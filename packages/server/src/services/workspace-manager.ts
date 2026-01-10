import { EventEmitter } from 'events';
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
  private workspaces: Map<string, Workspace> = new Map();
  private debates: Map<string, WorkspaceDebate[]> = new Map();
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

    this.workspaces.set(id, workspace);
    this.debates.set(id, []);
    this.emit('workspace:created', workspace);

    return workspace;
  }

  getWorkspace(id: string): Workspace | undefined {
    return this.workspaces.get(id);
  }

  getWorkspaceByPath(path: string): Workspace | undefined {
    for (const workspace of this.workspaces.values()) {
      if (workspace.path === path) {
        return workspace;
      }
    }
    return undefined;
  }

  getAllWorkspaces(): Workspace[] {
    return Array.from(this.workspaces.values());
  }

  getWorkspacesByStatus(status: WorkspaceStatus): Workspace[] {
    return this.getAllWorkspaces().filter(w => w.status === status);
  }

  getWorkspacesByTag(tag: string): Workspace[] {
    return this.getAllWorkspaces().filter(w => w.config.tags.includes(tag));
  }

  updateWorkspace(id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>): Workspace | undefined {
    const workspace = this.workspaces.get(id);
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

    this.workspaces.set(id, updated);
    this.emit('workspace:updated', updated);

    return updated;
  }

  updateWorkspaceConfig(id: string, config: Partial<WorkspaceConfig>): Workspace | undefined {
    const workspace = this.workspaces.get(id);
    if (!workspace) return undefined;

    return this.updateWorkspace(id, {
      config: { ...workspace.config, ...config },
    });
  }

  deleteWorkspace(id: string): boolean {
    const workspace = this.workspaces.get(id);
    if (!workspace) return false;

    if (this.activeWorkspaceId === id) {
      this.activeWorkspaceId = null;
    }

    this.workspaces.delete(id);
    this.debates.delete(id);
    this.emit('workspace:deleted', { id, name: workspace.name });

    return true;
  }

  archiveWorkspace(id: string): Workspace | undefined {
    return this.updateWorkspace(id, { status: 'archived' });
  }

  // ============ Active Workspace ============

  setActiveWorkspace(id: string): boolean {
    const workspace = this.workspaces.get(id);
    if (!workspace || workspace.status !== 'active') return false;

    this.activeWorkspaceId = id;
    this.emit('workspace:activated', workspace);

    return true;
  }

  getActiveWorkspace(): Workspace | undefined {
    if (!this.activeWorkspaceId) return undefined;
    return this.workspaces.get(this.activeWorkspaceId);
  }

  clearActiveWorkspace(): void {
    this.activeWorkspaceId = null;
    this.emit('workspace:deactivated');
  }

  // ============ Debate Tracking ============

  startDebate(workspaceId: string, task: DevelopmentTask): WorkspaceDebate | undefined {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return undefined;

    const workspaceDebates = this.debates.get(workspaceId) ?? [];
    const activeDebates = workspaceDebates.filter(d => d.status === 'in_progress');
    if (activeDebates.length >= workspace.config.maxConcurrentDebates) {
      this.emit('workspace:debate:limit_reached', { workspaceId, limit: workspace.config.maxConcurrentDebates });
      return undefined;
    }

    const debate: WorkspaceDebate = {
      workspaceId,
      debateId: this.generateId(),
      task,
      startedAt: new Date(),
      status: 'in_progress',
    };

    workspaceDebates.push(debate);
    this.debates.set(workspaceId, workspaceDebates);
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
    const workspaceDebates = this.debates.get(workspaceId);
    if (!workspaceDebates) return undefined;

    const debateIndex = workspaceDebates.findIndex(d => d.debateId === debateId);
    if (debateIndex === -1) return undefined;

    const debate = workspaceDebates[debateIndex];
    const completedAt = new Date();
    const duration = completedAt.getTime() - debate.startedAt.getTime();

    const updated: WorkspaceDebate = {
      ...debate,
      decision,
      completedAt,
      status: 'completed',
    };

    workspaceDebates[debateIndex] = updated;

    const workspace = this.workspaces.get(workspaceId);
    if (workspace) {
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
    }

    this.emit('workspace:debate:completed', updated);
    return updated;
  }

  failDebate(workspaceId: string, debateId: string, error: string): WorkspaceDebate | undefined {
    const workspaceDebates = this.debates.get(workspaceId);
    if (!workspaceDebates) return undefined;

    const debateIndex = workspaceDebates.findIndex(d => d.debateId === debateId);
    if (debateIndex === -1) return undefined;

    const updated: WorkspaceDebate = {
      ...workspaceDebates[debateIndex],
      completedAt: new Date(),
      status: 'failed',
    };

    workspaceDebates[debateIndex] = updated;
    this.emit('workspace:debate:failed', { debate: updated, error });

    return updated;
  }

  getWorkspaceDebates(workspaceId: string, limit?: number): WorkspaceDebate[] {
    const debates = this.debates.get(workspaceId) ?? [];
    const sorted = [...debates].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    return limit ? sorted.slice(0, limit) : sorted;
  }

  getActiveDebates(workspaceId: string): WorkspaceDebate[] {
    const debates = this.debates.get(workspaceId) ?? [];
    return debates.filter(d => d.status === 'in_progress');
  }

  getAllActiveDebates(): WorkspaceDebate[] {
    const active: WorkspaceDebate[] = [];
    for (const debates of this.debates.values()) {
      active.push(...debates.filter(d => d.status === 'in_progress'));
    }
    return active;
  }

  // ============ Statistics & Analytics ============

  getWorkspaceStats(workspaceId: string, periodDays: number = 30): WorkspaceStats | undefined {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return undefined;

    const debates = this.debates.get(workspaceId) ?? [];
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    const periodDebates = debates.filter(d => d.startedAt >= periodStart);
    const completedDebates = periodDebates.filter(d => d.status === 'completed' && d.decision);

    let totalDuration = 0;
    let totalConsensus = 0;
    let totalConfidence = 0;
    const supervisorActivity: Map<string, number> = new Map();
    const supervisorAgreement: Map<string, { agreed: number; total: number }> = new Map();

    for (const debate of completedDebates) {
      if (debate.completedAt && debate.decision) {
        totalDuration += debate.completedAt.getTime() - debate.startedAt.getTime();
        totalConsensus += debate.decision.consensus;
        
        for (const vote of debate.decision.votes) {
          supervisorActivity.set(vote.supervisor, (supervisorActivity.get(vote.supervisor) ?? 0) + 1);
          
          const agreement = supervisorAgreement.get(vote.supervisor) ?? { agreed: 0, total: 0 };
          agreement.total++;
          if (vote.approved === debate.decision.approved) {
            agreement.agreed++;
          }
          supervisorAgreement.set(vote.supervisor, agreement);
          
          totalConfidence += vote.confidence;
        }
      }
    }

    const totalVotes = completedDebates.reduce((sum, d) => sum + (d.decision?.votes.length ?? 0), 0);

    const sortedByActivity = Array.from(supervisorActivity.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    const sortedByAgreement = Array.from(supervisorAgreement.entries())
      .sort((a, b) => (b[1].agreed / b[1].total) - (a[1].agreed / a[1].total))
      .map(([name]) => name);

    return {
      workspaceId,
      period: { start: periodStart, end: now },
      debates: {
        total: periodDebates.length,
        approved: completedDebates.filter(d => d.decision?.approved).length,
        rejected: completedDebates.filter(d => d.decision && !d.decision.approved).length,
        pending: periodDebates.filter(d => d.status === 'in_progress' || d.status === 'pending').length,
      },
      performance: {
        avgDurationMs: completedDebates.length > 0 ? totalDuration / completedDebates.length : 0,
        avgConsensus: completedDebates.length > 0 ? totalConsensus / completedDebates.length : 0,
        avgConfidence: totalVotes > 0 ? totalConfidence / totalVotes : 0,
      },
      supervisors: {
        mostActive: sortedByActivity.slice(0, 5),
        highestAgreement: sortedByAgreement.slice(0, 5),
      },
      tokens: {
        total: workspace.metadata.totalTokensUsed,
        perDebate: workspace.metadata.totalDebates > 0 
          ? workspace.metadata.totalTokensUsed / workspace.metadata.totalDebates 
          : 0,
      },
      cost: {
        total: workspace.metadata.estimatedCost,
        perDebate: workspace.metadata.totalDebates > 0 
          ? workspace.metadata.estimatedCost / workspace.metadata.totalDebates 
          : 0,
      },
    };
  }

  compareWorkspaces(workspaceIds: string[]): WorkspaceComparison {
    const metrics: WorkspaceComparison['metrics'] = [];

    for (const id of workspaceIds) {
      const workspace = this.workspaces.get(id);
      if (!workspace) continue;

      const debates = this.debates.get(id) ?? [];
      const completedDebates = debates.filter(d => d.status === 'completed' && d.decision);

      let totalConsensus = 0;
      let totalDuration = 0;

      for (const debate of completedDebates) {
        if (debate.decision) {
          totalConsensus += debate.decision.consensus;
        }
        if (debate.completedAt) {
          totalDuration += debate.completedAt.getTime() - debate.startedAt.getTime();
        }
      }

      metrics.push({
        workspaceId: id,
        name: workspace.name,
        debates: workspace.metadata.totalDebates,
        approvalRate: workspace.metadata.totalDebates > 0 
          ? workspace.metadata.approvedDebates / workspace.metadata.totalDebates 
          : 0,
        avgConsensus: completedDebates.length > 0 ? totalConsensus / completedDebates.length : 0,
        avgDuration: completedDebates.length > 0 ? totalDuration / completedDebates.length : 0,
        totalCost: workspace.metadata.estimatedCost,
      });
    }

    const byApprovalRate = [...metrics]
      .sort((a, b) => b.approvalRate - a.approvalRate)
      .map(m => m.workspaceId);

    const byConsensus = [...metrics]
      .sort((a, b) => b.avgConsensus - a.avgConsensus)
      .map(m => m.workspaceId);

    const byEfficiency = [...metrics]
      .sort((a, b) => {
        const effA = a.totalCost > 0 ? a.debates / a.totalCost : a.debates;
        const effB = b.totalCost > 0 ? b.debates / b.totalCost : b.debates;
        return effB - effA;
      })
      .map(m => m.workspaceId);

    return {
      workspaces: workspaceIds,
      metrics,
      ranking: {
        byApprovalRate,
        byConsensus,
        byEfficiency,
      },
    };
  }

  // ============ Bulk Operations ============

  pauseAllWorkspaces(): number {
    let count = 0;
    for (const workspace of this.workspaces.values()) {
      if (workspace.status === 'active') {
        this.updateWorkspace(workspace.id, { status: 'paused' });
        count++;
      }
    }
    this.emit('workspaces:paused_all', { count });
    return count;
  }

  resumeAllWorkspaces(): number {
    let count = 0;
    for (const workspace of this.workspaces.values()) {
      if (workspace.status === 'paused') {
        this.updateWorkspace(workspace.id, { status: 'active' });
        count++;
      }
    }
    this.emit('workspaces:resumed_all', { count });
    return count;
  }

  // ============ Config Templates ============

  applyConfigToWorkspace(workspaceId: string, templateConfig: Partial<WorkspaceConfig>): Workspace | undefined {
    return this.updateWorkspaceConfig(workspaceId, templateConfig);
  }

  cloneWorkspaceConfig(sourceId: string, targetId: string): boolean {
    const source = this.workspaces.get(sourceId);
    const target = this.workspaces.get(targetId);
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
    const workspace = this.workspaces.get(id);
    if (!workspace) return undefined;

    return {
      workspace,
      debates: this.debates.get(id) ?? [],
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

    this.workspaces.set(newId, imported);
    
    const importedDebates = data.debates.map(d => ({
      ...d,
      workspaceId: newId,
      debateId: this.generateId(),
    }));
    this.debates.set(newId, importedDebates);

    this.emit('workspace:imported', imported);
    return imported;
  }

  // ============ Cleanup ============

  clearAllWorkspaces(): void {
    this.workspaces.clear();
    this.debates.clear();
    this.activeWorkspaceId = null;
    this.emit('workspaces:cleared');
  }
}

export const workspaceManager = new WorkspaceManagerService();
