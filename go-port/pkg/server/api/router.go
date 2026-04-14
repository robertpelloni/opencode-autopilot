package api

import (
	"encoding/json"
	"net/http"

	"borg-orchestrator/pkg/server/services/cli"
	"borg-orchestrator/pkg/server/services/env"
	"borg-orchestrator/pkg/server/services/session"
	"borg-orchestrator/pkg/server/services/ws"
)

type APIServer struct {
	sessionManager *session.SessionManagerService
	envManager     *env.EnvironmentManagerService
	cliRegistry    *cli.CLIRegistryService
	wsManager      *ws.WSManagerService
	mux            *http.ServeMux
}

func NewAPIServer(
	sessionManager *session.SessionManagerService,
	envManager *env.EnvironmentManagerService,
	cliRegistry *cli.CLIRegistryService,
	wsManager *ws.WSManagerService,
) *APIServer {
	s := &APIServer{
		sessionManager: sessionManager,
		envManager:     envManager,
		cliRegistry:    cliRegistry,
		wsManager:      wsManager,
		mux:            http.NewServeMux(),
	}
	s.setupRoutes()
	return s
}

func (s *APIServer) setupRoutes() {
	s.mux.HandleFunc("/health", s.handleHealth)
	s.mux.HandleFunc("/api/sessions", s.handleSessions)
	s.mux.HandleFunc("/api/cli/configs", s.handleCLIConfigs)
}

func (s *APIServer) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	response := map[string]string{
		"status": "healthy",
		"version": "1.0.24",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *APIServer) handleSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// This is a stub, actual implementation would list sessions from manager
	response := map[string]interface{}{
		"success": true,
		"data":    []string{},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *APIServer) handleCLIConfigs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	configs := s.cliRegistry.GetAllConfigs()

	response := map[string]interface{}{
		"success": true,
		"data":    configs,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *APIServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Enable CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	s.mux.ServeHTTP(w, r)
}
