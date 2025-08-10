import React, { useEffect, useRef, useState } from "react";
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
  };
  parts?: Array<{
    type: string;
    text?: string;
    name?: string;
    input?: any;
    output?: string;
    error?: string;
    synthetic?: boolean;
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
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
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
    <div className="flex-1 overflow-y-auto p-4 min-h-0">
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
                  className="max-w-[85%] px-4 py-2 rounded-lg text-white"
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
                fullContent += "```\n" + output + truncated + "\n```\n";
              } else if (part.error) {
                fullContent += "❌ Error: " + part.error + "\n";
              }
            } else if (part.type === "tool" && (part as any).state) {
              // OpenCode's tool format
              const tool = part as any;
              const isRunning =
                tool.state.status === "running" ||
                tool.state.status === "pending";
              fullContent +=
                '\n\n<details open data-tool-status="' +
                tool.state.status +
                '">\n<summary class="text-sm font-mono text-indigo-600 dark:text-indigo-400">› ' +
                tool.tool +
                "</summary>\n\n";

              if (tool.state.input) {
                // Special formatting for bash commands
                if (tool.tool === "bash" && tool.state.input.command) {
                  fullContent +=
                    "```bash\n$ " + tool.state.input.command + "\n```\n\n";
                  if (tool.state.input.description) {
                    fullContent +=
                      '<span class="text-xs text-gray-500 italic">' +
                      tool.state.input.description +
                      "</span>\n\n";
                  }
                } else {
                  fullContent +=
                    '<span class="text-xs text-gray-500">input:</span>\n```json\n';
                  fullContent +=
                    JSON.stringify(tool.state.input, null, 2) + "\n";
                  fullContent += "```\n\n";
                }
              }

              if (tool.state.output) {
                // Parse stdout/stderr tags if present
                const output = tool.state.output;
                const stdoutMatch = output.match(
                  /<stdout>\n?([\s\S]*?)\n?<\/stdout>/,
                );
                const stderrMatch = output.match(
                  /<stderr>\n?([\s\S]*?)\n?<\/stderr>/,
                );

                if (stdoutMatch || stderrMatch) {
                  if (stdoutMatch && stdoutMatch[1].trim()) {
                    fullContent += "```\n";
                    fullContent += stdoutMatch[1] + "\n";
                    fullContent += "```\n\n";
                  }
                  if (stderrMatch && stderrMatch[1].trim()) {
                    fullContent +=
                      '<span class="text-xs text-red-500">stderr:</span>\n```\n';
                    fullContent += stderrMatch[1] + "\n";
                    fullContent += "```\n\n";
                  }
                } else if (
                  tool.state.metadata?.stdout ||
                  tool.state.metadata?.stderr
                ) {
                  // Try metadata fields
                  if (tool.state.metadata.stdout) {
                    fullContent += "```\n";
                    fullContent += tool.state.metadata.stdout + "\n";
                    fullContent += "```\n\n";
                  }
                  if (
                    tool.state.metadata.stderr &&
                    tool.state.metadata.stderr.trim()
                  ) {
                    fullContent +=
                      '<span class="text-xs text-red-500">stderr:</span>\n```\n';
                    fullContent += tool.state.metadata.stderr + "\n";
                    fullContent += "```\n\n";
                  }
                  if (
                    tool.state.metadata.exit !== undefined &&
                    tool.state.metadata.exit !== 0
                  ) {
                    fullContent +=
                      '<span class="text-xs text-red-500">exit code: ' +
                      tool.state.metadata.exit +
                      "</span>\n\n";
                  }
                } else {
                  // Fallback to raw output
                  fullContent += "```\n";
                  fullContent += output + "\n";
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
                <div className="message-bubble max-w-[85%] sm:max-w-[70%] px-4 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-100">
                  <MessageContent
                    content={fullContent}
                    isStreaming={msgIndex === sortedMessages.length - 1}
                  />
                  {activePermission &&
                    onRespondPermission &&
                    (msg.parts || []).some(
                      (p) =>
                        (p as any).type === "tool" &&
                        (p as any).callID === activePermission.callID,
                    ) && (
                      <div className="mt-2">
                        <InlinePermission
                          permission={activePermission}
                          onRespond={onRespondPermission}
                        />
                      </div>
                    )}
                </div>
              </div>
              <div className="text-left text-xs text-gray-500 dark:text-gray-400 mt-1 ml-2">
                {timeStr}
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
