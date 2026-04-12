package history

import (
	"borg-orchestrator/pkg/server/services/db"
	"borg-orchestrator/pkg/shared"
	"encoding/json"
	"fmt"
	"math/rand"
	"strconv"
	"strings"
	"sync"
	"time"
)

type DebateDynamicSelection struct {
	Enabled    bool             `json:"enabled"`
	TaskType   *shared.TaskType `json:"taskType,omitempty"`
	Confidence *float64         `json:"confidence,omitempty"`
}

type DebateMetadata struct {
	SessionId                *string                 `json:"sessionId,omitempty"`
	DebateRounds             int                     `json:"debateRounds"`
	ConsensusMode            shared.ConsensusMode    `json:"consensusMode"`
	LeadSupervisor           *string                 `json:"leadSupervisor,omitempty"`
	DynamicSelection         *DebateDynamicSelection `json:"dynamicSelection,omitempty"`
	DurationMs               int64                   `json:"durationMs"`
	SupervisorCount          int                     `json:"supervisorCount"`
	ParticipatingSupervisors []string                `json:"participatingSupervisors"`
}

type DebateRecord struct {
	ID        string                 `json:"id"`
	Timestamp int64                  `json:"timestamp"`
	Task      shared.DevelopmentTask `json:"task"`
	Decision  shared.CouncilDecision `json:"decision"`
	Metadata  DebateMetadata         `json:"metadata"`
}

type DebateQueryOptions struct {
	SessionId      *string
	TaskType       *shared.TaskType
	Approved       *bool
	SupervisorName *string
	FromTimestamp  *int64
	ToTimestamp    *int64
	MinConsensus   *float64
	MaxConsensus   *float64
	Limit          *int
	Offset         *int
	SortBy         *string
	SortOrder      *string
}

type DebateStats struct {
	TotalDebates           int            `json:"totalDebates"`
	ApprovedCount          int            `json:"approvedCount"`
	RejectedCount          int            `json:"rejectedCount"`
	ApprovalRate           float64        `json:"approvalRate"`
	AverageConsensus       float64        `json:"averageConsensus"`
	AverageDurationMs      float64        `json:"averageDurationMs"`
	DebatesByTaskType      map[string]int `json:"debatesByTaskType"`
	DebatesBySupervisor    map[string]int `json:"debatesBySupervisor"`
	DebatesByConsensusMode map[string]int `json:"debatesByConsensusMode"`
	OldestDebate           *int64         `json:"oldestDebate,omitempty"`
	NewestDebate           *int64         `json:"newestDebate,omitempty"`
}

type DebateHistoryConfig struct {
	Enabled       bool   `json:"enabled"`
	StorageDir    string `json:"storageDir"`
	MaxRecords    int    `json:"maxRecords"`
	AutoSave      bool   `json:"autoSave"`
	RetentionDays int    `json:"retentionDays"`
}

type DebateHistoryService struct {
	mu          sync.RWMutex
	config      DebateHistoryConfig
	initialized bool
}

var Service = NewDebateHistoryService()

func NewDebateHistoryService() *DebateHistoryService {
	return &DebateHistoryService{
		config: DebateHistoryConfig{
			Enabled:       true,
			StorageDir:    "./data/debate-history",
			MaxRecords:    1000,
			AutoSave:      true,
			RetentionDays: 90,
		},
	}
}

func (s *DebateHistoryService) Initialize() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.initialized {
		return
	}
	s.initialized = true
	// Emit 'initialized' event logically here
}

func (s *DebateHistoryService) generateId() string {
	timestamp := strconv.FormatInt(time.Now().UnixMilli(), 36)
	randomStr := fmt.Sprintf("%06x", rand.Intn(0xffffff))
	return fmt.Sprintf("debate_%s_%s", timestamp, randomStr)
}

func (s *DebateHistoryService) SaveDebate(task shared.DevelopmentTask, decision shared.CouncilDecision, metadata map[string]interface{}) (*DebateRecord, error) {
	id := s.generateId()
	timestamp := time.Now().UnixMilli()

	rounds := 2
	if r, ok := metadata["debateRounds"].(int); ok {
		rounds = r
	}
	mode := shared.Weighted
	if m, ok := metadata["consensusMode"].(shared.ConsensusMode); ok {
		mode = m
	}
	var leadSupervisor *string
	if ls, ok := metadata["leadSupervisor"].(*string); ok {
		leadSupervisor = ls
	}
	var durationMs int64
	if d, ok := metadata["durationMs"].(int64); ok {
		durationMs = d
	}
	var sessionId *string
	if sess, ok := metadata["sessionId"].(*string); ok {
		sessionId = sess
	}

	var dynamicSelection *DebateDynamicSelection
	if ds, ok := metadata["dynamicSelection"].(map[string]interface{}); ok {
		dynamicSelection = &DebateDynamicSelection{
			Enabled: ds["enabled"].(bool),
		}
		if tt, ok := ds["taskType"].(shared.TaskType); ok {
			dynamicSelection.TaskType = &tt
		}
		if conf, ok := ds["confidence"].(float64); ok {
			dynamicSelection.Confidence = &conf
		}
	}

	var participatingSupervisors []string
	for _, v := range decision.Votes {
		participatingSupervisors = append(participatingSupervisors, v.Supervisor)
	}

	record := DebateRecord{
		ID:        id,
		Timestamp: timestamp,
		Task:      task,
		Decision:  decision,
		Metadata: DebateMetadata{
			SessionId:                sessionId,
			DebateRounds:             rounds,
			ConsensusMode:            mode,
			LeadSupervisor:           leadSupervisor,
			DynamicSelection:         dynamicSelection,
			DurationMs:               durationMs,
			SupervisorCount:          len(decision.Votes),
			ParticipatingSupervisors: participatingSupervisors,
		},
	}

	if s.IsEnabled() {
		s.persistRecord(record)
		s.pruneOldRecords()
	}

	return &record, nil
}

