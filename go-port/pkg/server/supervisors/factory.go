package supervisors

import (
	"fmt"
	"os"

	"borg-orchestrator/pkg/shared"
)

func CreateSupervisor(config shared.SupervisorConfig) (shared.Supervisor, error) {
	provider := config.Provider

	switch provider {
	case "openai":
		return NewOpenAISupervisor(config), nil

	case "anthropic":
		return NewAnthropicSupervisor(config), nil

	case "deepseek":
		baseURL := "https://api.deepseek.com/v1"
		if config.BaseURL != nil {
			baseURL = *config.BaseURL
		}
		apiKey := os.Getenv("DEEPSEEK_API_KEY")
		if config.APIKey != nil {
			apiKey = *config.APIKey
		}
		config.BaseURL = &baseURL
		config.APIKey = &apiKey
		return NewOpenAISupervisor(config), nil

	case "qwen":
		baseURL := "https://dashscope.aliyuncs.com/compatible-mode/v1"
		if config.BaseURL != nil {
			baseURL = *config.BaseURL
		}
		apiKey := os.Getenv("QWEN_API_KEY")
		if config.APIKey != nil {
			apiKey = *config.APIKey
		}
		config.BaseURL = &baseURL
		config.APIKey = &apiKey
		return NewOpenAISupervisor(config), nil

	case "moonshot", "kimi":
		baseURL := "https://api.moonshot.cn/v1"
		if config.BaseURL != nil {
			baseURL = *config.BaseURL
		}
		apiKey := os.Getenv("KIMI_API_KEY")
		if apiKey == "" {
			apiKey = os.Getenv("MOONSHOT_API_KEY")
		}
		if config.APIKey != nil {
			apiKey = *config.APIKey
		}
		config.BaseURL = &baseURL
		config.APIKey = &apiKey
		return NewOpenAISupervisor(config), nil

	case "grok", "xai":
		baseURL := "https://api.x.ai/v1"
		if config.BaseURL != nil {
			baseURL = *config.BaseURL
		}
		apiKey := os.Getenv("GROK_API_KEY")
		if apiKey == "" {
			apiKey = os.Getenv("XAI_API_KEY")
		}
		if config.APIKey != nil {
			apiKey = *config.APIKey
		}
		config.BaseURL = &baseURL
		config.APIKey = &apiKey
		return NewOpenAISupervisor(config), nil

	case "gemini", "google":
		baseURL := "https://generativelanguage.googleapis.com/v1beta/openai"
		if config.BaseURL != nil {
			baseURL = *config.BaseURL
		}
		apiKey := os.Getenv("GEMINI_API_KEY")
		if apiKey == "" {
			apiKey = os.Getenv("GOOGLE_API_KEY")
		}
		if config.APIKey != nil {
			apiKey = *config.APIKey
		}
		config.BaseURL = &baseURL
		config.APIKey = &apiKey
		return NewOpenAISupervisor(config), nil

	case "custom":
		if config.BaseURL == nil || *config.BaseURL == "" {
			return nil, fmt.Errorf("Custom provider requires baseURL for supervisor: %s", config.Name)
		}
		return NewOpenAISupervisor(config), nil

	default:
		return nil, fmt.Errorf("Unknown provider: %s for supervisor: %s", provider, config.Name)
	}
}

func CreateSupervisors(configs []shared.SupervisorConfig) ([]shared.Supervisor, error) {
	supervisors := make([]shared.Supervisor, 0, len(configs))
	for _, config := range configs {
		s, err := CreateSupervisor(config)
		if err != nil {
			return nil, err
		}
		supervisors = append(supervisors, s)
	}
	return supervisors, nil
}

func CreateMockSupervisor(name string) shared.Supervisor {
	if name == "" {
		name = "MockSupervisor"
	}
	config := shared.SupervisorConfig{
		Name:     name,
		Provider: "custom",
	}
	return NewMockSupervisor(config, MockSupervisorOptions{ShouldApprove: true})
}
