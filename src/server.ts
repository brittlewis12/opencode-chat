import { serve, spawn } from "bun";
import OpenCodeClient from "./opencode-client";
import index from "./index.html";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const OPENCODE_URL = process.env.OPENCODE_URL || "http://localhost:4096";
const isDev = process.env.NODE_ENV !== "production";

// Check if OpenCode is already running
async function checkOpenCode() {
  try {
    const res = await fetch(`${OPENCODE_URL}/config/providers`);
    return res.ok;
  } catch {
    return false;
  }
}

let opencodeProcess = null;

if (!(await checkOpenCode())) {
  console.log("OpenCode not detected, starting server...");
  opencodeProcess = spawn(["opencode", "serve"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  // Log OpenCode output
  if (opencodeProcess.stdout) {
    const reader = opencodeProcess.stdout.getReader();
    const decoder = new TextDecoder();
    (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        console.log("[OpenCode]", decoder.decode(value, { stream: true }));
      }
    })();
  }

  if (opencodeProcess.stderr) {
    const reader = opencodeProcess.stderr.getReader();
    const decoder = new TextDecoder();
    (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        console.error(
          "[OpenCode ERROR]",
          decoder.decode(value, { stream: true }),
        );
      }
    })();
  }

  // Wait for OpenCode to be ready
  let retries = 10;
  while (retries > 0 && !(await checkOpenCode())) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    retries--;
  }

  if (retries === 0) {
    console.error("Failed to start OpenCode server");
    process.exit(1);
  }
  console.log("OpenCode server ready");
} else {
  console.log("OpenCode server already running on port 4096");
}

// Create persistent OpenCode client
const opencodeClient = new OpenCodeClient(OPENCODE_URL);

// Track active browser SSE connections
const browserConnections = new Map<
  string,
  Set<ReadableStreamDefaultController>
>();

// Listen for state updates and forward to browsers
opencodeClient.addListener((sessionId, state) => {
  const connections = browserConnections.get(sessionId);
  if (connections) {
    const encoder = new TextEncoder();
    const data = JSON.stringify({ sessionId, state });
    for (const controller of connections) {
      try {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      } catch {
        // Connection closed, will be cleaned up
      }
    }
  }
});

