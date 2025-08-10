// Persistent OpenCode SSE client that maintains state
import type { Message, Permission, MessagePart } from "./types";

interface PermissionsState {
  byId: Record<string, Permission>;
  queue: string[];
  activeId?: string;
}

interface ToolEntry {
  callID: string;
  messageID: string;
  partID: string;
  tool: string;
  state: NonNullable<MessagePart["state"]>;
}

interface SessionState {
  messages: Message[];
  permissions: PermissionsState;
  toolsByCall: Record<string, ToolEntry>;
  lastUpdate: number;
}

class OpenCodeClient {
  private state = new Map<string, SessionState>();
  private reconnectAttempts = 0;
  private listeners = new Set<
    (sessionId: string, state: SessionState) => void
  >();
  private isConnecting = false;

  constructor(private opencodeUrl: string) {
    this.connect();
  }

  private async connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    console.log("Connecting to OpenCode SSE...");

    try {
      const res = await fetch(`${this.opencodeUrl}/event`, {
        headers: {
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });

      if (!res.ok) {
        throw new Error(`SSE connection failed: ${res.status}`);
      }

      console.log("OpenCode SSE connected");
      this.reconnectAttempts = 0;

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("No reader available");
      }

      const decoder = new TextDecoder();
      let textBuffer = "";
      let eventBuffer: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("SSE stream ended");
          break;
        }

        textBuffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = textBuffer.indexOf("\n")) !== -1) {
          const line = textBuffer.slice(0, idx);
          textBuffer = textBuffer.slice(idx + 1);

          if (line === "") {
            // dispatch event
            const dataPayload = eventBuffer
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).trimStart())
              .join("\n");
            eventBuffer = [];
            if (!dataPayload) continue;
            try {
              const data = JSON.parse(dataPayload);
              // console.log('[OpenCode Event]', data.type, data)
              this.handleEvent(data);
            } catch (e) {
              console.error("Failed to parse SSE JSON:", e);
            }
            continue;
          }

          // Accumulate event lines (data:, event:, id:, retry:)
          if (
            line.startsWith("data:") ||
            line.startsWith("event:") ||
            line.startsWith("id:") ||
            line.startsWith("retry:") ||
            line.startsWith(":")
          ) {
            eventBuffer.push(line);
          }
        }
      }
    } catch (error) {
      console.error("OpenCode SSE error:", error);
    } finally {
      this.isConnecting = false;
    }

    // Reconnect on any exit
    this.reconnect();
  }

  private reconnect() {
    if (this.isConnecting) return;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(
      `Reconnecting to OpenCode in ${delay}ms (attempt ${this.reconnectAttempts + 1})`,
    );
    this.reconnectAttempts++;

    setTimeout(() => this.connect(), delay);
  }

  private handleEvent(event: any) {
    const t = event?.type;
    if (!t) return;

    // Map to sessionId for different event shapes
    const sessionId = this.extractSessionId(event);
    if (!sessionId) return;

    const state = this.getOrCreateState(sessionId);
    let updated = false;

    if (t === "message.updated") {
      const msgInfo = event.properties.info;
      const existingMsg = state.messages.find((m) => m.info?.id === msgInfo.id);
      if (existingMsg) {
        existingMsg.info = msgInfo;
      } else {
        state.messages.push({ info: msgInfo, parts: [] });
      }
      updated = true;
    } else if (t === "message.removed") {
      const { messageID } = event.properties;
      const idx = state.messages.findIndex((m) => m.info?.id === messageID);
      if (idx >= 0) {
        const removed = state.messages.splice(idx, 1)[0];
        // Cleanup any tools linked to that message
        for (const [callID, entry] of Object.entries(state.toolsByCall)) {
          if (entry.messageID === removed.info!.id)
            delete state.toolsByCall[callID];
        }
        updated = true;
      }
    } else if (t === "message.part.updated") {
      const part: MessagePart = event.properties.part;
      const msg = state.messages.find((m) => m.info?.id === part.messageID);
      if (msg) {
        const existingPart = msg.parts.find((p) => p.id === part.id);
        if (existingPart) Object.assign(existingPart, part);
        else msg.parts.push(part);

        if (part.type === "tool" && part.callID && part.state) {
          state.toolsByCall[part.callID] = {
            callID: part.callID,
            messageID: part.messageID,
            partID: part.id,
            tool: (part as any).tool,
            state: part.state!,
          };
        }
        updated = true;
      }
    } else if (t === "message.part.removed") {
      const { messageID, partID } = event.properties;
      const msg = state.messages.find((m) => m.info?.id === messageID);
      if (msg) {
        const pidx = msg.parts.findIndex((p) => p.id === partID);
        if (pidx >= 0) msg.parts.splice(pidx, 1);
        for (const [callID, entry] of Object.entries(state.toolsByCall)) {
          if (entry.partID === partID) delete state.toolsByCall[callID];
        }
        updated = true;
      }
    } else if (t === "permission.updated") {
      const perm: Permission = event.properties;
      if (!state.permissions.byId[perm.id]) {
        state.permissions.byId[perm.id] = perm;
        state.permissions.queue.push(perm.id);
        if (!state.permissions.activeId) state.permissions.activeId = perm.id;
        updated = true;
      }
    } else if (t === "permission.replied") {
      const { permissionID } = event.properties;
      if (state.permissions.byId[permissionID]) {
        delete state.permissions.byId[permissionID];
        state.permissions.queue = state.permissions.queue.filter(
          (id) => id !== permissionID,
        );
        if (state.permissions.activeId === permissionID) {
          state.permissions.activeId = state.permissions.queue[0];
        }
        updated = true;
      }
    }

    // Optional: session events for future cleanup
    else if (t === "session.deleted") {
      // No-op; higher level can prune
    }

    if (updated) {
      state.lastUpdate = Date.now();
      // Keep messages ordered
      state.messages.sort(
        (a, b) => (a.info?.time?.created || 0) - (b.info?.time?.created || 0),
      );
      this.notifyListeners(sessionId, state);
    }
  }

  private extractSessionId(event: any): string | null {
    return (
      event.properties?.sessionID ||
      event.properties?.info?.sessionID ||
      event.properties?.part?.sessionID ||
      null
    );
  }

  private getOrCreateState(sessionId: string): SessionState {
    if (!this.state.has(sessionId)) {
      this.state.set(sessionId, {
        messages: [],
        permissions: { byId: {}, queue: [] },
        toolsByCall: {},
        lastUpdate: Date.now(),
      });
    }
    return this.state.get(sessionId)!;
  }

  private notifyListeners(sessionId: string, state: SessionState) {
    for (const listener of this.listeners) {
      listener(sessionId, state);
    }
  }

  // Public API
  async getSessionState(sessionId: string): Promise<SessionState> {
    // If we don't have state yet, fetch initial messages
    if (!this.state.has(sessionId)) {
      try {
        const res = await fetch(
          `${this.opencodeUrl}/session/${sessionId}/message`,
        );
        if (res.ok) {
          const messages = await res.json();
          // Sort messages chronologically by creation time
          messages.sort((a: Message, b: Message) => {
            const timeA = a.info?.time?.created || 0;
            const timeB = b.info?.time?.created || 0;
            return timeA - timeB;
          });
          // Build initial tools map from parts
          const toolsByCall: Record<string, ToolEntry> = {};
          for (const m of messages as Message[]) {
            for (const p of (m.parts || []) as MessagePart[]) {
              if (p.type === "tool" && p.callID && p.state) {
                toolsByCall[p.callID] = {
                  callID: p.callID,
                  messageID: (p as any).messageID,
                  partID: p.id,
                  tool: (p as any).tool,
                  state: p.state!,
                };
              }
            }
          }
          this.state.set(sessionId, {
            messages,
            permissions: { byId: {}, queue: [] },
            toolsByCall,
            lastUpdate: Date.now(),
          });
        }
      } catch (error) {
        console.error("Failed to fetch initial messages:", error);
      }
    }

    const state = this.state.get(sessionId)!;
    // Ensure messages sorted
    state.messages.sort(
      (a, b) => (a.info?.time?.created || 0) - (b.info?.time?.created || 0),
    );
    return state;
  }

  addListener(listener: (sessionId: string, state: SessionState) => void) {
    this.listeners.add(listener);
  }

  removeListener(listener: (sessionId: string, state: SessionState) => void) {
    this.listeners.delete(listener);
  }

  async respondToPermission(
    sessionId: string,
    permissionId: string,
    response: "once" | "always" | "reject",
  ) {
    const res = await fetch(
      `${this.opencodeUrl}/session/${sessionId}/permissions/${permissionId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      },
    );

    if (!res.ok) {
      throw new Error(`Failed to respond to permission: ${res.status}`);
    }
    // Optimistically advance queue
    const state = this.state.get(sessionId);
    if (state && state.permissions.byId[permissionId]) {
      delete state.permissions.byId[permissionId];
      state.permissions.queue = state.permissions.queue.filter(
        (id) => id !== permissionId,
      );
      if (state.permissions.activeId === permissionId) {
        state.permissions.activeId = state.permissions.queue[0];
      }
      state.lastUpdate = Date.now();
      this.notifyListeners(sessionId, state);
    }
  }

  async sendMessage(
    sessionId: string,
    message: string,
    modelId: string,
    providerId: string,
    agent: string,
  ) {
    // Create message ID
    const timestamp = Date.now();
    const timestampHex = (timestamp * 0x1000).toString(16).padStart(12, "0");
    const randomChars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let random = "";
    for (let i = 0; i < 14; i++) {
      random += randomChars.charAt(
        Math.floor(Math.random() * randomChars.length),
      );
    }
    const messageId = `msg_${timestampHex}${random}`;

    const payload = {
      providerID: providerId,
      modelID: modelId,
      agent: agent,
      messageID: messageId,
      parts: [{ type: "text", text: message }],
    };

    console.log("Sending to OpenCode:", JSON.stringify(payload, null, 2));
    console.log("Message text length:", message.length);
    console.log("Actual message text:", message);

    // Send to OpenCode; do not rely on synchronous completion in caller
    const res = await fetch(
      `${this.opencodeUrl}/session/${sessionId}/message`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    console.log("OpenCode response:", res.status, res.statusText);

    if (!res.ok) {
      const error = await res.text();
      console.error("OpenCode error:", error);
      throw new Error(`Failed to send message: ${error}`);
    }

    const responseText = await res.text();
    console.log("OpenCode response body:", responseText);
  }
}

export default OpenCodeClient;
