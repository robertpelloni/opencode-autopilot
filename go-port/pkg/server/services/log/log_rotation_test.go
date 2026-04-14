package log

import (
	"borg-orchestrator/pkg/shared"
	"testing"
	"time"
)

func TestLogRotationService_Basic(t *testing.T) {
	service := NewLogRotationService()

	// Register session and add log
	service.RegisterSession("sess-1")
	service.AddLog("sess-1", shared.LogEntry{
		Timestamp: time.Now().UnixMilli(),
		Message:   "Hello World",
		Level:     "info",
	})

	logs := service.GetLogs("sess-1")
	if len(logs) != 1 {
		t.Errorf("Expected 1 log, got %d", len(logs))
	}
	if logs[0].Message != "Hello World" {
		t.Errorf("Expected message 'Hello World'")
	}
}

func TestLogRotationService_Pagination(t *testing.T) {
	service := NewLogRotationService()
	service.RegisterSession("sess-2")

	for i := 0; i < 50; i++ {
		service.AddLog("sess-2", shared.LogEntry{
			Timestamp: time.Now().UnixMilli(),
			Message:   "Log",
			Level:     "info",
		})
	}

	page := service.GetLogsWithPagination("sess-2", 0, 10)
	if len(page.Logs) != 10 {
		t.Errorf("Expected 10 logs per page, got %d", len(page.Logs))
	}
	if page.Total != 50 {
		t.Errorf("Expected total 50 logs, got %d", page.Total)
	}
	if !page.HasMore {
		t.Errorf("Expected HasMore to be true")
	}

	page2 := service.GetLogsWithPagination("sess-2", 45, 10)
	if len(page2.Logs) != 5 {
		t.Errorf("Expected 5 logs on last page, got %d", len(page2.Logs))
	}
	if page2.HasMore {
		t.Errorf("Expected HasMore to be false on last page")
	}
}

func TestLogRotationService_PruningBounds(t *testing.T) {
	service := NewLogRotationService()
	service.UpdateConfig(shared.LogRotationConfig{
		MaxLogsPerSession: 5,
		MaxLogAgeMs:       10000,
	})

	service.RegisterSession("sess-3")

	// Add 10 logs. The check `logs.entries.length > this.config.maxLogsPerSession * 1.2`
	// means 5 * 1.2 = 6.
	// When length is 7, it prunes down to maxLogsPerSession (5).
	// Let's add 10 logs.
	for i := 0; i < 10; i++ {
		service.AddLog("sess-3", shared.LogEntry{
			Timestamp: time.Now().UnixMilli(),
			Message:   "Log",
		})
	}

	// At end:
	// i=0..5 (6 logs) -> length 6, limit 6 (no prune)
	// i=6 (7 logs) -> length 7 > 6. Prunes to 5 logs.
	// i=7 (6 logs)
	// i=8 (7 logs) -> Prunes to 5 logs.
	// i=9 (6 logs) -> Returns length 6.
	logs := service.GetLogs("sess-3")
	if len(logs) > 6 || len(logs) < 5 {
		t.Errorf("Expected logs to be within pruning threshold (5-6), got %d", len(logs))
	}
}
