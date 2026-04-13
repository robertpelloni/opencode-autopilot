package session

import (
	"testing"
	"borg-orchestrator/pkg/server/services/env"
	"borg-orchestrator/pkg/server/services/cli"
)

func TestSessionManagerService(t *testing.T) {
	envMgr := env.NewEnvironmentManagerService()
	cliReg := cli.NewCLIRegistryService()
	manager := NewSessionManagerService(envMgr, cliReg)

	session, err := manager.CreateSession("test-123", "aider")
	if err != nil {
		t.Fatalf("Expected to create session: %v", err)
	}

	if session.ID != "test-123" {
		t.Errorf("Expected session ID to match")
	}

	_, err = manager.GetSession("test-123")
	if err != nil {
		t.Errorf("Expected to get session")
	}

	_, err = manager.CreateSession("test-456", "unknown-cli")
	if err == nil {
		t.Errorf("Expected error when creating session with unknown CLI type")
	}
}
