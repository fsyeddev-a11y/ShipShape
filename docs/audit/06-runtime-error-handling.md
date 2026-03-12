# Category 6: Runtime Error and Edge Case Handling

## Methodology

### Environment
- **Browser testing:** Playwright MCP browser session, logged in as `dev@ship.local`, navigated through `/my-week`, `/projects`, `/documents/:id/details` (editor open, WebSocket connected)
- **Console monitoring:** Captured at `error` and `warning` levels after each flow
- **Malformed input:** Programmatic `PATCH /api/documents/:id` with XSS payload, empty title, 10,000-char title, SQL injection
- **Code inspection:** `main.tsx` root tree, `useRealtimeEvents.tsx`, `Editor.tsx` WebSocket close handler, `collaboration/index.ts` rate limit handler

---

## Audit Deliverable

| Metric | Your Baseline |
|--------|---------------|
| Console errors during normal usage | **1** — `401 Unauthorized` from `/api/auth/me` on initial load before auth redirect. 0 errors and 0 warnings during all authenticated navigation. |
| Unhandled promise rejections (server) | **No global handler.** No `process.on('unhandledRejection', ...)` in the API. Node.js 15+ terminates the process on unhandled rejections with only a stderr log. |
| Network disconnect recovery | **Partial** — Editor shows Saved/Cached/Offline indicator and buffers changes in IndexedDB. Non-editor pages (issues, projects, dashboard) have no offline indicator and silently show stale data. |
| Missing error boundaries | **Root `main.tsx` has no `ErrorBoundary`.** All 8 providers (`PersistQueryClientProvider`, `ToastProvider`, `WorkspaceProvider`, `AuthProvider`, `RealtimeEventsProvider`, `DocumentsProvider`, `ProgramsProvider`, `IssuesProvider`) throw to a blank screen. The `ErrorBoundary` in `App.tsx:542` only protects `<Outlet />` — page-level content. |
| Silent failures identified | 6 — see below |

### Silent Failures

| # | Failure | Severity |
|---|---------|----------|
| 1 | **No root-level `ErrorBoundary` in `main.tsx`.** Any provider crash produces a complete blank screen. `App.tsx:542` only covers the routed page content. Previous audit finding confirmed. | High |
| 2 | **`useRealtimeEvents` reconnects every 3s on any close, including server-side 429.** The collaboration server sends `HTTP/1.1 429 Too Many Requests` and destroys the socket when rate limited (≥30 connections/min per IP). The frontend `onclose` handler schedules a reconnect unconditionally after 3,000ms — no backoff, no 429 awareness. The client hammers the server every 3s indefinitely. | High |
| 3 | **Editor WebSocket has no 429 handling.** When the collaboration WebSocket upgrade is rejected with 429, y-websocket sees an abnormal close (code 1006) and retries with its own backoff. The editor shows `Offline` indefinitely with no user-facing explanation. A user cannot distinguish "network issue" from "you've been rate-limited." | Medium |
| 4 | **Title field has no `maxLength` — saves silently fail above 255 chars.** The API enforces `z.string().max(255)` (returns 400). The title `<textarea>` in `Editor.tsx:927` has no `maxLength` attribute. A user can type beyond 255 characters; the save silently fails with a 400 in the background. The title reverts on next sync with no explanation. | Medium |
| 5 | **Transaction `ROLLBACK` silently swallowed.** `documents.ts:1093` and `issues.ts:1002` call `client.query('ROLLBACK').catch(() => {})`. If the rollback itself fails (e.g., connection drop mid-transaction), the error is discarded and the transaction may remain open. | Medium |
| 6 | **No `process.on('unhandledRejection')` handler.** Any uncaught async throw in the API emits to stderr only. In Node.js 15+, this terminates the process. No structured log, no alert. | Medium |

---

## Console Errors Detail

### Pre-authentication

```
[ERROR] Failed to load resource: 401 (Unauthorized) @ /api/auth/me
```

Fires on every cold load before the auth redirect. Correct behavior, but produces a console error on every session start — registers as an error in automated scans and DevTools audits.

### Authenticated usage

**0 errors. 0 warnings** across `/my-week`, `/projects`, `/documents/:id/details` with editor open and WebSocket connected.

---

## Malformed Input Results

| Input | Endpoint | Result |
|-------|----------|--------|
| Empty title `""` | `PATCH /api/documents/:id` | **400** — correctly rejected |
| 10,000-char title | `PATCH /api/documents/:id` | **400** — correctly rejected |
| SQL injection `'; DROP TABLE documents; --` | `PATCH /api/documents/:id` | **200** — stored as string; parameterized queries prevent execution |
| XSS `<script>alert("xss")</script>` | `PATCH /api/documents/:id` | **200** — stored verbatim; React's default escaping prevents execution in UI, but no server-side sanitization |

---

## Rate Limit (429) Error Handling

The collaboration server (`api/src/collaboration/index.ts`) enforces two rate limits:
- **Connection rate limit:** 30 connections/min per IP (`collaboration/index.ts:21`)
- **Message rate limit:** 50 messages/sec per connection

