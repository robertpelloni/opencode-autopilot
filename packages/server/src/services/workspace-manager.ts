import { EventEmitter } from 'events';
import { dbService } from './db.js';
import type { CouncilConfig, ConsensusMode, DevelopmentTask, CouncilDecision } from '@opencode-autopilot/shared';

/**
 * Workspace configuration and state
 */
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
  config: WorkspaceConfig;
  metadata: WorkspaceMetadata;
  status: WorkspaceStatus;
}

export interface WorkspaceConfig {
  defaultConsensusMode: ConsensusMode;
  defaultDebateRounds: number;
  consensusThreshold: number;
  supervisorTeam: string[];
  leadSupervisor?: string;
  autoSaveDebates: boolean;
  maxConcurrentDebates: number;
  budgetLimit?: number;
  tags: string[];
}

export interface WorkspaceMetadata {
  totalDebates: number;
  approvedDebates: number;
  rejectedDebates: number;
  totalTokensUsed: number;
  estimatedCost: number;
  lastDebateAt?: Date;
  averageDebateDuration: number;
}

export type WorkspaceStatus = 'active' | 'paused' | 'archived';

export interface WorkspaceDebate {
  workspaceId: string;
  debateId: string;
  task: DevelopmentTask;
  decision?: CouncilDecision;
  startedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface WorkspaceStats {
  workspaceId: string;
  period: { start: Date; end: Date };
  debates: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
  };
  performance: {
    avgDurationMs: number;
    avgConsensus: number;
    avgConfidence: number;
  };
  supervisors: {
    mostActive: string[];
    highestAgreement: string[];
  };
  tokens: {
    total: number;
    perDebate: number;
  };
  cost: {
    total: number;
    perDebate: number;
  };
}

export interface WorkspaceComparison {
  workspaces: string[];
  metrics: {
    workspaceId: string;
    name: string;
    debates: number;
    approvalRate: number;
    avgConsensus: number;
    avgDuration: number;
    totalCost: number;
  }[];
  ranking: {
    byApprovalRate: string[];
    byConsensus: string[];
    byEfficiency: string[];
  };
}

/**
 * WorkspaceManager - Manage multiple project workspaces with isolated configurations
 */
export class WorkspaceManagerService extends EventEmitter {
  private activeWorkspaceId: string | null = null;

  constructor() {
    super();
  }

  // ============ Workspace CRUD ============

