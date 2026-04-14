package council

import (
	"borg-orchestrator/pkg/shared"
	"testing"
)

type DummySupervisor struct {
	name      string
	available bool
	chatFunc  func() string
}

func (d *DummySupervisor) GetName() string { return d.name }
func (d *DummySupervisor) GetProvider() string { return "dummy" }
func (d *DummySupervisor) IsAvailable() (bool, error) { return d.available, nil }
func (d *DummySupervisor) Chat(m []shared.Message) (string, error) { return d.chatFunc(), nil }

func TestCouncilBasicSetup(t *testing.T) {
	config := shared.CouncilConfig{}
	c := NewSupervisorCouncil(config)

	c.AddSupervisor(&DummySupervisor{name: "A", available: true}, 1.0)
	c.AddSupervisor(&DummySupervisor{name: "B", available: false}, 1.5)

	avail := c.GetAvailableSupervisors()
	if len(avail) != 1 {
		t.Errorf("Expected 1 available supervisor, got %d", len(avail))
	}
	if avail[0].GetName() != "A" {
		t.Errorf("Expected supervisor A to be available")
	}

	weight := c.GetSupervisorWeight("B")
	if weight != 1.5 {
		t.Errorf("Expected weight 1.5, got %f", weight)
	}
}

func TestCouncilConsensusHandlers(t *testing.T) {
	c := NewSupervisorCouncil(shared.CouncilConfig{})

	votes := []shared.Vote{
		{Supervisor: "A", Approved: true, Confidence: 0.8, Weight: 1.0},
		{Supervisor: "B", Approved: true, Confidence: 0.9, Weight: 1.0},
		{Supervisor: "C", Approved: false, Confidence: 0.7, Weight: 1.0},
	}

	// Unanimous
	approved, _ := c.handleUnanimous(votes, shared.CouncilConfig{}, nil)
	if approved {
		t.Errorf("Expected Unanimous to fail")
	}

	// Simple Majority
	approved, _ = c.handleSimpleMajority(votes, shared.CouncilConfig{}, nil)
	if !approved {
		t.Errorf("Expected Simple Majority to pass")
	}

	// Supermajority (2/3 is 66%, so threshold is 3 * 0.667 = 2.001. Approvals = 2. It will fail. Let's fix the test or logic.)
	// Wait, 3 * 0.667 is 2.001. Since it's float comparison, 2.0 >= 2.001 is FALSE.
	// In the original TS: `const threshold = votes.length * 0.667; const approved = approvals >= threshold;`
	// In TS, 3 * 0.667 = 2.001. So approvals >= 2.001 is FALSE. 2 out of 3 is NOT a supermajority if 66.7% is required (it's 66.666...%).
	// The original code actually required > 2/3.
}
