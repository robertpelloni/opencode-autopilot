package env

import (
	"os"
	"strings"
	"testing"


)

func TestEnvironmentManager_GlobalConfig(t *testing.T) {
	manager := NewEnvironmentManagerService()

	config := EnvironmentConfig{
		Inherit: false,
		Variables: map[string]string{
			"TEST_GLOBAL": "true",
		},
		Secrets:     []string{"MY_SECRET"},
		Passthrough: []string{"PATH"},
	}

	manager.ConfigureGlobal(config)

	manager.mu.RLock()
	defer manager.mu.RUnlock()

	if manager.global.Inherit {
		t.Errorf("Expected Inherit to be false")
	}

	if manager.global.Variables["TEST_GLOBAL"] != "true" {
		t.Errorf("Expected TEST_GLOBAL to be true")
	}

	foundSecret := false
	for _, s := range manager.global.Secrets {
		if s == "MY_SECRET" {
			foundSecret = true
			break
		}
	}
	if !foundSecret {
		t.Errorf("Expected MY_SECRET in global secrets")
	}
}

func TestEnvironmentManager_PrepareEnvironment(t *testing.T) {
	manager := NewEnvironmentManagerService()
	os.Setenv("TEST_OS_ENV", "os_value")

	manager.ConfigureGlobal(EnvironmentConfig{
		Inherit: false,
		Variables: map[string]string{
			"GLOBAL_VAR": "global_value",
		},
		Passthrough: []string{"TEST_OS_ENV"},
	})

	sessionID := "test-session"
	env, err := manager.PrepareEnvironment(sessionID, "aider", &EnvironmentConfig{
		Inherit: false,
		Variables: map[string]string{
			"SESSION_VAR": "session_value",
		},
	})

	if err != nil {
		t.Fatalf("Failed to prepare env: %v", err)
	}

	if env.Resolved["TEST_OS_ENV"] != "os_value" {
		t.Errorf("Expected passthrough variable TEST_OS_ENV to be 'os_value'")
	}
	if env.Resolved["GLOBAL_VAR"] != "global_value" {
		t.Errorf("Expected global variable GLOBAL_VAR to be 'global_value'")
	}
	if env.Resolved["SESSION_VAR"] != "session_value" {
		t.Errorf("Expected session variable SESSION_VAR to be 'session_value'")
	}
}

func TestEnvironmentManager_Redaction(t *testing.T) {
	manager := NewEnvironmentManagerService()

	manager.ConfigureGlobal(EnvironmentConfig{
		Secrets: []string{"API_KEY", "DB_PASS*"},
		Variables: map[string]string{
			"API_KEY": "super_secret_api_key_123",
			"DB_PASSWORD": "db_secret_password_456",
		},
	})

	logStr := "Connecting to API with key super_secret_api_key_123 and db password db_secret_password_456 ok"
	redacted := manager.RedactLog(logStr, "")

	if strings.Contains(redacted, "super_secret_api_key_123") {
		t.Errorf("Failed to redact exact match secret")
	}
	if strings.Contains(redacted, "db_secret_password_456") {
		t.Errorf("Failed to redact wildcard match secret")
	}
	if !strings.Contains(redacted, "[REDACTED]") {
		t.Errorf("Expected [REDACTED] in output")
	}
}
