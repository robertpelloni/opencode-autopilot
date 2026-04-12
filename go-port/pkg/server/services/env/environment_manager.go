package env

import (
	"borg-orchestrator/pkg/shared"
	"os"
	"regexp"
	"strings"
	"sync"
)

type EnvironmentConfig struct {
	Inherit     bool
	Variables   map[string]string
	Secrets     []string
	Passthrough []string
}

type SessionEnvironment struct {
	SessionId string
	CliType   shared.CLIType
	Config    EnvironmentConfig
	Resolved  map[string]string
}

var defaultPassthroughVars = []string{
	"PATH",
	"HOME",
	"USER",
	"SHELL",
	"TERM",
	"LANG",
	"LC_ALL",
	"TMPDIR",
	"TMP",
	"TEMP",
	"NODE_ENV",
	"BUN_ENV",
}

var cliSpecificVars = map[shared.CLIType][]string{
	shared.Opencode:           {"OPENCODE_*", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"},
	shared.Claude:             {"ANTHROPIC_API_KEY", "CLAUDE_*"},
	shared.Aider:              {"AIDER_*", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"},
	shared.Cursor:             {"CURSOR_*", "OPENAI_API_KEY"},
	shared.Continue:           {"CONTINUE_*", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"},
	shared.Cody:               {"SRC_*", "CODY_*"},
	shared.Copilot:            {"GITHUB_*", "GH_*"},
	shared.Custom:             {},
	shared.Adrenaline:         {"ADRENALINE_*", "OPENAI_API_KEY"},
	shared.AmazonQ:            {"AWS_*", "Q_*"},
	shared.AmazonQDeveloper:   {"AWS_*", "Q_*"},
	shared.AmpCode:            {"AMP_*"},
	shared.Auggie:             {"AUGGIE_*"},
	shared.AzureOpenAI:        {"AZURE_*", "OPENAI_*"},
	shared.Bito:               {"BITO_*"},
	shared.ByteRover:          {"BYTEROVER_*"},
	shared.ClaudeCode:         {"ANTHROPIC_API_KEY", "CLAUDE_*"},
	shared.CodeCodex:          {"CODEX_*"},
	shared.CodeBuff:           {"CODEBUFF_*"},
	shared.CodeMachine:        {"CODEMACHINE_*"},
	shared.Codex:              {"CODEX_*", "OPENAI_API_KEY"},
	shared.Crush:              {"CRUSH_*"},
	shared.Dolt:               {"DOLT_*"},
	shared.Factory:            {"FACTORY_*"},
	shared.Gemini:             {"GEMINI_API_KEY", "GOOGLE_API_KEY"},
	shared.Goose:              {"GOOSE_*"},
	shared.Grok:               {"GROK_API_KEY", "XAI_API_KEY"},
	shared.Jules:              {"JULES_*"},
	shared.KiloCode:           {"KILO_*"},
	shared.Kimi:               {"KIMI_API_KEY", "MOONSHOT_API_KEY"},
	shared.LLM:                {"LLM_*", "OPENAI_API_KEY"},
	shared.LiteLLM:            {"LITELLM_*", "OPENAI_API_KEY"},
	shared.Llamafile:          {"LLAMAFILE_*"},
	shared.Manus:              {"MANUS_*"},
	shared.MistralVibe:        {"MISTRAL_API_KEY"},
	shared.Ollama:             {"OLLAMA_*"},
	shared.OpenInterpreter:    {"INTERPRETER_*", "OPENAI_API_KEY"},
	shared.QwenCode:           {"QWEN_API_KEY", "DASHSCOPE_API_KEY"},
	shared.RowboatX:           {"ROWBOATX_*"},
	shared.Rovo:               {"ROVO_*"},
	shared.ShellPilot:         {"SHELL_PILOT_*"},
	shared.Smithery:           {"SMITHERY_*"},
	shared.Trae:               {"TRAE_*"},
	shared.Pi:                 {"PI_*"},
	shared.Warp:               {"WARP_*"},
}

type EnvironmentManager struct {
	mu              sync.RWMutex
	sessions        map[string]SessionEnvironment
	globalOverrides map[string]string
	globalSecrets   map[string]struct{}
}

var Service = NewEnvironmentManager()

func NewEnvironmentManager() *EnvironmentManager {
	return &EnvironmentManager{
		sessions:        make(map[string]SessionEnvironment),
		globalOverrides: make(map[string]string),
		globalSecrets:   make(map[string]struct{}),
	}
}

func (m *EnvironmentManager) SetGlobalOverride(key string, value string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.globalOverrides[key] = value
}

func (m *EnvironmentManager) RemoveGlobalOverride(key string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.globalOverrides, key)
}

func (m *EnvironmentManager) AddGlobalSecret(key string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.globalSecrets[key] = struct{}{}
}

func (m *EnvironmentManager) CreateSessionEnvironment(
	sessionId string,
	cliType shared.CLIType,
	configVars map[string]string,
) map[string]string {

	envConfig := EnvironmentConfig{
		Inherit:     true,
		Variables:   make(map[string]string),
		Secrets:     []string{},
		Passthrough: []string{},
	}

	if configVars != nil {
		for k, v := range configVars {
			envConfig.Variables[k] = v
		}
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	resolved := m.resolveEnvironment(cliType, envConfig)

	m.sessions[sessionId] = SessionEnvironment{
		SessionId: sessionId,
		CliType:   cliType,
		Config:    envConfig,
		Resolved:  resolved,
	}

	return resolved
}

func (m *EnvironmentManager) resolveEnvironment(cliType shared.CLIType, config EnvironmentConfig) map[string]string {
	result := make(map[string]string)

	if config.Inherit {
		cliSpecific := cliSpecificVars[cliType]
		passthroughPatterns := append([]string{}, defaultPassthroughVars...)
		passthroughPatterns = append(passthroughPatterns, config.Passthrough...)
		passthroughPatterns = append(passthroughPatterns, cliSpecific...)

		for _, envStr := range os.Environ() {
			parts := strings.SplitN(envStr, "=", 2)
			if len(parts) == 2 {
				key := parts[0]
				value := parts[1]
				if value != "" && m.matchesPattern(key, passthroughPatterns) {
					result[key] = value
				}
			}
		}
	}

	for k, v := range m.globalOverrides {
		result[k] = v
	}

	for k, v := range config.Variables {
		result[k] = m.expandVariables(v, result)
	}

	return result
}

func (m *EnvironmentManager) matchesPattern(key string, patterns []string) bool {
	for _, pattern := range patterns {
		if strings.HasSuffix(pattern, "*") {
			prefix := pattern[:len(pattern)-1]
			if strings.HasPrefix(key, prefix) {
				return true
			}
		} else if pattern == key {
			return true
		}
	}
	return false
}

var varRegex = regexp.MustCompile(`\$\{(\w+)\}`)

func (m *EnvironmentManager) expandVariables(value string, env map[string]string) string {
	return varRegex.ReplaceAllStringFunc(value, func(match string) string {
		varName := match[2 : len(match)-1]
		if val, exists := env[varName]; exists {
			return val
		}
		if val := os.Getenv(varName); val != "" {
			return val
		}
		return ""
	})
}

func (m *EnvironmentManager) GetSessionEnvironment(sessionId string) map[string]string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if sess, exists := m.sessions[sessionId]; exists {
		// Return copy
		cp := make(map[string]string)
		for k, v := range sess.Resolved {
			cp[k] = v
		}
		return cp
	}
	return nil
}

func (m *EnvironmentManager) UpdateSessionVariable(sessionId string, key string, value string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	sess, exists := m.sessions[sessionId]
	if !exists {
		return
	}

	sess.Config.Variables[key] = value
	sess.Resolved[key] = m.expandVariables(value, sess.Resolved)
	m.sessions[sessionId] = sess
}

func (m *EnvironmentManager) RemoveSessionVariable(sessionId string, key string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	sess, exists := m.sessions[sessionId]
	if !exists {
		return
	}

	delete(sess.Config.Variables, key)
	delete(sess.Resolved, key)
	m.sessions[sessionId] = sess
}

func (m *EnvironmentManager) DeleteSessionEnvironment(sessionId string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.sessions, sessionId)
}

func (m *EnvironmentManager) GetSanitizedEnvironment(sessionId string) map[string]string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	sess, exists := m.sessions[sessionId]
	if !exists {
		return make(map[string]string)
	}

	result := make(map[string]string)
	secretKeys := make(map[string]struct{})

	for _, s := range sess.Config.Secrets {
		secretKeys[s] = struct{}{}
	}
	for k := range m.globalSecrets {
		secretKeys[k] = struct{}{}
	}

	for k, v := range sess.Resolved {
		_, isSecret := secretKeys[k]
		if isSecret || m.looksLikeSecret(k) {
			result[k] = "***REDACTED***"
		} else {
			result[k] = v
		}
	}

	return result
}

var secretPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)api[_-]?key`),
	regexp.MustCompile(`(?i)secret`),
	regexp.MustCompile(`(?i)password`),
	regexp.MustCompile(`(?i)token`),
	regexp.MustCompile(`(?i)credential`),
	regexp.MustCompile(`(?i)auth`),
	regexp.MustCompile(`(?i)private[_-]?key`),
}

func (m *EnvironmentManager) looksLikeSecret(key string) bool {
	for _, pattern := range secretPatterns {
		if pattern.MatchString(key) {
			return true
		}
	}
	return false
}

func (m *EnvironmentManager) GetRequiredVarsForCLI(cliType shared.CLIType) []string {
	required := map[shared.CLIType][]string{
		shared.Opencode:           {},
		shared.Claude:             {"ANTHROPIC_API_KEY"},
		shared.Aider:              {"OPENAI_API_KEY"},
		shared.Cursor:             {},
		shared.Continue:           {},
		shared.Cody:               {"SRC_ACCESS_TOKEN"},
		shared.Copilot:            {"GITHUB_TOKEN"},
		shared.Custom:             {},
		shared.Adrenaline:         {},
		shared.AmazonQ:            {},
		shared.AmazonQDeveloper:   {},
		shared.AmpCode:            {},
		shared.Auggie:             {},
		shared.AzureOpenAI:        {"AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT"},
		shared.Bito:               {},
		shared.ByteRover:          {},
		shared.ClaudeCode:         {"ANTHROPIC_API_KEY"},
		shared.CodeCodex:          {},
		shared.CodeBuff:           {},
		shared.CodeMachine:        {},
		shared.Codex:              {},
		shared.Crush:              {},
		shared.Dolt:               {},
		shared.Factory:            {},
		shared.Gemini:             {"GEMINI_API_KEY"},
		shared.Goose:              {},
		shared.Grok:               {"GROK_API_KEY"},
		shared.Jules:              {},
		shared.KiloCode:           {},
		shared.Kimi:               {"KIMI_API_KEY"},
		shared.LLM:                {},
		shared.LiteLLM:            {},
		shared.Llamafile:          {},
		shared.Manus:              {},
		shared.MistralVibe:        {"MISTRAL_API_KEY"},
		shared.Ollama:             {},
		shared.OpenInterpreter:    {},
		shared.QwenCode:           {"QWEN_API_KEY"},
		shared.RowboatX:           {},
		shared.Rovo:               {},
		shared.ShellPilot:         {},
		shared.Smithery:           {},
		shared.Trae:               {},
		shared.Pi:                 {},
		shared.Warp:               {},
	}

	if vars, ok := required[cliType]; ok {
		return vars
	}
	return []string{}
}

func (m *EnvironmentManager) ValidateEnvironmentForCLI(cliType shared.CLIType, env map[string]string) (bool, []string) {
	required := m.GetRequiredVarsForCLI(cliType)
	var missing []string

	for _, key := range required {
		if val, exists := env[key]; !exists || val == "" {
			missing = append(missing, key)
		}
	}

	return len(missing) == 0, missing
}
