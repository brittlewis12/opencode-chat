# SST/OpenCode Permission System: Research Findings & Architecture

## Research Findings: The Actual SST/OpenCode Permission System

### What Actually Exists in SST/OpenCode

Based on comprehensive analysis of the SST/OpenCode server source code:

#### Real API Endpoints
- ✅ `POST /session/{sessionId}/permissions/{permissionId}` - Responds to permission requests
  - Accepts: `{"response": "once" | "always" | "reject"}`
  - Returns: 200 OK on success
- ✅ `GET /event` - SSE stream that includes permission events
- ✅ `GET /session/{sessionId}/state` - Declarative state including permissions

#### Fictional Endpoints (Don't Exist)
- ❌ `GET /session/{sessionId}/permissions` - No endpoint to query permissions
- ❌ Any permission listing/browsing endpoints

### SSE Event Structure

The actual events from SST/OpenCode server:

```typescript
// When a tool needs permission
{
  "type": "permission.updated",
  "properties": {
    "id": "perm_abc123",
    "messageID": "msg_def456",
    "sessionID": "sess_ghi789",
    "callID": "call_jkl012",
    "type": "tool",
    "pattern": "bash:*",
    "title": "Permission required to run bash tool",
    "metadata": {
      "tool": "bash",
      "command": "ls -la",
      // tool-specific metadata
    },
    "time": {
      "created": 1234567890
    }
  }
}

// After user responds
{
  "type": "permission.replied",
  "properties": {
    "id": "perm_abc123",
    "response": "once"
  }
}
```

### How the TUI Actually Works

From analyzing `/packages/tui/internal/tui/tui.go`:

1. **State Management**
   - Maintains `[]opencode.Permission` queue
   - Single `CurrentPermission` for active request
   - No persistence - permissions are ephemeral

2. **User Interaction**
   - Shows permission inline in message flow
   - Keyboard controls: Enter (approve once), A (approve always), Esc (reject)
   - Blocks message progression until answered

3. **Network Handling**
   - No special permission recovery - if SSE drops, permission is lost
   - Permissions are fire-and-forget events
   - No retry mechanism for permission responses

## Our Architecture: Design Decisions

### Core Architectural Choices

#### 1. Permission State Management

**Decision**: Store permissions in client-side state with queue

```typescript
interface PermissionState {
  byId: Record<string, Permission>;
  queue: string[];
  activeId?: string;
}
```

**Rationale**:
- SSE events are ephemeral and can be missed
- Queue handles multiple rapid tool requests
- Client-side state enables UI responsiveness

**Tradeoff**:
- More complex than TUI's simple array
- But provides better recovery from disconnections

#### 2. Event-Driven Permission Flow

**Decision**: Pure SSE-driven, no polling

```typescript
// Listen for permission events
on("permission.updated", (perm) => {
  state.permissions.byId[perm.id] = perm;
  state.permissions.queue.push(perm.id);
});

// Clean up after response
on("permission.replied", (reply) => {
  delete state.permissions.byId[reply.id];
  removeFromQueue(reply.id);
});
```

**Rationale**:
- Matches SST/OpenCode's event broadcast model
- No unnecessary API calls
- Real-time updates

**Why Not Poll**:
- No endpoint exists to poll
- Would create unnecessary load
- Permissions are push-based, not pull-based

#### 3. Response Mechanism

**Decision**: Direct API call, optimistic UI update

```typescript
async function respondToPermission(id: string, response: string) {
  // Optimistic update
  setPermissionResponded(id);
  
  // API call
  await fetch(`/session/${sessionId}/permissions/${id}`, {
    method: "POST",
    body: JSON.stringify({ response })
  });
  
  // SSE will confirm with permission.replied event
}
```

**Rationale**:
- Immediate UI feedback
- Follows SST/OpenCode's API design
- SSE confirmation ensures consistency

#### 4. Reconnection Strategy

**Decision**: Fetch declarative state on reconnect

```typescript
on("reconnected", async () => {
  // Get full state including any pending permissions
  const state = await fetch(`/session/${sessionId}/state`);
  reconcilePermissions(state.permissions);
});
```

**Rationale**:
- Permissions might arrive during disconnection
- Declarative state is source of truth
- Prevents missed permission requests

**Critical Insight**: Permissions in the declarative state are already in the queue server-side, so we just need to display them.

