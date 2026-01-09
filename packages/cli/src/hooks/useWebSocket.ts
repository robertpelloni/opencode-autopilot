import { useState, useEffect, useCallback, useRef } from 'react';
import type { WebSocketMessage, Session, CouncilDecision, LogEntry } from '@opencode-autopilot/shared';

const WS_URL = process.env.AUTOPILOT_WS || 'ws://localhost:3847/ws';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseWebSocketOptions {
  sessionId?: string;
  autoReconnect?: boolean;
  reconnectDelay?: number;
}

interface WebSocketState {
  status: ConnectionStatus;
  lastMessage: WebSocketMessage | null;
  sessions: Map<string, Session>;
  decisions: CouncilDecision[];
  logs: LogEntry[];
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { sessionId, autoReconnect = true, reconnectDelay = 3000 } = options;
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [state, setState] = useState<WebSocketState>({
    status: 'disconnected',
    lastMessage: null,
    sessions: new Map(),
    decisions: [],
    logs: [],
  });

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setState((s) => ({ ...s, status: 'connecting' }));

    const url = sessionId ? `${WS_URL}?sessionId=${sessionId}` : WS_URL;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setState((s) => ({ ...s, status: 'connected' }));
      if (sessionId) {
        ws.send(JSON.stringify({ type: 'subscribe', sessionId }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        setState((s) => {
          const newState = { ...s, lastMessage: message };

          switch (message.type) {
            case 'session_update': {
              const session = message.payload as Session;
              const sessions = new Map(s.sessions);
              sessions.set(session.id, session);
              return { ...newState, sessions };
            }
            case 'council_decision': {
              const decision = message.payload as CouncilDecision;
              return { ...newState, decisions: [...s.decisions.slice(-99), decision] };
            }
            case 'log': {
              const log = message.payload as LogEntry;
              return { ...newState, logs: [...s.logs.slice(-499), log] };
            }
            case 'error': {
              return newState;
            }
            default:
              return newState;
          }
        });
      } catch {
      }
    };

    ws.onclose = () => {
      setState((s) => ({ ...s, status: 'disconnected' }));
      wsRef.current = null;

      if (autoReconnect) {
        reconnectTimeoutRef.current = setTimeout(connect, reconnectDelay);
      }
    };

    ws.onerror = () => {
      setState((s) => ({ ...s, status: 'error' }));
    };

    wsRef.current = ws;
  }, [sessionId, autoReconnect, reconnectDelay]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const subscribe = useCallback((newSessionId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', sessionId: newSessionId }));
    }
  }, []);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const clearLogs = useCallback(() => {
    setState((s) => ({ ...s, logs: [] }));
  }, []);

  const clearDecisions = useCallback(() => {
    setState((s) => ({ ...s, decisions: [] }));
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    subscribe,
    send,
    clearLogs,
    clearDecisions,
    isConnected: state.status === 'connected',
  };
}
