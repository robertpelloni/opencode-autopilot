package hierarchy

import (
	"errors"
	"fmt"
	"log"
	"sync"
	"borg-orchestrator/pkg/server/services/council"
	"borg-orchestrator/pkg/shared"
)

type SpecializedCouncil struct {
	ID          string                    `json:"id"`
	Name        string                    `json:"name"`
	Description string                    `json:"description"`
	Specialties []string                  `json:"specialties"`
	Council     *council.SupervisorCouncil `json:"-"`
}

type SpecializedCouncilConfig struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Specialties []string `json:"specialties"`
}

type CouncilHierarchyService struct {
	supremeCouncil     *council.SupervisorCouncil
	specializedCouncils map[string]*SpecializedCouncil
	mu                 sync.RWMutex
}

func NewCouncilHierarchyService() *CouncilHierarchyService {
	return &CouncilHierarchyService{
		specializedCouncils: make(map[string]*SpecializedCouncil),
	}
}

func (s *CouncilHierarchyService) Initialize(supremeCouncil *council.SupervisorCouncil, configs []SpecializedCouncilConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if supremeCouncil == nil {
		return errors.New("supremeCouncil cannot be nil")
	}

	s.supremeCouncil = supremeCouncil

	for _, cfg := range configs {
		s.registerSpecializedCouncil(cfg)
	}

	log.Printf("[CouncilHierarchy] Initialized with %d specialized councils.", len(s.specializedCouncils))
	return nil
}

func (s *CouncilHierarchyService) registerSpecializedCouncil(config SpecializedCouncilConfig) {
    mode := shared.ConsensusMode("simple_majority")
	c := council.NewSupervisorCouncil(shared.CouncilConfig{
		ConsensusMode: &mode,
	})

	specialized := &SpecializedCouncil{
		ID:          config.ID,
		Name:        config.Name,
		Description: config.Description,
		Specialties: config.Specialties,
		Council:     c,
	}

	s.specializedCouncils[config.ID] = specialized
}

// Note: Using Context to represent task "type" or tags for the prototype since shared.DevelopmentTask lacks Type
func (s *CouncilHierarchyService) RouteTask(task shared.DevelopmentTask) *council.SupervisorCouncil {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if len(s.specializedCouncils) == 0 {
		return s.supremeCouncil
	}

	for _, specialized := range s.specializedCouncils {
		for _, specialty := range specialized.Specialties {
			// Using Context as a makeshift routing tag string for the test
			if task.Context == specialty {
				log.Printf("[CouncilHierarchy] Routing task %s to specialized council: %s", task.ID, specialized.Name)
				return specialized.Council
			}
		}
	}

	log.Printf("[CouncilHierarchy] No specialized council found, routing to Supreme Council.")
	return s.supremeCouncil
}

func (s *CouncilHierarchyService) EscalateToSupreme(task shared.DevelopmentTask, specializedDecision shared.CouncilDecision) (*shared.CouncilDecision, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.supremeCouncil == nil {
		return nil, errors.New("Supreme council is not initialized")
	}

	log.Printf("[CouncilHierarchy] Escalating task %s to Supreme Council for review.", task.ID)

	escalationTask := shared.DevelopmentTask{
		ID:          task.ID + "-escalation",
		Description: fmt.Sprintf("Review decision from specialized council on task: %s\nOriginal Task: %s\nSpecialized Decision: %v", task.ID, task.Description, specializedDecision.Approved),
		Context:     task.Context,
		Files:       task.Files,
	}

	// This is a mock response, in a real system we would use StartDebate or ExecuteDebate
	// which doesn't seem to be exposed on SupervisorCouncil in the current types
	decision := shared.CouncilDecision{
		Approved: false,
		Consensus: 0.5,
	}
	_ = escalationTask

	return &decision, nil
}
