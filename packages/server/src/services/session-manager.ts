import type { Session, LogEntry, DevelopmentTask, Guidance } from '@opencode-autopilot/shared';
import { loadConfig } from './config.js';
import { wsManager } from './ws-manager.js';

interface ManagedSession {
  session: Session;
  process: { pid: number; kill: () => void; exited: Promise<number> } | null;
  port: number;
}

class SessionManager {
  private sessions: Map<string, ManagedSession> = new Map();
  private basePort: number;
  private maxSessions: number;
  private pollInterval: number;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const config = loadConfig();
    this.basePort = config.sessions.basePort;
    this.maxSessions = config.sessions.maxSessions;
    this.pollInterval = config.sessions.pollInterval;
  }

  private getNextPort(): number {
    const usedPorts = new Set([...this.sessions.values()].map(s => s.port));
    for (let i = 0; i < this.maxSessions; i++) {
      const port = this.basePort + i;
      if (!usedPorts.has(port)) return port;
    }
    throw new Error(`Max sessions (${this.maxSessions}) reached`);
  }

  private log(sessionId: string, level: 'info' | 'warn' | 'error', message: string): void {
    const entry: LogEntry = { timestamp: Date.now(), level, message, source: 'session-manager' };
    
    const managed = this.sessions.get(sessionId);
    if (managed) {
      managed.session.logs.push(entry);
      managed.session.lastActivity = Date.now();
    }

    wsManager.notifyLog(sessionId, entry);
    wsManager.notifySessionUpdate(managed?.session || { id: sessionId } as Session);
  }

  async startSession(task?: DevelopmentTask): Promise<Session> {
    const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const port = this.getNextPort();

    const session: Session = {
      id,
      status: 'starting',
      startedAt: Date.now(),
      lastActivity: Date.now(),
      currentTask: task?.description,
      logs: [],
    };

    const managed: ManagedSession = { session, process: null, port };
    this.sessions.set(id, managed);

    this.log(id, 'info', `Starting session on port ${port}`);
    wsManager.notifySessionUpdate(session);

    try {
      const proc = Bun.spawn(['opencode', 'serve', '--port', String(port)], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      managed.process = {
        pid: proc.pid,
        kill: () => proc.kill(),
        exited: proc.exited,
      };

      this.streamOutput(id, proc.stdout, 'info');
      this.streamOutput(id, proc.stderr, 'warn');

      proc.exited.then((code) => {
        this.log(id, 'info', `Process exited with code ${code}`);
        session.status = code === 0 ? 'completed' : 'error';
        wsManager.notifySessionUpdate(session);
      });

      await this.waitForReady(port, 10000);
      session.status = 'running';
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
        if (text) this.log(sessionId, level, text);
      }
    } catch {
      // Stream ended
    }
  }

  private async waitForReady(port: number, timeout: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const res = await fetch(`http://localhost:${port}/health`);
        if (res.ok) return;
      } catch {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    throw new Error(`Timeout waiting for port ${port}`);
  }

  async stopSession(id: string): Promise<void> {
    const managed = this.sessions.get(id);
    if (!managed) throw new Error(`Session ${id} not found`);

    this.log(id, 'info', 'Stopping session');
    
    if (managed.process) {
      managed.process.kill();
      await Promise.race([
        managed.process.exited,
        new Promise(r => setTimeout(r, 5000)),
      ]);
    }

    managed.session.status = 'stopped';
    wsManager.notifySessionUpdate(managed.session);
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
    return this.sessions.get(id)?.session;
  }

  getAllSessions(): Session[] {
    return [...this.sessions.values()].map(m => m.session);
  }

  getActiveSessions(): Session[] {
    return this.getAllSessions().filter(s => s.status === 'running');
  }

  startPolling(): void {
    if (this.pollTimer) return;

    this.pollTimer = setInterval(async () => {
      for (const managed of this.sessions.values()) {
        if (managed.session.status !== 'running') continue;

        try {
          const res = await fetch(`http://localhost:${managed.port}/status`);
          if (!res.ok) {
            managed.session.status = 'error';
            wsManager.notifySessionUpdate(managed.session);
          }
        } catch {
          this.log(managed.session.id, 'warn', 'Health check failed');
        }
      }
    }, this.pollInterval);
  }

  stopPolling(): void {
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
