import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

interface SessionState {
  messages: any[];
  currentPermission: any | null;
  lastUpdate: number;
}

export function useSessionState(sessionId: string | null) {
  const [state, setState] = useState<SessionState>({
    messages: [],
    currentPermission: null,
    lastUpdate: Date.now(),
  });
  const eventSourceRef = useRef<EventSource | null>(null);

  // Initial state fetch
  const { data: initialState } = useQuery({
    queryKey: ["sessionState", sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const res = await fetch(`/session/${sessionId}/state`);
      if (!res.ok) throw new Error("Failed to fetch state");
      return res.json() as Promise<SessionState>;
    },
    enabled: !!sessionId,
  });

  // Set initial state
  useEffect(() => {
    if (initialState) {
      setState(initialState);
    }
  }, [initialState]);

  // Subscribe to state updates via SSE
  useEffect(() => {
    if (!sessionId) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Connect to server's state stream
    const eventSource = new EventSource(`/stream?sessionId=${sessionId}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.sessionId === sessionId && data.state) {
          setState(data.state);
        }
      } catch (error) {
        console.error("Failed to parse state update:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("State stream error:", error);
    };

    return () => {
      eventSource.close();
    };
  }, [sessionId]);

  return state;
}
