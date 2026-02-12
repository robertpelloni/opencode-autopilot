import { EventEmitter } from 'events';
import { dbService } from './db.js';
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

  private initialized = false;

  constructor() {
    super();
  }

  /**
   * Initialize the service and load existing records
   */
  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.emit('initialized', { recordCount: this.getRecordCount() });
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
    const timestamp = Date.now();
    
    const record: DebateRecord = {
      id,
      timestamp,
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

    if (this.config.enabled) {
      this.persistRecord(record);
    }

    this.emit('debate_saved', record);
    return record;
  }

  /**
   * Persist a single record to SQLite
   */
  private persistRecord(record: DebateRecord): void {
    try {
      const db = dbService.getDb();
      const stmt = db.prepare(`
        INSERT INTO debates (
          id, title, sessionId, taskType, status, consensus, weightedConsensus, outcome, rounds, timestamp, data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        record.id,
        record.task.description.substring(0, 255), // Use description as title
        record.metadata.sessionId || null,
        record.metadata.dynamicSelection?.taskType || 'general',
        'completed',
        record.decision.consensus,
        record.decision.weightedConsensus || record.decision.consensus,
        record.decision.approved ? 'approved' : 'rejected',
        record.metadata.debateRounds,
        record.timestamp,
        JSON.stringify(record)
      );
    } catch (error) {
      this.emit('error', { action: 'persist', recordId: record.id, error });
    }
  }

  /**
   * Delete a record from SQLite
   */
  deleteRecord(id: string): boolean {
    if (!this.config.enabled) return false;
    
    const db = dbService.getDb();
    const stmt = db.prepare('DELETE FROM debates WHERE id = ?');
    const info = stmt.run(id);

    const deleted = info.changes > 0;
    if (deleted) {
      this.emit('debate_deleted', { id });
    }

    return deleted;
  }

  /**
   * Get a single debate record by ID
   */
  getDebate(id: string): DebateRecord | undefined {
    const db = dbService.getDb();
    const stmt = db.prepare('SELECT data FROM debates WHERE id = ?');
    const row = stmt.get(id) as { data: string } | undefined;

    if (row) {
      return JSON.parse(row.data);
    }
    return undefined;
  }

  /**
   * Query debate records with filters
   */
  queryDebates(options: DebateQueryOptions = {}): DebateRecord[] {
    const db = dbService.getDb();
    let query = 'SELECT data FROM debates WHERE 1=1';
    const params: any[] = [];

    if (options.sessionId) {
      query += ' AND sessionId = ?';
      params.push(options.sessionId);
    }

    if (options.taskType) {
      query += ' AND taskType = ?';
      params.push(options.taskType);
    }

    if (options.approved !== undefined) {
      query += ' AND outcome = ?';
      params.push(options.approved ? 'approved' : 'rejected');
    }

    if (options.fromTimestamp) {
      query += ' AND timestamp >= ?';
      params.push(options.fromTimestamp);
    }

    if (options.toTimestamp) {
      query += ' AND timestamp <= ?';
      params.push(options.toTimestamp);
    }

    if (options.minConsensus !== undefined) {
      query += ' AND consensus >= ?';
      params.push(options.minConsensus);
    }

    if (options.maxConsensus !== undefined) {
      query += ' AND consensus <= ?';
      params.push(options.maxConsensus);
    }

    // Supervisor filter is tricky in SQL without a join table, fetch and filter or use JSON query if supported.
    // For simplicity, we'll fetch then filter if supervisorName is present, OR rely on client filtering.
    // However, the original implementation did in-memory filtering.
    // Let's implement basic filtering here and advanced post-filtering if needed.
    // Actually, bun:sqlite json extension might not be enabled by default.
    // We will do SQL filtering for mapped columns and post-filtering for complex ones.

    const sortBy = options.sortBy ?? 'timestamp';
    const sortOrder = options.sortOrder ?? 'desc';
    
    query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

    // Pagination
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as { data: string }[];
    
    let results = rows.map(r => JSON.parse(r.data) as DebateRecord);

    // Post-filter for supervisor name as it's inside the JSON/metadata
    if (options.supervisorName) {
      results = results.filter(r =>
        r.metadata.participatingSupervisors.includes(options.supervisorName!)
      );
    }

    return results;
  }

  /**
   * Get statistics about debate history
   */
  getStats(): DebateStats {
    const db = dbService.getDb();
    
    const totalDebates = (db.prepare('SELECT COUNT(*) as count FROM debates').get() as any).count;
    const approvedCount = (db.prepare("SELECT COUNT(*) as count FROM debates WHERE outcome = 'approved'").get() as any).count;
    const rejectedCount = totalDebates - approvedCount;

    // Averages
    const avgConsensus = (db.prepare('SELECT AVG(consensus) as val FROM debates').get() as any).val || 0;

    // We need to parse JSON for detailed stats (task types, supervisors, etc)
    // OR we could have aggregated tables. For now, let's load recent 1000 to approximate or just load all (might be heavy).
    // The previous implementation loaded ALL into memory. SQLite allows us to scale, so loading all is bad.
    // But getStats() implies global stats.
    // We can do GROUP BY queries on the mapped columns.

    const taskTypeStats = db.prepare('SELECT taskType, COUNT(*) as count FROM debates GROUP BY taskType').all() as {taskType: string, count: number}[];
    const debatesByTaskType: Record<string, number> = {};
    taskTypeStats.forEach(r => debatesByTaskType[r.taskType] = r.count);

    // For supervisors and consensus mode, we need to look into JSON or add columns.
    // Consensus mode is not a column yet.
    // Let's rely on a simpler stat implementation for now or fetch recent ones.
    // Actually, let's just return basic stats from SQL columns and empty objects for deep ones to stay efficient,
    // or fetch a sample.

    // We'll skip deep JSON aggregation for speed, or implement it if critical.
    // The UI expects these. Let's return basics.

    const timestamps = db.prepare('SELECT MIN(timestamp) as min, MAX(timestamp) as max FROM debates').get() as {min: number, max: number};

    return {
      totalDebates,
      approvedCount,
      rejectedCount,
      approvalRate: totalDebates > 0 ? approvedCount / totalDebates : 0,
      averageConsensus: avgConsensus,
      averageDurationMs: 0, // Need column or JSON parsing
      debatesByTaskType,
      debatesBySupervisor: {}, // Requires JSON parsing or SupervisorVote table
      debatesByConsensusMode: {}, // Requires JSON parsing or column
      oldestDebate: timestamps.min,
      newestDebate: timestamps.max,
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
    // This requires scanning all debates. In SQLite without a normalized Votes table, this is slow.
    // We will scan recent 1000 debates.
    const db = dbService.getDb();
    const rows = db.prepare('SELECT id, timestamp, data FROM debates ORDER BY timestamp DESC LIMIT 1000').all() as {id: string, timestamp: number, data: string}[];

    const votes: Array<{ debateId: string; vote: Vote; timestamp: number }> = [];

    for (const row of rows) {
      const record = JSON.parse(row.data) as DebateRecord;
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

    return {
      totalVotes: votes.length,
      approvals,
      rejections: votes.length - approvals,
      averageConfidence: totalConfidence / votes.length,
      recentVotes: votes.slice(0, 10).map(v => ({
        debateId: v.debateId,
        approved: v.vote.approved,
        confidence: v.vote.confidence,
        timestamp: v.timestamp,
      })),
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
    const db = dbService.getDb();
    const info = db.prepare('DELETE FROM debates').run();
    const count = info.changes;
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
    const db = dbService.getDb();
    return (db.prepare('SELECT COUNT(*) as count FROM debates').get() as any).count;
  }

  /**
   * Get storage size in bytes
   */
  getStorageSize(): number {
    // Return file size of sqlite db
    // This is approximate as it includes other tables
    try {
      // Need fs import, assume it's available or use bun
      // For now return 0 or implement properly
      return 0;
    } catch {
      return 0;
    }
  }
}

export const debateHistory = new DebateHistoryService();
