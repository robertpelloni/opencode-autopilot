import { EventEmitter } from 'events';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import type { CouncilDecision, DevelopmentTask, Vote, ConsensusMode, TaskType } from '@opencode-autopilot/shared';

/**
 * A complete record of a council debate
 */
export interface DebateRecord {
  id: string;
  timestamp: number;
  task: DevelopmentTask;
  decision: CouncilDecision;
  metadata: DebateMetadata;
}

/**
 * Metadata about the debate context
 */
export interface DebateMetadata {
  sessionId?: string;
  debateRounds: number;
  consensusMode: ConsensusMode;
  leadSupervisor?: string;
  dynamicSelection?: {
    enabled: boolean;
    taskType?: TaskType;
    confidence?: number;
  };
  durationMs: number;
  supervisorCount: number;
  participatingSupervisors: string[];
}

/**
 * Query options for searching debate history
 */
export interface DebateQueryOptions {
  sessionId?: string;
  taskType?: TaskType;
  approved?: boolean;
  supervisorName?: string;
  fromTimestamp?: number;
  toTimestamp?: number;
  minConsensus?: number;
  maxConsensus?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'consensus' | 'duration';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Statistics about debate history
 */
export interface DebateStats {
  totalDebates: number;
  approvedCount: number;
  rejectedCount: number;
  approvalRate: number;
  averageConsensus: number;
  averageDurationMs: number;
  debatesByTaskType: Record<string, number>;
  debatesBySupervisor: Record<string, number>;
  debatesByConsensusMode: Record<string, number>;
  oldestDebate?: number;
  newestDebate?: number;
}

/**
 * Configuration for debate history persistence
 */
export interface DebateHistoryConfig {
  enabled: boolean;
  storageDir: string;
  maxRecords: number;
  autoSave: boolean;
  retentionDays: number;
}

/**
 * Service for persisting and querying council debate history
 */
export class DebateHistoryService extends EventEmitter {
  private config: DebateHistoryConfig = {
    enabled: true,
    storageDir: './data/debate-history',
    maxRecords: 1000,
    autoSave: true,
    retentionDays: 90,
  };

  private records: Map<string, DebateRecord> = new Map();
  private initialized = false;

  constructor() {
    super();
  }

  /**
   * Initialize the service and load existing records
   */
  initialize(): void {
    if (this.initialized) return;

    if (this.config.enabled) {
      this.ensureStorageDir();
      this.loadAllRecords();
      this.pruneOldRecords();
    }

    this.initialized = true;
    this.emit('initialized', { recordCount: this.records.size });
  }

  /**
   * Ensure storage directory exists
   */
  private ensureStorageDir(): void {
    if (!existsSync(this.config.storageDir)) {
      mkdirSync(this.config.storageDir, { recursive: true });
    }
  }

  /**
   * Load all records from storage
   */
  private loadAllRecords(): void {
    try {
      const files = readdirSync(this.config.storageDir).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        try {
          const filePath = join(this.config.storageDir, file);
          const content = readFileSync(filePath, 'utf-8');
          const record: DebateRecord = JSON.parse(content);
          this.records.set(record.id, record);
        } catch {
        }
      }
    } catch {
    }
  }

  /**
   * Prune records older than retention period
   */
  private pruneOldRecords(): void {
    const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    const toDelete: string[] = [];

    for (const [id, record] of this.records) {
      if (record.timestamp < cutoffTime) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.deleteRecord(id);
    }

    if (this.records.size > this.config.maxRecords) {
      const sorted = Array.from(this.records.values())
        .sort((a, b) => a.timestamp - b.timestamp);
      
      const excess = sorted.slice(0, this.records.size - this.config.maxRecords);
      for (const record of excess) {
        this.deleteRecord(record.id);
      }
    }

    if (toDelete.length > 0) {
      this.emit('pruned', { count: toDelete.length });
    }
  }

  /**
   * Generate a unique ID for a debate record
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `debate_${timestamp}_${random}`;
  }

  /**
   * Save a debate record
   */
  saveDebate(
    task: DevelopmentTask,
    decision: CouncilDecision,
    metadata: Partial<DebateMetadata>
  ): DebateRecord {
    const id = this.generateId();
    
    const record: DebateRecord = {
      id,
      timestamp: Date.now(),
      task,
      decision,
      metadata: {
        sessionId: metadata.sessionId,
        debateRounds: metadata.debateRounds ?? 2,
        consensusMode: metadata.consensusMode ?? 'weighted',
        leadSupervisor: metadata.leadSupervisor,
        dynamicSelection: metadata.dynamicSelection,
        durationMs: metadata.durationMs ?? 0,
        supervisorCount: decision.votes.length,
        participatingSupervisors: decision.votes.map(v => v.supervisor),
      },
    };

    this.records.set(id, record);

    if (this.config.autoSave && this.config.enabled) {
      this.persistRecord(record);
    }

    this.emit('debate_saved', record);
    
    if (this.records.size > this.config.maxRecords) {
      this.pruneOldRecords();
    }

    return record;
  }

