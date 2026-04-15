package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for dev/prototype
	},
}

type Connection struct {
	ws   *websocket.Conn
	send chan []byte
}

func (c *Connection) writePump() {
	defer c.ws.Close()
	for msg := range c.send {
		err := c.ws.WriteMessage(websocket.TextMessage, msg)
		if err != nil {
			return
		}
	}
}

type WSManagerService struct {
	connections map[*Connection]bool
	sessions    map[string]map[*Connection]bool
	mu          sync.RWMutex
}

func NewWSManagerService() *WSManagerService {
	return &WSManagerService{
		connections: make(map[*Connection]bool),
		sessions:    make(map[string]map[*Connection]bool),
	}
}

func (s *WSManagerService) HandleConnection(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade websocket: %v", err)
		return
	}

	conn := &Connection{
		ws:   ws,
		send: make(chan []byte, 256),
	}

	s.mu.Lock()
	s.connections[conn] = true
	s.mu.Unlock()

	go conn.writePump()

	// Simplistic read loop to keep connection alive and handle unregister
	go func() {
		defer func() {
			s.mu.Lock()
			delete(s.connections, conn)
			for _, clients := range s.sessions {
				delete(clients, conn)
			}
			s.mu.Unlock()
			close(conn.send)
			conn.ws.Close()
		}()
		for {
			_, _, err := conn.ws.ReadMessage()
			if err != nil {
				break
			}
		}
	}()
}

func (s *WSManagerService) SubscribeToSession(conn *Connection, sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.sessions[sessionID] == nil {
		s.sessions[sessionID] = make(map[*Connection]bool)
	}
	s.sessions[sessionID][conn] = true
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

	s.mu.RLock()
	defer s.mu.RUnlock()

	for conn := range s.connections {
		select {
		case conn.send <- bytes:
		default:
			// Handle dead connection logic
		}
	}
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

	s.mu.RLock()
	defer s.mu.RUnlock()

	if clients, ok := s.sessions[sessionID]; ok {
		for conn := range clients {
			select {
			case conn.send <- bytes:
			default:
			}
		}
	}
}

// Added to resolve missing methods in SmartPilot
func (s *WSManagerService) NotifyLog(sessionID string, message string) {
	s.SendToSession(sessionID, "log", message)
}

func (s *WSManagerService) NotifyCouncilDecision(sessionID string, decision interface{}) {
	s.SendToSession(sessionID, "council_decision", decision)
}
