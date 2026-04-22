package ws

import (
	"sync"
)

// Hub maintains the set of active clients and broadcasts messages to the clients.
type Hub struct {
	// Registered clients.
	clients map[*Client]bool

	// Maps session IDs to sets of registered clients for session-specific routing.
	sessions map[string]map[*Client]bool

	// Inbound messages from the clients.
	broadcast chan []byte

	// Register requests from the clients.
	register chan *Client

	// Unregister requests from clients.
	unregister chan *Client

	// Mutex for thread-safe access to sessions map
	mu sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
		sessions:   make(map[string]map[*Client]bool),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)

				// Clean up from any sessions
				h.mu.Lock()
				for _, sessionClients := range h.sessions {
					delete(sessionClients, client)
				}
				h.mu.Unlock()
			}
		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)

					// Clean up from any sessions
					h.mu.Lock()
					for _, sessionClients := range h.sessions {
						delete(sessionClients, client)
					}
					h.mu.Unlock()
				}
			}
		}
	}
}

func (h *Hub) SubscribeToSession(client *Client, sessionID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.sessions[sessionID] == nil {
		h.sessions[sessionID] = make(map[*Client]bool)
	}
	h.sessions[sessionID][client] = true
}

func (h *Hub) BroadcastToSession(sessionID string, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if clients, ok := h.sessions[sessionID]; ok {
		for client := range clients {
			select {
			case client.send <- message:
			default:
				// Dead connection cleanup should ideally happen in Run loop via unregister
				// Doing it here risks deadlocks or concurrent map writes if not careful
			}
		}
	}
}