### Why This Architecture

#### What We Optimized For

1. **Unreliable Networks**
   - Mobile networks drop frequently
   - VPN connections reset
   - Wifi/cellular transitions
   - Solution: Aggressive reconnection with state recovery

2. **User Context Switching**
   - Users switch tabs
   - Multiple conversations
   - May ignore permissions initially
   - Solution: Queue persists, inline display doesn't block

3. **Developer Experience**
   - Clear separation of concerns
   - Predictable state updates
   - Easy to debug event flow
   - Solution: Single OpenCodeClient with event emitters

#### What We Explicitly Didn't Do

1. **Create New Server Endpoints**
   - Tempting to add GET for permissions
   - Would require forking SST/OpenCode
   - Instead: Work within existing API surface

2. **Implement Complex State Machines**
   - Could model permission lifecycle
   - Adds complexity without clear benefit
   - Instead: Simple queue with event handlers

3. **Add Client-Side Permission Persistence**
   - Could store in localStorage
   - Permissions are ephemeral by design
   - Instead: Rely on server state recovery

## Key Architectural Insights

### The Permission Model Is Ephemeral

Permissions are NOT:
- Persistent entities with database records
- Queryable resources with REST endpoints
- Long-lived objects with complex state

Permissions ARE:
- Transient events in the message stream
- Immediate decision points
- Fire-and-forget after response

### The Broadcast Model Is Fundamental

SST/OpenCode uses pure event broadcasting:
- Server broadcasts ALL events to ALL connected clients
- Clients filter relevant events by sessionId
- No request-response pattern for state updates
- Declarative state endpoint is the only "query" mechanism

### Network Resilience Through Simplicity

Rather than complex reconnection protocols:
- Accept that events will be missed
- Use declarative state for recovery
- Make UI resilient to partial state
- Embrace eventual consistency

## Implementation Consequences

### What This Means for the UI

1. **Permissions must be inline and non-blocking**
   - Can't assume user will respond immediately
   - Must show context of what's being approved
   - Should queue gracefully

2. **Connection state must be visible**
   - Users need to know if they might miss events
   - Reconnection should be obvious
   - State recovery should be transparent

3. **Optimistic updates are essential**
   - Network latency is variable
   - Users expect immediate feedback
   - SSE confirmation reconciles state

### What This Means for the Code

1. **Event handlers must be idempotent**
   ```typescript
   // Same event might arrive twice after reconnection
   on("permission.updated", (perm) => {
     if (!state.permissions.byId[perm.id]) {
       // Only add if not already present
     }
   });
   ```

2. **State reconciliation must be careful**
   ```typescript
   // After reconnection, merge carefully
   function reconcileState(remote, local) {
     // Remote is authoritative for existence
     // Local might have optimistic updates
   }
   ```

3. **Error boundaries are critical**
   ```typescript
   // Network errors shouldn't crash UI
   try {
     await respondToPermission(id, response);
   } catch (error) {
     // Show error, allow retry
     // Don't break the entire app
   }
   ```

## Conclusions

### Why This Architecture Works

1. **Aligns with SST/OpenCode's event-driven model**
2. **Handles network unreliability gracefully**
3. **Provides good user experience despite constraints**
4. **Minimal server changes required**

### What We Learned

1. **The server architecture is simpler than expected**
   - No complex permission management
   - Pure event broadcasting
   - Declarative state for recovery

2. **The TUI's simplicity doesn't translate directly**
   - Terminal's synchronous model doesn't fit web
   - Network reliability assumptions don't hold
   - User behavior patterns are different

3. **Event-driven architecture is the right choice**
   - Matches server's broadcast model
   - Handles async nature of web
   - Scales to multiple sessions

### Future Considerations

1. **WebSocket upgrade path exists**
   - If bidirectional communication needed
   - Would enable presence awareness
   - Could reduce reconnection overhead

2. **Offline queue could be added**
   - Buffer actions during disconnection
   - Replay on reconnection
   - Improve perceived reliability

3. **Permission templates could optimize UX**
   - "Always allow file reads in this directory"
   - "Trust this tool for this session"
   - Reduce permission fatigue

---

*This document reflects the actual SST/OpenCode architecture as discovered through code analysis, not assumptions or wishes about how it might work.*