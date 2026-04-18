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
	s.addExtendedRoutes()
	return s
}

func (s *APIServer) setupRoutes() {
	s.mux.HandleFunc("/health", s.handleHealth)
	s.mux.HandleFunc("/api/sessions", s.handleSessions)
	s.mux.HandleFunc("/api/sessions/create", s.handleCreateSession)
	s.mux.HandleFunc("/api/cli/configs", s.handleCLIConfigs)
	s.mux.HandleFunc("/ws", s.wsManager.HandleConnection)
}

func (s *APIServer) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	response := map[string]string{
		"status": "healthy",
		"version": "1.0.27",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *APIServer) handleSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	sessions := s.sessionManager.GetActiveSessions()

	response := map[string]interface{}{
		"success": true,
		"data":    sessions,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *APIServer) handleCreateSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload struct {
		ID      string `json:"id"`
		CLIType string `json:"cliType"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	// Create and register session via live connection
	sess, err := s.sessionManager.CreateSession(payload.ID, "aider")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	err = s.sessionManager.StartSession(sess.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"success": true,
		"data":    sess,
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