When either limit is hit, the server writes `HTTP/1.1 429 Too Many Requests` to the raw socket and destroys it (`index.ts:621`, `index.ts:653`).

### Issue 1 — `/events` WebSocket (`useRealtimeEvents`)

When the 429 closes the connection, `ws.onclose` fires with code `1006` (abnormal closure). The handler at `useRealtimeEvents.tsx:96` schedules a reconnect unconditionally after `3000ms`:

```ts
ws.onclose = () => {
  setIsConnected(false);
  if (user) {
    reconnectTimeoutRef.current = setTimeout(() => connect(), 3000);
  }
};
```

No backoff. No check on close code or reason. When rate-limited, the client reconnects every 3 seconds forever — each attempt counting against the rate limit, ensuring it is never lifted.

### Issue 2 — Editor WebSocket (y-websocket)

When the collaboration WebSocket upgrade is rejected with 429, y-websocket's internal handler fires `onerror` then `onclose` with code `1006`. The `connection-close` handler in `Editor.tsx:397` checks for codes `4403`, `4100`, and `4101` only — `1006` is unhandled. y-websocket auto-retries with its own backoff, but the UI shows `Offline` indefinitely with no explanation to the user.

---

## Reference: Previous Audit Numbers

The previous audit (README_Audit.md) cited:
- **"6 different types of silent failures"**
- **"Database connection blips lose work permanently"**
- **"Major crash leaves users staring at a blank screen"**

| Finding | Previous Audit | Current Audit |
|---------|---------------|---------------|
| Blank screen on crash | "No error boundary" | **Confirmed** — no ErrorBoundary in `main.tsx`; 8 providers unprotected |
| DB/WebSocket data loss | "Work permanently lost" | **Partial** — editor buffers in IndexedDB; REST pages show stale silently |
| Silent failure count | 6 types | **6 confirmed** (see table above) |

---

## Improvement Target (for Phase 2)

Fix 3 error handling gaps. At least one involves a real user-facing data loss or confusion scenario.

### Fix 1 — `useRealtimeEvents`: Add exponential backoff with 429 awareness

**File:** `web/src/hooks/useRealtimeEvents.tsx`
**Risk mitigated:** Reconnect storm when server-side rate limit is hit. Client hammers server every 3s indefinitely, preventing recovery and making the rate limit permanent for that session.

**Before:** Fixed 3,000ms reconnect on any close. No awareness of close code. No backoff.

**After:** Exponential backoff (3s → 6s → 12s → 24s → 60s max) with jitter. Track retry count; reset on successful open.

**Reproduction steps:**
1. Start dev server
2. Open browser devtools, navigate to any page (loads `RealtimeEventsProvider`)
3. Simulate 429: set breakpoint or temporarily lower connection rate limit to 1/min in `collaboration/index.ts:22`
4. Observe `ws.onclose` firing every 3 seconds in the Network tab indefinitely

---

### Fix 2 — Editor WebSocket: Show user message on repeated 1006 close

**File:** `web/src/components/Editor.tsx`
**Risk mitigated:** User is rate-limited from the collaboration server; editor shows `Offline` indefinitely with no explanation. User cannot distinguish "network drop" from "rate limited" and may continue editing without knowing their changes are not syncing.

**Before:** `connection-close` handler at `Editor.tsx:397` handles codes `4403`, `4100`, `4101`. Code `1006` (abnormal closure, including 429 upgrade rejection) falls through silently — UI stays on `Offline`.

**After:** Track consecutive `1006` closes. After N consecutive failures (e.g., 3), update the sync status message from `Offline` to `"Connection blocked — changes saved locally"` to distinguish rate-limiting from a transient network drop.

**Reproduction steps:**
1. Open any document in the editor
2. Lower collaboration connection rate limit to 1/min in `collaboration/index.ts:22`
3. Reload the document page — WebSocket upgrade returns 429
4. Observe editor stays on `Offline` with no further explanation

---

### Fix 3 — Title field: Add `maxLength={255}` with character count feedback *(user-facing data confusion)*

**File:** `web/src/components/Editor.tsx`
**Risk mitigated:** User types a title exceeding 255 characters. The save silently fails (400 Bad Request). On the next WebSocket sync, the title reverts to its last saved value. The user sees their title silently truncated with no explanation — a confusing data loss scenario.

**Before:** `<textarea>` at `Editor.tsx:927` has no `maxLength`. The API enforces `z.string().max(255)` (400 on violation). The frontend has no corresponding enforcement or feedback.

**After:** Add `maxLength={255}` to the textarea. When the character count exceeds ~240, show a small counter below the title (e.g., `"247 / 255"`) so the user knows they are approaching the limit. No logic changes — existing save behavior unchanged.

**Reproduction steps:**
1. Open any document in the editor
2. Click the title and paste text longer than 255 characters
3. Tab away or wait for autosave
4. Observe: title silently reverts to previous value; no error shown; no explanation

_Do not fix during audit phase._
