package cli

import (
	"testing"
)

func TestCLIRegistryService(t *testing.T) {
	registry := NewCLIRegistryService()

	config, err := registry.GetConfig("aider")
	if err != nil {
		t.Fatalf("Expected to find aider config: %v", err)
	}

	if config.Command != "aider" {
		t.Errorf("Expected command 'aider', got %s", config.Command)
	}

	_, err = registry.GetConfig("unknown")
	if err == nil {
		t.Errorf("Expected error for unknown cli type")
	}

	registry.RegisterConfig(CLIConfig{
		Type:    "custom-cli",
		Command: "./custom",
	})

	custom, err := registry.GetConfig("custom-cli")
	if err != nil {
		t.Errorf("Expected to find registered custom config")
	}
	if custom.Command != "./custom" {
		t.Errorf("Expected command './custom', got %s", custom.Command)
	}
}
