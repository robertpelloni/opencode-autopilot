package env

import (
	"borg-orchestrator/pkg/shared"
	"os"
	"testing"
)

func TestEnvironmentManager_Globals(t *testing.T) {
	manager := NewEnvironmentManager()

	manager.SetGlobalOverride("TEST_GLOBAL", "global_value")

	env := manager.CreateSessionEnvironment("sess1", shared.Opencode, nil)
	if env["TEST_GLOBAL"] != "global_value" {
		t.Errorf("Expected TEST_GLOBAL to be global_value, got %s", env["TEST_GLOBAL"])
	}

	manager.RemoveGlobalOverride("TEST_GLOBAL")
	env2 := manager.CreateSessionEnvironment("sess2", shared.Opencode, nil)
	if _, ok := env2["TEST_GLOBAL"]; ok {
		t.Errorf("Expected TEST_GLOBAL to be removed")
	}
}

func TestEnvironmentManager_VariableExpansion(t *testing.T) {
	manager := NewEnvironmentManager()

	os.Setenv("BASE_URL", "http://test")
	defer os.Unsetenv("BASE_URL")

	vars := map[string]string{
		"API_URL": "${BASE_URL}/api",
		"DB_URL": "${MISSING_VAR}/db",
	}

	env := manager.CreateSessionEnvironment("sess3", shared.Opencode, vars)

	if env["API_URL"] != "http://test/api" {
		t.Errorf("Expected API_URL to be expanded to http://test/api, got %s", env["API_URL"])
	}
	if env["DB_URL"] != "/db" {
		t.Errorf("Expected DB_URL to be /db, got %s", env["DB_URL"])
	}
}

func TestEnvironmentManager_Sanitization(t *testing.T) {
	manager := NewEnvironmentManager()

	vars := map[string]string{
		"PUBLIC_VAR": "visible",
		"OPENAI_API_KEY": "sk-12345",
		"MY_SECRET": "hidden",
	}

	manager.CreateSessionEnvironment("sess4", shared.Opencode, vars)
	manager.AddGlobalSecret("MY_SECRET")

	sanitized := manager.GetSanitizedEnvironment("sess4")

	if sanitized["PUBLIC_VAR"] != "visible" {
		t.Errorf("Expected PUBLIC_VAR to be visible")
	}
	if sanitized["OPENAI_API_KEY"] != "***REDACTED***" {
		t.Errorf("Expected OPENAI_API_KEY to be redacted via regex")
	}
	if sanitized["MY_SECRET"] != "***REDACTED***" {
		t.Errorf("Expected MY_SECRET to be redacted via global secret explicitly")
	}
}

func TestEnvironmentManager_Validation(t *testing.T) {
	manager := NewEnvironmentManager()

	vars := map[string]string{}

	valid, missing := manager.ValidateEnvironmentForCLI(shared.ClaudeCode, vars)
	if valid {
		t.Errorf("Expected invalid environment for claude-code due to missing ANTHROPIC_API_KEY")
	}
	if len(missing) != 1 || missing[0] != "ANTHROPIC_API_KEY" {
		t.Errorf("Expected missing ANTHROPIC_API_KEY")
	}

	vars["ANTHROPIC_API_KEY"] = "sk-ant-123"
	valid, _ = manager.ValidateEnvironmentForCLI(shared.ClaudeCode, vars)
	if !valid {
		t.Errorf("Expected valid environment for claude-code when ANTHROPIC_API_KEY is present")
	}
}

func TestEnvironmentManager_Passthrough(t *testing.T) {
	manager := NewEnvironmentManager()
	os.Setenv("OPENAI_API_KEY", "sys-env-key")
	defer os.Unsetenv("OPENAI_API_KEY")

	// Aider needs OPENAI_API_KEY and ANTHROPIC_API_KEY
	// The manager should automatically passthrough Aider specific keys if they are in os.Environ()
	env := manager.CreateSessionEnvironment("sess5", shared.Aider, nil)

	if env["OPENAI_API_KEY"] != "sys-env-key" {
		t.Errorf("Expected OPENAI_API_KEY to be pulled from OS env for Aider, got %s", env["OPENAI_API_KEY"])
	}

	// Ensure it filters out non-passthrough
	os.Setenv("RANDOM_UNMATCHED_VAR", "foo")
	defer os.Unsetenv("RANDOM_UNMATCHED_VAR")

	env2 := manager.CreateSessionEnvironment("sess6", shared.Opencode, nil)
	if _, ok := env2["RANDOM_UNMATCHED_VAR"]; ok {
		t.Errorf("Expected RANDOM_UNMATCHED_VAR to be filtered out")
	}
}