// Server with native Bun routing
const server = serve({
  port: PORT,
  idleTimeout: 120, // 2 minutes timeout for long responses

  // Enable browser console streaming and HMR in development
  development: isDev
    ? {
        hmr: true, // Hot module reloading
        console: true, // Stream browser console logs to terminal
      }
    : undefined,

  routes: {
    // Serve the React app for all unmatched routes
    "/*": index,

    // Debug endpoint
    "/debug": async (req) => {
      const debugInfo: {
        providers: any;
        agents: any;
        sessions: any;
        errors: string[];
      } = {
        providers: null,
        agents: null,
        sessions: null,
        errors: [],
      };

      try {
        const providersRes = await fetch(`${OPENCODE_URL}/config/providers`);
        debugInfo.providers = await providersRes.json();
      } catch (e: any) {
        debugInfo.errors.push(`Providers: ${e.message}`);
      }

      try {
        const agentsRes = await fetch(`${OPENCODE_URL}/agent`);
        debugInfo.agents = await agentsRes.json();
      } catch (e: any) {
        debugInfo.errors.push(`Agents: ${e.message}`);
      }

      try {
        const sessionsRes = await fetch(`${OPENCODE_URL}/session`);
        debugInfo.sessions = await sessionsRes.json();
      } catch (e: any) {
        debugInfo.errors.push(`Sessions: ${e.message}`);
      }

      return Response.json(debugInfo);
    },

    // Proxy config endpoints
    "/config/providers": async () => {
      const response = await fetch(`${OPENCODE_URL}/config/providers`);
      return new Response(await response.text(), {
        headers: { "Content-Type": "application/json" },
      });
    },

    "/config": {
      async GET() {
        const response = await fetch(`${OPENCODE_URL}/config`);
        return new Response(await response.text(), {
          headers: { "Content-Type": "application/json" },
        });
      },
      async PATCH(req) {
        // For now, we'll need to handle config updates differently
        // OpenCode doesn't expose a PATCH endpoint for config
        const body = await req.json();

        // TODO: Save to opencode.json file or implement proper config update
        return Response.json({
          success: false,
          message:
            "Config updates require creating an opencode.json file. This feature is coming soon!",
        });
      },
    },

    // Proxy agent endpoint
    "/agent": async () => {
      const response = await fetch(`${OPENCODE_URL}/agent`);
      return new Response(await response.text(), {
        headers: { "Content-Type": "application/json" },
      });
    },

    // Proxy session list endpoint
    "/session": async () => {
      const response = await fetch(`${OPENCODE_URL}/session`);
      return new Response(await response.text(), {
        headers: { "Content-Type": "application/json" },
      });
    },

    // Delete session endpoint
    "/session/:sessionId": async (req) => {
      if (req.method === "DELETE") {
        const sessionId = req.params.sessionId;
        const response = await fetch(`${OPENCODE_URL}/session/${sessionId}`, {
          method: "DELETE",
        });
        return new Response(null, {
          status: response.ok ? 204 : response.status,
        });
      }
      return new Response("Method not allowed", { status: 405 });
    },

    // History endpoint
    "/history": async (req) => {
      const url = new URL(req.url);
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) {
        return new Response("Session ID required", { status: 400 });
      }

      try {
        const response = await fetch(
          `${OPENCODE_URL}/session/${sessionId}/message`,
        );
        if (!response.ok) {
          return new Response("Failed to load history", { status: 500 });
        }

        const messages = await response.json();
        return Response.json(messages);
      } catch (error: any) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    },

    // Get declarative session state
    "/session/:sessionId/state": async (req) => {
      const sessionId = req.params.sessionId;
      const state = await opencodeClient.getSessionState(sessionId);
      return Response.json(state);
    },

    // Recovery endpoint to handle all pending permissions
    "/session/:sessionId/permissions/handle-all": async (req) => {
      if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      const sessionId = req.params.sessionId;
      const body = await req.json();
      const action = body.action || "reject"; // "accept" | "reject"
      const responseType = action === "accept" ? "once" : "reject";

      const state = await opencodeClient.getSessionState(sessionId);

      // Handle all pending permissions
      const handled = [];
      const failed = [];
      if (state?.permissions?.queue) {
        for (const permId of state.permissions.queue) {
          const perm = state.permissions.byId?.[permId];
          if (perm) {
            try {
              const response = await fetch(
                `${OPENCODE_URL}/session/${sessionId}/permissions/${permId}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ response: responseType }),
                },
              );
              if (response.ok) {
                handled.push(permId);
              } else {
                failed.push(permId);
              }
            } catch (e) {
              console.error(`Failed to ${action} permission ${permId}:`, e);
              failed.push(permId);
            }
          }
        }
      }

      return Response.json({
        action,
        handled,
        failed,
        totalCount: handled.length + failed.length,
        handledCount: handled.length,
        failedCount: failed.length,
      });
    },

    // Enable event buffering for a session (during transitions)
    "/session/:sessionId/buffer/enable": {
      async POST(req) {
        const { sessionId } = req.params;
        opencodeClient.enableBuffering(sessionId);
        return Response.json({ success: true });
      },
    },

    // Disable event buffering and flush events
    "/session/:sessionId/buffer/disable": {
      async POST(req) {
        const { sessionId } = req.params;
        opencodeClient.disableBuffering(sessionId);
        return Response.json({ success: true });
      },
    },

    // SSE endpoint for streaming state updates to browser
    "/stream": async (req) => {
      const url = new URL(req.url);
      const sessionId = url.searchParams.get("sessionId");
      console.log("Browser SSE stream requested for session:", sessionId);
      if (!sessionId) {
        return new Response("Session ID required", { status: 400 });
      }

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();

          // Track this connection
          if (!browserConnections.has(sessionId)) {
            browserConnections.set(sessionId, new Set());
          }
          browserConnections.get(sessionId)!.add(controller);

          // Send initial state
          const state = await opencodeClient.getSessionState(sessionId);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ sessionId, state })}\n\n`),
          );

          // Send keepalive every 30 seconds
          const keepalive = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(":keepalive\n\n"));
            } catch (e) {
              clearInterval(keepalive);
              browserConnections.get(sessionId)?.delete(controller);
              if (browserConnections.get(sessionId)?.size === 0) {
                browserConnections.delete(sessionId);
              }
            }
          }, 30000);

          // Cleanup on close
          req.signal.addEventListener("abort", () => {
            clearInterval(keepalive);
            browserConnections.get(sessionId)?.delete(controller);
            if (browserConnections.get(sessionId)?.size === 0) {
              browserConnections.delete(sessionId);
            }
          });
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    },

    // Handle permission responses
    "/session/:sessionId/permissions/:permissionId": {
      async POST(req) {
        const { sessionId, permissionId } = req.params;
        try {
          const body = await req.json();
          await opencodeClient.respondToPermission(
            sessionId,
            permissionId,
            body.response,
          );
          return Response.json({ success: true });
        } catch (error: any) {
          console.error("Permission response error:", error);
          return new Response(error.message, { status: 500 });
        }
      },
    },

    // Handle chat endpoint
    "/chat": {
      async POST(req) {
        try {
          const body = await req.json();
          const { message, sessionId, agent, modelId, providerId } = body;

          // Create or reuse session
          let currentSessionId = sessionId;

          if (!currentSessionId) {
            // Create new session
            const sessionRes = await fetch(`${OPENCODE_URL}/session`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });

            if (!sessionRes.ok) {
              throw new Error("Failed to create session");
            }

            const sessionData = await sessionRes.json();
            currentSessionId = sessionData.id;
          }

          // Get current agent/mode setting from request (default to build)
          const currentAgent = agent || "build";

          // Use the model selected by the user, fallback to Opus 4.1
          const currentModelId = modelId || "claude-opus-4-1-20250805";
          const currentProviderId = providerId || "anthropic"; // Default to anthropic for Opus
          console.log(
            "Sending message with model:",
            currentModelId,
            "provider:",
            currentProviderId,
          );

          // Send message through OpenCodeClient (do not await full run)
          opencodeClient
            .sendMessage(
              currentSessionId,
              message,
              currentModelId,
              currentProviderId,
              currentAgent,
            )
            .catch((err) => console.error("sendMessage error:", err));

          // Return immediately - progress will stream via SSE/state
          return Response.json({
            sessionId: currentSessionId,
            streaming: true,
          });
        } catch (error: any) {
          console.error("Chat error:", error);
          return Response.json({ error: error.message }, { status: 500 });
        }
      },
    },
  },
});

console.log(`OpenCode Chat server running on http://localhost:${PORT}`);
if (isDev) {
  console.log("Browser console logs will be streamed to this terminal");
  console.log("Hot module reloading enabled");
}
