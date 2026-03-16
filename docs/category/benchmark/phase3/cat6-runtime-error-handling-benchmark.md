# Category 6: Runtime Error and Edge Case Handling — Phase 3 Benchmark

> Phase 3 Note: One additional fix was added in Phase 3 — Spec 6.6 (real-time title sync via WebSocket and useAutoSave throttle double-fire fix). Core benchmark results carry forward from Phase 2.

## What You Are Measuring

How the application behaves when things go wrong. This covers error boundaries, unhandled promise rejections, network failure recovery (especially during real-time collaboration), malformed input handling, and user-facing error states.

## How to Measure

- Open browser DevTools and monitor the console during normal usage. Count errors and warnings
- Test network failure: disconnect while editing a document collaboratively, then reconnect. Does data survive? Does the UI recover?
- Test malformed input: submit empty forms, extremely long text, special characters, HTML/script injection
- Test concurrent edge cases: two users editing the same document field simultaneously
- Throttle the network to 3G and use the app. Note every spinner that hangs, every silent failure, every missing loading state
- Check server logs for unhandled errors during all of the above

## Audit Deliverable

| Metric | Post-Fix |
|--------|----------|
| Console errors during normal usage | **1** — `401 Unauthorized` from `/api/auth/me` on initial load before auth redirect (unchanged, correct behavior) |
| Unhandled promise rejections (server) | **No global handler** (unchanged — not in Cat 6 spec scope) |
| Network disconnect recovery | **Improved** — Editor buffers in IndexedDB + retry with exponential backoff; "Connection blocked" message on sustained failures |
| Missing error boundaries | **Fixed** — `RootErrorBoundary` in `main.tsx` wraps all providers (Spec 6.1) |
| Silent failures identified | **6 → 1 remaining** (5 fixed) |

## Improvement Target

Fix 3 error handling gaps. At least one must involve a real user-facing data loss or confusion scenario (not just a missing loading spinner). Each fix requires reproduction steps, before/after behavior, and a screenshot or recording.

---

## Fixes Implemented

### Fix 1 — Root ErrorBoundary (Spec 6.1)

**File:** `web/src/main.tsx` (lines 56–98, 313–335)

**Before:** No root-level `ErrorBoundary`. Any provider crash (PersistQueryClientProvider, ToastProvider, WorkspaceProvider, AuthProvider, RealtimeEventsProvider, DocumentsProvider, ProgramsProvider, IssuesProvider) produced a complete blank white screen with no recovery path.

**After:** `RootErrorBoundary` class component wraps all providers. On error:
- Renders a styled error message with `role="alert"` (accessible)
- Shows the error message text
- Provides a "Refresh" button to reload the page
- Catches errors from any provider initialization failure

**User-facing impact:** Users no longer see a blank white screen on provider crashes. They see a clear error message with a recovery action.

### Fix 2 — WebSocket Exponential Backoff + 429 Awareness (Spec 6.2)

**File:** `web/src/hooks/useRealtimeEvents.tsx`

**Before:** Fixed 3,000ms reconnect on any WebSocket close, including server-side 429 rate limiting. Client hammered the server every 3s indefinitely, ensuring the rate limit was never lifted. No user feedback on rate-limiting vs network issues.

**After:**
- Exponential backoff: 3s → 6s → 12s → 24s → 60s max (BASE_DELAY × BACKOFF_FACTOR^failures, capped at MAX_DELAY)
- 429 awareness: close codes 429 or 4029 jump `consecutiveFailuresRef` to ≥3, starting backoff at 24s minimum
- Retry counter resets on successful connection (`onopen`)
- Console logging shows reconnect delay and attempt number
- "Connection blocked" message shown after 3+ consecutive failures

**User-facing impact:** Rate-limited users no longer cause reconnect storms. The backoff gives the rate limit window time to expire. Users see "Connection blocked" instead of indefinite "Offline" status.

### Fix 3 — WebSocket Rate Limit Connection Tracking Cleanup (Spec 6.3)

**File:** `api/src/collaboration/index.ts`

**Before:** `recordConnectionAttempt()` was append-only. Closing a WebSocket connection did not free rate limit budget. Navigating through 16 documents = 32 connection attempts (events + collaboration per doc) = exceeded 30/min rate limit. Normal usage triggered 429 after ~8 document navigations.

**After:**
- `recordConnectionAttempt()` returns a `release()` function
- Release function removes the oldest entry from the rate limit window for that IP
- Called on WebSocket `close` event for both `/events` and `/collaboration` upgrade paths
- Also cleans up `messageTimestamps` and `rateLimitViolations` maps for the closed connection

**User-facing impact:** Users can navigate freely between documents without hitting the rate limit. The 30/min budget now tracks only *concurrent* connections, not cumulative navigations.

### Fix 4 — Title maxLength Guard (Spec 6.4) *(user-facing data confusion fix)*

**File:** `web/src/components/Editor.tsx` (line 998)

**Before:** Title `<textarea>` had no `maxLength`. API enforced `z.string().max(255)` and returned 400 on violation. User could type >255 characters; the save silently failed; the title reverted to its last saved value on next sync with no explanation. **Real user-facing data confusion.**

**After:**
- `maxLength={255}` on the textarea — browser prevents typing beyond 255 characters
- Character counter appears at 230+ characters showing `{length}/255`
- No backend changes needed — existing Zod validation unchanged

