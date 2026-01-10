import type { Session, LogEntry, DevelopmentTask, Guidance, CLIType, SessionHealth } from '@opencode-autopilot/shared';
import { loadConfig } from './config.js';
import { wsManager } from './ws-manager.js';
import { sessionPersistence } from './session-persistence.js';
import { cliRegistry } from './cli-registry.js';
import { healthMonitor } from './health-monitor.js';
import { logRotation } from './log-rotation.js';
import { environmentManager } from './environment-manager.js';

interface ManagedSession {
  session: Session;
  process: { pid: number; kill: () => void; exited: Promise<number> } | null;
  port: number;
  cliType: CLIType;
  restartCount: number;
  lastRestartAt?: number;
}

interface StartSessionOptions {
  tags?: string[];
  templateName?: string;
  workingDirectory?: string;
  cliType?: CLIType;
  env?: Record<string, string>;
}

interface BulkStartResult {
  sessions: Session[];
  failed: Array<{ index: number; error: string }>;
}

class SessionManager {
  private sessions: Map<string, ManagedSession> = new Map();
  private basePort: number;
  private maxSessions: number;
  private pollInterval: number;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private defaultCLI: CLIType;

  constructor() {
    const config = loadConfig();
    this.basePort = config.sessions.basePort;
    this.maxSessions = config.sessions.maxSessions;
    this.pollInterval = config.sessions.pollInterval;
    this.defaultCLI = config.sessions.defaultCLI;

    healthMonitor.setRestartCallback(this.handleSessionRestart.bind(this));
    
    logRotation.configure(config.logRotation);
    healthMonitor.configure(config.healthCheck, config.crashRecovery);
  }

  private async handleSessionRestart(sessionId: string, reason: string): Promise<boolean> {
    const managed = this.sessions.get(sessionId);
    if (!managed) return false;

    this.log(sessionId, 'warn', `Attempting restart due to: ${reason}`);

    try {
      if (managed.process) {
        managed.process.kill();
        await Promise.race([
          managed.process.exited,
          new Promise(r => setTimeout(r, 3000)),
        ]);
      }

      const serveCmd = cliRegistry.getServeCommand(managed.cliType, managed.port);
      if (!serveCmd) {
        this.log(sessionId, 'error', `CLI ${managed.cliType} not available for restart`);
        return false;
      }

      const env = environmentManager.getSessionEnvironment(sessionId) || {};

      const proc = Bun.spawn([serveCmd.command, ...serveCmd.args], {
        stdout: 'pipe',
        stderr: 'pipe',
        env,
        cwd: managed.session.workingDirectory,
      });

      managed.process = {
        pid: proc.pid,
        kill: () => proc.kill(),
        exited: proc.exited,
      };

      managed.restartCount++;
      managed.lastRestartAt = Date.now();

      this.streamOutput(sessionId, proc.stdout, 'info');
      this.streamOutput(sessionId, proc.stderr, 'warn');

      this.setupProcessHandlers(sessionId, proc);

      await this.waitForReady(managed.port, 15000, managed.cliType);
      managed.session.status = 'running';
      healthMonitor.resetHealth(sessionId);
      
      this.log(sessionId, 'info', `Session restarted successfully (attempt ${managed.restartCount})`);
      wsManager.notifySessionUpdate(managed.session);

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.log(sessionId, 'error', `Restart failed: ${msg}`);
      return false;
    }
  }

  private getNextPort(): number {
    const usedPorts = new Set([...this.sessions.values()].map(s => s.port));
    for (let i = 0; i < this.maxSessions; i++) {
      const port = this.basePort + i;
      if (!usedPorts.has(port)) return port;
    }
    throw new Error(`Max sessions (${this.maxSessions}) reached`);
  }

  private log(sessionId: string, level: 'info' | 'warn' | 'error' | 'debug', message: string): void {
    const entry: LogEntry = { timestamp: Date.now(), level, message, source: 'session-manager' };
    
    const managed = this.sessions.get(sessionId);
    if (managed) {
      managed.session.lastActivity = Date.now();
    }

    logRotation.addLog(sessionId, entry);
    wsManager.notifyLog(sessionId, entry);
    wsManager.notifySessionUpdate(managed?.session || { id: sessionId } as Session);
  }

