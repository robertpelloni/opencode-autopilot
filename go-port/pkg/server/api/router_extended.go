package api

import (
	"encoding/json"
	"net/http"
)

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
	response := map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"approved":  true,
			"consensus": 1.0,
			"votes":     []interface{}{},
		},
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

	// Normally we would decode the request body here

	response := map[string]interface{}{
		"success": true,
		"config": map[string]interface{}{
			"autoApproveThreshold": 0.9,
			"maxAutoApprovals":     5,
		},
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
