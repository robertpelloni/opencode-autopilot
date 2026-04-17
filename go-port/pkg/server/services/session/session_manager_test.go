package session

import (
	"borg-orchestrator/pkg/server/services/cli"
	"borg-orchestrator/pkg/server/services/env"
	"borg-orchestrator/pkg/server/services/ws"
	"testing"
)

func TestSessionManagerService(t *testing.T) {
	envMgr := env.NewEnvironmentManagerService()
	cliReg := cli.NewCLIRegistryService()
	wsMgr := ws.NewWSManagerService()
	manager := NewSessionManagerService(envMgr, cliReg, wsMgr)

	session, err := manager.CreateSession("test-123", "aider")
	if err != nil {
		t.Fatalf("Expected to create session: %v", err)
	}

	if session.ID != "test-123" {
		t.Errorf("Expected session ID to match")
	}

	if session.Cmd == nil {
		t.Errorf("Expected session.Cmd to be initialized")
	}

	if session.StdinPipe == nil {
		t.Errorf("Expected session.StdinPipe to be initialized")
	}

	_, err = manager.GetSession("test-123")
	if err != nil {
		t.Errorf("Expected to get session")
	}

	active := manager.GetActiveSessions()
	if len(active) != 1 {
		t.Errorf("Expected 1 active session, got %d", len(active))
	}

	_, err = manager.CreateSession("test-456", "unknown-cli")
	if err == nil {
		t.Errorf("Expected error when creating session with unknown CLI type")
	}

	// Test setting guidance on a non-running session
	err = manager.SendGuidance("test-123", "do this")
	if err == nil || err.Error() != "Session is not running" {
		t.Errorf("Expected 'Session is not running' error, got: %v", err)
	}
}
