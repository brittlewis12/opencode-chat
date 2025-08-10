import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import MessageList from "./MessageList";
import { type PermissionInfo } from "./InlinePermission";
import ConfigManager from "./ConfigManager";
import { marked } from "marked";
import DOMPurify from "dompurify";

interface ChatProps {
  sessionId: string | null;
}

export default function Chat({ sessionId: propSessionId }: ChatProps) {
  const [sessionId, setSessionId] = useState(propSessionId);
  // Keep internal sessionId in sync with prop (e.g., New Chat)
  useEffect(() => {
    setSessionId(propSessionId);
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
        }
      })
      .catch((err) => console.error("Failed to fetch initial state:", err));
  }, [sessionId]);

  // Connect to our server's SSE for streaming state updates
  useEffect(() => {
    if (!sessionId) return;

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
              setPendingPermission(null);
            }
            const msgs = Array.isArray(state?.messages) ? state.messages : [];
            const lastAssistant = [...msgs]
              .reverse()
              .find((m: any) => m?.info?.role === "assistant");
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
            // Compute session cost using pricing map; fallback to server-reported cost
            let computed = 0;
            for (const m of msgs) {
              if (
                m?.info?.role !== "assistant" ||
                !m?.info?.tokens ||
                !m?.info?.modelID
              )
                continue;
              const price = pricingByModel[m.info.modelID];
              if (!price) continue;
              const tIn = m.info.tokens.input || 0;
              const tOut = m.info.tokens.output || 0;
              const tReason = m.info.tokens.reasoning || 0;
              const denom = 1_000_000; // pricing is $ per 1M tokens
              if (price.input) computed += (tIn / denom) * price.input;
              if (price.output) computed += (tOut / denom) * price.output;
              if (price.reasoning)
                computed += (tReason / denom) * price.reasoning;
            }
            if (computed > 0) setCost(computed);
            else if (lastAssistant?.info?.cost !== undefined)
              setCost(lastAssistant.info.cost);
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
            setPendingPermission(state.permissions.byId[activeId]);
          } else if (state?.currentPermission) {
            setPendingPermission(state.currentPermission);
          } else {
            setPendingPermission(null);
          }

          // Calculate context usage and cost
          const msgs = Array.isArray(state?.messages) ? state.messages : [];
          const lastAssistant = [...msgs]
            .reverse()
            .find((m: any) => m?.info?.role === "assistant");
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
        <button
          onClick={() => setShowConfig(true)}
          className="text-gray-400 hover:text-gray-200 p-1"
          title="Configure permissions"
        >
          ⚙️
        </button>
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
                  acc[model.provider].push(model);
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
