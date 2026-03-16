# Spec 6.5: Silent Save Failure Handling

**Category:** 6 — Runtime Error Handling
**Priority:** Medium
**Severity:** Medium
**Audit Finding:** Category 6, Finding 5

---

## Problem

Database save failures are silently swallowed in multiple locations:

1. **ROLLBACK errors discarded** — `documents.ts` and `issues.ts` use `.catch(() => {})` on ROLLBACK queries. If a transaction fails and the ROLLBACK also fails, the error is completely invisible. The user's data is lost with no warning.

2. **No user-facing feedback on save failure** — When a database connection blips while a user is typing, the save request fails silently. The app doesn't retry or warn the user. Their work is permanently lost with no indication that anything went wrong.

## Fix

### Part A: Surface ROLLBACK errors

Replace `.catch(() => {})` with error logging:

```typescript
// Before
await client.query('ROLLBACK').catch(() => {});

// After
await client.query('ROLLBACK').catch((rollbackErr) => {
  console.error('ROLLBACK failed after transaction error:', rollbackErr);
});
```

### Part B: Add save failure retry + user notification

When a document save (POST/PATCH to `/api/documents/:id`) fails due to a network or database error:

1. **Retry with backoff** — attempt the save up to 3 times with exponential backoff (1s, 2s, 4s)
2. **Notify the user on failure** — after retries are exhausted, show a toast/banner:
   ```
   "Save failed — your changes are preserved locally. Retrying..."
   ```
3. **Queue failed saves** — buffer the failed save payload and retry when connectivity is restored

### Steps

1. In `documents.ts` and `issues.ts`, replace `.catch(() => {})` on ROLLBACK with error logging
2. In the frontend API layer (`api.ts` or mutation hooks), add retry logic for save/update mutations:
   ```typescript
   const mutation = useMutation({
     mutationFn: updateDocument,
     retry: 3,
     retryDelay: (attempt) => Math.pow(2, attempt) * 1000,
     onError: (error) => {
       toast.error('Save failed — your changes are preserved locally. Retrying...');
     },
   });
   ```
3. Ensure the editor's local Yjs state (IndexedDB) preserves changes even when the server save fails — this is already partially in place via Yjs offline support, but verify it covers all save paths

## Verification

- Simulate database downtime during editing — user sees a save failure notification
- Failed saves retry automatically up to 3 times
- After connectivity is restored, queued saves complete
- ROLLBACK failures appear in server logs (not silently swallowed)
- No data loss during temporary network interruptions

## Audit Targets Addressed

- Fixes Category 6 improvement target: user-facing error handling gap
- Addresses Finding 5: ROLLBACK errors silently swallowed
- Addresses the human audit finding: "the app doesn't retry or warn the user — it just secretly loses their work permanently"
