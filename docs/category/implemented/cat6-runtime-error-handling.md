# Category 6: Runtime Error and Edge Case Handling — Implemented Specs

---

## 6.1 — Root ErrorBoundary

**Spec:** [cat6-root-error-boundary.md](../../specs/cat6-root-error-boundary.md)

**What Changed:**
Added a `RootErrorBoundary` class component in `web/src/main.tsx` that wraps the entire provider stack (`PersistQueryClientProvider`, `ToastProvider`, `BrowserRouter`, etc.). The boundary sits inside `React.StrictMode` but outside all other providers, so it catches any provider initialization crash. The fallback UI includes `role="alert"` for accessibility, displays the error message, and provides a "Refresh" button that calls `window.location.reload()`. Uses inline styles to ensure the fallback renders even if CSS fails to load.

**Why the Original Code Was Suboptimal:**
The existing `ErrorBoundary` in `App.tsx` only wrapped page content — not the 8+ providers in `main.tsx`. Any crash in `QueryClientProvider`, `AuthProvider`, `WorkspaceProvider`, or `RealtimeEventsProvider` produced a blank white screen with no recovery path and no information for assistive technology users.

**Why This Approach Is Better:**
The root-level boundary catches errors from the entire component tree including all providers. The fallback uses inline styles (no dependency on CSS bundle), includes `role="alert"` for screen readers, and shows the actual error message for debugging. The refresh button provides a one-click recovery path.

**Tradeoffs:**
The fallback UI is intentionally minimal (no theming, no layout) since the providers that supply those features may be the ones that crashed. Error details are shown in a `<pre>` tag which could expose internal information — acceptable for a project management tool but may need sanitization for public-facing apps.

---

## 6.2 — WebSocket Backoff + 429 Handling

**Spec:** [cat6-ws-backoff-429.md](../../specs/cat6-ws-backoff-429.md)

**What Changed:**
**Part A (useRealtimeEvents):** Replaced the fixed 3-second reconnect delay in `web/src/hooks/useRealtimeEvents.tsx` with exponential backoff. Added `consecutiveFailuresRef` tracking, `BASE_DELAY` (3s), `MAX_DELAY` (60s), and `BACKOFF_FACTOR` (2). Backoff schedule: 3s → 6s → 12s → 24s → 60s (capped). Counter resets to 0 on successful `onopen`.

**Part B (429 awareness):** In the `onclose` handler, if close code is 429 or 4029, the failure counter jumps to at least 3 (starting at 24s minimum backoff) to avoid hammering a rate-limiting server.

**Part C (Editor connection status):** Added `connectionBlocked` state and `consecutiveClosesRef` to `web/src/components/Editor.tsx`. After 3 consecutive disconnects without a successful reconnect, the sync status changes from "Offline" to "Connection blocked — changes saved locally". Resets on successful reconnection.

**Why the Original Code Was Suboptimal:**
The fixed 3-second reconnect caused reconnect storms when the server was rate-limiting. A 429 response would trigger a 3s retry, which would get 429'd again, creating an infinite loop that kept the user permanently locked out and amplified server load.

**Why This Approach Is Better:**
Exponential backoff naturally reduces pressure on the server during outages. The 429-aware jump to higher backoff prevents reconnect storms. The "Connection blocked" message replaces the uninformative "Offline" label, telling users their work is safe locally.

**Tradeoffs:**
Longer reconnect delays mean users wait longer to resync after transient network blips. The 60s max delay is a compromise — short enough that recovery happens within a minute, long enough to avoid pressure on stressed servers. The editor message is passive (no auto-retry button) since auto-retry is handled by the backoff itself.

---

## 6.3 — WS Rate Limit Connection Tracking

**Spec:** [cat6-ws-rate-limit-tracking.md](../../specs/cat6-ws-rate-limit-tracking.md)

**What Changed:**
Modified `recordConnectionAttempt()` in `api/src/collaboration/index.ts` to return a `release()` function. When called, `release()` removes the oldest timestamp entry for that IP from the `connectionAttempts` map. The release function is passed through `wss.emit('connection')` and `eventsWss.emit('connection')` to the respective connection handlers, and called in each `ws.on('close')` callback. Also added release calls for early-exit paths (failed auth validation, failed document access check) so rejected connections don't consume rate limit budget.

