import { Database } from 'bun:sqlite';
import path from 'path';
import fs from 'fs';

class DatabaseService {
  private db: Database;
  private dbPath: string;

  constructor() {
    const isTest = process.env.NODE_ENV === 'test';
    if (isTest) {
      this.dbPath = ':memory:';
    } else {
      const dataDir = path.resolve(process.cwd(), '../../.autopilot');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      this.dbPath = path.join(dataDir, 'autopilot.sqlite');
    }
    this.db = new Database(this.dbPath, { create: true });
    this.init();
  }

  private init() {
    // Enable WAL mode for better concurrency
    this.db.exec('PRAGMA journal_mode = WAL;');

    this.createTables();
  }

  private createTables() {
    // Debates Table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS debates (
        id TEXT PRIMARY KEY,
        title TEXT,
        sessionId TEXT,
        taskType TEXT,
        status TEXT,
        consensus REAL,
        weightedConsensus REAL,
        outcome TEXT, -- 'approved', 'rejected', 'deadlock'
        rounds INTEGER,
        timestamp INTEGER,
        data JSON -- Full debate object including messages and votes for now
      );
    `);

    // Workspaces Table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT,
        path TEXT,
        status TEXT,
        config JSON,
        description TEXT,
        createdAt INTEGER,
        updatedAt INTEGER
      );
    `);

    // Indexes
    this.db.run('CREATE INDEX IF NOT EXISTS idx_debates_session ON debates(sessionId);');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_debates_timestamp ON debates(timestamp);');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);');
  }

  getDb(): Database {
    return this.db;
  }

  close() {
    this.db.close();
  }
}

export const dbService = new DatabaseService();
