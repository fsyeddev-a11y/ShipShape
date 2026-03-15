# Spec 6.6: Document Title Real-Time Sync Failure

**Category:** 6 — Runtime Error Handling
**Priority:** Medium-High
**Severity:** Medium-High
**Audit Finding:** Discovered during Phase 2 testing — multi-user title editing

---

## Problem

When two users are viewing the same document, title changes made by User A are never seen by User B. The body content syncs perfectly via Yjs CRDT over WebSocket, but title updates go through a REST `PATCH /api/documents/{id}` call with no broadcast to other connected clients.

**Symptoms:**
1. User A changes the title — PATCH requests fire to the API (visible in Network tab)
2. User B sees nothing — no WebSocket message, no UI update
3. User B refreshes — still sees the old title (React Query serves stale cache)
4. User B only sees the updated title after a full logout/login cycle

This is a silent data inconsistency — User B has no idea they're looking at a stale title. If User B edits the document, their stale title could overwrite User A's update.

### Secondary Bug: useAutoSave Throttle Double-Fire

`useAutoSave.ts` fires two PATCH requests per throttle window instead of one. When a keystroke passes the throttle gate (`timeSinceLastSave >= throttleMs`), it saves immediately AND schedules a trailing save 500ms later. If no new keystroke arrives before the trailing timeout, both fire with the same value.

```typescript
// Lines 66-75 — both branches execute in the same call
if (timeSinceLastSave >= throttleMs) {
  saveSequenceRef.current++;
  save(value, saveSequenceRef.current);  // fires immediately
}

// Always runs — even when the immediate save already fired above
timeoutRef.current = setTimeout(() => {
  saveSequenceRef.current++;
  save(value, saveSequenceRef.current);  // fires again 500ms later
}, throttleMs);
```

**Impact:** Typing a 120-character title at normal speed produces ~8-9 PATCH requests instead of ~4-5. Not critical, but wasteful.

## Fix

### Part A: Broadcast title changes via existing `/events` WebSocket

The `/events` WebSocket already exists for global notifications. Use it to broadcast title updates to other clients viewing the same document.

**Backend** — In `api/src/routes/documents.ts`, after a successful title PATCH:

```typescript
// After title update succeeds in the PATCH handler
if (updates.title) {
  broadcastEvent('title-updated', {
    documentId,
    title: updates.title,
    updatedBy: req.session.userId,
  });
}
```

**Frontend** — Listen for the event and update local state + React Query cache:

```typescript
// In the component that manages document state
useRealtimeEvent('title-updated', (data) => {
  if (data.documentId === currentDocumentId && data.updatedBy !== currentUserId) {
    // Update React Query cache
    queryClient.setQueryData(['document', data.documentId], (old) => ({
      ...old,
      title: data.title,
    }));
  }
});
```

### Part B: Fix useAutoSave throttle double-fire

Skip the trailing `setTimeout` when the immediate save already fired:

```typescript
if (timeSinceLastSave >= throttleMs) {
  saveSequenceRef.current++;
  save(value, saveSequenceRef.current);
} else {
  // Only schedule trailing save when immediate didn't fire
  timeoutRef.current = setTimeout(() => {
    saveSequenceRef.current++;
    save(value, saveSequenceRef.current);
  }, throttleMs);
}
```

## Steps

1. Add a `broadcastEvent` helper (or use the existing WebSocket broadcast in `collaboration/index.ts`) to emit events on the `/events` WebSocket
2. In the `PATCH /api/documents/:id` handler in `documents.ts`, emit `title-updated` after a successful title change
3. In the frontend, add a listener for `title-updated` in the document page component that updates React Query cache and local title state (only when `updatedBy !== currentUser`)
4. In `useAutoSave.ts`, add an `else` so the trailing timeout only schedules when the immediate save didn't fire
5. Verify the `hasLocalChangesRef` guard in `Editor.tsx` (line 228) correctly allows server-pushed title updates through

## Files to Modify

- `api/src/routes/documents.ts` — emit `title-updated` event after PATCH
- `api/src/collaboration/index.ts` — expose broadcast helper if not already available
- `web/src/pages/UnifiedDocumentPage.tsx` — listen for `title-updated`, update cache
- `web/src/components/Editor.tsx` — ensure server-pushed titles update local state
- `web/src/hooks/useAutoSave.ts` — fix throttle double-fire

## Verification

- User A changes a title → User B sees the update within 1 second (no refresh needed)
- User B's React Query cache is updated correctly — navigating away and back shows the new title
- If both users edit the title simultaneously, last-write-wins without errors
- Throttle produces ~4-5 PATCH requests for a 120-char title typed at normal speed (down from ~8-9)
- No regressions: existing body content collaboration still works, existing tests pass

## Audit Targets Addressed

- Fixes a silent data inconsistency where users see stale titles with no warning
- Reduces unnecessary PATCH requests from throttle double-fire
- Aligns with Category 6's goal of surfacing failures and inconsistencies that currently happen silently
