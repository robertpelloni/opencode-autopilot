package cli

import (
	"encoding/json"
	"errors"
	"sync"
	"borg-orchestrator/pkg/shared"
)

type CLIConfig struct {
	Type        shared.CLIType    `json:"type"`
	Command     string            `json:"command"`
	Arguments   []string          `json:"arguments"`
	Environment map[string]string `json:"environment"`
	Version     string            `json:"version"`
}

type CLIRegistryService struct {
	configs map[shared.CLIType]CLIConfig
	mu      sync.RWMutex
}

func NewCLIRegistryService() *CLIRegistryService {
	s := &CLIRegistryService{
		configs: make(map[shared.CLIType]CLIConfig),
	}
	s.loadDefaults()
	return s
}

func (s *CLIRegistryService) loadDefaults() {
	s.configs["aider"] = CLIConfig{
		Type:    "aider",
		Command: "aider",
		Arguments: []string{"--no-auto-commits"},
	}
	s.configs["claude-code"] = CLIConfig{
		Type:    "claude-code",
		Command: "claude",
	}
}

func (s *CLIRegistryService) GetConfig(cliType shared.CLIType) (CLIConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	config, ok := s.configs[cliType]
	if !ok {
		return CLIConfig{}, errors.New("CLI config not found for type: " + string(cliType))
	}
	return config, nil
}

func (s *CLIRegistryService) RegisterConfig(config CLIConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.configs[config.Type] = config
}

func (s *CLIRegistryService) GetAllConfigs() map[shared.CLIType]CLIConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()

	copyConfigs := make(map[shared.CLIType]CLIConfig)
	for k, v := range s.configs {
		copyConfigs[k] = v
	}
	return copyConfigs
}

func (s *CLIRegistryService) ExportJSON() ([]byte, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return json.Marshal(s.configs)
}
