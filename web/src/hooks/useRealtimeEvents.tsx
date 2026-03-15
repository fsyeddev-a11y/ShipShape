import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './useAuth';

// Event types that can be received from the server
export type RealtimeEventType = 'accountability:updated' | 'title:updated' | 'connected' | 'pong';

export interface RealtimeEvent {
  type: RealtimeEventType;
  data: Record<string, unknown>;
}

type EventCallback = (event: RealtimeEvent) => void;

interface RealtimeEventsContextType {
  isConnected: boolean;
  subscribe: (eventType: RealtimeEventType, callback: EventCallback) => () => void;
}

const RealtimeEventsContext = createContext<RealtimeEventsContextType | null>(null);

// WebSocket URLs for different environments
// VITE_WS_URL allows bypassing CloudFront (which doesn't support WebSocket)
// by connecting directly to the EB endpoint for real-time events
function getEventsWsUrl(): string {
  // Prefer explicit WebSocket URL (for CloudFront deployments)
  const wsUrl = import.meta.env.VITE_WS_URL;
  if (wsUrl) {
    return wsUrl.replace(/^http/, 'ws') + '/events';
  }

  // Fall back to API URL or current host
  const apiUrl = import.meta.env.VITE_API_URL ?? '';
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return apiUrl
    ? apiUrl.replace(/^http/, 'ws') + '/events'
    : `${wsProtocol}//${window.location.host}/events`;
}

// Exponential backoff constants
const BASE_DELAY = 3000;    // 3s
const MAX_DELAY = 60000;    // 60s
const BACKOFF_FACTOR = 2;

export function RealtimeEventsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscribersRef = useRef<Map<RealtimeEventType, Set<EventCallback>>>(new Map());
  const consecutiveFailuresRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);

  // Subscribe to events
  const subscribe = useCallback((eventType: RealtimeEventType, callback: EventCallback) => {
    if (!subscribersRef.current.has(eventType)) {
      subscribersRef.current.set(eventType, new Set());
    }
    subscribersRef.current.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      subscribersRef.current.get(eventType)?.delete(callback);
    };
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;
    if (wsRef.current?.readyState === WebSocket.CLOSING) return;

    const ws = new WebSocket(getEventsWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[RealtimeEvents] Connected');
      consecutiveFailuresRef.current = 0;
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as RealtimeEvent;
        console.log('[RealtimeEvents] Received:', data.type);

        // Notify subscribers
        const callbacks = subscribersRef.current.get(data.type);
        if (callbacks) {
          callbacks.forEach((callback) => callback(data));
        }
      } catch (err) {
        console.error('[RealtimeEvents] Failed to parse message:', err);
      }
    };

    ws.onclose = (event: CloseEvent) => {
      console.log('[RealtimeEvents] Disconnected, code:', event.code);
      setIsConnected(false);
      // Only nullify if this is still the current WebSocket
      // (avoids race where a new WS was created before old one finished closing)
      if (wsRef.current === ws) {
        wsRef.current = null;
      }

      // 429 awareness — jump to higher backoff on rate limit
      if (event.code === 429 || event.code === 4029) {
        consecutiveFailuresRef.current = Math.max(consecutiveFailuresRef.current, 3); // Start at 24s minimum
      }

      // Reconnect with exponential backoff if user is still logged in
      if (user) {
        const delay = Math.min(
          BASE_DELAY * Math.pow(BACKOFF_FACTOR, consecutiveFailuresRef.current),
          MAX_DELAY
        );
        consecutiveFailuresRef.current++;
        console.log(`[RealtimeEvents] Reconnecting in ${delay}ms (attempt ${consecutiveFailuresRef.current})...`);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };

    ws.onerror = (err) => {
      console.error('[RealtimeEvents] Error:', err);
      ws.close();
    };
  }, [user]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Connect when user logs in, disconnect when they log out
  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user, connect, disconnect]);

  // Keepalive ping every 30 seconds
  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [isConnected]);

  return (
    <RealtimeEventsContext.Provider value={{ isConnected, subscribe }}>
      {children}
    </RealtimeEventsContext.Provider>
  );
}

export function useRealtimeEvents() {
  const context = useContext(RealtimeEventsContext);
  if (!context) {
    throw new Error('useRealtimeEvents must be used within RealtimeEventsProvider');
  }
  return context;
}

/**
 * Hook to listen for a specific realtime event type.
 * Automatically subscribes on mount and unsubscribes on unmount.
 */
export function useRealtimeEvent(eventType: RealtimeEventType, callback: EventCallback) {
  const { subscribe } = useRealtimeEvents();

  useEffect(() => {
    return subscribe(eventType, callback);
  }, [eventType, callback, subscribe]);
}
