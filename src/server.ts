import { serve, file, spawn } from "bun";
import OpenCodeClient from "./opencode-client";

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

// Proxy server with native React support
serve({
  port: PORT,
  idleTimeout: 120, // 2 minutes timeout for long responses

  // Enable browser console streaming (Bun 1.2.20 feature)
  development: isDev ? {
    console: true,  // Stream browser console logs to terminal
  } : undefined,

  async fetch(req) {
    const url = new URL(req.url);

    // Debug endpoint
    if (url.pathname === "/debug") {
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
      } catch (e) {
        debugInfo.errors.push(`Providers: ${e.message}`);
      }

      try {
        const agentsRes = await fetch(`${OPENCODE_URL}/agent`);
        debugInfo.agents = await agentsRes.json();
      } catch (e) {
        debugInfo.errors.push(`Agents: ${e.message}`);
      }

      try {
        const sessionsRes = await fetch(`${OPENCODE_URL}/session`);
        debugInfo.sessions = await sessionsRes.json();
      } catch (e) {
        debugInfo.errors.push(`Sessions: ${e.message}`);
      }

      return Response.json(debugInfo);
    }

    // Proxy config endpoints
    if (url.pathname === "/config/providers") {
      const response = await fetch(`${OPENCODE_URL}/config/providers`);
      return new Response(await response.text(), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/config") {
      if (req.method === "GET") {
        const response = await fetch(`${OPENCODE_URL}/config`);
        return new Response(await response.text(), {
          headers: { "Content-Type": "application/json" },
        });
      } else if (req.method === "PATCH") {
        // For now, we'll need to handle config updates differently
        // OpenCode doesn't expose a PATCH endpoint for config
        const body = await req.json();

        // TODO: Save to opencode.json file or implement proper config update
        return Response.json({
          success: false,
          message:
            "Config updates require creating an opencode.json file. This feature is coming soon!",
        });
      }
    }

    // Proxy agent endpoint
    if (url.pathname === "/agent") {
      const response = await fetch(`${OPENCODE_URL}/agent`);
      return new Response(await response.text(), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Proxy session list endpoint
    if (url.pathname === "/session") {
      const response = await fetch(`${OPENCODE_URL}/session`);
      return new Response(await response.text(), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // History endpoint
    if (url.pathname === "/history") {
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
      } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    // Get declarative session state
    if (url.pathname.match(/^\/session\/([^\/]+)\/state$/)) {
      const sessionId = url.pathname.split("/")[2];
      const state = await opencodeClient.getSessionState(sessionId);
      return Response.json(state);
    }

    // SSE endpoint for streaming state updates to browser
    if (url.pathname === "/stream") {
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

          // Send keepalive every 30 seconds (was incorrectly set to 10 seconds)
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
    }

    // Handle permission queries
    if (
      req.method === "GET" &&
      url.pathname.match(/^\/session\/[^\/]+\/permissions$/)
    ) {
      const response = await fetch(`${OPENCODE_URL}${url.pathname}`);
      return new Response(await response.text(), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle permission responses
    if (
      req.method === "POST" &&
      url.pathname.match(/^\/session\/([^\/]+)\/permissions\/([^\/]+)$/)
    ) {
      const matches = url.pathname.match(
        /^\/session\/([^\/]+)\/permissions\/([^\/]+)$/,
      );
      const sessionId = matches![1];
      const permissionId = matches![2];

      try {
        const body = await req.json();
        await opencodeClient.respondToPermission(
          sessionId,
          permissionId,
          body.response,
        );
        return Response.json({ success: true });
      } catch (error) {
        console.error("Permission response error:", error);
        return new Response(error.message, { status: 500 });
      }
    }

    // Handle chat endpoint
    if (url.pathname === "/chat" && req.method === "POST") {
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
      } catch (error) {
        console.error("Chat error:", error);
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    // Serve index.html for root
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const indexFile = file("./src/index.html");
      if (await indexFile.exists()) {
        return new Response(indexFile, {
          headers: { "Content-Type": "text/html" }
        });
      }
    }
    
    // Serve static files with automatic JSX/TSX transpilation
    const filePath = `./src${url.pathname}`;
    const staticFile = file(filePath);
    
    if (await staticFile.exists()) {
      const ext = url.pathname.split('.').pop();
      
      // Transpile JS/JSX/TS/TSX files on the fly
      if (['js', 'jsx', 'ts', 'tsx'].includes(ext || '')) {
        const transpiler = new Bun.Transpiler({
          loader: ext as any,
          jsx: "react",
          tsconfig: {
            compilerOptions: {
              jsx: "react",
              jsxFactory: "React.createElement",
              jsxFragmentFactory: "React.Fragment",
            }
          }
        });
        
        const code = await staticFile.text();
        const transpiled = await transpiler.transform(code);
        
        return new Response(transpiled, {
          headers: { 
            "Content-Type": "application/javascript",
            "Cache-Control": isDev ? "no-cache" : "public, max-age=3600"
          }
        });
      }
      
      // Serve other static files
      const contentType = {
        'css': 'text/css',
        'html': 'text/html',
        'json': 'application/json',
        'svg': 'image/svg+xml',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
      }[ext || ''] || 'text/plain';
      
      return new Response(staticFile, {
        headers: { "Content-Type": contentType }
      });
    }

    console.log(`Unhandled request: ${req.method} ${url.pathname}`);
    return new Response("Not found", { status: 404 });
  },
});

console.log(`OpenCode Chat server running on http://localhost:${PORT}`);
if (isDev) {
  console.log("Browser console logs will be streamed to this terminal");
}
