import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import { createOpencodeClient } from '@opencode-ai/sdk';
import { Council } from './council.js';
import { OpenAISupervisor } from './supervisors/OpenAISupervisor.js';
import { AnthropicSupervisor } from './supervisors/AnthropicSupervisor.js';
import { GoogleSupervisor } from './supervisors/GoogleSupervisor.js';
import { DeepSeekSupervisor } from './supervisors/DeepSeekSupervisor.js';
import { MockSupervisor } from './supervisors/MockSupervisor.js';
import type { CouncilConfig, SupervisorConfig, DevelopmentContext } from './types.js';
import * as fs from 'fs';

interface Session {
    id: string;
    path: string;
    port: number;
    status: 'stopped' | 'starting' | 'running' | 'error';
    process: ChildProcess | null;
    client: any | null; // OpenCodeClient type is complex to import directly sometimes, using any for simplicity in manager
    council: Council | null;
    logs: string[];
    lastCheck: number;
    branch?: string;
    commit?: string;
    remote?: string;
}

const execAsync = promisify(exec);

export class SessionManager {
    private sessions: Map<string, Session> = new Map();
    private nextPort = 4096;

    constructor() {
        // Load existing sessions from disk if needed? For now, in-memory.
    }

    public getSessions() {
        return Array.from(this.sessions.values()).map(s => ({
            id: s.id,
            path: s.path,
            port: s.port,
            status: s.status,
            logs: s.logs.slice(-50), // Return last 50 logs
            lastCheck: s.lastCheck,
            branch: s.branch,
            commit: s.commit,
            remote: s.remote
        }));
    }

    public getLogs(id: string) {
        const session = this.sessions.get(id);
        return session ? session.logs : [];
    }

    private async getGitInfo(repoPath: string) {
        try {
            const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath });
            const { stdout: commit } = await execAsync('git rev-parse HEAD', { cwd: repoPath });
            const { stdout: remote } = await execAsync('git config --get remote.origin.url', { cwd: repoPath }).catch(() => ({ stdout: '' }));
            
