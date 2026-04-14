package smartpilot

import (
	"math"
	"sync"
	"time"

	"borg-orchestrator/pkg/server/services/config"
	"borg-orchestrator/pkg/shared"
)

type TaskCheckpoint struct {
	SessionID     string
	LastCheckedAt int64
	LastTaskID    *string
	PendingDebate bool
}

type SmartPilotConfig struct {
	Enabled              bool
	PollIntervalMs       int
	AutoApproveThreshold float64
	RequireUnanimous     bool
	MaxAutoApprovals     int
}

type SmartPilot struct {
	mu                sync.RWMutex
	config            SmartPilotConfig
	checkpoints       map[string]*TaskCheckpoint
	pollTimer         *time.Ticker
	stopChan          chan struct{}
	autoApprovalCount map[string]int
	activePlans       map[string]shared.TaskPlan
}

var Service = NewSmartPilot()

func NewSmartPilot() *SmartPilot {
	appConfig := config.LoadConfig()
	enabled := false
	if appConfig.Council.SmartPilot != nil {
		enabled = *appConfig.Council.SmartPilot
	}

	return &SmartPilot{
		config: SmartPilotConfig{
			Enabled:              enabled,
			PollIntervalMs:       3000,
			AutoApproveThreshold: 0.8,
			RequireUnanimous:     false,
			MaxAutoApprovals:     10,
		},
		checkpoints:       make(map[string]*TaskCheckpoint),
		autoApprovalCount: make(map[string]int),
		activePlans:       make(map[string]shared.TaskPlan),
	}
}

func (s *SmartPilot) SetEnabled(enabled bool) {
	s.mu.Lock()
	s.config.Enabled = enabled
	s.mu.Unlock()

	if enabled {
		s.Start()
	} else {
		s.Stop()
	}
}

func (s *SmartPilot) SetAutoApproveThreshold(threshold float64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.config.AutoApproveThreshold = math.Max(0.5, math.Min(1.0, threshold))
}

func (s *SmartPilot) SetRequireUnanimous(require bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.config.RequireUnanimous = require
}

func (s *SmartPilot) SetMaxAutoApprovals(max int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if max < 1 {
		max = 1
	}
	s.config.MaxAutoApprovals = max
}

func (s *SmartPilot) IsEnabled() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config.Enabled
}

func (s *SmartPilot) GetConfig() SmartPilotConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config
}

func (s *SmartPilot) ResetApprovalCount(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.autoApprovalCount, sessionID)
}

func (s *SmartPilot) ResetAllApprovalCounts() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.autoApprovalCount = make(map[string]int)
}

func (s *SmartPilot) Cleanup() {
	s.Stop()
	s.mu.Lock()
	defer s.mu.Unlock()
	s.checkpoints = make(map[string]*TaskCheckpoint)
	s.autoApprovalCount = make(map[string]int)
	s.activePlans = make(map[string]shared.TaskPlan)
}
