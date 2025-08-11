import React, { useState, useEffect } from "react";
import Chat from "./components/Chat";
import SessionList from "./components/SessionList";

export default function App() {
  const [showSessions, setShowSessions] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(
    localStorage.getItem("opencodeSessionId"),
  );
  const [sessions, setSessions] = useState<any[]>([]);
  const [projectRoot, setProjectRoot] = useState<string | null>(null);

  // Fetch sessions on mount and when sessionId changes
  useEffect(() => {
    fetch("/session")
      .then((res) => res.json())
      .then((data) => {
        console.log("Fetched sessions:", data);
        setSessions(data);
      })
      .catch(() => {});
  }, [sessionId]); // Re-fetch when sessionId changes

  const currentSession = sessions.find((s) => s.id === sessionId);

  const handleNewChat = () => {
    localStorage.removeItem("opencodeSessionId");
    setSessionId(null);
  };

  const handleSelectSession = (id: string) => {
    localStorage.setItem("opencodeSessionId", id);
    setSessionId(id);
    setShowSessions(false);
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 h-[100dvh] p-0 sm:p-4">
      <div className="w-full max-w-7xl xl:max-w-[1400px] 2xl:max-w-[1600px] h-[100dvh] sm:h-[90vh] sm:mx-auto bg-white dark:bg-slate-800 sm:rounded-2xl shadow-2xl flex flex-col">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 sm:rounded-t-2xl flex justify-between items-center flex-shrink-0">
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="px-3 py-1 bg-white/20 rounded hover:bg-white/30 text-sm"
          >
            Sessions
          </button>
          <div className="text-center flex flex-col">
            {currentSession ? (
              <>
                <span className="font-semibold text-lg">
                  {currentSession.title || "Untitled Session"}
                </span>
                {projectRoot && (
                  <span className="text-xs text-white/70 mt-0.5">
                    {projectRoot}
                  </span>
                )}
              </>
            ) : (
              <span className="font-semibold text-lg">New Chat</span>
            )}
          </div>
          <button
            onClick={handleNewChat}
            className="px-3 py-1 bg-white/20 rounded hover:bg-white/30 text-sm"
          >
            New Chat
          </button>
        </div>

        {showSessions ? (
          <SessionList
            currentSessionId={sessionId}
            onSelectSession={handleSelectSession}
            onClose={() => setShowSessions(false)}
          />
        ) : (
          <Chat sessionId={sessionId} onProjectPathChange={setProjectRoot} />
        )}
      </div>
      {currentSession && (
        <div className="text-center text-xs text-slate-600 dark:text-slate-500 mt-2">
          OpenCode Chat • OpenCode v{currentSession.version}
        </div>
      )}
    </div>
  );
}
