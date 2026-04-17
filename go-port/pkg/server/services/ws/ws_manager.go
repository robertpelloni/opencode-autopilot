package ws

import (
	"encoding/json"
	"log"
	"net/http"
)

// WSManagerService implements the structured websocket hub architecture
type WSManagerService struct {
	hub *Hub
}

func NewWSManagerService() *WSManagerService {
	hub := NewHub()
	go hub.Run()
	return &WSManagerService{
		hub: hub,
	}
}

func (s *WSManagerService) HandleConnection(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade websocket: %v", err)
		return
	}

	client := &Client{hub: s.hub, conn: conn, send: make(chan []byte, 256)}
	client.hub.register <- client

	// Allow collection of memory referenced by the caller by doing all work in
	// new goroutines.
	go client.writePump()
	go client.readPump()
}

func (s *WSManagerService) Broadcast(messageType string, payload interface{}) {
	msg := map[string]interface{}{
		"type":    messageType,
		"payload": payload,
	}

	bytes, err := json.Marshal(msg)
	if err != nil {
		return
	}

	s.hub.broadcast <- bytes
}

func (s *WSManagerService) SendToSession(sessionID string, messageType string, payload interface{}) {
	msg := map[string]interface{}{
		"type":    messageType,
		"payload": payload,
	}

	bytes, err := json.Marshal(msg)
	if err != nil {
		return
	}

	s.hub.BroadcastToSession(sessionID, bytes)
}

func (s *WSManagerService) NotifyLog(sessionID string, message string) {
	s.SendToSession(sessionID, "log", message)
}

func (s *WSManagerService) NotifyCouncilDecision(sessionID string, decision interface{}) {
	s.SendToSession(sessionID, "council_decision", decision)
}
