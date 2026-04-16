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
}
