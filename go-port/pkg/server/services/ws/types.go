package ws

// WSMessage represents the standard wrapper for all WebSocket communications.
type WSMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// ClientMessage represents a structured command from the client to the server.
type ClientMessage struct {
	Action    string      `json:"action"`
	SessionID string      `json:"sessionId,omitempty"`
	Data      interface{} `json:"data,omitempty"`
}

// Below are explicit payload structs for different event types.

type LogPayload struct {
	SessionID string `json:"sessionId"`
	Message   string `json:"message"`
}

type SessionStatusPayload struct {
	SessionID string `json:"sessionId"`
	Status    string `json:"status"` // "running", "stopped", "crashed", "completed"
}

type MetricPayload struct {
	Provider string  `json:"provider"`
	Metric   string  `json:"metric"`
	Value    float64 `json:"value"`
}
