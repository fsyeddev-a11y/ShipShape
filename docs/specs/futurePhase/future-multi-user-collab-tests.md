# Spec: Multi-User Real-Time Collaboration E2E Tests

## Functional Area

Editor — Real-Time Collaboration

## Problem

ShipShape is a real-time collaboration app using Yjs + WebSocket for document editing, but no E2E test verifies that two users can edit the same document simultaneously and see each other's changes. The existing multi-user tests only cover permissions (private-documents.spec.ts) and backlink updates (backlinks.spec.ts) — none test the core collaboration flow.

This gap means regressions in Yjs sync, WebSocket broadcasting, title propagation (Spec 6.6 bug), and conflict resolution could ship undetected.

## What to Test

### A — Body content syncs between two users
1. User A opens a document and types "Hello from A"
2. User B opens the same document in a separate browser context
3. User B should see "Hello from A" appear in their editor without refreshing
4. User B types "Hello from B"
5. User A should see "Hello from B" appear in their editor without refreshing

### B — Title changes sync between two users
1. User A opens a document
2. User B opens the same document
3. User A changes the title to "Updated Title"
4. User B should see "Updated Title" without refreshing (tests Spec 6.6 WebSocket fix)

### C — Concurrent typing at different positions
1. Both users open the same document with existing content
2. User A types at the beginning, User B types at the end, simultaneously
3. Both users should see the complete merged content without data loss

### D — Cursor/presence awareness
1. User A and User B open the same document
2. User A should see User B's cursor or presence indicator
3. User B should see User A's cursor or presence indicator

### E — Disconnect and reconnect
1. User A and User B are editing a document
2. User B goes offline (network intercept)
3. User A types content while B is offline
4. User B reconnects
5. User B should see User A's changes after reconnection

## Implementation Approach

Use Playwright's `browser.newContext()` to create two separate browser sessions logged in as different users. Both navigate to the same document URL. Use `page.evaluate()` to interact with the TipTap editor programmatically if needed.

```ts
test('two users see each other's edits in real-time', async ({ browser }) => {
  // Create two separate sessions
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  // Login as different users
  await loginAs(pageA, 'userA@ship.local')
  await loginAs(pageB, 'userB@ship.local')

  // Both open the same document
  await pageA.goto(`/documents/${docId}`)
  await pageB.goto(`/documents/${docId}`)

  // User A types
  await pageA.locator('.ProseMirror').type('Hello from A')

  // User B should see it (via Yjs WebSocket sync)
  await expect(pageB.locator('.ProseMirror')).toContainText('Hello from A', { timeout: 10000 })
})
```

## Files to Create

- `e2e/collaboration-sync.spec.ts`

## Priority

Medium-High — this is core product functionality with zero test coverage. The Spec 6.6 title sync bug was only caught by manual testing. These tests would have caught it automatically.