  /**
   * Persist a single record to disk
   */
  private persistRecord(record: DebateRecord): void {
    try {
      this.ensureStorageDir();
      const filePath = join(this.config.storageDir, `${record.id}.json`);
      writeFileSync(filePath, JSON.stringify(record, null, 2));
    } catch (error) {
      this.emit('error', { action: 'persist', recordId: record.id, error });
    }
  }

  /**
   * Delete a record from memory and disk
   */
  deleteRecord(id: string): boolean {
    const existed = this.records.delete(id);
    
    if (existed && this.config.enabled) {
      try {
        const filePath = join(this.config.storageDir, `${id}.json`);
        if (existsSync(filePath)) {
          unlinkSync(filePath);
        }
      } catch {
      }
    }

    if (existed) {
      this.emit('debate_deleted', { id });
    }

    return existed;
  }

  /**
   * Get a single debate record by ID
   */
  getDebate(id: string): DebateRecord | undefined {
    return this.records.get(id);
  }

  /**
   * Query debate records with filters
   */
  queryDebates(options: DebateQueryOptions = {}): DebateRecord[] {
    let results = Array.from(this.records.values());

    if (options.sessionId) {
      results = results.filter(r => r.metadata.sessionId === options.sessionId);
    }

    if (options.taskType) {
      results = results.filter(r => r.metadata.dynamicSelection?.taskType === options.taskType);
    }

    if (options.approved !== undefined) {
      results = results.filter(r => r.decision.approved === options.approved);
    }

    if (options.supervisorName) {
      results = results.filter(r => 
        r.metadata.participatingSupervisors.includes(options.supervisorName!)
      );
    }

    if (options.fromTimestamp) {
      results = results.filter(r => r.timestamp >= options.fromTimestamp!);
    }

    if (options.toTimestamp) {
      results = results.filter(r => r.timestamp <= options.toTimestamp!);
    }

    if (options.minConsensus !== undefined) {
      results = results.filter(r => r.decision.consensus >= options.minConsensus!);
    }

    if (options.maxConsensus !== undefined) {
      results = results.filter(r => r.decision.consensus <= options.maxConsensus!);
    }

    const sortBy = options.sortBy ?? 'timestamp';
    const sortOrder = options.sortOrder ?? 'desc';
    
    results.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'timestamp':
          comparison = a.timestamp - b.timestamp;
          break;
        case 'consensus':
          comparison = a.decision.consensus - b.decision.consensus;
          break;
        case 'duration':
          comparison = a.metadata.durationMs - b.metadata.durationMs;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    const offset = options.offset ?? 0;
    const limit = options.limit ?? 50;
    
    return results.slice(offset, offset + limit);
  }

  /**
   * Get statistics about debate history
   */
  getStats(): DebateStats {
    const records = Array.from(this.records.values());
    
    if (records.length === 0) {
      return {
        totalDebates: 0,
        approvedCount: 0,
        rejectedCount: 0,
        approvalRate: 0,
        averageConsensus: 0,
        averageDurationMs: 0,
        debatesByTaskType: {},
        debatesBySupervisor: {},
        debatesByConsensusMode: {},
      };
    }

    const approvedCount = records.filter(r => r.decision.approved).length;
    const rejectedCount = records.length - approvedCount;

    const totalConsensus = records.reduce((sum, r) => sum + r.decision.consensus, 0);
    const totalDuration = records.reduce((sum, r) => sum + r.metadata.durationMs, 0);

    const debatesByTaskType: Record<string, number> = {};
    for (const record of records) {
      const taskType = record.metadata.dynamicSelection?.taskType ?? 'general';
      debatesByTaskType[taskType] = (debatesByTaskType[taskType] ?? 0) + 1;
    }

    const debatesBySupervisor: Record<string, number> = {};
    for (const record of records) {
      for (const supervisor of record.metadata.participatingSupervisors) {
        debatesBySupervisor[supervisor] = (debatesBySupervisor[supervisor] ?? 0) + 1;
      }
    }

    const debatesByConsensusMode: Record<string, number> = {};
    for (const record of records) {
      const mode = record.metadata.consensusMode;
      debatesByConsensusMode[mode] = (debatesByConsensusMode[mode] ?? 0) + 1;
    }

    const timestamps = records.map(r => r.timestamp);
    const oldestDebate = Math.min(...timestamps);
    const newestDebate = Math.max(...timestamps);

    return {
      totalDebates: records.length,
      approvedCount,
      rejectedCount,
      approvalRate: approvedCount / records.length,
      averageConsensus: totalConsensus / records.length,
      averageDurationMs: totalDuration / records.length,
      debatesByTaskType,
      debatesBySupervisor,
      debatesByConsensusMode,
      oldestDebate,
      newestDebate,
    };
  }

