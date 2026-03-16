# Spec: Fix `createNewDocument` helper — Replace `networkidle` with editor visibility

## Problem
The shared `createNewDocument` helper (used by 8+ test files) calls `waitForLoadState('networkidle')` after creating a document. `networkidle` waits until no network requests occur for 500ms, but ShipShape uses persistent WebSocket connections for Yjs collaboration — the page never truly reaches "network idle." This causes two failure modes: (1) the wait times out, wasting time and leaving the editor in an unknown state, or (2) a brief gap in WebSocket traffic triggers a false positive, and the test proceeds before TipTap has finished initializing. Tests that type into the editor, trigger slash commands, or interact with the toolbar then fail intermittently because the editor isn't ready.

## Files to Modify
- Find the file(s) containing the `createNewDocument` helper function. Search for `createNewDocument` across the e2e/ directory. It's likely in a shared helper/fixture file or defined locally in multiple test files. Fix ALL occurrences.

## Changes Required
Replace `waitForLoadState('networkidle')` with an explicit wait for the TipTap editor:

```ts
// BEFORE:
await page.waitForLoadState('networkidle')

// AFTER:
await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 10000 })
```

If `createNewDocument` is defined in multiple files, update all of them. Search for the pattern across e2e/.

## Tradeoffs
- The `.ProseMirror` selector is coupled to TipTap's internal DOM structure. If TipTap changes its root element class, these waits would break. However, `.ProseMirror` has been stable across TipTap versions and is widely used in the codebase.
- Tests that navigate to non-editor pages after `createNewDocument` won't benefit from this change, but those tests don't use `createNewDocument` anyway.

## Acceptance Criteria
- Zero `waitForLoadState('networkidle')` calls in the `createNewDocument` helper
- All tests that use `createNewDocument` still pass

## Testing
```bash
pnpm test:e2e --grep "emoji|file-attach|image|table|mention|error-handling" --reporter=list
```
