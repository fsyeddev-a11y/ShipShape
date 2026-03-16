# Spec: Fix `useSessionTimeout.test.ts` — 1 Failure

## Functional Area
Auth — Session Timeout

## Problem

`web/src/hooks/useSessionTimeout.test.ts` has 1 failing test: **"does NOT call onTimeout if dismissed before 0"** (line ~146). The root cause is a missing mock.

The `resetTimer()` function in `useSessionTimeout.ts` (line 109) now calls `apiPost('/api/auth/extend-session')` to extend the session on the server. The test only mocks `global.fetch` — it does not mock `apiPost` from `@/lib/api`. Since `apiPost` is a separate module-level function (not a thin wrapper around `global.fetch`), the unmocked call throws a network error. The hook's catch block (line 115–118) responds to the error by calling `onTimeoutRef.current()` — forcing a logout. The test asserts `expect(onTimeout).not.toHaveBeenCalled()`, which fails because `onTimeout` was called due to the network error.

### Cascade risk

Any test that calls `result.current.resetTimer()` and then asserts `onTimeout` was NOT called is at risk. Currently only 1 test fails because only 1 test exercises this exact path, but additional tests may be fragile.

## Files to Modify

- `web/src/hooks/useSessionTimeout.test.ts`

## Changes Required

### A — Mock `apiPost` from `@/lib/api`

Add a module mock at the top of the test file (before any imports that depend on it):

```ts
vi.mock('@/lib/api', () => ({
  apiPost: vi.fn().mockResolvedValue({ ok: true }),
}));
```

Or, if `@/lib/api` exports other functions used in the tests, use a partial mock:

```ts
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiPost: vi.fn().mockResolvedValue({ ok: true }),
  };
});
```

### B — Verify `resetTimer` calls `apiPost` correctly

Add a test (or assertion in the existing "resetTimer resets the timer" test) that verifies `apiPost` is called with the correct endpoint:

```ts
import { apiPost } from '@/lib/api';
// ...
await result.current.resetTimer();
expect(apiPost).toHaveBeenCalledWith('/api/auth/extend-session');
```

### C — Test the error path explicitly

Add a test that verifies the error-handling behavior when `apiPost` fails:

```ts
test('calls onTimeout when extend-session fails', async () => {
  vi.mocked(apiPost).mockRejectedValueOnce(new Error('Network error'));
  // ... render hook, call resetTimer(), verify onTimeout is called
});
```

This makes the forced-logout-on-network-error behavior explicit rather than having it break unrelated tests.

## Acceptance Criteria

- The "does NOT call onTimeout if dismissed before 0" test passes
- `apiPost` is properly mocked so `resetTimer()` succeeds in all tests that expect no logout
- The error path (network failure during extend-session) is tested explicitly
- `cd web && pnpm vitest run src/hooks/useSessionTimeout.test.ts` exits 0

## Testing

```bash
cd web && pnpm vitest run src/hooks/useSessionTimeout.test.ts
```
