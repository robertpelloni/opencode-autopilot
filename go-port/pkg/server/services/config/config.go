package config

import "borg-orchestrator/pkg/shared"

type AutopilotConfig struct {
	Council  shared.CouncilConfig
	Server   ServerConfig
	Sessions SessionsConfig
}

type ServerConfig struct {
	Port        int
	Host        string
	CorsOrigins *string
}

type SessionsConfig struct {
	BasePort     int
	MaxSessions  int
	PollInterval int
}

func LoadConfig() AutopilotConfig {
	return AutopilotConfig{
		Council: shared.CouncilConfig{
			SmartPilot: func(b bool) *bool { return &b }(false),
		},
		Sessions: SessionsConfig{
			BasePort: 3000,
		},
	}
}
