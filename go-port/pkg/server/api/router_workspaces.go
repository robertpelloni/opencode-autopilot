package api

import (
	"encoding/json"
	"net/http"
)

func (s *APIServer) addWorkspaceRoutes() {
	s.mux.HandleFunc("/api/workspaces", s.handleWorkspaces)
}

func (s *APIServer) handleWorkspaces(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Mock workspaces list
	workspaces := []map[string]string{
		{"id": "ws-1", "name": "Default Workspace", "path": "/app"},
		{"id": "ws-2", "name": "Frontend Project", "path": "/app/frontend"},
	}

	response := map[string]interface{}{
		"success": true,
		"data":    workspaces,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
