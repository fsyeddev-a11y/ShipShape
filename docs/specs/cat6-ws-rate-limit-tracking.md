# Spec 6.3: Fix WebSocket Rate Limit Connection Tracking

**Category:** 6 — Runtime Error Handling
**Priority:** High
**Severity:** High
**Audit Finding:** Category 6 (from previous human audit)

---

## Problem

The WebSocket rate limiter has a 1-minute window with a max of 30 connections per IP. Every document navigation creates 2 new WebSocket connections (`/collaboration/{docType}:{docID}` and `/events`). Old connections are properly cleaned up via `wsProvider.destroy()`, but `recordConnectionAttempt()` counts every attempt within the 60-second window regardless of whether prior connections were closed.

Switching between 16 documents within 60 seconds = 16 × 2 = 32 connection attempts = **rate limit hit**.

When the limit is hit:
- Server responds with raw `HTTP/1.1 429 Too Many Requests` and destroys the socket
- No WebSocket upgrade happens, so no helpful error reaches the frontend
- `y-websocket` sees a failed connection and retries, generating more attempts
- This creates a feedback loop that locks the user out until the 60-second window expires

## Root Cause

`recordConnectionAttempt()` is append-only within the time window. Closed/destroyed connections are never removed from the counter.

## Fix

Track active connections, not just attempts. When a connection is cleaned up via `wsProvider.destroy()`, decrement the counter.

### Steps

1. Locate the rate limiting logic (likely in `api/src/collaboration/index.ts` or a middleware)
2. Modify `recordConnectionAttempt()` to return a release function:
   ```typescript
   function recordConnectionAttempt(ip: string): { allowed: boolean; release: () => void } {
     const count = activeConnections.get(ip) || 0;
     if (count >= MAX_CONNECTIONS_PER_IP) {
       return { allowed: false, release: () => {} };
     }
     activeConnections.set(ip, count + 1);
     return {
       allowed: true,
       release: () => {
         const current = activeConnections.get(ip) || 1;
         activeConnections.set(ip, Math.max(0, current - 1));
       },
     };
   }
   ```
3. Call `release()` when the WebSocket connection closes:
   ```typescript
   ws.on('close', () => {
     connectionRecord.release();
     // ... existing cleanup
   });
   ```
4. Keep the 60-second window for **new** connection bursts (DDoS protection) — but don't count connections that have already been closed

### Alternative: Sliding Window with Decay

If tracking active connections is complex, use a sliding window that decays entries when their connections close:

```typescript
// On connection close, remove the oldest entry for this IP from the window
function releaseConnection(ip: string) {
  const attempts = connectionAttempts.get(ip);
  if (attempts && attempts.length > 0) {
    attempts.shift(); // Remove oldest attempt
  }
}
```

## Verification

- Rapidly switch between 20+ documents within 60 seconds — no 429 error
- DDoS protection still works: 30+ **simultaneous** open connections from one IP triggers rate limit
- Connection counter accurately reflects active (not historical) connections
- `wsProvider.destroy()` properly releases the connection from the counter

## Audit Targets Addressed

- Fixes the root cause of document-switching rate limit hits
- Works in conjunction with Spec 6.2 (backoff) — this spec prevents the 429 from occurring in normal usage; Spec 6.2 handles recovery when it does occur
