package env

import "borg-orchestrator/pkg/shared"

var Service = &EnvironmentManager{}

type EnvironmentManager struct{}

func (s *EnvironmentManager) GetSessionEnvironment(sessionID string) map[string]string {
	return make(map[string]string)
}

func (s *EnvironmentManager) CreateSessionEnvironment(sessionID string, cliType shared.CLIType, envVars map[string]string) map[string]string {
	return make(map[string]string)
}
