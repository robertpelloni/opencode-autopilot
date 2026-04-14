package env

import (
	"os"
	"strings"
	"sync"


	"borg-orchestrator/pkg/shared"
)

type EnvironmentConfig struct {
	Inherit     bool              `json:"inherit"`
	Variables   map[string]string `json:"variables"`
	Secrets     []string          `json:"secrets"`
	Passthrough []string          `json:"passthrough"`
}

type SessionEnvironment struct {
	SessionID string            `json:"sessionId"`
	CLIType   shared.CLIType    `json:"cliType"`
	Config    EnvironmentConfig `json:"config"`
	Resolved  map[string]string `json:"resolved"`
}

var DefaultPassthroughVars = []string{
	"PATH", "HOME", "USER", "SHELL", "TERM",
	"LANG", "LC_ALL", "TMPDIR", "TMP", "TEMP",
	"NODE_ENV", "BUN_ENV",
}

var CommonSecrets = []string{
	"OPENAI_API_KEY",
	"ANTHROPIC_API_KEY",
	"GEMINI_API_KEY",
	"DEEPSEEK_API_KEY",
	"XAI_API_KEY",
	"GITHUB_TOKEN",
	"GITLAB_TOKEN",
	"NPM_TOKEN",
	"AWS_ACCESS_KEY_ID",
	"AWS_SECRET_ACCESS_KEY",
	"STRIPE_SECRET_KEY",
}

type EnvironmentManagerService struct {
	sessions map[string]*SessionEnvironment
	global   EnvironmentConfig
	mu       sync.RWMutex
}

func NewEnvironmentManagerService() *EnvironmentManagerService {
	return &EnvironmentManagerService{
		sessions: make(map[string]*SessionEnvironment),
		global: EnvironmentConfig{
			Inherit:     true,
			Variables:   make(map[string]string),
			Secrets:     append([]string{}, CommonSecrets...),
			Passthrough: append([]string{}, DefaultPassthroughVars...),
		},
	}
}

func (s *EnvironmentManagerService) ConfigureGlobal(config EnvironmentConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.global.Inherit = config.Inherit

	if config.Variables != nil {
		s.global.Variables = config.Variables
	}

	if config.Secrets != nil {
		s.global.Secrets = append([]string{}, config.Secrets...)
	}

	if config.Passthrough != nil {
		s.global.Passthrough = append([]string{}, config.Passthrough...)
	}
}

func (s *EnvironmentManagerService) PrepareEnvironment(sessionID string, cliType shared.CLIType, customConfig *EnvironmentConfig) (*SessionEnvironment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	config := EnvironmentConfig{
		Inherit:     s.global.Inherit,
		Variables:   make(map[string]string),
		Secrets:     append([]string{}, s.global.Secrets...),
		Passthrough: append([]string{}, s.global.Passthrough...),
	}

	for k, v := range s.global.Variables {
		config.Variables[k] = v
	}

	if customConfig != nil {
		config.Inherit = customConfig.Inherit
		for k, v := range customConfig.Variables {
			config.Variables[k] = v
		}
		if customConfig.Secrets != nil {
			config.Secrets = append(config.Secrets, customConfig.Secrets...)
		}
		if customConfig.Passthrough != nil {
			config.Passthrough = append(config.Passthrough, customConfig.Passthrough...)
		}
	}

	resolved := make(map[string]string)

	if config.Inherit {
		for _, env := range os.Environ() {
			parts := strings.SplitN(env, "=", 2)
			if len(parts) == 2 {
				resolved[parts[0]] = parts[1]
			}
		}
	} else {
		for _, key := range config.Passthrough {
			if val, ok := os.LookupEnv(key); ok {
				resolved[key] = val
			}
		}
	}

	for k, v := range config.Variables {
		resolved[k] = v
	}

	env := &SessionEnvironment{
		SessionID: sessionID,
		CLIType:   cliType,
		Config:    config,
		Resolved:  resolved,
	}

	s.sessions[sessionID] = env
	return env, nil
}

func (s *EnvironmentManagerService) GetEnvironment(sessionID string) (*SessionEnvironment, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	env, ok := s.sessions[sessionID]
	return env, ok
}

func (s *EnvironmentManagerService) UpdateSessionVariable(sessionID string, key, value string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	env, ok := s.sessions[sessionID]
	if !ok {
		return false
	}

	env.Config.Variables[key] = value
	env.Resolved[key] = value
	return true
}

func (s *EnvironmentManagerService) RemoveSession(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.sessions, sessionID)
}

func (s *EnvironmentManagerService) IsSecret(key string, sessionID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	checkSecret := func(secrets []string, k string) bool {
		for _, secret := range secrets {
			if secret == k || (strings.HasSuffix(secret, "*") && strings.HasPrefix(k, strings.TrimSuffix(secret, "*"))) {
				return true
			}
		}
		return false
	}

	if checkSecret(s.global.Secrets, key) {
		return true
	}

	if sessionID != "" {
		if env, ok := s.sessions[sessionID]; ok {
			if checkSecret(env.Config.Secrets, key) {
				return true
			}
		}
	}

	return false
}

func (s *EnvironmentManagerService) RedactLog(log string, sessionID string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	secretsToRedact := []string{}

	addSecrets := func(resolved map[string]string, secrets []string) {
		for k, v := range resolved {
			if v != "" && len(v) > 3 {
				for _, secret := range secrets {
					if secret == k || (strings.HasSuffix(secret, "*") && strings.HasPrefix(k, strings.TrimSuffix(secret, "*"))) {
						secretsToRedact = append(secretsToRedact, v)
					}
				}
			}
		}
	}

	// add globals
	globalResolved := make(map[string]string)
	for _, env := range os.Environ() {
		parts := strings.SplitN(env, "=", 2)
		if len(parts) == 2 {
			globalResolved[parts[0]] = parts[1]
		}
	}
	for k, v := range s.global.Variables {
		globalResolved[k] = v
	}
	addSecrets(globalResolved, s.global.Secrets)

	if sessionID != "" {
		if env, ok := s.sessions[sessionID]; ok {
			addSecrets(env.Resolved, env.Config.Secrets)
		}
	}

	redacted := log
	for _, secret := range secretsToRedact {
		redacted = strings.ReplaceAll(redacted, secret, "[REDACTED]")
	}

	return redacted
}
