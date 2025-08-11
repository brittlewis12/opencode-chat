import React from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import CopyButton from "./CopyButton";

interface MessagePart {
  type: "text" | "code" | "tool";
  content: string;
  language?: string;
  toolName?: string;
  command?: string;
  output?: string;
  description?: string;
  status?: "pending" | "running" | "completed" | "failed";
}

function parseMessageContent(content: string): MessagePart[] {
  const parts: MessagePart[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    // Check for tool details
    const nextLine = lines[i + 1];
    if (
      line &&
      line.includes("<details") &&
      nextLine &&
      nextLine.includes("› ")
    ) {
      const statusMatch = line.match(/data-tool-status="(\w+)"/);
      const status = (statusMatch?.[1] as any) || "completed";
      const toolMatch = nextLine.match(/› (\w+)/);
      const toolName = toolMatch?.[1] || "tool";

      // Find the end of this details block
      let j = i + 2;
      let command = "";
      let output = "";
      let description = "";
      let inCommand = false;
      let inOutput = false;

      while (j < lines.length && !lines[j]?.includes("</details>")) {
        if (lines[j]?.startsWith("```bash")) {
          inCommand = true;
          j++;
          while (j < lines.length && !lines[j]?.startsWith("```")) {
            if (command) command += "\n";
            command += lines[j]!.replace(/^\$ /, "");
            j++;
          }
          inCommand = false;
        } else if (lines[j]?.startsWith("```") && !inCommand) {
          inOutput = true;
          j++;
          while (j < lines.length && !lines[j]?.startsWith("```")) {
            if (output) output += "\n";
            output += lines[j];
            j++;
          }
          inOutput = false;
        } else if (lines[j]?.includes('class="text-xs text-gray-500 italic"')) {
          const descMatch = lines[j]!.match(/>([^<]+)</);
          if (descMatch && descMatch[1]) description = descMatch[1];
        }
        j++;
      }

      parts.push({
        type: "tool",
        content: "",
        toolName,
        command: command.trim(),
        output: output.trim(),
        description,
        status,
      });

      i = j + 1;
    }
    // Check for code blocks
    else if (line?.startsWith("```")) {
      const language = line.slice(3).trim() || "text";
      let code = "";
      i++;

      while (i < lines.length && !lines[i]!.startsWith("```")) {
        if (code) code += "\n";
        code += lines[i];
        i++;
      }

      parts.push({
        type: "code",
        content: code,
        language,
      });

      i++; // Skip closing ```
    }
    // Regular text
    else {
      let text = line;
      i++;

      // Collect consecutive text lines
      while (
        i < lines.length &&
        !lines[i]?.startsWith("```") &&
        !lines[i]?.includes("<details")
      ) {
        text += "\n" + lines[i];
        i++;
      }

      if (text?.trim()) {
        parts.push({
          type: "text",
          content: text,
        });
      }
    }
  }

  return parts;
}

function ToolSpinner() {
  return (
    <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
      <svg
        className="animate-spin h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      <span>Running...</span>
    </div>
  );
}

export default function MessageContent({
  content,
  isStreaming = false,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  const parsedParts = parseMessageContent(content);

  return (
    <div className="message-content text-base lg:text-[1.05rem] xl:text-[1.1rem]">
      {parsedParts.map((part, index) => {
        if (part.type === "text") {
          const html = marked.parse(part.content) as string;
          const clean = DOMPurify.sanitize(html);
          return (
            <div key={index} dangerouslySetInnerHTML={{ __html: clean }} />
          );
        }

        if (part.type === "code") {
          return (
            <div key={index} className="relative group my-2">
              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <CopyButton text={part.content} />
              </div>
              <pre className="overflow-x-auto p-3 lg:p-4 bg-gray-100 dark:bg-gray-800 rounded text-sm lg:text-[0.95rem] xl:text-base">
                <code className={`language-${part.language}`}>
                  {part.content}
                </code>
              </pre>
            </div>
          );
        }

        if (part.type === "tool") {
          const isRunning =
            part.status === "running" || part.status === "pending";

          return (
            <div key={index}>
              <details
                open
                className="my-2 p-3 lg:p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800"
              >
                <summary className="text-sm font-mono text-indigo-600 dark:text-indigo-400 cursor-pointer flex items-center gap-2">
                  <span>› {part.toolName}</span>
                  {isRunning && <ToolSpinner />}
                </summary>

                {part.command && (
                  <div className="relative group mt-2">
                    {!isRunning && (
                      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <CopyButton text={part.command} />
                      </div>
                    )}
                    <pre className="overflow-x-auto p-3 lg:p-4 bg-gray-900 text-gray-100 rounded text-sm lg:text-[0.95rem] xl:text-base">
                      <code>$ {part.command}</code>
                    </pre>
                    {part.description && (
                      <div className="text-xs text-gray-500 italic mt-1">
                        {part.description}
                      </div>
                    )}
                  </div>
                )}

                {isRunning && !part.output && (
                  <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        <div
                          className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Executing command...
                      </span>
                    </div>
                  </div>
                )}

                {part.output && (
                  <div className="relative group mt-2">
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <CopyButton text={part.output} />
                    </div>
                    <pre className="overflow-x-auto p-3 lg:p-4 bg-gray-100 dark:bg-gray-800 rounded text-sm lg:text-[0.95rem]">
                      <code>{part.output}</code>
                    </pre>
                  </div>
                )}
              </details>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
