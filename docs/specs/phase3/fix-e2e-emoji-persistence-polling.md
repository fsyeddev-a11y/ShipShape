# Spec: Fix `emoji` — Replace save delay with Yjs persistence polling

## Problem
`e2e/emoji.spec.ts:153` ("emoji persists after save and reload") uses `waitForTimeout(2000)` to "wait for auto-save" before reloading the page. There's no verification that the save actually completed. If Yjs takes longer than 2s to flush to the database, the emoji isn't persisted and the reload shows an empty document. Additionally, `waitForTimeout(500)` is used after typing `/fire` for the emoji picker and `waitForTimeout(1000)` after reload — both are arbitrary delays with no condition checks.

## Files to Modify
- `e2e/emoji.spec.ts`

## Changes Required

### A — Replace save delay with API polling
```ts
// BEFORE:
await page.waitForTimeout(2000) // wait for auto-save

// AFTER:
// Extract doc ID from URL
const docId = page.url().match(/documents\/([a-f0-9-]+)/)?.[1]
// Poll API until content is persisted
await expect(async () => {
  const res = await page.request.get(`/api/documents/${docId}`)
  const body = await res.json()
  expect(JSON.stringify(body.content)).toContain('🔥')
}).toPass({ timeout: 15000 })
```

### B — Replace other waitForTimeout calls
- `waitForTimeout(500)` after typing → `await expect(picker).toBeVisible({ timeout: 5000 })`
- `waitForTimeout(1000)` after reload → `await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 10000 })`

### C — Replace point-in-time `isVisible()` checks with retrying assertions
The test uses `if (await picker.isVisible({ timeout: 3000 }))` which silently skips if the picker doesn't appear. Replace with `await expect(picker).toBeVisible({ timeout: 5000 })` so failures are visible.

## Tradeoffs
- API polling adds up to 15s worst case vs the fixed 2s delay. In practice, persistence usually completes in 1-3s so the test won't be noticeably slower.
- Asserting emoji content via `JSON.stringify(body.content).toContain('🔥')` assumes the emoji is stored as a Unicode character in the Yjs/ProseMirror JSON. If it's stored differently (e.g., as an emoji node with metadata), the check may need adjustment.

## Acceptance Criteria
- Zero `waitForTimeout` calls in the file
- Zero point-in-time `isVisible()` used for branching
- Test passes on 3 consecutive runs

## Testing
```bash
pnpm test:e2e --grep "emoji" --reporter=list
```
