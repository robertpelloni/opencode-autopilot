package db

import (
	"os"
	"testing"
)

func TestDatabaseService(t *testing.T) {
	dbPath := "./test_db.sqlite"
	defer os.Remove(dbPath)

	service, err := NewDatabaseService(dbPath)
	if err != nil {
		t.Fatalf("Failed to init db: %v", err)
	}

	err = service.RecordDebate("deb-1", "task-1", "test task", 0.9, true)
	if err != nil {
		t.Errorf("Failed to record debate: %v", err)
	}

	err = service.UpdateQuota("openai", 1500, 2)
	if err != nil {
		t.Errorf("Failed to update quota: %v", err)
	}

	history, err := service.GetDebateHistory(10)
	if err != nil {
		t.Errorf("Failed to get debate history: %v", err)
	}
	if len(history) != 1 {
		t.Errorf("Expected 1 history record, got %d", len(history))
	} else {
		if history[0].ID != "deb-1" {
			t.Errorf("Expected ID 'deb-1', got %s", history[0].ID)
		}
	}

	quotas, err := service.GetQuotas()
	if err != nil {
		t.Errorf("Failed to get quotas: %v", err)
	}
	if len(quotas) != 1 {
		t.Errorf("Expected 1 quota record, got %d", len(quotas))
	} else {
		if quotas[0].Provider != "openai" {
			t.Errorf("Expected provider 'openai', got %s", quotas[0].Provider)
		}
		if quotas[0].TokensUsed != 1500 {
			t.Errorf("Expected 1500 tokens, got %d", quotas[0].TokensUsed)
		}
	}
}
