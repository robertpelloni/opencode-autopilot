package api

import (
	"encoding/json"
	"net/http"
	"strings"
)

// Mock data to unblock plugin endpoints until fully integrated
type PluginMock struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Enabled bool   `json:"enabled"`
	Version string `json:"version"`
}

var mockPlugins = map[string]*PluginMock{
	"plugin-1": {ID: "plugin-1", Name: "Auto-Formatter", Enabled: true, Version: "1.0.0"},
	"plugin-2": {ID: "plugin-2", Name: "Security-Scanner", Enabled: false, Version: "0.5.0"},
}

func (s *APIServer) addPluginRoutes() {
	s.mux.HandleFunc("/api/plugins", s.handlePlugins)
}

func (s *APIServer) handlePlugins(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		pluginsList := make([]*PluginMock, 0)
		for _, p := range mockPlugins {
			pluginsList = append(pluginsList, p)
		}

		response := map[string]interface{}{
			"success": true,
			"data":    pluginsList,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	if r.Method == http.MethodPost {
		// Expects path like /api/plugins/plugin-1/toggle
		parts := strings.Split(r.URL.Path, "/")
		if len(parts) >= 5 && parts[4] == "toggle" {
			pluginID := parts[3]
			if plugin, exists := mockPlugins[pluginID]; exists {
				plugin.Enabled = !plugin.Enabled

				response := map[string]interface{}{
					"success": true,
					"data":    plugin,
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(response)
				return
			}
			http.Error(w, "Plugin not found", http.StatusNotFound)
			return
		}
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}
