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

  getWorkspacesByStatus(status: WorkspaceStatus): Workspace[] {
    const db = dbService.getDb();
    const rows = db.prepare('SELECT * FROM workspaces WHERE status = ?').all(status) as any[];
    return rows.map(r => this.mapRowToWorkspace(r));
  }

  getWorkspacesByTag(tag: string): Workspace[] {
    // SQLite JSON query would be better, but for compatibility/simplicity, filtering in memory after fetch active/all
    return this.getAllWorkspaces().filter(w => w.config.tags && w.config.tags.includes(tag));
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

    const db = dbService.getDb();

    // Check concurrent limit
    const activeCount = (db.prepare("SELECT COUNT(*) as count FROM debates WHERE workspaceId = ? AND status = 'in_progress'").get(workspaceId) as any).count;

    if (activeCount >= workspace.config.maxConcurrentDebates) {
      this.emit('workspace:debate:limit_reached', { workspaceId, limit: workspace.config.maxConcurrentDebates });
      return undefined;
    }

    const debateId = this.generateId();
    const startedAt = new Date();

    const debate: WorkspaceDebate = {
      workspaceId,
      debateId,
      task,
      startedAt,
      status: 'in_progress',
    };

    // Insert into debates table (using partial data since it's in progress)
    db.prepare(`
      INSERT INTO debates (id, title, workspaceId, taskType, status, timestamp, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      debateId,
      task.description.substring(0, 255),
      workspaceId,
      'general',
      'in_progress',
      startedAt.getTime(),
      JSON.stringify(debate)
    );

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

    const db = dbService.getDb();
    const row = db.prepare('SELECT data FROM debates WHERE id = ?').get(debateId) as { data: string };

    if (!row) return undefined;

    const existingDebate = JSON.parse(row.data) as WorkspaceDebate;
    const completedAt = new Date();
    const duration = completedAt.getTime() - new Date(existingDebate.startedAt).getTime();

    const updatedDebate: WorkspaceDebate = {
      ...existingDebate,
      decision,
      completedAt,
      status: 'completed',
    };

    // Update debate record
    db.prepare(`
      UPDATE debates
      SET status = 'completed',
          outcome = ?,
          consensus = ?,
          weightedConsensus = ?,
          data = ?
      WHERE id = ?
    `).run(
      decision.approved ? 'approved' : 'rejected',
      decision.consensus,
      decision.weightedConsensus,
      JSON.stringify(updatedDebate),
      debateId
    );

    // Update workspace metadata
    const totalDebates = workspace.metadata.totalDebates + 1;
    const previousTotalDuration = workspace.metadata.averageDebateDuration * workspace.metadata.totalDebates;
      
    this.updateWorkspace(workspaceId, {
        metadata: {
          ...workspace.metadata,
          totalDebates,
          approvedDebates: workspace.metadata.approvedDebates + (decision.approved ? 1 : 0),
          rejectedDebates: workspace.metadata.rejectedDebates + (decision.approved ? 0 : 1),
          totalTokensUsed: workspace.metadata.totalTokensUsed + tokensUsed,
          estimatedCost: workspace.metadata.estimatedCost + cost,
          lastDebateAt: completedAt,
          averageDebateDuration: (previousTotalDuration + duration) / totalDebates,
        },
    });

    this.emit('workspace:debate:completed', updatedDebate);
    return updatedDebate;
  }

  failDebate(workspaceId: string, debateId: string, error: string): WorkspaceDebate | undefined {
    const db = dbService.getDb();
    const row = db.prepare('SELECT data FROM debates WHERE id = ?').get(debateId) as { data: string };
    if (!row) return undefined;

    const existingDebate = JSON.parse(row.data) as WorkspaceDebate;
    const updatedDebate: WorkspaceDebate = {
      ...existingDebate,
      completedAt: new Date(),
      status: 'failed',
    };

    db.prepare("UPDATE debates SET status = 'failed', data = ? WHERE id = ?").run(
      JSON.stringify(updatedDebate),
      debateId
    );

    this.emit('workspace:debate:failed', { debate: updatedDebate, error });
    return updatedDebate;
  }

  getWorkspaceDebates(workspaceId: string, limit: number = 50): WorkspaceDebate[] {
    const db = dbService.getDb();
    const rows = db.prepare(`
      SELECT data FROM debates
      WHERE workspaceId = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(workspaceId, limit) as { data: string }[];

    return rows.map(r => JSON.parse(r.data));
  }

  getActiveDebates(workspaceId: string): WorkspaceDebate[] {
    const db = dbService.getDb();
    const rows = db.prepare(`
      SELECT data FROM debates
      WHERE workspaceId = ? AND status = 'in_progress'
    `).all(workspaceId) as { data: string }[];

    return rows.map(r => JSON.parse(r.data));
  }

  getAllActiveDebates(): WorkspaceDebate[] {
    const db = dbService.getDb();
    const rows = db.prepare(`
      SELECT data FROM debates
      WHERE status = 'in_progress'
    `).all() as { data: string }[];

    return rows.map(r => JSON.parse(r.data));
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
    const metrics = workspaceIds.map(id => {
      const stats = this.getWorkspaceStats(id);
      const workspace = this.getWorkspace(id);
      if (!stats || !workspace) return null;

      return {
        workspaceId: id,
        name: workspace.name,
        debates: stats.debates.total,
        approvalRate: stats.debates.total > 0 ? stats.debates.approved / stats.debates.total : 0,
        avgConsensus: stats.performance.avgConsensus,
        avgDuration: stats.performance.avgDurationMs,
        totalCost: stats.cost.total,
      };
    }).filter((m): m is NonNullable<typeof m> => m !== null);

    const byApprovalRate = [...metrics].sort((a, b) => b.approvalRate - a.approvalRate).map(m => m.workspaceId);
    const byConsensus = [...metrics].sort((a, b) => b.avgConsensus - a.avgConsensus).map(m => m.workspaceId);
    const byEfficiency = [...metrics].sort((a, b) => a.totalCost - b.totalCost).map(m => m.workspaceId); // Lower cost is better

    return {
        workspaces: workspaceIds,
        metrics,
        ranking: { byApprovalRate, byConsensus, byEfficiency }
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

    const debates = this.getWorkspaceDebates(id, 1000);

    return {
      workspace,
      debates,
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
    // Also clear debates associated with workspaces
    db.prepare('DELETE FROM debates WHERE workspaceId IS NOT NULL').run();
    db.prepare('DELETE FROM workspaces').run();
    this.activeWorkspaceId = null;
    this.emit('workspaces:cleared');
  }
}

export const workspaceManager = new WorkspaceManagerService();
