package hierarchy

import (
	"borg-orchestrator/pkg/server/services/council"
	"borg-orchestrator/pkg/shared"
	"testing"
)

func TestCouncilHierarchyService(t *testing.T) {
	service := NewCouncilHierarchyService()
    mode := shared.ConsensusMode("simple_majority")
	supreme := council.NewSupervisorCouncil(shared.CouncilConfig{
		ConsensusMode: &mode,
	})

	configs := []SpecializedCouncilConfig{
		{
			ID:          "sec-council",
			Name:        "Security Council",
			Description: "Handles security audits",
			Specialties: []string{"security", "audit"},
		},
		{
			ID:          "ui-council",
			Name:        "UI Council",
			Description: "Handles UI tasks",
			Specialties: []string{"frontend", "ui"},
		},
	}

	err := service.Initialize(supreme, configs)
	if err != nil {
		t.Fatalf("Failed to initialize: %v", err)
	}

	// Test routing to Security Council
	secTask := shared.DevelopmentTask{ID: "t1", Context: "security"}
	routed := service.RouteTask(secTask)
	if routed == supreme {
		t.Errorf("Expected task to be routed to specialized council, got supreme")
	}

	// Test routing to Supreme Council (fallback)
	backendTask := shared.DevelopmentTask{ID: "t2", Context: "backend"}
	routed = service.RouteTask(backendTask)
	if routed != supreme {
		t.Errorf("Expected fallback task to be routed to supreme council")
	}
}
