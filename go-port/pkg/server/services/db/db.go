package db

import (
	"database/sql"
	"log"
	"sync"
	_ "modernc.org/sqlite"
)

type DatabaseService struct {
	db *sql.DB
	mu sync.RWMutex
}

func NewDatabaseService(dbPath string) (*DatabaseService, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}

	service := &DatabaseService{
		db: db,
	}

	if err := service.initSchemas(); err != nil {
		return nil, err
	}

	return service, nil
}

func (s *DatabaseService) initSchemas() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	queries := []string{
		`CREATE TABLE IF NOT EXISTS debate_history (
			id TEXT PRIMARY KEY,
			task_id TEXT NOT NULL,
			description TEXT,
			consensus REAL,
			approved BOOLEAN,
			timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS quota_tracking (
			provider TEXT PRIMARY KEY,
			tokens_used INTEGER DEFAULT 0,
			requests_made INTEGER DEFAULT 0,
			last_reset DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
	}

	for _, query := range queries {
		if _, err := s.db.Exec(query); err != nil {
			log.Printf("Failed to execute schema query: %v", err)
			return err
		}
	}
	return nil
}

func (s *DatabaseService) RecordDebate(id, taskID, description string, consensus float64, approved bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	_, err := s.db.Exec(
		"INSERT INTO debate_history (id, task_id, description, consensus, approved) VALUES (?, ?, ?, ?, ?)",
		id, taskID, description, consensus, approved,
	)
	return err
}

func (s *DatabaseService) UpdateQuota(provider string, tokens int, requests int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	_, err := s.db.Exec(
		`INSERT INTO quota_tracking (provider, tokens_used, requests_made)
		 VALUES (?, ?, ?)
		 ON CONFLICT(provider) DO UPDATE SET
		 tokens_used = tokens_used + excluded.tokens_used,
		 requests_made = requests_made + excluded.requests_made`,
		provider, tokens, requests,
	)
	return err
}

type DebateRecord struct {
	ID          string  `json:"id"`
	TaskID      string  `json:"taskId"`
	Description string  `json:"description"`
	Consensus   float64 `json:"consensus"`
	Approved    bool    `json:"approved"`
	Timestamp   string  `json:"timestamp"`
}

func (s *DatabaseService) GetDebateHistory(limit int) ([]DebateRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rows, err := s.db.Query("SELECT id, task_id, description, consensus, approved, timestamp FROM debate_history ORDER BY timestamp DESC LIMIT ?", limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []DebateRecord
	for rows.Next() {
		var rec DebateRecord
		if err := rows.Scan(&rec.ID, &rec.TaskID, &rec.Description, &rec.Consensus, &rec.Approved, &rec.Timestamp); err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, nil
}

type QuotaRecord struct {
	Provider     string `json:"provider"`
	TokensUsed   int    `json:"tokensUsed"`
	RequestsMade int    `json:"requestsMade"`
	LastReset    string `json:"lastReset"`
}

func (s *DatabaseService) GetQuotas() ([]QuotaRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rows, err := s.db.Query("SELECT provider, tokens_used, requests_made, last_reset FROM quota_tracking")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var quotas []QuotaRecord
	for rows.Next() {
		var q QuotaRecord
		if err := rows.Scan(&q.Provider, &q.TokensUsed, &q.RequestsMade, &q.LastReset); err != nil {
			return nil, err
		}
		quotas = append(quotas, q)
	}
	return quotas, nil
}
