"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import apiClient from "@/lib/axios";

interface WebSocketPayload {
  created_by?: number;
  title?: string;
  [key: string]: unknown;
}

interface WebSocketMessage {
  type: string;
  payload: WebSocketPayload;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { accessToken, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!accessToken || !isAuthenticated || typeof window === "undefined") return;

    let cancelled = false;
    const maxReconnectAttempts = 5;

    const connect = async () => {
      if (cancelled) return;
      if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

      try {
        const { data } = await apiClient.post<{ ticket: string }>("/auth/ws-ticket");
        if (cancelled) return;

        const configuredUrl = process.env.NEXT_PUBLIC_WS_URL;
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const baseUrl = configuredUrl || `${protocol}//${window.location.host}/api/v1/ws`;
        const separator = baseUrl.includes("?") ? "&" : "?";
        const ws = new WebSocket(`${baseUrl}${separator}ticket=${encodeURIComponent(data.ticket)}`);

        ws.onopen = () => {
          setIsConnected(true);
          reconnectAttempts.current = 0;
        };
        ws.onmessage = (event) => {
          try { setLastMessage(JSON.parse(event.data)); } catch { /* ignore malformed messages */ }
        };
        ws.onclose = () => {
          setIsConnected(false);
          wsRef.current = null;
          if (!cancelled && reconnectAttempts.current < maxReconnectAttempts) {
            const timeout = Math.min(1000 * (2 ** reconnectAttempts.current), 15000);
            reconnectAttempts.current += 1;
            reconnectTimer.current = setTimeout(connect, timeout);
          }
        };
        ws.onerror = () => ws.close();
        wsRef.current = ws;
      } catch {
        if (!cancelled && reconnectAttempts.current < maxReconnectAttempts) {
          const timeout = Math.min(1000 * (2 ** reconnectAttempts.current), 15000);
          reconnectAttempts.current += 1;
          reconnectTimer.current = setTimeout(connect, timeout);
        }
      }
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [accessToken, isAuthenticated]);

  return { isConnected, lastMessage };
}
