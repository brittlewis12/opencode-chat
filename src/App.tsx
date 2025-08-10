import React, { useState, useEffect } from "react";
import Chat from "./components/Chat";
import SessionList from "./components/SessionList";

export default function App() {
  const [showSessions, setShowSessions] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(
    localStorage.getItem("opencodeSessionId"),
  );

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
      <div className="w-full max-w-4xl h-[100dvh] sm:h-[600px] sm:mx-auto bg-white dark:bg-slate-800 sm:rounded-2xl shadow-2xl flex flex-col">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 sm:rounded-t-2xl flex justify-between items-center flex-shrink-0">
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="px-3 py-1 bg-white/20 rounded hover:bg-white/30 text-sm"
          >
            Sessions
          </button>
          <span className="font-semibold text-lg">OpenCode Chat</span>
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
          <Chat sessionId={sessionId} />
        )}
      </div>
    </div>
  );
}
