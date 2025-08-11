import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import MessageList from "./MessageList";
import PermissionRequest, { type PermissionInfo } from "./PermissionRequest";
import ConfigManager from "./ConfigManager";
import { marked } from "marked";
import DOMPurify from "dompurify";

interface ChatProps {
  sessionId: string | null;
  onProjectPathChange?: (path: string | null) => void;
}

export default function Chat({
  sessionId: propSessionId,
  onProjectPathChange,
}: ChatProps) {
  const [sessionId, setSessionId] = useState(propSessionId);
  const sessionSwitchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep internal sessionId in sync with prop (e.g., New Chat) with debounce
  useEffect(() => {
    // Clear any pending session switch
    if (sessionSwitchTimeoutRef.current) {
      clearTimeout(sessionSwitchTimeoutRef.current);
    }

    // Debounce rapid session changes
    sessionSwitchTimeoutRef.current = setTimeout(() => {
      setSessionId(propSessionId);
      sessionSwitchTimeoutRef.current = null;
    }, 50); // 50ms debounce

    return () => {
      if (sessionSwitchTimeoutRef.current) {
        clearTimeout(sessionSwitchTimeoutRef.current);
      }
    };
  }, [propSessionId]);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("build");
  const [contextUsage, setContextUsage] = useState("--");
  const [cost, setCost] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [pendingPermission, setPendingPermission] =
    useState<PermissionInfo | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const stallCheckRef = useRef<number | null>(null);
  const lastEventRef = useRef<number>(0);
  const [runningTools, setRunningTools] = useState<Map<string, any>>(new Map());
  const [serverState, setServerState] = useState<any>({
    messages: [],
    permissions: { byId: {}, queue: [] },
    lastUpdate: 0,
  });
  const [projectCwd, setProjectCwd] = useState<string | null>(null);
  const [projectRoot, setProjectRoot] = useState<string | null>(null);
  const [homeDir, setHomeDir] = useState<string | null>(null);

  // Fetch home directory once
  useEffect(() => {
    fetch("/home")
      .then((res) => res.json())
      .then((data) => setHomeDir(data.home))
      .catch(() => {});
  }, []);

  // Helper to format path with ~ for home
  const formatPath = (path: string) => {
    if (!path) return path;
    if (homeDir && path.startsWith(homeDir)) {
      return "~" + path.slice(homeDir.length);
    }
    return path;
  };

  // Fetch available models
  const { data: providers } = useQuery({
    queryKey: ["providers"],
    queryFn: async () => {
      const res = await fetch("/config/providers");
      if (!res.ok) throw new Error("Failed to fetch providers");
      return res.json() as Promise<{ providers: any[] }>;
    },
  });

  // Fetch available agents
  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await fetch("/agent");
      if (!res.ok) throw new Error("Failed to fetch agents");
      return res.json();
    },
  });

  // Parse models from providers and extract pricing/limits
  const { modelList, pricingByModel, contextLimitByModel } =
    React.useMemo(() => {
      const result = {
        modelList: [] as Array<{ id: string; name: string; provider: string }>,
        pricingByModel: {} as Record<
          string,
          {
            input?: number;
            output?: number;
            reasoning?: number;
            cache_read?: number;
            cache_write?: number;
          }
        >,
        contextLimitByModel: {} as Record<string, number>,
      };
      if (!providers?.providers) return result;
      for (const provider of providers.providers) {
        for (const [id, model] of Object.entries<any>(provider.models || {})) {
          if (model?.enabled === false) continue;
          result.modelList.push({
            id,
            name: model?.name,
            provider: provider.id,
          });
          if (model?.cost && typeof model.cost === "object") {
            result.pricingByModel[id] = {
              input:
                typeof model.cost.input === "number"
                  ? model.cost.input
                  : undefined,
              output:
                typeof model.cost.output === "number"
                  ? model.cost.output
                  : undefined,
              reasoning:
                typeof model.cost.reasoning === "number"
                  ? model.cost.reasoning
                  : undefined,
              cache_read:
                typeof model.cost.cache_read === "number"
                  ? model.cost.cache_read
                  : undefined,
              cache_write:
                typeof model.cost.cache_write === "number"
                  ? model.cost.cache_write
                  : undefined,
            };
          }
          if (model?.limit && typeof model.limit.context === "number") {
            result.contextLimitByModel[id] = model.limit.context;
            result.contextLimitByModel[`${provider.id}/${id}`] =
              model.limit.context;
          }
        }
      }
      return result;
    }, [providers]);

  // Ensure selected model is valid for the current provider list and session
  useEffect(() => {
    if (modelList.length === 0) return;
    let currentId: string | null = null;
    try {
      const parsed = JSON.parse(selectedModel);
      currentId = parsed?.id || null;
    } catch {
      currentId = selectedModel || null;
    }
    const exists = currentId
      ? modelList.some((m: any) => m.id === currentId)
      : false;
    if (!exists) {
      const saved = localStorage.getItem("opencodePreferredModel");
      const defaultModel = "claude-opus-4-1-20250805";
      const modelToUse =
        (modelList as any[]).find((m) => m.id === saved) ||
        (modelList as any[]).find((m) => m.id === defaultModel) ||
        (modelList as any[])[0];
      if (modelToUse) {
        const modelValue = JSON.stringify({
          id: (modelToUse as any).id,
          provider: (modelToUse as any).provider,
        });
        setSelectedModel(modelValue);
      }
    }
  }, [modelList, sessionId]);

  // When switching sessions, prefer the last assistant's model if available
  useEffect(() => {
    if (!sessionId || modelList.length === 0) return;
    const msgs = Array.isArray(serverState?.messages)
      ? serverState.messages
      : [];
    const lastAssistant = [...msgs]
      .reverse()
      .find((m: any) => m?.info?.role === "assistant" && m?.info?.modelID);
    if (!lastAssistant) return;
    const modelId = lastAssistant.info.modelID;
    const providerId = lastAssistant.info.providerID;
    const exists = (modelList as any[]).some((m: any) => m.id === modelId);
    if (!exists) return;
    try {
      const parsed = JSON.parse(selectedModel || "{}");
      if (parsed?.id === modelId) return;
    } catch {
      /* ignore */
    }
    const provider =
      providerId ||
      ((modelList as any[]).find((m: any) => m.id === modelId) as any)
        ?.provider;
    setSelectedModel(JSON.stringify({ id: modelId, provider }));
  }, [sessionId, serverState?.lastUpdate, modelList]);

  // Fetch initial state
  useEffect(() => {
    if (!sessionId) {
      setServerState({
        messages: [],
        permissions: { byId: {}, queue: [] },
        lastUpdate: 0,
      });
      setPendingPermission(null);
      setContextUsage("--");
      setCost(0);
      setIsThinking(false);
      setIsResponding(false);
      return;
    }

    fetch(`/session/${sessionId}/state`)
      .then((res) => res.json() as Promise<any>)
      .then((state: any) => {
        setServerState(state);
        const activeId = state?.permissions?.activeId;
        if (activeId && state?.permissions?.byId?.[activeId]) {
          setPendingPermission(state.permissions.byId[activeId]);
        } else if (state?.currentPermission) {
          // backward-compat if old shape
          setPendingPermission(state.currentPermission);
        } else {
          // Try to recover permission from localStorage
          const keys = Object.keys(localStorage).filter((k) =>
            k.startsWith(`permission_${sessionId}_`),
          );
          if (keys.length > 0) {
            try {
              const recovered = JSON.parse(
                localStorage.getItem(keys[0]!) || "{}",
              );
              if (recovered.id) {
                console.log(
                  "Recovered permission from localStorage:",
                  recovered.id,
                );
                setPendingPermission(recovered);
              }
            } catch (e) {
              console.error("Failed to recover permission:", e);
            }
          }
        }

        // Extract project paths from last assistant message
        const msgs = Array.isArray(state?.messages) ? state.messages : [];
        const lastAssistant = [...msgs]
          .reverse()
          .find((m: any) => m?.info?.role === "assistant");
        if (lastAssistant?.info?.path) {
          if (lastAssistant.info.path.cwd) {
            setProjectCwd(formatPath(lastAssistant.info.path.cwd));
          }
          if (lastAssistant.info.path.root) {
            const formattedRoot = formatPath(lastAssistant.info.path.root);
            setProjectRoot(formattedRoot);
            onProjectPathChange?.(formattedRoot);
          }
        }
      })
      .catch((err) => console.error("Failed to fetch initial state:", err));
  }, [sessionId]);

  // Connect to our server's SSE for streaming state updates
  useEffect(() => {
    if (!sessionId) return;

    // Enable buffering BEFORE closing old connection
    const previousSessionId =
      eventSourceRef.current?.url?.match(/sessionId=([^&]+)/)?.[1];
    if (previousSessionId && previousSessionId !== sessionId) {
      // Switching sessions - enable buffering for the new session
      fetch(`/session/${sessionId}/buffer/enable`, { method: "POST" }).catch(
        (err) => console.error("Failed to enable buffering:", err),
      );
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/stream?sessionId=${sessionId}`);
    eventSourceRef.current = eventSource;

    const stopPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
    const startPolling = () => {
      if (pollIntervalRef.current) return;
      pollIntervalRef.current = window.setInterval(async () => {
        try {
          const res = await fetch(`/session/${sessionId}/state`);
          if (!res.ok) return;
          const state: any = await res.json();
          if ((state?.lastUpdate || 0) > (serverState?.lastUpdate || 0)) {
            setServerState(state);
            const activeId = state?.permissions?.activeId;
            if (activeId && state?.permissions?.byId?.[activeId]) {
              setPendingPermission(state.permissions.byId[activeId]);
            } else if (state?.currentPermission) {
              setPendingPermission(state.currentPermission);
            } else {
              // Only clear if we don't already have a permission
              if (!pendingPermission) {
                setPendingPermission(null);
              }
            }
            const msgs = Array.isArray(state?.messages) ? state.messages : [];
            const lastAssistant = [...msgs]
              .reverse()
              .find((m: any) => m?.info?.role === "assistant");

            // Extract project paths from assistant message
            if (lastAssistant?.info?.path) {
              if (lastAssistant.info.path.cwd) {
                setProjectCwd(formatPath(lastAssistant.info.path.cwd));
              }
              if (lastAssistant.info.path.root) {
                const formattedRoot = formatPath(lastAssistant.info.path.root);
                setProjectRoot(formattedRoot);
                onProjectPathChange?.(formattedRoot);
              }
            }

            if (lastAssistant?.info?.tokens) {
              const total =
                (lastAssistant.info.tokens.input || 0) +
                (lastAssistant.info.tokens.output || 0) +
                (lastAssistant.info.tokens.reasoning || 0);
              const modelKey = lastAssistant.info.modelID;
              const limit =
                (contextLimitByModel as any)[modelKey] ??
                (contextLimitByModel as any)[
                  (modelKey || "").split("/").pop()!
                ] ??
                200000;
              const percent = Math.round((total / limit) * 100);
              setContextUsage(`${(total / 1000).toFixed(1)}K/${percent}%`);
            }
            // Cost: prefer server-reported last run; fallback to parts; then compute from pricing (per 1M tokens)
            let lastCost: number | undefined = lastAssistant?.info?.cost;
            if ((lastCost === undefined || lastCost === 0) && lastAssistant) {
              let partsCost = 0;
              for (const p of lastAssistant.parts || []) {
                if (typeof (p as any)?.cost === "number")
                  partsCost += (p as any).cost as number;
              }
              if (partsCost > 0) lastCost = partsCost;
            }
            if (
              (lastCost === undefined || lastCost === 0) &&
              lastAssistant?.info?.tokens &&
              lastAssistant?.info?.modelID
            ) {
              const price = (pricingByModel as any)[lastAssistant.info.modelID];
              if (price) {
                const denom = 1_000_000;
                const tIn = lastAssistant.info.tokens.input || 0;
                const tOut = lastAssistant.info.tokens.output || 0;
                const tReason = lastAssistant.info.tokens.reasoning || 0;
                let computed = 0;
                if (price.input) computed += (tIn / denom) * price.input;
                if (price.output) computed += (tOut / denom) * price.output;
                if (price.reasoning)
                  computed += (tReason / denom) * price.reasoning;
                if (computed > 0) lastCost = computed;
              }
            }
            if (typeof lastCost === "number") setCost(lastCost);
            const lastMsg = (msgs || []).slice(-1)[0];
            const isLastMessageIncomplete =
              lastMsg?.info?.role === "assistant" &&
              !lastMsg?.info?.time?.completed;
            const hasRunningTools =
              isLastMessageIncomplete &&
              (lastMsg?.parts || []).some(
                (p: any) =>
                  p?.type === "tool" &&
                  (p?.state?.status === "running" ||
                    p?.state?.status === "pending"),
              );
            setIsThinking(false);
            setIsResponding(hasRunningTools || isLastMessageIncomplete);
          }
        } catch {}
      }, 1200);
    };

    lastEventRef.current = Date.now();

    eventSource.onopen = () => {
      lastEventRef.current = Date.now();
      // when SSE opens, favor SSE by stopping any polling
      stopPolling();
      // Disable buffering and flush any buffered events
      fetch(`/session/${sessionId}/buffer/disable`, { method: "POST" }).catch(
        (err) => console.error("Failed to disable buffering:", err),
      );
    };

    eventSource.onerror = () => {
      // On error, begin polling; EventSource will try to reconnect automatically
      startPolling();
    };

    eventSource.onmessage = (event) => {
      try {
        const data: any = JSON.parse(event.data);
        // heartbeat lines like ":keepalive" are filtered by server; if any data arrives, mark fresh
        lastEventRef.current = Date.now();
        // We're now receiving declarative state from our server
        if (data?.sessionId === sessionId && data?.state) {
          const state: any = data.state;
          setServerState(state);
          // Since SSE is alive, stop polling
          stopPolling();

          // Update permission from queue if present
          const activeId = state?.permissions?.activeId;
          if (activeId && state?.permissions?.byId?.[activeId]) {
            const perm = state.permissions.byId[activeId];
            setPendingPermission(perm);
            // Persist permission to localStorage for recovery
            if (sessionId) {
              localStorage.setItem(
                `permission_${sessionId}_${perm.id}`,
                JSON.stringify(perm),
              );
            }
          } else if (state?.currentPermission) {
            setPendingPermission(state.currentPermission);
            if (sessionId && state.currentPermission.id) {
              localStorage.setItem(
                `permission_${sessionId}_${state.currentPermission.id}`,
                JSON.stringify(state.currentPermission),
              );
            }
            // } else {
            //   // Don't clear the permission if we recovered one from localStorage
            //   // The server doesn't know about it, so state won't have it
            //   console.log(
            //     "SSE: No permission in state, keeping existing pendingPermission",
            //   );
          }

          // Calculate context usage and cost
          const msgs = Array.isArray(state?.messages) ? state.messages : [];
          const lastAssistant = [...msgs]
            .reverse()
            .find((m: any) => m?.info?.role === "assistant");

          // Extract project paths from assistant message
          if (lastAssistant?.info?.path) {
            if (lastAssistant.info.path.cwd) {
              setProjectCwd(formatPath(lastAssistant.info.path.cwd));
            }
            if (lastAssistant.info.path.root) {
              const formattedRoot = formatPath(lastAssistant.info.path.root);
              setProjectRoot(formattedRoot);
              onProjectPathChange?.(formattedRoot);
            }
          }

          if (lastAssistant?.info?.tokens) {
            const total =
              (lastAssistant.info.tokens.input || 0) +
              (lastAssistant.info.tokens.output || 0) +
              (lastAssistant.info.tokens.reasoning || 0);
            const modelKey = lastAssistant.info.modelID;
            const limit =
              (contextLimitByModel as any)[modelKey] ??
              (contextLimitByModel as any)[
                (modelKey || "").split("/").pop()!
              ] ??
              200000;
            const percent = Math.round((total / limit) * 100);
            setContextUsage(`${(total / 1000).toFixed(1)}K/${percent}%`);
          }
          if (lastAssistant?.info?.cost !== undefined) {
            setCost(lastAssistant.info.cost);
          }

          // Check if we're thinking/responding based on tool states
          const lastMsg = (msgs || []).slice(-1)[0];
          const isLastMessageIncomplete =
            lastMsg?.info?.role === "assistant" &&
            !lastMsg?.info?.time?.completed;
          const hasRunningTools =
            isLastMessageIncomplete &&
            (lastMsg?.parts || []).some(
              (p: any) =>
                p?.type === "tool" &&
                (p?.state?.status === "running" ||
                  p?.state?.status === "pending"),
            );
          setIsThinking(false);
          setIsResponding(hasRunningTools || isLastMessageIncomplete);
        }
      } catch (e) {
        console.error("Failed to process SSE message:", e, event?.data);
      }
    };

    // Stall detection: if no SSE for 12s, start polling
    if (stallCheckRef.current) clearInterval(stallCheckRef.current);
    stallCheckRef.current = window.setInterval(() => {
      const now = Date.now();
      if (now - lastEventRef.current > 12000) {
        startPolling();
      }
    }, 3000);

    return () => {
      if (stallCheckRef.current) {
        clearInterval(stallCheckRef.current);
        stallCheckRef.current = null;
      }
      stopPolling();
      eventSource.close();
    };
  }, [sessionId, queryClient, serverState?.lastUpdate]);

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      setIsThinking(true);
      setIsResponding(false);

      // Parse model data if it's JSON (new format)
      let modelId = selectedModel;
      let providerId = null;
      try {
        const parsed = JSON.parse(selectedModel);
        modelId = parsed.id;
        providerId = parsed.provider;
      } catch {
        // Fallback for plain model ID
        modelId = selectedModel;
        // Guess provider from model name
        if (modelId.startsWith("claude")) {
          providerId = "anthropic";
        } else if (modelId.startsWith("gpt")) {
          providerId = "openai";
        }
      }

      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          sessionId,
          modelId,
          providerId,
          agent: selectedAgent,
        }),
      });

      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        localStorage.setItem("opencodeSessionId", data.sessionId);
      }
      setInput("");
      queryClient.invalidateQueries({
        queryKey: ["messages", data.sessionId || sessionId],
      });
    },
    onError: () => {
      setIsThinking(false);
      setIsResponding(false);
    },
  });

  const handleSubmit = async () => {
    if (!selectedModel) {
      alert("Please select a model first");
      return;
    }

    if (!input.trim()) {
      return;
    }

    // Bypass the mutation and just do the fetch directly
    try {
      setIsThinking(true);
      let modelId = selectedModel;
      let providerId = null;
      try {
        const parsed = JSON.parse(selectedModel);
        modelId = parsed.id;
        providerId = parsed.provider;
      } catch {
        modelId = selectedModel;
        if (modelId.startsWith("claude")) {
          providerId = "anthropic";
        } else if (modelId.startsWith("gpt")) {
          providerId = "openai";
        }
      }

      console.log("Sending POST to /chat with:", {
        message: input.trim(),
        sessionId,
        modelId,
        providerId,
        agent: selectedAgent,
      });
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input.trim(),
          sessionId,
          modelId,
          providerId,
          agent: selectedAgent,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Failed to send message:", res.status, errorText);
        throw new Error(`Failed to send message: ${res.status}`);
      }
      const data = await res.json();

      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        localStorage.setItem("opencodeSessionId", data.sessionId);
      }
      setInput("");
      queryClient.invalidateQueries({
        queryKey: ["messages", data.sessionId || sessionId],
      });
    } catch (error) {
      console.error("Send error:", error);
      setIsThinking(false);
    }
  };

  const handlePermissionResponse = async (
    response: "once" | "always" | "reject",
  ) => {
    if (!pendingPermission) return;

    try {
      const permissionId = pendingPermission.id;
      console.log("Responding to permission:", permissionId, "with:", response);

      const res = await fetch(
        `/session/${pendingPermission.sessionID}/permissions/${permissionId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response }),
        },
      );

      if (res.ok) {
        setPendingPermission(null);
        // Clean up from localStorage
        if (pendingPermission.sessionID && permissionId) {
          localStorage.removeItem(
            `permission_${pendingPermission.sessionID}_${permissionId}`,
          );
        }
        // Clear from running tools if it was there
        if (pendingPermission.callID) {
          setRunningTools((prev) => {
            const next = new Map(prev);
            next.delete(pendingPermission.callID!);
            return next;
          });
        }
      } else {
        const error = await res.text();
        console.error("Permission response failed:", res.status, error);
        // Still close the modal on error to avoid being stuck
        setPendingPermission(null);
        alert(`Failed to respond to permission: ${res.status}`);
      }
    } catch (error) {
      console.error("Failed to respond to permission:", error);
      // Still close the modal on error to avoid being stuck
      setPendingPermission(null);
      alert("Failed to respond to permission");
    }
  };

  return (
    <>
      {/* Permission modal only when not tied to a visible tool call */}
      {(() => {
        if (!pendingPermission) return null;
        const isInline =
          !!pendingPermission.callID &&
          (serverState.messages || []).some((m: any) =>
            (m.parts || []).some(
              (p: any) =>
                p.type === "tool" && p.callID === pendingPermission.callID,
            ),
          );
        console.log("PendingPermission isInline:", isInline);
        if (isInline) return null;
        return (
          <PermissionRequest
            permission={pendingPermission}
            onRespond={handlePermissionResponse}
          />
        );
      })()}
      {showConfig && <ConfigManager onClose={() => setShowConfig(false)} />}
      <MessageList
        messages={serverState.messages || []}
        isThinking={isThinking}
        isResponding={isResponding}
        activePermission={pendingPermission}
        onRespondPermission={handlePermissionResponse}
      />

      <div className="p-4 border-t border-gray-200 dark:border-slate-600 flex-shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:border-purple-600 dark:focus:border-purple-400"
            disabled={sendMessage.isPending}
            autoFocus
          />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            disabled={sendMessage.isPending || !selectedModel}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-shadow disabled:opacity-50"
          >
            {sendMessage.isPending ? "..." : "Send"}
          </button>
        </div>
      </div>

      <div className="px-4 py-2 bg-gray-900 text-xs text-gray-400 flex justify-between items-center flex-shrink-0 sm:rounded-b-2xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfig(true)}
            className="text-gray-400 hover:text-gray-200 p-1"
            title="Configure permissions"
          >
            ⚙️
          </button>
          {projectCwd && (
            <span className="text-gray-500" title="Working directory">
              📁 {projectCwd}
            </span>
          )}
        </div>
        {Math.max(
          0,
          (serverState.permissions?.queue?.length || 0) -
            (pendingPermission ? 1 : 0),
        ) > 0 && (
          <span
            className="ml-2 text-[10px] bg-yellow-500 text-black px-1.5 py-0.5 rounded-full"
            title="Queued approval requests"
          >
            +
            {Math.max(
              0,
              (serverState.permissions?.queue?.length || 0) -
                (pendingPermission ? 1 : 0),
            )}
          </span>
        )}
        <span title="Token usage">{contextUsage}</span>
        <div className="flex gap-2">
          <select
            value={selectedModel}
            onChange={(e) => {
              setSelectedModel(e.target.value);
              try {
                const parsed = JSON.parse(e.target.value);
                localStorage.setItem("opencodePreferredModel", parsed.id);
              } catch {
                localStorage.setItem("opencodePreferredModel", e.target.value);
              }
            }}
            className="bg-gray-800 text-gray-400 border border-gray-700 rounded px-2 py-1"
          >
            {modelList.length === 0 && <option>Loading...</option>}
            {Object.entries(
              (
                modelList as Array<{
                  id: string;
                  name: string;
                  provider: string;
                }>
              ).reduce(
                (
                  acc: Record<
                    string,
                    Array<{ id: string; name: string; provider: string }>
                  >,
                  model,
                ) => {
                  if (!acc[model.provider]) acc[model.provider] = [];
                  acc[model.provider]?.push(model);
                  return acc;
                },
                {} as Record<
                  string,
                  Array<{ id: string; name: string; provider: string }>
                >,
              ),
            ).map(([provider, providerModels]) => (
              <optgroup key={provider} label={provider}>
                {(
                  providerModels as Array<{
                    id: string;
                    name: string;
                    provider: string;
                  }>
                ).map((model) => (
                  <option
                    key={model.id}
                    value={JSON.stringify({
                      id: model.id,
                      provider: model.provider,
                    })}
                  >
                    {model.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="bg-gray-800 text-gray-400 border border-gray-700 rounded px-2 py-1"
          >
            {agents
              ?.filter((a: any) => a.mode === "primary")
              .map((agent: any) => (
                <option key={agent.name} value={agent.name}>
                  {agent.name} mode
                </option>
              ))}
          </select>
        </div>
        <span title="Session cost">${cost.toFixed(2)}</span>
      </div>
    </>
  );
}
