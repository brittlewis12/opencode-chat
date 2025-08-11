import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Session {
  id: string;
  title?: string;
  time?: {
    created: number;
    updated: number;
  };
  version?: string;
  messageCount?: number;
  lastModelId?: string;
  lastProviderId?: string;
  projectPath?: string;
}

interface SessionListProps {
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onClose: () => void;
}

function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

export default function SessionList({
  currentSessionId,
  onSelectSession,
  onClose,
}: SessionListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [homeDir, setHomeDir] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch home directory once
  React.useEffect(() => {
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
  const {
    data: sessions,
    isLoading,
    error,
    refetch,
  } = useQuery<Session[]>({
    queryKey: ["sessions"],
    queryFn: async () => {
      const res = await fetch("/session");
      if (!res.ok) throw new Error("Failed to fetch sessions");
      const sessionList = await res.json();

      // Fetch message counts and last model info for each session
      const sessionsWithCounts = await Promise.all(
        sessionList.map(async (session: Session) => {
          try {
            const stateRes = await fetch(`/session/${session.id}/state`);
            if (stateRes.ok) {
              const state = await stateRes.json();
              const messages = state.messages || [];

              // Find last assistant message to get model info
              const lastAssistant = [...messages]
                .reverse()
                .find((m: any) => m?.info?.role === "assistant");

              // Extract project path
              let projectPath = null;
              if (lastAssistant?.info?.path?.root) {
                projectPath = formatPath(lastAssistant.info.path.root);
              }

              return {
                ...session,
                messageCount: messages.length,
                lastModelId: lastAssistant?.info?.modelID,
                lastProviderId: lastAssistant?.info?.providerID,
                projectPath,
              };
            }
          } catch {
            // Ignore errors for individual sessions
          }
          return { ...session, messageCount: 0 };
        }),
      );

      return sessionsWithCounts;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="flex-1 p-4 flex items-center justify-center">
        <div className="text-gray-500">Loading sessions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-4">
        <div className="text-red-500">Failed to load sessions</div>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded"
        >
          Back to Chat
        </button>
      </div>
    );
  }

  const sortedSessions = [...(sessions || [])]
    .sort((a, b) => {
      const timeA = a.time?.updated || a.time?.created || 0;
      const timeB = b.time?.updated || b.time?.created || 0;
      return timeB - timeA;
    })
    .filter((session) => {
      if (!searchTerm) return true;
      const title = session.title || `Session ${session.id.slice(0, 8)}`;
      return title.toLowerCase().includes(searchTerm.toLowerCase());
    });

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search sessions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:border-purple-600 dark:focus:border-purple-400"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        {sortedSessions.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            No chat sessions yet. Start a new chat!
          </div>
        ) : (
          sortedSessions.map((session) => {
            const isActive = session.id === currentSessionId;
            const timestamp =
              session.time?.updated || session.time?.created || 0;
            const relativeTime = getRelativeTime(timestamp);

            return (
              <div
                key={session.id}
                className={`flex items-center gap-2 ${
                  isActive
                    ? "bg-purple-100 dark:bg-purple-900/30 border border-purple-500"
                    : "bg-gray-50 dark:bg-slate-700"
                } rounded-lg`}
              >
                <button
                  onClick={() => onSelectSession(session.id)}
                  className="flex-1 text-left p-3 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-lg transition-colors"
                >
                  <div className="font-medium text-gray-800 dark:text-gray-100">
                    {session.title || `Session ${session.id.slice(0, 8)}`}
                  </div>
                  {session.projectPath && (
                    <div className="text-xs text-gray-600 dark:text-gray-500">
                      {session.projectPath}
                    </div>
                  )}
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span>{relativeTime}</span>
                      {session.version && (
                        <span className="text-xs text-gray-400">
                          v{session.version}
                        </span>
                      )}
                      {session.lastModelId && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {session.lastModelId}
                        </span>
                      )}
                    </div>
                    {session.messageCount !== undefined && (
                      <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">
                        {session.messageCount}{" "}
                        {session.messageCount === 1 ? "msg" : "msgs"}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (
                      confirm(
                        `Delete session "${session.title || `Session ${session.id.slice(0, 8)}`}"?`,
                      )
                    ) {
                      try {
                        const res = await fetch(`/session/${session.id}`, {
                          method: "DELETE",
                        });
                        if (res.ok) {
                          refetch();
                          if (session.id === currentSessionId) {
                            onSelectSession(""); // Clear current session if deleted
                          }
                        }
                      } catch (err) {
                        console.error("Failed to delete session:", err);
                      }
                    }
                  }}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded mr-2"
                  title="Delete session"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>

      <button
        onClick={onClose}
        className="mt-6 w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
      >
        Back to Chat
      </button>
    </div>
  );
}