**User-facing impact:** Users can no longer lose title text to silent save failures. The browser enforces the limit, and the counter provides advance warning.

### Fix 5 — Silent Save Failure Handling (Spec 6.5)

**Files:** `api/src/routes/documents.ts` (line 1093), `web/src/hooks/useDocumentsQuery.ts`, `web/src/hooks/useIssuesQuery.ts`

**Before:** Transaction `ROLLBACK` errors silently swallowed with `.catch(() => {})`. If a connection dropped mid-transaction, the rollback failure was invisible in logs. Frontend mutations had no retry logic — a single network blip = permanent data loss.

**After:**
- **Backend:** ROLLBACK errors logged with `console.error('ROLLBACK failed after transaction error:', rollbackErr)` instead of silently swallowed
- **Frontend:** Mutation configs include `retry: 3` with exponential backoff (`Math.pow(2, attempt) * 1000` → 1s, 2s, 4s delay)
- `MutationErrorToast` component surfaces errors to the user after all retries are exhausted
- Combined with Yjs IndexedDB persistence for local data safety

**User-facing impact:** Save failures are retried automatically. If retries fail, the user sees a toast notification instead of silent data loss. ROLLBACK errors are visible in server logs for debugging.

---

## Comparison with Baseline

### Silent Failures: Before vs After

| # | Silent Failure | Audit Status | Post-Fix Status | Change |
|---|---------------|-------------|-----------------|--------|
| 1 | No root-level ErrorBoundary — blank screen on provider crash | **Present** | **Fixed** (Spec 6.1) | RootErrorBoundary with recovery UI |
| 2 | WebSocket reconnects every 3s on 429 — reconnect storm | **Present** | **Fixed** (Spec 6.2) | Exponential backoff + 429 awareness |
| 3 | Rate limit counter never releases closed connections | **Present** | **Fixed** (Spec 6.3) | Release function on disconnect |
| 4 | Title >255 chars silently fails save, reverts without explanation | **Present** | **Fixed** (Spec 6.4) | maxLength={255} + character counter |
| 5 | ROLLBACK errors swallowed, no retry, no user notification | **Present** | **Fixed** (Spec 6.5) | Error logging + retry + toast notification |
| 6 | No `process.on('unhandledRejection')` handler | **Present** | **Remaining** | Not in Cat 6 spec scope |

### Summary Metrics

| Metric | Audit Baseline | Post-Fix | Change |
|--------|---------------|----------|--------|
| Silent failures identified | 6 | **1** | **-5 fixed** |
| Error boundaries at root level | None | `RootErrorBoundary` in `main.tsx` | **Added** |
| WebSocket reconnect strategy | Fixed 3s, no backoff | Exponential 3s→60s + 429 jump | **Improved** |
| Title input validation (frontend) | None | maxLength={255} + counter | **Added** |
| Save failure user notification | None (silent) | MutationErrorToast after 3 retries | **Added** |

### Target Assessment

**Target:** Fix 3 error handling gaps. At least one must involve real user-facing data loss or confusion.

- **Fix 1 (ErrorBoundary):** Provider crashes no longer produce blank screens. **Met.**
- **Fix 2 (WebSocket backoff):** Rate-limited reconnect storms eliminated. **Met.**
- **Fix 3 (Rate limit cleanup):** Normal navigation no longer triggers rate limits. **Met.**
- **Fix 4 (Title maxLength):** **User-facing data confusion fix.** Title text no longer silently reverts on save failure. **Met.**
- **Fix 5 (Save failure handling):** Save failures surfaced to user via toast. **Met.**

**Result: Target exceeded.** 5 of 6 identified silent failures fixed (target was 3). Fix 4 (title maxLength) and Fix 5 (save failure) both address real user-facing data loss/confusion scenarios.

---

## Analysis

### Which specs contributed most

1. **Spec 6.3 (Rate limit tracking cleanup)** — Highest real-world impact. The bug caused normal document navigation to trigger 429 rate limiting after ~8 documents. Every ShipShape user who browsed multiple documents in quick succession would hit this. The release function fix makes the rate limiter work as intended.

2. **Spec 6.4 (Title maxLength)** — Most user-visible fix. Title text silently reverting is a confusing data loss scenario that users would report as a bug. The browser-enforced limit with character counter prevents the issue entirely.

3. **Spec 6.1 (Root ErrorBoundary)** — Safety net for catastrophic failures. While provider crashes are rare, when they happen the blank screen is unrecoverable. The error boundary provides a recovery path.

### Metrics that did NOT improve

- **`process.on('unhandledRejection')` handler:** Not added (not in Cat 6 spec scope). The API still relies on Node.js default behavior for uncaught async errors.
- **Console error on initial load:** The `401 Unauthorized` from `/api/auth/me` before auth redirect persists. This is correct behavior but registers as an error in DevTools.

### Recommendations for further optimization

- **Add `process.on('unhandledRejection')` handler** — Log structured error with request context, prevent process termination, send to error tracking service.
- **Suppress or handle the pre-auth 401** — Either check auth state before making the `/api/auth/me` request or catch the 401 in the auth hook to prevent the console error.
- **Add connection quality indicator** — Show network latency/quality in the UI so users can distinguish between "offline", "slow connection", and "rate limited" states.
