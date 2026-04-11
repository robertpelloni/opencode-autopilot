package council

import (
	"borg-orchestrator/pkg/shared"
	"math"
)

type ConsensusModeHandler func(votes []shared.Vote, config shared.CouncilConfig, leadVote *shared.Vote) (bool, string)

type SupervisorCouncil struct {
	supervisors       []shared.Supervisor
	supervisorWeights map[string]float64
	config            shared.CouncilConfig
	fallbackIndex     int
	consensusHandlers map[shared.ConsensusMode]ConsensusModeHandler
}

func NewSupervisorCouncil(config shared.CouncilConfig) *SupervisorCouncil {
	c := &SupervisorCouncil{
		supervisors:       make([]shared.Supervisor, 0),
		supervisorWeights: make(map[string]float64),
		config:            config,
		fallbackIndex:     0,
		consensusHandlers: make(map[shared.ConsensusMode]ConsensusModeHandler),
	}

	c.consensusHandlers[shared.SimpleMajority] = c.handleSimpleMajority
	c.consensusHandlers[shared.Supermajority] = c.handleSupermajority
	c.consensusHandlers[shared.Unanimous] = c.handleUnanimous
	c.consensusHandlers[shared.Weighted] = c.handleWeighted
	c.consensusHandlers[shared.CEOOverride] = c.handleCeoOverride
	c.consensusHandlers[shared.CEOVeto] = c.handleCeoVeto
	c.consensusHandlers[shared.HybridCEOMajority] = c.handleHybridCeoMajority
	c.consensusHandlers[shared.RankedChoice] = c.handleRankedChoice

	return c
}

func (c *SupervisorCouncil) AddSupervisor(supervisor shared.Supervisor, weight float64) {
	c.supervisors = append(c.supervisors, supervisor)
	c.supervisorWeights[supervisor.GetName()] = weight
}

func (c *SupervisorCouncil) SetSupervisorWeight(name string, weight float64) {
	c.supervisorWeights[name] = math.Max(0, math.Min(2, weight))
}

func (c *SupervisorCouncil) GetSupervisorWeight(name string) float64 {
	if w, ok := c.supervisorWeights[name]; ok {
		return w
	}
	return 1.0
}

func (c *SupervisorCouncil) SetLeadSupervisor(name string) {
	c.config.LeadSupervisor = &name
}

func (c *SupervisorCouncil) GetLeadSupervisor() *string {
	return c.config.LeadSupervisor
}

func (c *SupervisorCouncil) SetFallbackChain(supervisors []string) {
	c.config.FallbackSupervisors = supervisors
}

func (c *SupervisorCouncil) GetFallbackChain() []string {
	if c.config.FallbackSupervisors != nil {
		return c.config.FallbackSupervisors
	}
	return []string{}
}

func (c *SupervisorCouncil) SetConsensusMode(mode shared.ConsensusMode) {
	c.config.ConsensusMode = &mode
}

func (c *SupervisorCouncil) GetConsensusMode() shared.ConsensusMode {
	if c.config.ConsensusMode != nil {
		return *c.config.ConsensusMode
	}
	return shared.Weighted
}

func (c *SupervisorCouncil) GetAvailableSupervisors() []shared.Supervisor {
	var available []shared.Supervisor
	for _, supervisor := range c.supervisors {
		isAvail, err := supervisor.IsAvailable()
		if err == nil && isAvail {
			available = append(available, supervisor)
		}
	}
	return available
}

func (c *SupervisorCouncil) GetSupervisors() []shared.Supervisor {
	return c.supervisors
}

func (c *SupervisorCouncil) ClearSupervisors() {
	c.supervisors = make([]shared.Supervisor, 0)
	c.supervisorWeights = make(map[string]float64)
}

func (c *SupervisorCouncil) SetDebateRounds(rounds int) {
	c.config.DebateRounds = &rounds
}

func (c *SupervisorCouncil) SetConsensusThreshold(threshold float64) {
	c.config.ConsensusThreshold = &threshold
}

func (c *SupervisorCouncil) SetWeightedVoting(enabled bool) {
	c.config.WeightedVoting = &enabled
	currentMode := shared.Weighted
	if c.config.ConsensusMode != nil {
		currentMode = *c.config.ConsensusMode
	}

	if !enabled && (currentMode == shared.Weighted || c.config.ConsensusMode == nil) {
		simple := shared.SimpleMajority
		c.config.ConsensusMode = &simple
	} else if enabled && currentMode == shared.SimpleMajority {
		weighted := shared.Weighted
		c.config.ConsensusMode = &weighted
	}
}

func (c *SupervisorCouncil) GetConfig() shared.CouncilConfig {
	return c.config
}

// These method stubs ensure compilation for the struct initialization