**Why the Original Code Was Suboptimal:**
`recordConnectionAttempt()` was append-only within the 60-second window. Every document navigation creates 2 WebSocket connections (`/collaboration/{type}:{id}` and `/events`). Even though old connections were properly destroyed via `wsProvider.destroy()`, they still counted against the rate limit. Switching between 16 documents in 60 seconds = 32 attempts = rate limit hit. This created a feedback loop: 429 → y-websocket retry → more 429s → user locked out.

**Why This Approach Is Better:**
Tracking active connections instead of historical attempts means closed connections free up budget immediately. Users can navigate between unlimited documents without hitting the rate limit, as long as they're not maintaining 30+ simultaneous open connections. DDoS protection is preserved: 30+ actually-open connections from one IP still triggers the limit.

**Tradeoffs:**
The release function uses `shift()` (removes oldest entry) rather than tracking specific timestamps, which means the accounting is approximate. In practice this doesn't matter since connections are short-lived and the window is only 60 seconds. The approach adds a small amount of state (release closures) per connection.

---

## 6.4 — Title maxLength Guard

**Spec:** [cat6-title-maxlength.md](../../specs/cat6-title-maxlength.md)

**What Changed:**
Added `maxLength={255}` to the title `<textarea>` in `web/src/components/Editor.tsx`. Added a character counter (`{title.length}/255`) that appears when the title reaches 230+ characters. Adjusted bottom margin to accommodate the counter — `mb-1` when counter is visible, `mb-6` otherwise.

**Why the Original Code Was Suboptimal:**
The title textarea had no length limit. When users typed more than 255 characters, the backend save returned a 400 error. The title silently reverted on the next sync with no user-facing feedback — the user's input was lost without explanation.

**Why This Approach Is Better:**
The browser-native `maxLength` attribute prevents exceeding 255 characters entirely. The character counter provides progressive disclosure — it only appears when the user is near the limit (230+), avoiding visual clutter for normal titles. No server round-trip is needed to enforce the constraint.

**Tradeoffs:**
The 230-character threshold for showing the counter is somewhat arbitrary. Very few titles will ever approach 255 characters, so most users will never see the counter. The counter uses minimal styling (`text-xs text-muted`) to avoid drawing attention away from the editor content.

---

## 6.5 — Silent Save Failure Handling

**Spec:** [cat6-silent-save-failure.md](../../specs/cat6-silent-save-failure.md)

**What Changed:**
**Part A (ROLLBACK logging):** Replaced `.catch(() => {})` with `.catch((rollbackErr) => { console.error('ROLLBACK failed after transaction error:', rollbackErr); })` in both `api/src/routes/issues.ts` (line 1031) and `api/src/routes/documents.ts` (line 1093). ROLLBACK failures are now logged to the server console instead of being silently swallowed.

**Part B (Frontend retry + notification):** Added `retry: 3` and `retryDelay: (attempt) => Math.pow(2, attempt) * 1000` to `useUpdateDocument()` in `web/src/hooks/useDocumentsQuery.ts` and `useUpdateIssue()` in `web/src/hooks/useIssuesQuery.ts`. Retry schedule: 1s → 2s → 4s. The existing `MutationErrorToast` component (already in the render tree in `main.tsx`) automatically surfaces errors from failed mutations via toast notifications after retries are exhausted.

**Why the Original Code Was Suboptimal:**
ROLLBACK errors were caught with empty handlers (`.catch(() => {})`), making database transaction failures completely invisible in server logs. On the frontend, save mutations had no retry logic — a single network blip would permanently lose the user's edit with no notification. The app had `MutationErrorToast` wired up but mutations would fail immediately without retrying.

**Why This Approach Is Better:**
Server-side ROLLBACK failures are now logged for debugging. Frontend mutations retry 3 times with exponential backoff before showing an error toast. Combined with Yjs IndexedDB persistence (which preserves editor content locally regardless of server save state), users have multiple layers of protection against data loss.

**Tradeoffs:**
Retrying mutations 3 times means a failed save takes up to 7 seconds (1+2+4) before the user sees an error. For most transient failures (network blip, DB connection timeout), this is acceptable. For permanent failures (deleted document, permission revoked), the retries are wasted time — but the `onError` handler still rolls back optimistic updates, so the UI stays consistent.
