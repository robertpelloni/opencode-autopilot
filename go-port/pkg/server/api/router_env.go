package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"borg-orchestrator/pkg/server/services/env"
)

func (s *APIServer) addEnvRoutes() {
	s.mux.HandleFunc("/api/env/global", s.handleEnvGlobal)
	s.mux.HandleFunc("/api/env/secrets", s.handleEnvSecrets)
	s.mux.HandleFunc("/api/env/overrides", s.handleEnvOverrides)
}

func (s *APIServer) handleEnvGlobal(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		// Create a sanitized view (no secrets)
		response := map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"variables": map[string]string{
					"NODE_ENV": "development",
					"BORG_VERSION": "1.0.30",
				},
				"passthrough": env.DefaultPassthroughVars,
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	if r.Method == http.MethodPost {
		var payload struct {
			Key   string `json:"key"`
			Value string `json:"value"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "Invalid payload", http.StatusBadRequest)
			return
		}

		s.envManager.ConfigureGlobal(env.EnvironmentConfig{
			Variables: map[string]string{payload.Key: payload.Value},
		})

		response := map[string]interface{}{
			"success": true,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func (s *APIServer) handleEnvSecrets(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		response := map[string]interface{}{
			"success": true,
			"data":    env.CommonSecrets,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	if r.Method == http.MethodPost {
		var payload struct {
			Key string `json:"key"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "Invalid payload", http.StatusBadRequest)
			return
		}

		s.envManager.ConfigureGlobal(env.EnvironmentConfig{
			Secrets: []string{payload.Key},
		})

		response := map[string]interface{}{
			"success": true,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func (s *APIServer) handleEnvOverrides(w http.ResponseWriter, r *http.Request) {
	// Simple query param routing for session overrides
	sessionID := r.URL.Query().Get("sessionId")

	if r.Method == http.MethodGet {
		if sessionID == "" {
			http.Error(w, "sessionId required", http.StatusBadRequest)
			return
		}

		envCtx, exists := s.envManager.GetEnvironment(sessionID)
		if !exists {
			http.Error(w, "Session not found", http.StatusNotFound)
			return
		}

		// Scrub secrets from the response for UI display
		safeResolved := make(map[string]string)
		for k, v := range envCtx.Resolved {
			if s.envManager.IsSecret(k, sessionID) {
				safeResolved[k] = "[REDACTED]"
			} else {
				safeResolved[k] = v
			}
		}

		response := map[string]interface{}{
			"success": true,
			"data":    safeResolved,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	if r.Method == http.MethodPost {
		if sessionID == "" {
			http.Error(w, "sessionId required", http.StatusBadRequest)
			return
		}

		var payload struct {
			Key   string `json:"key"`
			Value string `json:"value"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "Invalid payload", http.StatusBadRequest)
			return
		}

		// Specifically inject the override to the terminal if it's already active
		// BORG_CTRL or standard export depending on platform
		if session, err := s.sessionManager.GetSession(sessionID); err == nil && session.Status == "running" {
			exportCmd := "export " + payload.Key + "='" + strings.ReplaceAll(payload.Value, "'", "'\\''") + "'"
			s.sessionManager.SendGuidance(sessionID, exportCmd)
		}

		success := s.envManager.UpdateSessionVariable(sessionID, payload.Key, payload.Value)
		if !success {
			http.Error(w, "Session not found", http.StatusNotFound)
			return
		}

		response := map[string]interface{}{
			"success": true,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}