  /**
   * Get vote patterns for a specific supervisor
   */
  getSupervisorVoteHistory(supervisorName: string): {
    totalVotes: number;
    approvals: number;
    rejections: number;
    averageConfidence: number;
    recentVotes: Array<{ debateId: string; approved: boolean; confidence: number; timestamp: number }>;
  } {
    const votes: Array<{ debateId: string; vote: Vote; timestamp: number }> = [];

    for (const record of this.records.values()) {
      const vote = record.decision.votes.find(v => v.supervisor === supervisorName);
      if (vote) {
        votes.push({ debateId: record.id, vote, timestamp: record.timestamp });
      }
    }

    if (votes.length === 0) {
      return {
        totalVotes: 0,
        approvals: 0,
        rejections: 0,
        averageConfidence: 0,
        recentVotes: [],
      };
    }

    const approvals = votes.filter(v => v.vote.approved).length;
    const totalConfidence = votes.reduce((sum, v) => sum + v.vote.confidence, 0);

    votes.sort((a, b) => b.timestamp - a.timestamp);
    const recentVotes = votes.slice(0, 10).map(v => ({
      debateId: v.debateId,
      approved: v.vote.approved,
      confidence: v.vote.confidence,
      timestamp: v.timestamp,
    }));

    return {
      totalVotes: votes.length,
      approvals,
      rejections: votes.length - approvals,
      averageConfidence: totalConfidence / votes.length,
      recentVotes,
    };
  }

  /**
   * Export debate history to JSON
   */
  exportToJson(options: DebateQueryOptions = {}): string {
    const records = this.queryDebates({ ...options, limit: options.limit ?? 10000 });
    return JSON.stringify(records, null, 2);
  }

  /**
   * Export debate history to CSV
   */
  exportToCsv(options: DebateQueryOptions = {}): string {
    const records = this.queryDebates({ ...options, limit: options.limit ?? 10000 });
    
    const headers = [
      'id',
      'timestamp',
      'task_id',
      'task_description',
      'approved',
      'consensus',
      'weighted_consensus',
      'consensus_mode',
      'supervisor_count',
      'participating_supervisors',
      'duration_ms',
      'session_id',
      'task_type',
    ];

    const rows = records.map(r => [
      r.id,
      new Date(r.timestamp).toISOString(),
      r.task.id,
      `"${r.task.description.replace(/"/g, '""')}"`,
      r.decision.approved,
      r.decision.consensus.toFixed(3),
      (r.decision.weightedConsensus ?? r.decision.consensus).toFixed(3),
      r.metadata.consensusMode,
      r.metadata.supervisorCount,
      `"${r.metadata.participatingSupervisors.join(', ')}"`,
      r.metadata.durationMs,
      r.metadata.sessionId ?? '',
      r.metadata.dynamicSelection?.taskType ?? 'general',
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Clear all debate history
   */
  clearAll(): number {
    const count = this.records.size;
    
    if (this.config.enabled) {
      try {
        const files = readdirSync(this.config.storageDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          try {
            unlinkSync(join(this.config.storageDir, file));
          } catch {
          }
        }
      } catch {
      }
    }

    this.records.clear();
    this.emit('cleared', { count });
    
    return count;
  }

  /**
   * Get current configuration
   */
  getConfig(): DebateHistoryConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<DebateHistoryConfig>): DebateHistoryConfig {
    this.config = { ...this.config, ...updates };
    
    if (this.config.enabled && !this.initialized) {
      this.initialize();
    }

    this.emit('config_updated', this.config);
    return this.getConfig();
  }

  /**
   * Check if service is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get total record count
   */
  getRecordCount(): number {
    return this.records.size;
  }

  /**
   * Get storage size in bytes
   */
  getStorageSize(): number {
    if (!this.config.enabled) return 0;

    try {
      const files = readdirSync(this.config.storageDir).filter(f => f.endsWith('.json'));
      let totalSize = 0;
      
      for (const file of files) {
        try {
          const stat = statSync(join(this.config.storageDir, file));
          totalSize += stat.size;
        } catch {
        }
      }
      
      return totalSize;
    } catch {
      return 0;
    }
  }
}

export const debateHistory = new DebateHistoryService();
