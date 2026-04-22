package api

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"borg-orchestrator/pkg/server/services/cli"
	"borg-orchestrator/pkg/server/services/env"
	"borg-orchestrator/pkg/server/services/session"
	"borg-orchestrator/pkg/server/services/ws"
	"github.com/gorilla/websocket"
)

func TestWSManagerIntegration(t *testing.T) {
	envMgr := env.NewEnvironmentManagerService()
	cliReg := cli.NewCLIRegistryService()
	wsMgr := ws.NewWSManagerService()
	sessionMgr := session.NewSessionManagerService(envMgr, cliReg, wsMgr)

	server := NewAPIServer(sessionMgr, envMgr, cliReg, wsMgr)

	s := httptest.NewServer(server)
	defer s.Close()

	// Convert http://127.0.0.1 to ws://127.0.0.1
	wsURL := "ws" + strings.TrimPrefix(s.URL, "http") + "/ws"

	// Connect to the WebSocket
	wsConn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect to websocket: %v", err)
	}
	defer wsConn.Close()

	// Give the server a moment to register the connection
	time.Sleep(100 * time.Millisecond)

	// Broadcast a message using the manager
	go func() {
		wsMgr.Broadcast("test_message", map[string]string{"foo": "bar"})
	}()

	// Ensure the message was received by the client
	wsConn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, msg, err := wsConn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read message from websocket: %v", err)
	}

	if !strings.Contains(string(msg), "test_message") {
		t.Errorf("Expected message to contain 'test_message', got %s", string(msg))
	}
	if !strings.Contains(string(msg), "bar") {
		t.Errorf("Expected message to contain payload 'bar', got %s", string(msg))
	}
}
