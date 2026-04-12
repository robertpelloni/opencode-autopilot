package log

import (
	"fmt"
	"sync"
	"time"

	"borg-orchestrator/pkg/server/services/config"
	"borg-orchestrator/pkg/shared"
)

type SessionLogs struct {
	Entries     []shared.LogEntry
	TotalPruned int
	LastPruneAt int64
}

type LogRotationService struct {
	mu           sync.RWMutex
	sessionLogs  map[string]*SessionLogs
	pruneTimer   *time.Ticker
	stopChan     chan struct{}
	config       shared.LogRotationConfig
}

var Service = NewLogRotationService()

func NewLogRotationService() *LogRotationService {
	return &LogRotationService{
		sessionLogs: make(map[string]*SessionLogs),
		config: shared.LogRotationConfig{
			MaxLogsPerSession: 1000,
			MaxLogAgeMs:       24 * 60 * 60 * 1000,
			PruneIntervalMs:   60000,
		},
	}
}

func (s *LogRotationService) Configure(config config.AutopilotConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Assuming the config logic passes the right struct, mimicking the TS spread
	// If the config system had `LogRotation` explicitly, we'd map it.
	// For now we'll allow an empty configure to satisfy the interface stub
}

func (s *LogRotationService) UpdateConfig(cfg shared.LogRotationConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if cfg.MaxLogsPerSession != 0 {
		s.config.MaxLogsPerSession = cfg.MaxLogsPerSession
	}
	if cfg.MaxLogAgeMs != 0 {
		s.config.MaxLogAgeMs = cfg.MaxLogAgeMs
	}
	if cfg.PruneIntervalMs != 0 {
		s.config.PruneIntervalMs = cfg.PruneIntervalMs
	}
}

func (s *LogRotationService) GetConfig() shared.LogRotationConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config
}

func (s *LogRotationService) RegisterSession(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.sessionLogs[sessionID]; !exists {
		s.sessionLogs[sessionID] = &SessionLogs{
			Entries:     []shared.LogEntry{},
			TotalPruned: 0,
			LastPruneAt: time.Now().UnixMilli(),
		}
	}
}

func (s *LogRotationService) UnregisterSession(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessionLogs, sessionID)
}

func (s *LogRotationService) AddLog(sessionID string, entry shared.LogEntry) {
	s.mu.Lock()
	logs, exists := s.sessionLogs[sessionID]
	if !exists {
		logs = &SessionLogs{
			Entries:     []shared.LogEntry{},
			TotalPruned: 0,
			LastPruneAt: time.Now().UnixMilli(),
		}
		s.sessionLogs[sessionID] = logs
	}

	logs.Entries = append(logs.Entries, entry)
	length := len(logs.Entries)
	limit := int(float64(s.config.MaxLogsPerSession) * 1.2)
	s.mu.Unlock()

	if length > limit {
		s.PruneSessionLogs(sessionID)
	}
}

func (s *LogRotationService) GetLogs(sessionID string) []shared.LogEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if logs, exists := s.sessionLogs[sessionID]; exists {
		// Return a copy to avoid race conditions when reading
		entriesCopy := make([]shared.LogEntry, len(logs.Entries))
		copy(entriesCopy, logs.Entries)
		return entriesCopy
	}
	return []shared.LogEntry{}
}

type PaginatedLogs struct {
	Logs    []shared.LogEntry `json:"logs"`
	Total   int               `json:"total"`
	HasMore bool              `json:"hasMore"`
}

func (s *LogRotationService) GetLogsWithPagination(sessionID string, offset int, limit int) PaginatedLogs {
	s.mu.RLock()
	defer s.mu.RUnlock()

	logs, exists := s.sessionLogs[sessionID]
	if !exists {
		return PaginatedLogs{Logs: []shared.LogEntry{}, Total: 0, HasMore: false}
	}

	total := len(logs.Entries)
	if offset >= total {
		return PaginatedLogs{Logs: []shared.LogEntry{}, Total: total, HasMore: false}
	}

	end := offset + limit
	if end > total {
		end = total
	}

	sliced := make([]shared.LogEntry, end-offset)
	copy(sliced, logs.Entries[offset:end])

	return PaginatedLogs{
		Logs:    sliced,
		Total:   total,
		HasMore: offset+limit < total,
	}
}

func (s *LogRotationService) ClearSessionLogs(sessionID string) int {
	s.mu.Lock()
	defer s.mu.Unlock()

	logs, exists := s.sessionLogs[sessionID]
	if !exists {
		return 0
	}

	count := len(logs.Entries)
	logs.Entries = []shared.LogEntry{}
	logs.TotalPruned += count
	return count
}

func (s *LogRotationService) PruneSessionLogs(sessionID string) int {
	s.mu.Lock()
	defer s.mu.Unlock()

	logs, exists := s.sessionLogs[sessionID]
	if !exists {
		return 0
	}

	now := time.Now().UnixMilli()
	originalLength := len(logs.Entries)

	var filtered []shared.LogEntry
	for _, entry := range logs.Entries {
		age := now - entry.Timestamp
		if age < int64(s.config.MaxLogAgeMs) {
			filtered = append(filtered, entry)
		}
	}

	if len(filtered) > s.config.MaxLogsPerSession {
		overflow := len(filtered) - s.config.MaxLogsPerSession
		filtered = filtered[overflow:]
	}

	logs.Entries = filtered
	pruned := originalLength - len(logs.Entries)
	logs.TotalPruned += pruned
	logs.LastPruneAt = now

	return pruned
}

func (s *LogRotationService) Start() {
	s.mu.Lock()
	if s.pruneTimer != nil {
		s.mu.Unlock()
		return
	}

	s.pruneTimer = time.NewTicker(time.Duration(s.config.PruneIntervalMs) * time.Millisecond)
	s.stopChan = make(chan struct{})
	interval := s.config.PruneIntervalMs
	maxLogs := s.config.MaxLogsPerSession
	s.mu.Unlock()

	fmt.Printf("[LogRotation] Started with %dms interval, max %d logs/session\n", interval, maxLogs)

	go func() {
		for {
			select {
			case <-s.pruneTimer.C:
				s.PruneAllSessions()
			case <-s.stopChan:
				return
			}
		}
	}()
}

func (s *LogRotationService) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.pruneTimer != nil {
		s.pruneTimer.Stop()
		close(s.stopChan)
		s.pruneTimer = nil
		s.stopChan = nil
	}
}

func (s *LogRotationService) PruneAllSessions() {
	s.mu.RLock()
	var sessionIDs []string
	for id := range s.sessionLogs {
		sessionIDs = append(sessionIDs, id)
	}
	sessionCount := len(s.sessionLogs)
	s.mu.RUnlock()

	totalPruned := 0
	for _, id := range sessionIDs {
		totalPruned += s.PruneSessionLogs(id)
	}

	if totalPruned > 0 {
		fmt.Printf("[LogRotation] Pruned %d log entries across %d sessions\n", totalPruned, sessionCount)
	}
}

type LogStats struct {
	SessionCount int `json:"sessionCount"`
	TotalLogs    int `json:"totalLogs"`
	TotalPruned  int `json:"totalPruned"`
}

func (s *LogRotationService) GetStats() LogStats {
	s.mu.RLock()
	defer s.mu.RUnlock()

	totalLogs := 0
	totalPruned := 0

	for _, logs := range s.sessionLogs {
		totalLogs += len(logs.Entries)
		totalPruned += logs.TotalPruned
	}

	return LogStats{
		SessionCount: len(s.sessionLogs),
		TotalLogs:    totalLogs,
		TotalPruned:  totalPruned,
	}
}
