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

func TestAPIServer_ExtendedRoutes(t *testing.T) {
	envMgr := env.NewEnvironmentManagerService()
	cliReg := cli.NewCLIRegistryService()
	wsMgr := ws.NewWSManagerService()
	sessionMgr := session.NewSessionManagerService(envMgr, cliReg, wsMgr)

	server := NewAPIServer(sessionMgr, envMgr, cliReg, wsMgr)

	// Test Council Status
	req, _ := http.NewRequest("GET", "/api/council/status", nil)
	rr := httptest.NewRecorder()
	server.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	var response map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &response)
	if response["success"] != true {
		t.Errorf("Expected success true")
	}

	// Test Smart Pilot Config
	req, _ = http.NewRequest("POST", "/api/smart-pilot/config", nil)
	rr = httptest.NewRecorder()
	server.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	var spResponse map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &spResponse)
	if spResponse["success"] != true {
		t.Errorf("Expected success true")
	}
}
