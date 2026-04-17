package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"borg-orchestrator/pkg/server/services/cli"
	"borg-orchestrator/pkg/server/services/env"
	"borg-orchestrator/pkg/server/services/session"
	"borg-orchestrator/pkg/server/services/ws"
)

func TestAPIServer_Health(t *testing.T) {
	envMgr := env.NewEnvironmentManagerService()
	cliReg := cli.NewCLIRegistryService()
	wsMgr := ws.NewWSManagerService()
	sessionMgr := session.NewSessionManagerService(envMgr, cliReg, wsMgr)

	server := NewAPIServer(sessionMgr, envMgr, cliReg, wsMgr)

	req, err := http.NewRequest("GET", "/health", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	server.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	var response map[string]string
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	if err != nil {
		t.Fatal(err)
	}

	if response["status"] != "healthy" {
		t.Errorf("Expected status 'healthy', got '%s'", response["status"])
	}
}