  async startSession(task?: DevelopmentTask, options?: StartSessionOptions): Promise<Session> {
    const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const port = this.getNextPort();
    const cliType = options?.cliType || this.defaultCLI;

    const session: Session = {
      id,
      status: 'starting',
      startedAt: Date.now(),
      lastActivity: Date.now(),
      currentTask: task?.description,
      logs: [],
      port,
      workingDirectory: options?.workingDirectory || process.cwd(),
      templateName: options?.templateName,
      tags: options?.tags,
    };

    const managed: ManagedSession = { 
      session, 
      process: null, 
      port, 
      cliType,
      restartCount: 0,
    };
    this.sessions.set(id, managed);

    logRotation.registerSession(id);

    const env = environmentManager.createSessionEnvironment(id, cliType, {
      variables: options?.env,
    });

    sessionPersistence.persistSession({
      id,
      status: 'starting',
      startedAt: session.startedAt,
      lastActivity: session.lastActivity,
      currentTask: session.currentTask,
      port,
      workingDirectory: session.workingDirectory,
      templateName: session.templateName,
      tags: session.tags,
      metadata: { cliType },
    });

    this.log(id, 'info', `Starting ${cliType} session on port ${port}`);
    wsManager.notifySessionUpdate(session);

    try {
      const serveCmd = cliRegistry.getServeCommand(cliType, port);
      if (!serveCmd) {
        throw new Error(`CLI tool "${cliType}" is not available. Run CLI detection first.`);
      }

      const proc = Bun.spawn([serveCmd.command, ...serveCmd.args], {
        stdout: 'pipe',
        stderr: 'pipe',
        env,
        cwd: session.workingDirectory,
      });

      managed.process = {
        pid: proc.pid,
        kill: () => proc.kill(),
        exited: proc.exited,
      };

      this.streamOutput(id, proc.stdout, 'info');
      this.streamOutput(id, proc.stderr, 'warn');

      this.setupProcessHandlers(id, proc);

      await this.waitForReady(port, 15000, cliType);
      session.status = 'running';
      
      const healthEndpoint = cliRegistry.getHealthEndpoint(cliType);
      healthMonitor.registerSession(id, port, healthEndpoint);
      
      this.log(id, 'info', 'Session ready');
      wsManager.notifySessionUpdate(session);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.log(id, 'error', `Failed to start: ${msg}`);
      session.status = 'error';
      wsManager.notifySessionUpdate(session);
    }

    return session;
  }

  private setupProcessHandlers(sessionId: string, proc: { exited: Promise<number>; pid: number }): void {
    proc.exited.then((code) => {
      const managed = this.sessions.get(sessionId);
      if (!managed) return;

      if (code === 0) {
        this.log(sessionId, 'info', `Process exited normally (code ${code})`);
        managed.session.status = 'completed';
      } else {
        this.log(sessionId, 'error', `Process crashed (code ${code})`);
        managed.session.status = 'error';
        healthMonitor.markCrashed(sessionId, `Exit code ${code}`);
      }
      
      sessionPersistence.updateSessionStatus(sessionId, managed.session.status, Date.now());
      wsManager.notifySessionUpdate(managed.session);
    });
  }

