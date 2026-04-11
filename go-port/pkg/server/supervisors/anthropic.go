package supervisors

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"borg-orchestrator/pkg/shared"
)

type AnthropicMessage struct {
	Role    string `json:"role"` // 'user' | 'assistant'
	Content string `json:"content"`
}

type AnthropicResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
}

type AnthropicSupervisor struct {
	name         string
	provider     string
	apiKey       string
	model        string
	baseURL      string
	systemPrompt *string
	temperature  float64
}

// Ensure interface satisfaction
var _ shared.Supervisor = (*AnthropicSupervisor)(nil)

func NewAnthropicSupervisor(config shared.SupervisorConfig) *AnthropicSupervisor {
	apiKey := ""
	if config.APIKey != nil {
		apiKey = *config.APIKey
	} else {
		apiKey = os.Getenv("ANTHROPIC_API_KEY")
	}

	model := "claude-3-5-sonnet-20241022"
	if config.Model != nil {
		model = *config.Model
	}

	baseURL := "https://api.anthropic.com"
	if config.BaseURL != nil {
		baseURL = *config.BaseURL
	}

	temperature := 0.7
	if config.Temperature != nil {
		temperature = *config.Temperature
	}

	return &AnthropicSupervisor{
		name:         config.Name,
		provider:     config.Provider,
		apiKey:       apiKey,
		model:        model,
		baseURL:      baseURL,
		systemPrompt: config.SystemPrompt,
		temperature:  temperature,
	}
}

func (s *AnthropicSupervisor) GetName() string {
	return s.name
}

func (s *AnthropicSupervisor) GetProvider() string {
	return s.provider
}

func (s *AnthropicSupervisor) Chat(messages []shared.Message) (string, error) {
	if s.apiKey == "" {
		return "", fmt.Errorf("Anthropic API key not configured for supervisor: %s", s.name)
	}

	anthropicMessages := make([]AnthropicMessage, 0)
	systemContent := ""
	if s.systemPrompt != nil {
		systemContent = *s.systemPrompt
	}

	for _, msg := range messages {
		if msg.Role == "system" {
			if systemContent != "" {
				systemContent = fmt.Sprintf("%s\n\n%s", systemContent, msg.Content)
			} else {
				systemContent = msg.Content
			}
		} else {
			anthropicMessages = append(anthropicMessages, AnthropicMessage{
				Role:    msg.Role,
				Content: msg.Content,
			})
		}
	}

	if len(anthropicMessages) == 0 || anthropicMessages[0].Role != "user" {
		return "", fmt.Errorf("Anthropic requires conversation to start with a user message")
	}

	bodyData := map[string]interface{}{
		"model":       s.model,
		"max_tokens":  4096,
		"messages":    anthropicMessages,
		"temperature": s.temperature,
	}

	if systemContent != "" {
		bodyData["system"] = systemContent
	}

	bodyBytes, err := json.Marshal(bodyData)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request body: %w", err)
	}

	endpoint := strings.TrimSuffix(s.baseURL, "/") + "/v1/messages"
	req, err := http.NewRequest("POST", endpoint, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", s.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := FetchWithRetry(s.name, req, DefaultRetryConfig)
	if err != nil {
		return "", fmt.Errorf("Anthropic API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		errorBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("Anthropic API error (%d): %s", resp.StatusCode, string(errorBytes))
	}

	var data AnthropicResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	for _, c := range data.Content {
		if c.Type == "text" {
			return c.Text, nil
		}
	}
	return "", nil
}

func (s *AnthropicSupervisor) IsAvailable() (bool, error) {
	return s.apiKey != "", nil
}
