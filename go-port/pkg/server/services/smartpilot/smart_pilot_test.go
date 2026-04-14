package smartpilot

import (
	"borg-orchestrator/pkg/shared"
	"testing"
)

func TestSmartPilot_SettersAndGetters(t *testing.T) {
	service := NewSmartPilot()

	service.SetEnabled(false)
	if service.IsEnabled() {
		t.Errorf("Expected SmartPilot to be disabled")
	}

	service.SetAutoApproveThreshold(0.9)
	config := service.GetConfig()
	if config.AutoApproveThreshold != 0.9 {
		t.Errorf("Expected AutoApproveThreshold to be 0.9, got %f", config.AutoApproveThreshold)
	}

	service.SetRequireUnanimous(true)
	if !service.GetConfig().RequireUnanimous {
		t.Errorf("Expected RequireUnanimous to be true")
	}

	service.SetMaxAutoApprovals(5)
	if service.GetConfig().MaxAutoApprovals != 5 {
		t.Errorf("Expected MaxAutoApprovals to be 5, got %d", service.GetConfig().MaxAutoApprovals)
	}
}

func TestSmartPilot_DecisionToGuidance(t *testing.T) {
	service := NewSmartPilot()
	service.SetAutoApproveThreshold(0.8)

	decision := shared.CouncilDecision{
		Approved:          true,
		Consensus:         0.9,
		WeightedConsensus: func(f float64) *float64 { return &f }(0.9),
		Votes: []shared.Vote{
			{Approved: true},
			{Approved: true},
		},
		Dissent: []string{},
	}

	guidance := service.DecisionToGuidance(decision, "session-1")
	if !guidance.Approved {
		t.Errorf("Expected guidance to be approved")
	}
	if len(guidance.SuggestedNextSteps) == 0 || guidance.SuggestedNextSteps[0] != "Continue with implementation" {
		t.Errorf("Expected continue step")
	}

	// Test below threshold
	decision.WeightedConsensus = func(f float64) *float64 { return &f }(0.7)
	guidance = service.DecisionToGuidance(decision, "session-2")
	if guidance.Approved {
		t.Errorf("Expected guidance to be rejected due to low consensus")
	}

	// Test dissent blocks auto-approval
	decision.WeightedConsensus = func(f float64) *float64 { return &f }(0.9)
	decision.Dissent = []string{"I disagree"}
	guidance = service.DecisionToGuidance(decision, "session-3")
	if guidance.Approved {
		t.Errorf("Expected guidance to be rejected due to dissent")
	}

	// Test unanimous requirement
	service.SetRequireUnanimous(true)
	decision.Dissent = []string{}
	decision.Votes = []shared.Vote{
		{Approved: true},
		{Approved: false},
	}
	guidance = service.DecisionToGuidance(decision, "session-4")
	if guidance.Approved {
		t.Errorf("Expected guidance to be rejected due to non-unanimous vote")
	}
}
