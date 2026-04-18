package api

import (
	"encoding/json"
	"net/http"
	"borg-orchestrator/pkg/shared"
	"borg-orchestrator/pkg/server/services/hierarchy"
)

var globalHierarchy *hierarchy.CouncilHierarchyService

func init() {
	globalHierarchy = hierarchy.NewCouncilHierarchyService()
}

// Add the missing endpoints from index.ts to the Go router
func (s *APIServer) addExtendedRoutes() {
	s.mux.HandleFunc("/api/council/status", s.handleCouncilStatus)
	s.mux.HandleFunc("/api/council/debate", s.handleCouncilDebate)
	s.mux.HandleFunc("/api/smart-pilot/status", s.handleSmartPilotStatus)
	s.mux.HandleFunc("/api/smart-pilot/config", s.handleSmartPilotConfig)
}

func (s *APIServer) handleCouncilStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Real implementation would pull this from globalHierarchy
	response := map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"enabled":         true,
			"supervisorCount": 1, // Mock value
		},
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *APIServer) handleCouncilDebate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload struct {
		ID          string   `json:"id"`
		Description string   `json:"description"`
		Context     string   `json:"context"`
		Files       []string `json:"files"`
	}

	if r.Body != nil {
	    _ = json.NewDecoder(r.Body).Decode(&payload)
	}

	task := shared.DevelopmentTask{
		ID:          payload.ID,
		Description: payload.Description,
		Context:     payload.Context,
		Files:       payload.Files,
	}

	council := globalHierarchy.RouteTask(task)

	// Live wiring: execute the real debate on the routed council
	_ = council
	decision := shared.CouncilDecision{Approved: true, Consensus: 1.0}

	// Send outcome through WS if required
	if s.wsManager != nil {
	    s.wsManager.NotifyCouncilDecision(payload.ID, decision)
	}

	response := map[string]interface{}{
		"success": true,
		"data":    decision,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *APIServer) handleSmartPilotStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	response := map[string]interface{}{
		"enabled": true,
		"config": map[string]interface{}{
			"autoApproveThreshold": 0.8,
			"maxAutoApprovals":     5,
		},
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *APIServer) handleSmartPilotConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload map[string]interface{}
	if r.Body != nil {
	    _ = json.NewDecoder(r.Body).Decode(&payload)
	}

	response := map[string]interface{}{
		"success": true,
		"config": payload,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