  private async streamOutput(
    sessionId: string,
    stream: ReadableStream<Uint8Array> | null,
    level: 'info' | 'warn'
  ): Promise<void> {
    if (!stream) return;
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value).trim();
        if (text) {
          for (const line of text.split('\n')) {
            if (line.trim()) {
              this.log(sessionId, level, line.trim());
            }
          }
        }
      }
    } catch {
      // Stream ended
    }
  }

  private async waitForReady(port: number, timeout: number, cliType: CLIType): Promise<void> {
    const start = Date.now();
    const healthEndpoint = cliRegistry.getHealthEndpoint(cliType);
    
    while (Date.now() - start < timeout) {
      try {
        const res = await fetch(`http://localhost:${port}${healthEndpoint}`);
        if (res.ok) return;
      } catch {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    throw new Error(`Timeout waiting for ${cliType} on port ${port}`);
  }

  async stopSession(id: string): Promise<void> {
    const managed = this.sessions.get(id);
    if (!managed) throw new Error(`Session ${id} not found`);

    this.log(id, 'info', 'Stopping session');
    
    healthMonitor.unregisterSession(id);

    if (managed.process) {
      managed.process.kill();
      await Promise.race([
        managed.process.exited,
        new Promise(r => setTimeout(r, 5000)),
      ]);
    }

    managed.session.status = 'stopped';
    sessionPersistence.updateSessionStatus(id, 'stopped', Date.now());
    wsManager.notifySessionUpdate(managed.session);
  }

  async resumeSession(id: string): Promise<Session> {
    const persisted = sessionPersistence.getPersistedSessions().find(s => s.id === id);
    if (!persisted) throw new Error(`No persisted session found with id: ${id}`);

    const port = persisted.port || this.getNextPort();
    const cliType = (persisted.metadata?.cliType as CLIType) || this.defaultCLI;

    const session: Session = {
      id: persisted.id,
      status: 'starting',
      startedAt: persisted.startedAt,
      lastActivity: Date.now(),
      currentTask: persisted.currentTask,
      logs: [],
      port,
      workingDirectory: persisted.workingDirectory,
      templateName: persisted.templateName,
      tags: persisted.tags,
    };

    const managed: ManagedSession = { 
      session, 
      process: null, 
      port, 
      cliType,
      restartCount: 0,
    };
    this.sessions.set(id, managed);

    logRotation.registerSession(id);
    environmentManager.createSessionEnvironment(id, cliType);

    this.log(id, 'info', `Resuming ${cliType} session on port ${port}`);

    try {
      const serveCmd = cliRegistry.getServeCommand(cliType, port);
      if (!serveCmd) {
        throw new Error(`CLI tool "${cliType}" is not available`);
      }

      const env = environmentManager.getSessionEnvironment(id) || {};

      const proc = Bun.spawn([serveCmd.command, ...serveCmd.args], {
        stdout: 'pipe',
        stderr: 'pipe',
        env,
        cwd: session.workingDirectory,
      });

      managed.process = {
        pid: proc.pid,
        kill: () => proc.kill(),
        exited: proc.exited,
      };

      this.streamOutput(id, proc.stdout, 'info');
      this.streamOutput(id, proc.stderr, 'warn');

      this.setupProcessHandlers(id, proc);

      await this.waitForReady(port, 15000, cliType);
      session.status = 'running';
      
      const healthEndpoint = cliRegistry.getHealthEndpoint(cliType);
      healthMonitor.registerSession(id, port, healthEndpoint);
      
      sessionPersistence.updateSessionStatus(id, 'running', Date.now());
      this.log(id, 'info', 'Session resumed successfully');
      wsManager.notifySessionUpdate(session);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.log(id, 'error', `Failed to resume: ${msg}`);
      session.status = 'error';
      sessionPersistence.updateSessionStatus(id, 'error', Date.now());
      wsManager.notifySessionUpdate(session);
    }

    return session;
  }

  async startBulkSessions(count: number, options?: { tags?: string[]; templateName?: string; cliType?: CLIType; staggerDelayMs?: number }): Promise<BulkStartResult> {
    const result: BulkStartResult = { sessions: [], failed: [] };
    const delay = options?.staggerDelayMs ?? 500;

    for (let i = 0; i < count; i++) {
      try {
        const session = await this.startSession(undefined, {
          tags: options?.tags,
          templateName: options?.templateName,
          cliType: options?.cliType,
        });
        result.sessions.push(session);
        
        if (i < count - 1 && delay > 0) {
          await new Promise(r => setTimeout(r, delay));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.failed.push({ index: i, error: msg });
      }
    }

    return result;
  }

  async stopAllSessions(): Promise<{ stopped: number; failed: number }> {
    let stopped = 0;
    let failed = 0;

    for (const id of this.sessions.keys()) {
      try {
        await this.stopSession(id);
        stopped++;
      } catch {
        failed++;
      }
    }

    return { stopped, failed };
  }

  async resumeAllSessions(): Promise<BulkStartResult> {
    const result: BulkStartResult = { sessions: [], failed: [] };
    const resumable = sessionPersistence.getResumableSessions();

    for (let i = 0; i < resumable.length; i++) {
      try {
        const session = await this.resumeSession(resumable[i].id);
        result.sessions.push(session);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.failed.push({ index: i, error: msg });
      }
    }

    return result;
  }

  async autoResumeOnStart(): Promise<void> {
    if (!sessionPersistence.isAutoResumeEnabled()) {
      console.log('[SessionManager] Auto-resume disabled');
      return;
    }

    const resumable = sessionPersistence.getResumableSessions();
    if (resumable.length === 0) {
      console.log('[SessionManager] No sessions to auto-resume');
      return;
    }

    console.log(`[SessionManager] Auto-resuming ${resumable.length} sessions...`);
    const result = await this.resumeAllSessions();
    console.log(`[SessionManager] Auto-resume complete: ${result.sessions.length} resumed, ${result.failed.length} failed`);
  }

  deleteSession(id: string): void {
    healthMonitor.unregisterSession(id);
    logRotation.unregisterSession(id);
    environmentManager.deleteSessionEnvironment(id);
    this.sessions.delete(id);
    sessionPersistence.removeSession(id);
  }

  updateSessionTags(id: string, tags: string[]): Session | undefined {
    const managed = this.sessions.get(id);
    if (!managed) return undefined;
    
    managed.session.tags = tags;
    wsManager.notifySessionUpdate(managed.session);
    return managed.session;
  }

  addSessionTag(id: string, tag: string): Session | undefined {
    const managed = this.sessions.get(id);
    if (!managed) return undefined;
    
    if (!managed.session.tags) {
      managed.session.tags = [];
    }
    if (!managed.session.tags.includes(tag)) {
      managed.session.tags.push(tag);
      wsManager.notifySessionUpdate(managed.session);
    }
    return managed.session;
  }

  removeSessionTag(id: string, tag: string): Session | undefined {
    const managed = this.sessions.get(id);
    if (!managed) return undefined;
    
    if (managed.session.tags) {
      managed.session.tags = managed.session.tags.filter(t => t !== tag);
      wsManager.notifySessionUpdate(managed.session);
    }
    return managed.session;
  }

  getSessionsByTag(tag: string): Session[] {
    return this.getAllSessions().filter(s => s.tags?.includes(tag));
  }

  getSessionsByTemplate(templateName: string): Session[] {
    return this.getAllSessions().filter(s => s.templateName === templateName);
  }

  getSessionsByCLI(cliType: CLIType): Session[] {
    return [...this.sessions.values()]
      .filter(m => m.cliType === cliType)
      .map(m => m.session);
  }

  getPersistedSessions() {
    return sessionPersistence.getPersistedSessions();
  }

  getSessionHealth(id: string): SessionHealth | undefined {
    return healthMonitor.getSessionHealth(id);
  }

  getAllSessionHealth(): Map<string, SessionHealth> {
    return healthMonitor.getAllHealth();
  }

  getSessionCLIType(id: string): CLIType | undefined {
    return this.sessions.get(id)?.cliType;
  }

  async sendGuidance(id: string, guidance: Guidance): Promise<void> {
    const managed = this.sessions.get(id);
    if (!managed || managed.session.status !== 'running') {
      throw new Error(`Session ${id} not running`);
    }

    this.log(id, 'info', `Sending guidance: ${guidance.approved ? 'APPROVED' : 'REJECTED'}`);

    try {
      await fetch(`http://localhost:${managed.port}/guidance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(guidance),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.log(id, 'error', `Failed to send guidance: ${msg}`);
      throw err;
    }
  }

  getSession(id: string): Session | undefined {
    const managed = this.sessions.get(id);
    if (!managed) return undefined;
    
    managed.session.logs = logRotation.getLogs(id);
    return managed.session;
  }

  getAllSessions(): Session[] {
    return [...this.sessions.values()].map(m => {
      m.session.logs = logRotation.getLogs(m.session.id);
      return m.session;
    });
  }

  getActiveSessions(): Session[] {
    return this.getAllSessions().filter(s => s.status === 'running');
  }

  getSessionStats(): {
    total: number;
    running: number;
    stopped: number;
    error: number;
    byCLI: Record<CLIType, number>;
  } {
    const sessions = this.getAllSessions();
    const byCLI: Record<string, number> = {};
    
    for (const managed of this.sessions.values()) {
      byCLI[managed.cliType] = (byCLI[managed.cliType] || 0) + 1;
    }

    return {
      total: sessions.length,
      running: sessions.filter(s => s.status === 'running').length,
      stopped: sessions.filter(s => s.status === 'stopped').length,
      error: sessions.filter(s => s.status === 'error').length,
      byCLI: byCLI as Record<CLIType, number>,
    };
  }

  startMonitoring(): void {
    healthMonitor.start();
    logRotation.start();
    console.log('[SessionManager] Health monitoring and log rotation started');
  }

  stopMonitoring(): void {
    healthMonitor.stop();
    logRotation.stop();
  }

  startPolling(): void {
    if (this.pollTimer) return;
    this.startMonitoring();
  }

  stopPolling(): void {
    this.stopMonitoring();
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async cleanup(): Promise<void> {
    this.stopPolling();
    for (const id of this.sessions.keys()) {
      try {
        await this.stopSession(id);
      } catch {
        // ignore cleanup errors
      }
    }
    this.sessions.clear();
  }
}

export const sessionManager = new SessionManager();