  createWorkspace(
    name: string,
    path: string,
    config?: Partial<WorkspaceConfig>,
    description?: string
  ): Workspace {
    const id = this.generateId();
    const now = new Date();

    const workspace: Workspace = {
      id,
      name,
      description,
      path,
      createdAt: now,
      updatedAt: now,
      config: {
        defaultConsensusMode: config?.defaultConsensusMode ?? 'weighted',
        defaultDebateRounds: config?.defaultDebateRounds ?? 2,
        consensusThreshold: config?.consensusThreshold ?? 0.7,
        supervisorTeam: config?.supervisorTeam ?? [],
        leadSupervisor: config?.leadSupervisor,
        autoSaveDebates: config?.autoSaveDebates ?? true,
        maxConcurrentDebates: config?.maxConcurrentDebates ?? 3,
        budgetLimit: config?.budgetLimit,
        tags: config?.tags ?? [],
      },
      metadata: {
        totalDebates: 0,
        approvedDebates: 0,
        rejectedDebates: 0,
        totalTokensUsed: 0,
        estimatedCost: 0,
        averageDebateDuration: 0,
      },
      status: 'active',
    };

    const db = dbService.getDb();
    const stmt = db.prepare(`
      INSERT INTO workspaces (id, name, path, status, config, description, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      workspace.id,
      workspace.name,
      workspace.path,
      workspace.status,
      JSON.stringify({ config: workspace.config, metadata: workspace.metadata }),
      workspace.description || null,
      workspace.createdAt.getTime(),
      workspace.updatedAt.getTime()
    );

    this.emit('workspace:created', workspace);
    return workspace;
  }

  getWorkspace(id: string): Workspace | undefined {
    const db = dbService.getDb();
    const row = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    return this.mapRowToWorkspace(row);
  }

  getWorkspaceByPath(path: string): Workspace | undefined {
    const db = dbService.getDb();
    const row = db.prepare('SELECT * FROM workspaces WHERE path = ?').get(path) as any;
    if (!row) return undefined;
    return this.mapRowToWorkspace(row);
  }

  getAllWorkspaces(): Workspace[] {
    const db = dbService.getDb();
    const rows = db.prepare('SELECT * FROM workspaces').all() as any[];
    return rows.map(r => this.mapRowToWorkspace(r));
  }

  private mapRowToWorkspace(row: any): Workspace {
    const data = JSON.parse(row.config);
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      status: row.status,
      description: row.description,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      config: data.config,
      metadata: data.metadata,
    };
  }

  updateWorkspace(id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>): Workspace | undefined {
    const workspace = this.getWorkspace(id);
    if (!workspace) return undefined;

    const updated: Workspace = {
      ...workspace,
      ...updates,
      id: workspace.id,
      createdAt: workspace.createdAt,
      updatedAt: new Date(),
      config: updates.config ? { ...workspace.config, ...updates.config } : workspace.config,
      metadata: updates.metadata ? { ...workspace.metadata, ...updates.metadata } : workspace.metadata,
    };

    const db = dbService.getDb();
    const stmt = db.prepare(`
      UPDATE workspaces
      SET name = ?, path = ?, status = ?, config = ?, description = ?, updatedAt = ?
      WHERE id = ?
    `);

    stmt.run(
      updated.name,
      updated.path,
      updated.status,
      JSON.stringify({ config: updated.config, metadata: updated.metadata }),
      updated.description || null,
      updated.updatedAt.getTime(),
      updated.id
    );

    this.emit('workspace:updated', updated);
    return updated;
  }

  updateWorkspaceConfig(id: string, config: Partial<WorkspaceConfig>): Workspace | undefined {
    const workspace = this.getWorkspace(id);
    if (!workspace) return undefined;

    return this.updateWorkspace(id, {
      config: { ...workspace.config, ...config },
    });
  }

  deleteWorkspace(id: string): boolean {
    const workspace = this.getWorkspace(id);
    if (!workspace) return false;

    if (this.activeWorkspaceId === id) {
      this.activeWorkspaceId = null;
    }

    const db = dbService.getDb();
    db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);

    this.emit('workspace:deleted', { id, name: workspace.name });
    return true;
  }

  archiveWorkspace(id: string): Workspace | undefined {
    return this.updateWorkspace(id, { status: 'archived' });
  }

  // ============ Active Workspace ============

  setActiveWorkspace(id: string): boolean {
    const workspace = this.getWorkspace(id);
    if (!workspace || workspace.status !== 'active') return false;

    this.activeWorkspaceId = id;
    this.emit('workspace:activated', workspace);
    return true;
  }

  getActiveWorkspace(): Workspace | undefined {
    if (!this.activeWorkspaceId) return undefined;
    return this.getWorkspace(this.activeWorkspaceId);
  }

  clearActiveWorkspace(): void {
    this.activeWorkspaceId = null;
    this.emit('workspace:deactivated');
  }

  // ============ Debate Tracking (Simplified for now - using metadata) ============
  // Note: Full debate tracking would use the 'debates' table with a workspaceId column.
  // For now, we update metadata.

  startDebate(workspaceId: string, task: DevelopmentTask): WorkspaceDebate | undefined {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) return undefined;

    // TODO: Concurrent check needs querying debates table.
    // Assuming concurrent limit is high or checked elsewhere for MVP migration.

    const debate: WorkspaceDebate = {
      workspaceId,
      debateId: this.generateId(),
      task,
      startedAt: new Date(),
      status: 'in_progress',
    };

    this.emit('workspace:debate:started', debate);
    return debate;
  }

  completeDebate(
    workspaceId: string,
    debateId: string,
    decision: CouncilDecision,
    tokensUsed: number = 0,
    cost: number = 0
  ): WorkspaceDebate | undefined {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) return undefined;

    // Simulate completion
    const debate: WorkspaceDebate = {
      workspaceId,
      debateId,
      task: { id: 'unknown', description: 'unknown' }, // Lost context if not persisted fully in separate table
      decision,
      startedAt: new Date(),
      completedAt: new Date(),
      status: 'completed',
    };

    const totalDebates = workspace.metadata.totalDebates + 1;
    const duration = 0; // Unknown without persistence of start time
    const previousTotalDuration = workspace.metadata.averageDebateDuration * workspace.metadata.totalDebates;
      
    this.updateWorkspace(workspaceId, {
        metadata: {
          ...workspace.metadata,
          totalDebates,
          approvedDebates: workspace.metadata.approvedDebates + (decision.approved ? 1 : 0),
          rejectedDebates: workspace.metadata.rejectedDebates + (decision.approved ? 0 : 1),
          totalTokensUsed: workspace.metadata.totalTokensUsed + tokensUsed,
          estimatedCost: workspace.metadata.estimatedCost + cost,
          lastDebateAt: new Date(),
          averageDebateDuration: (previousTotalDuration + duration) / totalDebates,
        },
    });

    this.emit('workspace:debate:completed', debate);
    return debate;
  }

  failDebate(workspaceId: string, debateId: string, error: string): WorkspaceDebate | undefined {
    const debate: WorkspaceDebate = {
        workspaceId,
        debateId,
        task: { id: 'unknown', description: 'unknown' },
        startedAt: new Date(),
        completedAt: new Date(),
        status: 'failed',
    };
    this.emit('workspace:debate:failed', { debate, error });
    return debate;
  }

  // Simplified stubs for non-critical listing functions that relied on in-memory array
  getWorkspaceDebates(workspaceId: string, limit?: number): WorkspaceDebate[] {
    return [];
  }

  getActiveDebates(workspaceId: string): WorkspaceDebate[] {
    return [];
  }

  getAllActiveDebates(): WorkspaceDebate[] {
    return [];
  }

  // ============ Statistics & Analytics ============

  getWorkspaceStats(workspaceId: string, periodDays: number = 30): WorkspaceStats | undefined {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) return undefined;

    // Basic stats from metadata
    return {
      workspaceId,
      period: { start: new Date(), end: new Date() },
      debates: {
        total: workspace.metadata.totalDebates,
        approved: workspace.metadata.approvedDebates,
        rejected: workspace.metadata.rejectedDebates,
        pending: 0,
      },
      performance: {
        avgDurationMs: workspace.metadata.averageDebateDuration,
        avgConsensus: 0,
        avgConfidence: 0,
      },
      supervisors: {
        mostActive: [],
        highestAgreement: [],
      },
      tokens: {
        total: workspace.metadata.totalTokensUsed,
        perDebate: 0,
      },
      cost: {
        total: workspace.metadata.estimatedCost,
        perDebate: 0,
      },
    };
  }

  compareWorkspaces(workspaceIds: string[]): WorkspaceComparison {
    // Basic implementation
    return {
        workspaces: workspaceIds,
        metrics: [],
        ranking: { byApprovalRate: [], byConsensus: [], byEfficiency: [] }
    };
  }

  // ============ Bulk Operations ============

  pauseAllWorkspaces(): number {
    const db = dbService.getDb();
    const info = db.prepare("UPDATE workspaces SET status = 'paused' WHERE status = 'active'").run();
    this.emit('workspaces:paused_all', { count: info.changes });
    return info.changes;
  }

  resumeAllWorkspaces(): number {
    const db = dbService.getDb();
    const info = db.prepare("UPDATE workspaces SET status = 'active' WHERE status = 'paused'").run();
    this.emit('workspaces:resumed_all', { count: info.changes });
    return info.changes;
  }

  // ============ Config Templates ============

  cloneWorkspaceConfig(sourceId: string, targetId: string): boolean {
    const source = this.getWorkspace(sourceId);
    const target = this.getWorkspace(targetId);
    if (!source || !target) return false;

    this.updateWorkspaceConfig(targetId, { ...source.config });
    return true;
  }

  // ============ Helpers ============

  private generateId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============ Export/Import ============

  exportWorkspace(id: string): { workspace: Workspace; debates: WorkspaceDebate[] } | undefined {
    const workspace = this.getWorkspace(id);
    if (!workspace) return undefined;

    return {
      workspace,
      debates: [], // Not fetching deep debates for now
    };
  }

  importWorkspace(data: { workspace: Workspace; debates: WorkspaceDebate[] }): Workspace {
    const newId = this.generateId();
    const now = new Date();

    const imported: Workspace = {
      ...data.workspace,
      id: newId,
      name: `${data.workspace.name} (imported)`,
      createdAt: now,
      updatedAt: now,
    };

    const db = dbService.getDb();
    const stmt = db.prepare(`
      INSERT INTO workspaces (id, name, path, status, config, description, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      imported.id,
      imported.name,
      imported.path,
      imported.status,
      JSON.stringify({ config: imported.config, metadata: imported.metadata }),
      imported.description || null,
      imported.createdAt.getTime(),
      imported.updatedAt.getTime()
    );

    this.emit('workspace:imported', imported);
    return imported;
  }

  // ============ Cleanup ============

  clearAllWorkspaces(): void {
    const db = dbService.getDb();
    db.prepare('DELETE FROM workspaces').run();
    this.activeWorkspaceId = null;
    this.emit('workspaces:cleared');
  }
}

export const workspaceManager = new WorkspaceManagerService();
