package history

import (
	"borg-orchestrator/pkg/shared"
	"os"
	"testing"
)

func TestMain(m *testing.M) {
	os.Setenv("GO_ENV", "test")
	// init triggered internally via variables will pick up the test environment and use :memory:
	code := m.Run()
	os.Exit(code)
}

func TestDebateHistoryService_BasicOperations(t *testing.T) {
	service := NewDebateHistoryService()
	service.Initialize()

	task := shared.DevelopmentTask{
		ID:          "task-123",
		Description: "A test task",
	}

	decision := shared.CouncilDecision{
		Approved:          true,
		Consensus:         0.8,
		WeightedConsensus: func(f float64) *float64 { return &f }(0.85),
		Votes: []shared.Vote{
			{Supervisor: "OpenAI", Approved: true, Confidence: 0.9, Weight: 1.0, Comment: "Looks good"},
		},
		Reasoning: "Approved based on high consensus",
	}

	metadata := map[string]interface{}{
		"debateRounds":   2,
		"consensusMode":  shared.Weighted,
		"sessionId":      func(s string) *string { return &s }("session-x"),
		"durationMs":     int64(1500),
		"leadSupervisor": func(s string) *string { return &s }("OpenAI"),
	}

	// Test Save
	record, err := service.SaveDebate(task, decision, metadata)
	if err != nil {
		t.Fatalf("Failed to save debate: %v", err)
	}

	if record.Task.ID != "task-123" {
		t.Errorf("Expected task ID 'task-123', got '%s'", record.Task.ID)
	}
	if record.Metadata.SupervisorCount != 1 {
		t.Errorf("Expected 1 supervisor, got %d", record.Metadata.SupervisorCount)
	}
	if len(record.Metadata.ParticipatingSupervisors) == 0 || record.Metadata.ParticipatingSupervisors[0] != "OpenAI" {
		t.Errorf("Expected OpenAI to be participant")
	}

	// Test Retrieve
	fetched := service.GetDebate(record.ID)
	if fetched == nil {
		t.Fatalf("Failed to get debate %s", record.ID)
	}
	if fetched.Task.Description != "A test task" {
		t.Errorf("Fetched description mismatch")
	}

	// Test Delete
	ok := service.DeleteRecord(record.ID)
	if !ok {
		t.Errorf("Expected deletion to succeed")
	}

	fetchedAgain := service.GetDebate(record.ID)
	if fetchedAgain != nil {
		t.Errorf("Expected debate to be deleted")
	}
}

func TestDebateHistoryService_Query(t *testing.T) {
	service := NewDebateHistoryService()
	service.Initialize()
	service.ClearAll()

	task1 := shared.DevelopmentTask{ID: "t-1", Description: "t1"}
	task2 := shared.DevelopmentTask{ID: "t-2", Description: "t2"}
	dec1 := shared.CouncilDecision{Approved: true, Consensus: 1.0}
	dec2 := shared.CouncilDecision{Approved: false, Consensus: 0.2}

	tt1 := shared.Testing
	tt2 := shared.SecurityAudit

	service.SaveDebate(task1, dec1, map[string]interface{}{
		"sessionId": func(s string) *string { return &s }("sess-1"),
		"dynamicSelection": map[string]interface{}{
			"enabled":    true,
			"taskType":   tt1,
			"confidence": 0.9,
		},
	})

	service.SaveDebate(task2, dec2, map[string]interface{}{
		"sessionId": func(s string) *string { return &s }("sess-1"),
		"dynamicSelection": map[string]interface{}{
			"enabled":    true,
			"taskType":   tt2,
			"confidence": 0.8,
		},
	})

	// Query by session ID
	sessId := "sess-1"
	res := service.QueryDebates(DebateQueryOptions{
		SessionId: &sessId,
	})
	if len(res) != 2 {
		t.Errorf("Expected 2 records for sess-1, got %d", len(res))
	}

	// Query by outcome
	approved := true
	resApproved := service.QueryDebates(DebateQueryOptions{
		Approved: &approved,
	})
	if len(resApproved) != 1 {
		t.Errorf("Expected 1 approved record, got %d", len(resApproved))
	}
	if resApproved[0].Task.ID != "t-1" {
		t.Errorf("Expected t-1 to be approved")
	}

	// Query by TaskType
	resTaskType := service.QueryDebates(DebateQueryOptions{
		TaskType: &tt2,
	})
	if len(resTaskType) != 1 {
		t.Errorf("Expected 1 security record, got %d", len(resTaskType))
	}
}
