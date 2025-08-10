# OpenCode Chat

A modern web interface for [OpenCode](https://github.com/opencodeco/opencode), providing a ChatGPT-like experience with local AI model management.

## Features

- 🚀 **Real-time streaming** - Server-sent events (SSE) for live response streaming
- 💬 **Session management** - Persistent sessions with full history
- 🎨 **Markdown rendering** - Full markdown support with syntax highlighting
- 📊 **Usage tracking** - Context usage, costs, and model information display
- 🔄 **Mode switching** - Support for build, plan, and custom agent modes
- 🎯 **Multi-model support** - Anthropic, OpenAI, GitHub Models, Google, and more
- 🔒 **Inline permissions** - Handle tool approval directly in chat
- ⚡ **Zero build step** - Bun-native JSX transpilation
- 🖥️ **Console streaming** - Browser console logs in terminal (Bun 1.2.20+)
- 📱 **Responsive design** - Mobile-first, works on all devices

## Quick Start

```bash
# Install dependencies
bun install

# Start development server (with file watching)
bun run dev

# Or start production server
bun start
```

The server will start on http://localhost:3000 and automatically spawn OpenCode if not running.

## Prerequisites

- [Bun](https://bun.sh) v1.2.20 or higher
- [OpenCode](https://github.com/opencodeco/opencode) installed globally
- API keys configured for your preferred AI providers

## Architecture

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Browser   │ <-----> │  Bun Server │ <-----> │  OpenCode   │
│  (Client)   │   HTTP  │   (Proxy)   │   HTTP  │   Server    │
└─────────────┘         └─────────────┘         └─────────────┘
```

## Development

```bash
# Run with auto-reload
bun --watch server.ts

# Run with logging
bun run server.ts > /tmp/opencode-server.log 2>&1 &
```

## Technical Details

### Server Implementation
- **Bun HTTP server** with native fetch for proxying
- **SSE streaming** via ReadableStream with proper chunk handling
- **Session management** through OpenCode's `/session` endpoints
- **No framework dependencies** - vanilla JS in a single HTML template

### Key Endpoints

#### Client Routes
- `GET /` - Serves the HTML interface
- `POST /chat` - Creates/reuses session and sends message
- `GET /stream?sessionId={id}` - SSE stream filtered by session
- `GET /history?sessionId={id}` - Fetches session message history
- `GET /debug` - Backend connectivity diagnostics

#### Proxied to OpenCode
- `/config/providers` - Model and provider information
- `/agent` - Available agents/modes

### Message Flow
1. Client sends message via `/chat` 
2. Server creates/reuses OpenCode session
3. Server posts to OpenCode `/session/{id}/message`
4. Response streams back via SSE on `/event` endpoint
5. Client filters SSE events by sessionId

### Current Limitations
- No tool approval UI (when OpenCode requests permissions)
- No session list/switching UI

### Configuration
Expects OpenCode on port 4096. Modify in `server.ts`:
```javascript
const OPENCODE_URL = "http://localhost:4096";
```