func (s *DebateHistoryService) pruneOldRecords() {
	database := db.Service.GetDb()
	if database == nil {
		return
	}

	cutoffTime := time.Now().UnixMilli() - int64(s.config.RetentionDays*24*60*60*1000)

	_, err := database.Exec("DELETE FROM debates WHERE timestamp < ?", cutoffTime)
	if err != nil {
		fmt.Printf("Failed to prune old records by age: %v\n", err)
	}

	count := s.GetRecordCount()
	if count > s.config.MaxRecords {
		excess := count - s.config.MaxRecords
		rows, err := database.Query("SELECT id FROM debates ORDER BY timestamp ASC LIMIT ?", excess)
		if err != nil {
			return
		}
		defer rows.Close()

		var ids []string
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err == nil {
				ids = append(ids, id)
			}
		}

		for _, id := range ids {
			s.DeleteRecord(id)
		}
	}
}

func (s *DebateHistoryService) persistRecord(record DebateRecord) {
	database := db.Service.GetDb()
	if database == nil {
		return
	}

	stmt, err := database.Prepare(`
        INSERT INTO debates (
          id, title, sessionId, taskType, status, consensus, weightedConsensus, outcome, rounds, timestamp, data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
	if err != nil {
		fmt.Printf("Prepare error: %v\n", err)
		return
	}
	defer stmt.Close()

	title := record.Task.Description
	if len(title) > 255 {
		title = title[:255]
	}

	taskType := "general"
	if record.Metadata.DynamicSelection != nil && record.Metadata.DynamicSelection.TaskType != nil {
		taskType = string(*record.Metadata.DynamicSelection.TaskType)
	}

	weightedConsensus := record.Decision.Consensus
	if record.Decision.WeightedConsensus != nil {
		weightedConsensus = *record.Decision.WeightedConsensus
	}

	outcome := "rejected"
	if record.Decision.Approved {
		outcome = "approved"
	}

	dataBytes, _ := json.Marshal(record)

	_, err = stmt.Exec(
		record.ID,
		title,
		record.Metadata.SessionId,
		taskType,
		"completed",
		record.Decision.Consensus,
		weightedConsensus,
		outcome,
		record.Metadata.DebateRounds,
		record.Timestamp,
		string(dataBytes),
	)

	if err != nil {
		fmt.Printf("Failed to insert record %s: %v\n", record.ID, err)
	}
}

func (s *DebateHistoryService) DeleteRecord(id string) bool {
	if !s.IsEnabled() {
		return false
	}

	database := db.Service.GetDb()
	if database == nil {
		return false
	}

	res, err := database.Exec("DELETE FROM debates WHERE id = ?", id)
	if err != nil {
		return false
	}

	affected, _ := res.RowsAffected()
	return affected > 0
}

func (s *DebateHistoryService) GetDebate(id string) *DebateRecord {
	database := db.Service.GetDb()
	if database == nil {
		return nil
	}

	row := database.QueryRow("SELECT data FROM debates WHERE id = ?", id)
	var data string
	err := row.Scan(&data)
	if err != nil {
		return nil
	}

	var record DebateRecord
	if err := json.Unmarshal([]byte(data), &record); err == nil {
		return &record
	}
	return nil
}

func (s *DebateHistoryService) QueryDebates(options DebateQueryOptions) []DebateRecord {
	database := db.Service.GetDb()
	if database == nil {
		return []DebateRecord{}
	}

	query := "SELECT data FROM debates WHERE 1=1"
	var params []interface{}

	if options.SessionId != nil {
		query += " AND sessionId = ?"
		params = append(params, *options.SessionId)
	}

	if options.TaskType != nil {
		query += " AND taskType = ?"
		params = append(params, string(*options.TaskType))
	}

	if options.Approved != nil {
		query += " AND outcome = ?"
		outcome := "rejected"
		if *options.Approved {
			outcome = "approved"
		}
		params = append(params, outcome)
	}

	if options.FromTimestamp != nil {
		query += " AND timestamp >= ?"
		params = append(params, *options.FromTimestamp)
	}

	if options.ToTimestamp != nil {
		query += " AND timestamp <= ?"
		params = append(params, *options.ToTimestamp)
	}

	if options.MinConsensus != nil {
		query += " AND consensus >= ?"
		params = append(params, *options.MinConsensus)
	}

	if options.MaxConsensus != nil {
		query += " AND consensus <= ?"
		params = append(params, *options.MaxConsensus)
	}

	sortBy := "timestamp"
	if options.SortBy != nil {
		sortBy = *options.SortBy
	}

	sortOrder := "desc"
	if options.SortOrder != nil {
		sortOrder = *options.SortOrder
	}

	query += fmt.Sprintf(" ORDER BY %s %s", sortBy, strings.ToUpper(sortOrder))

	limit := 50
	if options.Limit != nil {
		limit = *options.Limit
	}
	offset := 0
	if options.Offset != nil {
		offset = *options.Offset
	}

	query += " LIMIT ? OFFSET ?"
	params = append(params, limit, offset)

	rows, err := database.Query(query, params...)
	if err != nil {
		return []DebateRecord{}
	}
	defer rows.Close()

	var results []DebateRecord
	for rows.Next() {
		var data string
		if err := rows.Scan(&data); err == nil {
			var record DebateRecord
			if err := json.Unmarshal([]byte(data), &record); err == nil {
				results = append(results, record)
			}
		}
	}

	if options.SupervisorName != nil {
		var filtered []DebateRecord
		for _, r := range results {
			for _, sup := range r.Metadata.ParticipatingSupervisors {
				if sup == *options.SupervisorName {
					filtered = append(filtered, r)
					break
				}
			}
		}
		results = filtered
	}

	return results
}

func (s *DebateHistoryService) GetRecordCount() int {
	database := db.Service.GetDb()
	if database == nil {
		return 0
	}

	var count int
	err := database.QueryRow("SELECT COUNT(*) FROM debates").Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

func (s *DebateHistoryService) ClearAll() int {
	database := db.Service.GetDb()
	if database == nil {
		return 0
	}

	res, err := database.Exec("DELETE FROM debates")
	if err != nil {
		return 0
	}

	count, _ := res.RowsAffected()
	return int(count)
}

func (s *DebateHistoryService) IsEnabled() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config.Enabled
}

func (s *DebateHistoryService) GetConfig() DebateHistoryConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config
}

func (s *DebateHistoryService) UpdateConfig(updates DebateHistoryConfig) DebateHistoryConfig {
	s.mu.Lock()
	defer s.mu.Unlock()
	if updates.MaxRecords > 0 {
		s.config.MaxRecords = updates.MaxRecords
	}
	if updates.RetentionDays > 0 {
		s.config.RetentionDays = updates.RetentionDays
	}
	s.config.Enabled = updates.Enabled
	s.config.AutoSave = updates.AutoSave

	return s.config
}

type SupervisorVoteHistory struct {
	TotalVotes        int
	Approvals         int
	Rejections        int
	AverageConfidence float64
	RecentVotes       []RecentVote
}

type RecentVote struct {
	DebateId   string
	Approved   bool
	Confidence float64
	Timestamp  int64
}

func (s *DebateHistoryService) GetSupervisorVoteHistory(supervisorName string) SupervisorVoteHistory {
	database := db.Service.GetDb()
	if database == nil {
		return SupervisorVoteHistory{}
	}

	rows, err := database.Query("SELECT id, timestamp, data FROM debates ORDER BY timestamp DESC LIMIT 1000")
	if err != nil {
		return SupervisorVoteHistory{}
	}
	defer rows.Close()

	var votes []RecentVote

	for rows.Next() {
		var id string
		var timestamp int64
		var data string

		if err := rows.Scan(&id, &timestamp, &data); err == nil {
			var record DebateRecord
			if err := json.Unmarshal([]byte(data), &record); err == nil {
				for _, v := range record.Decision.Votes {
					if v.Supervisor == supervisorName {
						votes = append(votes, RecentVote{
							DebateId:   record.ID,
							Approved:   v.Approved,
							Confidence: v.Confidence,
							Timestamp:  record.Timestamp,
						})
						break
					}
				}
			}
		}
	}

	if len(votes) == 0 {
		return SupervisorVoteHistory{}
	}

	approvals := 0
	var totalConfidence float64 = 0

	for _, v := range votes {
		if v.Approved {
			approvals++
		}
		totalConfidence += v.Confidence
	}

	limit := 10
	if len(votes) < limit {
		limit = len(votes)
	}

	return SupervisorVoteHistory{
		TotalVotes:        len(votes),
		Approvals:         approvals,
		Rejections:        len(votes) - approvals,
		AverageConfidence: totalConfidence / float64(len(votes)),
		RecentVotes:       votes[:limit],
	}
}
