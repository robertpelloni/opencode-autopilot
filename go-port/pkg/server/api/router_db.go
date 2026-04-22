package api

import (
	"encoding/json"
	"net/http"
	"borg-orchestrator/pkg/server/services/db"
)

var globalDB *db.DatabaseService

func init() {
	// Initialize global database instance (in a real app this path would be configurable)
	globalDB, _ = db.NewDatabaseService("metamcp.sqlite")
}

func (s *APIServer) addDBRoutes() {
	s.mux.HandleFunc("/api/quotas", s.handleQuotas)
	s.mux.HandleFunc("/api/history", s.handleHistory)
}

func (s *APIServer) handleQuotas(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	quotas, err := globalDB.GetQuotas()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"success": true,
		"data":    quotas,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *APIServer) handleHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	history, err := globalDB.GetDebateHistory(50)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"success": true,
		"data":    history,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
