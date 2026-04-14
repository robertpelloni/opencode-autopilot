package supervisors

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"borg-orchestrator/pkg/shared"
)

type OpenAIChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type OpenAIChatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

type OpenAISupervisor struct {
	name         string
	provider     string
	apiKey       string
	model        string
	baseURL      string
	systemPrompt *string
	temperature  float64
}

func NewOpenAISupervisor(config shared.SupervisorConfig) *OpenAISupervisor {
	apiKey := ""
	if config.APIKey != nil {
		apiKey = *config.APIKey
	} else {
		apiKey = os.Getenv("OPENAI_API_KEY")
	}

	model := "gpt-4o"
	if config.Model != nil {
		model = *config.Model
	}

	baseURL := "https://api.openai.com/v1"
	if config.BaseURL != nil {
		baseURL = *config.BaseURL
	}

	temperature := 0.7
	if config.Temperature != nil {
		temperature = *config.Temperature
	}

	return &OpenAISupervisor{
		name:         config.Name,
		provider:     config.Provider,
		apiKey:       apiKey,
		model:        model,
		baseURL:      baseURL,
		systemPrompt: config.SystemPrompt,
		temperature:  temperature,
	}
}

// Ensure interface satisfaction
var _ shared.Supervisor = (*OpenAISupervisor)(nil)

func (s *OpenAISupervisor) GetName() string {
	return s.name
}

func (s *OpenAISupervisor) GetProvider() string {
	return s.provider
}

func (s *OpenAISupervisor) Chat(messages []shared.Message) (string, error) {
	if s.apiKey == "" {
		return "", fmt.Errorf("API key not configured for supervisor: %s (%s)", s.name, s.provider)
	}

	openaiMessages := make([]OpenAIChatMessage, 0)

	if s.systemPrompt != nil {
		openaiMessages = append(openaiMessages, OpenAIChatMessage{
			Role:    "system",
			Content: *s.systemPrompt,
		})
	}

	for _, msg := range messages {
		openaiMessages = append(openaiMessages, OpenAIChatMessage{
			Role:    msg.Role,
			Content: msg.Content,
		})
	}

	baseUrl := strings.TrimSuffix(s.baseURL, "/")
	endpoint := baseUrl
	if !strings.Contains(baseUrl, "/chat/completions") {
		endpoint = baseUrl + "/chat/completions"
	}

	bodyData := map[string]interface{}{
		"model":       s.model,
		"messages":    openaiMessages,
		"temperature": s.temperature,
	}
	bodyBytes, err := json.Marshal(bodyData)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request body: %w", err)
	}

	req, err := http.NewRequest("POST", endpoint, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := FetchWithRetry(s.name, req, DefaultRetryConfig)
	if err != nil {
		return "", fmt.Errorf("%s API request failed: %w", s.provider, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		errorBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("%s API error (%d): %s", s.provider, resp.StatusCode, string(errorBytes))
	}

	var data OpenAIChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	if len(data.Choices) > 0 {
		return data.Choices[0].Message.Content, nil
	}
	return "", nil
}

func (s *OpenAISupervisor) IsAvailable() (bool, error) {
	if s.apiKey == "" || s.baseURL == "" {
		return false, nil
	}

	req, err := http.NewRequest("GET", s.baseURL+"/models", nil)
	if err != nil {
		return false, err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false, nil
	}
	defer resp.Body.Close()

	return resp.StatusCode >= 200 && resp.StatusCode < 300, nil
}