            return {
                branch: branch.trim(),
                commit: commit.trim(),
                remote: remote.trim()
            };
        } catch (e) {
            return { branch: 'unknown', commit: 'unknown', remote: '' };
        }
    }

    private async checkPortAvailable(port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const server = require('net').createServer();
            server.once('error', (err: any) => {
                if (err.code === 'EADDRINUSE') {
                    resolve(false);
                } else {
                    resolve(false); // Other error, assume unsafe
                }
            });
            server.once('listening', () => {
                server.close();
                resolve(true);
            });
            server.listen(port);
        });
    }

    public async addSession(repoPath: string) {
        const id = Math.random().toString(36).substring(7);
        
        // Find next available port
        let port = this.nextPort;
        while (!(await this.checkPortAvailable(port))) {
            port++;
        }
        this.nextPort = port + 1; // Update global counter for next time
        
        // Attempt to get git info, but don't fail if not a git repo
        const gitInfo = await this.getGitInfo(repoPath);

        const session: Session = {
            id,
            path: repoPath,
            port,
            status: 'stopped',
            process: null,
            client: null,
            council: null,
            logs: [],
            lastCheck: 0,
            ...gitInfo
        };

        this.sessions.set(id, session);
        this.log(id, `Session created for ${repoPath} on port ${port}`);
        return {
            id: session.id,
            path: session.path,
            port: session.port,
            status: session.status,
            logs: session.logs,
            lastCheck: session.lastCheck,
            ...gitInfo
        };
    }

    public async removeSession(id: string) {
        await this.stopSession(id);
        this.sessions.delete(id);
    }

    public async startSession(id: string) {
        const session = this.sessions.get(id);
        if (!session) throw new Error("Session not found");
        if (session.status === 'running') return;

        // Ensure port rotation logic is executed every time
        this.log(id, `Checking port ${session.port} availability...`);
        
        let newPort = this.nextPort;
        if (session.port && !(await this.checkPortAvailable(session.port))) {
            this.log(id, `Port ${session.port} is busy. Rotating...`);
            while (!(await this.checkPortAvailable(newPort))) {
                newPort++;
            }
            this.nextPort = newPort + 1;
            session.port = newPort;
        } else if (!session.port) {
            // If for some reason port is missing
             while (!(await this.checkPortAvailable(newPort))) {
                newPort++;
            }
            this.nextPort = newPort + 1;
            session.port = newPort;
        } else {
            // Even if the current port *looks* available, Windows might lie about TIME_WAIT
            // So we force rotation if it was previously used
            this.log(id, `Forcing port rotation from ${session.port} to be safe...`);
            while (!(await this.checkPortAvailable(newPort))) {
                newPort++;
            }
            this.nextPort = newPort + 1;
            session.port = newPort;
        }
        
        this.log(id, `Assigned new port: ${session.port}`);

        session.status = 'starting';
        this.log(id, "Starting OpenCode...");

        try {
            // We use 'cmd' on Windows to ensure we catch .cmd/.bat files
            const cmd = process.platform === 'win32' ? 'opencode.cmd' : 'opencode';
            
            this.log(id, `Spawning: ${cmd} start "${session.path}" --port ${session.port}`);

            const child = spawn(cmd, ['start', session.path, '--port', session.port.toString()], {
                env: { ...process.env, PORT: session.port.toString() },
                shell: true
            });

            session.process = child;

            child.stdout?.on('data', (data) => {
                const msg = data.toString().trim();
                if (msg) this.log(id, `[OpenCode]: ${msg}`);
            });

            child.stderr?.on('data', (data) => {
                const msg = data.toString().trim();
                if (msg) this.log(id, `[OpenCode Err]: ${msg}`);
            });

            child.on('error', (err) => {
                this.log(id, `Failed to start OpenCode: ${err.message}`);
                session.status = 'error';
            });

            child.on('close', (code) => {
                this.log(id, `OpenCode exited with code ${code}`);
                session.status = 'stopped';
                session.process = null;
                session.client = null;
            });

            // Wait for it to be ready
            // We'll try to connect in the main loop or here.
            // Let's give it a few seconds then mark as running.
            setTimeout(() => {
                if (session.status === 'starting') {
                    session.status = 'running';
                    this.initializeClient(session);
                }
            }, 5000);

        } catch (e: any) {
            session.status = 'error';
            this.log(id, `Error spawning process: ${e.message}`);
            throw e;
        }
    }

    public async stopSession(id: string) {
        const session = this.sessions.get(id);
        if (!session) return;

        if (session.process) {
            this.log(id, "Stopping OpenCode...");
            
            // Create a promise that resolves when the process closes
            const closePromise = new Promise<void>((resolve) => {
                if (!session.process) { resolve(); return; }
                
                const timeout = setTimeout(() => {
                    this.log(id, "Process kill timed out, forcing...");
                    resolve();
                }, 5000);

                session.process.on('close', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });

            // Kill the process
            if (process.platform === 'win32') {
                try {
                    // Use taskkill to kill the process tree (/T) forcefully (/F)
                    exec(`taskkill /pid ${session.process.pid} /T /F`);
                } catch (e) {
                    // Fallback or ignore if already dead
                    session.process.kill();
                }
            } else {
                session.process.kill();
            }

            await closePromise;
            session.process = null;
        }
        
        session.status = 'stopped';
        session.client = null;
    }

    private async initializeClient(session: Session) {
        try {
            this.log(session.id, `Connecting to OpenCode on port ${session.port}...`);
            session.client = createOpencodeClient({
                baseUrl: `http://localhost:${session.port}`,
            });

            // Verify connection
            await session.client.project.list();
            this.log(session.id, "Connected to OpenCode SDK");

            // Initialize Council
            // We need a way to pass user settings here. For now, we'll use a default config 
            // but in a real app, this would come from a database or the frontend request.
            // Let's assume settings are passed via a global store or similar for this prototype.
            // TODO: Accept config in startSession or updateSession
            this.initializeCouncil(session);

        } catch (e: any) {
            this.log(session.id, `Failed to connect SDK: ${e.message}`);
            // We don't set status to error, we just retry later in the loop
        }
    }

    public async updateSessionConfig(id: string, config: any) {
        const session = this.sessions.get(id);
        if (!session) throw new Error("Session not found");
        
        // Re-initialize council with new settings
        this.initializeCouncil(session, config);
        this.log(id, "Council configuration updated.");
    }

    private initializeCouncil(session: Session, userSettings?: any) {
        const supervisors: SupervisorConfig[] = [];
        
        // If userSettings provided, use those
        if (userSettings && userSettings.smartPilot) {
             supervisors.push({
                 name: "Primary-Supervisor",
                 provider: userSettings.provider,
                 apiKey: userSettings.apiKey,
                 modelName: userSettings.model
             });
        } else {
            // Fallback to env vars (legacy)
            if (process.env.OPENAI_API_KEY) supervisors.push({ name: "GPT-Architect", provider: "openai", modelName: "gpt-4o" });
            if (process.env.ANTHROPIC_API_KEY) supervisors.push({ name: "Claude-Reviewer", provider: "anthropic", modelName: "claude-3-5-sonnet-20241022" });
            if (process.env.GOOGLE_API_KEY) supervisors.push({ name: "Gemini-Strategist", provider: "google", modelName: "gemini-pro" });
            if (process.env.DEEPSEEK_API_KEY) supervisors.push({ name: "DeepSeek-Analyst", provider: "deepseek", modelName: "deepseek-chat" });
        }
        
        if (supervisors.length === 0) {
            supervisors.push({ name: "Mock-Critic", provider: "custom", modelName: "mock-v1" });
        }

        const config: CouncilConfig = {
            supervisors,
            debateRounds: userSettings?.debate ? 2 : 0, // Enable debate if requested
            autoContinue: false,
            enabled: userSettings?.enabled ?? true,
            smartPilot: userSettings?.smartPilot ?? false,
            fallbackMessages: userSettings?.messages ? userSettings.messages.split('\n') : []
        };

        const council = new Council(config);
        
        config.supervisors.forEach(conf => {
            switch (conf.provider) {
            case 'openai': council.registerSupervisor(new OpenAISupervisor(conf)); break;
            case 'anthropic': council.registerSupervisor(new AnthropicSupervisor(conf)); break;
            case 'google': council.registerSupervisor(new GoogleSupervisor(conf)); break;
            case 'deepseek': council.registerSupervisor(new DeepSeekSupervisor(conf)); break;
            default: council.registerSupervisor(new MockSupervisor(conf)); break;
            }
        });

        council.init().then(() => {
            this.log(session.id, `Council initialized (SmartPilot: ${config.smartPilot ? 'ON' : 'OFF'}, Debate: ${config.debateRounds > 0 ? 'ON' : 'OFF'})`);
            session.council = council;
        }).catch(err => {
            this.log(session.id, `Council init failed: ${err.message}`);
        });
    }

    public init() {
        // Main Monitoring Loop
        setInterval(async () => {
            for (const session of this.sessions.values()) {
                if (session.status !== 'running') continue;
                
                // Update last check
                session.lastCheck = Date.now();

                if (!session.client || !session.council) {
                    // Try to re-init if missing
                    if (!session.client) await this.initializeClient(session);
                    continue;
                }

                try {
                    await this.processSessionLoop(session);
                } catch (e: any) {
                    this.log(session.id, `Loop error: ${e.message}`);
                }
            }
        }, 10000); // Check every 10 seconds
    }

    private async processSessionLoop(session: Session) {
        const client = session.client;
        if (!client) return;

        try {
            // 1. Get Active Session from OpenCode
            const sessionsList = await client.session.list();
            if (!sessionsList.data || sessionsList.data.length === 0) {
                // No active session in OpenCode
                return;
            }
            
            // Pick the first one
            const activeSession = sessionsList.data[0];
            
            // 2. Check Messages
            const messages = await client.session.messages({ path: { id: activeSession.id } });
            const history = messages.data || [];

            if (history.length === 0) return;

            const lastMsg = history[history.length - 1];

            // 3. Check if AI finished
            if (lastMsg?.info.role === 'assistant') {
                this.log(session.id, "AI finished turn. Council deliberating...");

                // Gather Context
                const lastUserMsg = [...history].reverse().find(m => m.info.role === 'user');
                const currentGoal = lastUserMsg 
                    ? (lastUserMsg.parts.find((p: any) => p.type === 'text') as any)?.text || "Unknown Goal"
                    : "Review project state";

                const context: DevelopmentContext = {
                    currentGoal,
                    recentChanges: ["Session history analyzed"],
                    fileContext: {}, 
                    projectState: "Active Development"
                };

                const council = session.council;
                if (!council) return;
                
                const guidance = await council.discuss(context);

                this.log(session.id, `Council Guidance: ${guidance.approved ? 'Approved' : 'Rejected'}`);

                // Fallback Logic
                let guidanceText = '';

                // If Autopilot is NOT enabled, skip everything
                const councilConfig = (council as any).config; 
                if (councilConfig.enabled === false) {
                    return;
                }

                // If Smart Pilot is OFF, use fallback messages
                if (!councilConfig.smartPilot || !guidance.approved) {
                    if (councilConfig.fallbackMessages && councilConfig.fallbackMessages.length > 0) {
                        // Pick a random message
                        const msg = councilConfig.fallbackMessages[Math.floor(Math.random() * councilConfig.fallbackMessages.length)];
                        guidanceText = msg;
                        this.log(session.id, "Using fallback message.");
                    }
                } 
                
                // If Smart Pilot is ON and we have guidance
                if (councilConfig.smartPilot && guidanceText === '') {
                    guidanceText = `
    ## 🏛️ Council Guidance
    **Approved:** ${guidance.approved ? '✅ Yes' : '❌ No'}

    **Feedback:**
    ${guidance.feedback}

    **Suggested Next Steps:**
    ${guidance.suggestedNextSteps.map((s: string) => `- ${s}`).join('\n')}

    *Please proceed with the next step.*
                `.trim();
                }

                // If we still have nothing (e.g. smart pilot off and no fallback messages), skip sending
                if (!guidanceText) {
                    this.log(session.id, "No guidance generated (SmartPilot off + no fallbacks). Skipping.");
                    // Wait to avoid double-processing
                    await new Promise(r => setTimeout(r, 10000));
                    return; 
                }

                await client.session.prompt({
                    path: { id: activeSession.id },
                    body: {
                        parts: [{ type: "text", text: guidanceText }]
                    }
                });
                
                this.log(session.id, "Guidance sent to OpenCode.");
                
                // Wait to avoid double-processing
                // In a real app, we'd track the last processed message ID
                await new Promise(r => setTimeout(r, 10000));
            }
        } catch (e: any) {
             // Handle fetch failures specifically gracefully (server might be down/restarting)
             if (e.message && e.message.includes('fetch failed')) {
                 this.log(session.id, "Connection to OpenCode lost. Will retry...");
                 // Mark client as potentially stale or just wait for next loop
             } else {
                 throw e; // Re-throw other errors
             }
        }
    }

    private log(id: string, message: string) {
        const session = this.sessions.get(id);
        if (session) {
            const timestamp = new Date().toLocaleTimeString();
            session.logs.push(`[${timestamp}] ${message}`);
            // Keep logs trimmed
            if (session.logs.length > 1000) session.logs.shift();
        }
        console.log(`[Session ${id}] ${message}`);
    }
}
