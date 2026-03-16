# Spec 6.2: WebSocket Exponential Backoff + 429 Handling

**Category:** 6 — Runtime Error Handling
**Priority:** High
**Severity:** High
**Audit Finding:** Category 6, Finding 2 & 3

---

## Problem

`useRealtimeEvents` reconnects every 3 seconds on any WebSocket close, including 429 (Too Many Requests). There is no backoff and no 429 awareness. When the server rate-limits a client, the client hammers the server indefinitely at 3-second intervals, making the rate limit permanent and potentially amplifying the problem.

The editor WebSocket also has no 429 handling — on rate-limit, the editor shows "Offline" indefinitely with no explanation to the user.

## Fix

### Part A: Exponential backoff for useRealtimeEvents

Replace the fixed 3-second reconnect with exponential backoff:

```typescript
const BASE_DELAY = 3000;    // 3s
const MAX_DELAY = 60000;    // 60s
const BACKOFF_FACTOR = 2;

let consecutiveFailures = 0;

function getReconnectDelay(): number {
  const delay = Math.min(BASE_DELAY * Math.pow(BACKOFF_FACTOR, consecutiveFailures), MAX_DELAY);
  consecutiveFailures++;
  return delay;
}

// Reset on successful connection
function onOpen() {
  consecutiveFailures = 0;
}
```

Backoff schedule: 3s → 6s → 12s → 24s → 60s (max)

### Part B: 429 awareness

When the WebSocket close code indicates rate limiting (HTTP 429 before upgrade, or close code 1008/4029 if the server sends one):

```typescript
function onClose(event: CloseEvent) {
  if (event.code === 429 || event.code === 4029) {
    // Rate limited — use longer initial backoff
    consecutiveFailures = Math.max(consecutiveFailures, 3); // Start at 24s minimum
  }
  scheduleReconnect(getReconnectDelay());
}
```

### Part C: User-facing connection status in Editor

After 3 consecutive close events (code 1006 or 429), show a message in the editor:

```
"Connection blocked — changes saved locally"
```

This replaces the current silent "Offline" indicator with actionable information.

## Steps

1. Modify `useRealtimeEvents` hook to implement exponential backoff
2. Add 429 detection to the close handler
3. In `Editor.tsx`, add connection status UI after 3 consecutive failures
4. Reset failure count on successful reconnection

## Verification

- Simulate rate limiting: rapidly open/close WebSocket connections
- After 429, reconnect delay increases exponentially instead of staying at 3s
- User sees "Connection blocked — changes saved locally" after repeated failures
- Successful reconnection resets backoff to 3s
- Changes made while offline are preserved (IndexedDB via Yjs)

## Audit Targets Addressed

- Fixes Category 6 improvement targets: exponential backoff + 429 awareness + user-facing connection message
- Prevents reconnect storms from amplifying rate-limit situations
