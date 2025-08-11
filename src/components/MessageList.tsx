import React, { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { marked } from "marked";
import DOMPurify from "dompurify";
import MessageContent from "./MessageContent";
import InlinePermission from "./InlinePermission";
import type { PermissionInfo } from "./InlinePermission";

interface MessageListProps {
  messages: Message[];
  isThinking?: boolean;
  isResponding?: boolean;
  activePermission?: PermissionInfo | null;
  onRespondPermission?: (response: "once" | "always" | "reject") => void;
}

interface Message {
  info: {
    id: string;
    role: "user" | "assistant";
    time?: {
      created?: number;
    };
    sessionID?: string;
    modelID?: string;
    providerID?: string;
    tokens?: {
      input?: number;
      output?: number;
      reasoning?: number;
    };
    cost?: number;
  };
  parts?: Array<{
    type: string;
    text?: string;
    name?: string;
    input?: any;
    output?: string;
    error?: string;
    synthetic?: boolean;
    callID?: string; // For tool calls
    metadata?: {
      stdout?: string;
      stderr?: string;
      exit?: number;
      description?: string;
    };
    tool?: string; // tool name
    state?: {
      status: "pending" | "running" | "completed" | "failed";
      input: any;
      output?: string;
      metadata?: {
        stdout?: string;
        stderr?: string;
        exit?: number;
        description?: string;
      };
    };
  }>;
}

export default function MessageList({
  messages,
  isThinking,
  isResponding,
  activePermission,
  onRespondPermission,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-4 lg:px-8 xl:px-12 py-4 min-h-0">
        <div className="text-center text-gray-500 dark:text-gray-400 italic">
          Welcome! Type a message to start chatting with OpenCode.
        </div>
      </div>
    );
  }

  // Sort messages by timestamp
  const sortedMessages = [...(messages || [])].sort((a, b) => {
    const timeA = a.info?.time?.created || 0;
    const timeB = b.info?.time?.created || 0;
    return timeA - timeB;
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 lg:px-8 xl:px-12 py-4 min-h-0">
      {sortedMessages.map((msg, msgIndex) => {
        const timestamp = msg.info?.time?.created;
        const time = timestamp ? new Date(timestamp) : new Date();
        const timeStr = time.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        if (msg.info.role === "user") {
          // User message
          const textPart = msg.parts?.find((p) => p.type === "text" && p.text);
          if (!textPart?.text) return null;

          return (
            <div key={msg.info.id} className="flex flex-col mb-4">
              <div className="flex justify-end">
                <div
                  className="max-w-[90%] sm:max-w-[70%] lg:max-w-[600px] px-4 py-2 rounded-lg text-white"
                  style={{
                    background: "linear-gradient(to right, #9333ea, #3b82f6)",
                  }}
                >
                  {textPart.text.trim()}
                </div>
              </div>
              <div className="text-right text-xs text-gray-500 dark:text-gray-400 mt-1 mr-2">
                {timeStr}
              </div>
            </div>
          );
        } else if (msg.info.role === "assistant") {
          // Build full assistant message content in order
          let fullContent = "";

          // Process all parts in their original order
          for (const part of msg.parts || []) {
            if (part.type === "text" && part.text && !part.synthetic) {
              if (fullContent) fullContent += "\n\n";
              fullContent += part.text;
            } else if (part.type === "tool_use") {
              fullContent += "\n\n🔧 **Tool: " + part.name + "**\n";
              fullContent += "```json\n";
              fullContent += JSON.stringify(part.input, null, 2) + "\n";
              fullContent += "```\n";
            } else if (part.type === "tool_result") {
              fullContent += "\n📤 **Result:**\n";
              if (part.output) {
                const output = part.output.substring(0, 1000);
                const truncated = part.output.length > 1000 ? "..." : "";
                fullContent +=
                  "```\n" +
                  output.replaceAll("```", "\\`\\`\\`") +
                  truncated +
                  "\n```\n";
              } else if (part.error) {
                fullContent += "❌ Error: " + part.error + "\n";
              }
            } else if (part.type === "tool" && part.state) {
              // const isRunning =
              //   part.state.status === "running" ||
              //   part.state.status === "pending";
              fullContent +=
                '\n\n<details open data-tool-status="' +
                part.state.status +
                '">\n<summary class="text-sm font-mono text-indigo-600 dark:text-indigo-400">› ' +
                part.tool +
                "</summary>\n\n";

              if (part.state.input) {
                // Special formatting for bash commands
                if (part.tool === "bash" && part.state.input.command) {
                  fullContent +=
                    "```bash\n$ " + part.state.input.command + "\n```\n\n";
                  if (part.state.input.description) {
                    fullContent +=
                      '<span class="text-xs text-gray-500 italic">' +
                      part.state.input.description +
                      "</span>\n\n";
                  }
                } else {
                  fullContent +=
                    '<span class="text-xs text-gray-500">input:</span>\n```json\n';
                  fullContent +=
                    JSON.stringify(part.state.input, null, 2) + "\n";
                  fullContent += "```\n\n";
                }
              }

              if (part.state.metadata?.stdout || part.state.metadata?.stderr) {
                // Try metadata fields
                if (part.state.metadata.stdout) {
                  fullContent += "```\n";
                  if (part.state.metadata.stdout.includes("```")) {
                    // debugger;
                  }
                  fullContent +=
                    part.state.metadata.stdout.replaceAll("```", "\\`\\`\\`") +
                    "\n";
                  fullContent += "```\n\n";
                }
                if (
                  part.state.metadata.stderr &&
                  part.state.metadata.stderr.trim()
                ) {
                  fullContent +=
                    '<span class="text-xs text-red-500">stderr:</span>\n```\n';
                  fullContent +=
                    part.state.metadata.stderr.replaceAll("```", "\\`\\`\\`") +
                    "\n";
                  fullContent += "```\n\n";
                }
                if (
                  part.state.metadata.exit !== undefined &&
                  part.state.metadata.exit !== 0
                ) {
                  fullContent +=
                    '<span class="text-xs text-red-500">exit code: ' +
                    part.state.metadata.exit +
                    "</span>\n\n";
                }
              } else if (part.state.output) {
                // Parse stdout/stderr tags if present
                const output = part.state.output;
                const stdoutMatch = output.match(
                  /<stdout>\n?([\s\S]*?)\n?<\/stdout>/,
                );
                const stderrMatch = output.match(
                  /<stderr>\n?([\s\S]*?)\n?<\/stderr>/,
                );

                if (stdoutMatch || stderrMatch) {
                  if (stdoutMatch && stdoutMatch[1]?.trim()) {
                    fullContent += "```\n";
                    fullContent +=
                      stdoutMatch[1].trim().replaceAll("```", "\\`\\`\\`") +
                      "\n";
                    fullContent += "```\n\n";
                  }
                  if (stderrMatch && stderrMatch[1]?.trim()) {
                    fullContent +=
                      '<span class="text-xs text-red-500">stderr:</span>\n```\n';
                    fullContent +=
                      stderrMatch[1].trim().replaceAll("```", "\\`\\`\\`") +
                      "\n";
                    fullContent += "```\n\n";
                  }
                } else {
                  // Fallback to raw output
                  fullContent += "```\n";
                  fullContent += output.replaceAll("```", "\\`\\`\\`") + "\n";
                  fullContent += "```\n";
                }
              }

              fullContent += "</details>\n";
            }
          }

          if (!fullContent) return null;

          return (
            <div key={msg.info.id} className="flex flex-col mb-4">
              <div className="flex justify-start">
                <div className="message-bubble max-w-[95%] sm:max-w-[85%] lg:max-w-[75%] xl:max-w-[1200px] px-4 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-100">
                  <MessageContent
                    content={fullContent}
                    isStreaming={msgIndex === sortedMessages.length - 1}
                  />
                  {onRespondPermission &&
                    activePermission &&
                    (msg.parts || []).some(
                      (p) =>
                        p.type === "tool" &&
                        p.callID === activePermission.callID,
                    ) && (
                      <InlinePermission
                        permission={activePermission}
                        onRespond={onRespondPermission}
                      />
                    )}
                </div>
              </div>
              <div className="text-left text-xs text-gray-500 dark:text-gray-400 mt-1 ml-2 flex items-center gap-3">
                <span>{timeStr}</span>
                {msg.info.modelID && (
                  <span
                    className="text-gray-400"
                    title={`Model: ${msg.info.modelID}`}
                  >
                    {msg.info.modelID}
                  </span>
                )}
                {msg.info.tokens && (
                  <span className="text-gray-400" title="Token usage">
                    {(
                      (msg.info.tokens.input || 0) +
                      (msg.info.tokens.output || 0) +
                      (msg.info.tokens.reasoning || 0)
                    ).toLocaleString()}{" "}
                    tokens
                  </span>
                )}
                {msg.info.cost !== undefined && msg.info.cost > 0 && (
                  <span className="text-gray-400" title="Cost">
                    ${msg.info.cost.toFixed(4)}
                  </span>
                )}
              </div>
            </div>
          );
        }

        return null;
      })}

      {(isThinking || isResponding) && (
        <div className="flex flex-col mb-4">
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-lg bg-gray-100 dark:bg-slate-700">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
                  <div
                    className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"
                    style={{ animationDelay: "150ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"
                    style={{ animationDelay: "300ms" }}
                  ></div>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {isThinking ? "Thinking..." : "Responding..."}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
