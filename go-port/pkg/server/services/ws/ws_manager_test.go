package ws

import (
	"testing"
)

func TestWSManagerService(t *testing.T) {
	manager := NewWSManagerService()
	manager.Broadcast("test", map[string]string{"msg": "hello"})
	manager.SendToSession("test-123", "test", "hello")
}
