# Spec: Fix `tables` — Remove silent-pass guard, replace persistence delay with API polling

## Problem
Two issues in `e2e/tables.spec.ts`:

1. **Silent pass (line 72):** "should add rows to table" wraps the assertion in `if (await addRowOption.isVisible({ timeout: 2000 }).catch(() => false))`. If the context menu doesn't appear, the test passes without checking anything. This hides real failures.

2. **Yjs persistence race (line 418):** "should persist table after reload" uses `waitForTimeout(2000)` before reloading, hoping Yjs has flushed to the database. If persistence takes longer, the reload shows an empty document.

Additionally, `waitForTimeout(300)` is used after right-clicks to wait for context menus, and `waitForTimeout(500)` after typing `/table` for the slash command menu.

## Files to Modify
- `e2e/tables.spec.ts`

## Changes Required

### A — Remove silent-pass `if` guard
```ts
// BEFORE:
if (await addRowOption.isVisible({ timeout: 2000 }).catch(() => false)) {
  await addRowOption.click()
  // ... assertions
}

// AFTER:
await expect(addRowOption).toBeVisible({ timeout: 5000 })
await addRowOption.click()
// ... assertions (always run)
```

### B — Replace persistence delay with API polling
```ts
// BEFORE:
await page.waitForTimeout(2000)
await page.reload()

// AFTER:
const docId = page.url().match(/documents\/([a-f0-9-]+)/)?.[1]
await expect(async () => {
  const res = await page.request.get(`/api/documents/${docId}`)
  const body = await res.json()
  expect(JSON.stringify(body.content)).toContain('Persistent data')
}).toPass({ timeout: 15000 })
await page.reload()
```

### C — Replace `waitForTimeout(300)` after right-click with menu wait
```ts
// BEFORE:
await cell.click({ button: 'right' })
await page.waitForTimeout(300)

// AFTER:
await cell.click({ button: 'right' })
await expect(page.locator('[role="menu"], [data-context-menu]')).toBeVisible({ timeout: 5000 })
```

### D — Replace `waitForTimeout(500)` after `/table` with slash menu wait
```ts
// BEFORE:
await page.keyboard.type('/table')
await page.waitForTimeout(500)

// AFTER:
await page.keyboard.type('/table')
await expect(page.getByRole('button', { name: /table/i })).toBeVisible({ timeout: 5000 })
```

## Tradeoffs
- Removing the `if` guard means the test will now FAIL if the context menu doesn't appear, instead of silently passing. This is intentionally stricter — it may expose a real bug in the context menu that was previously hidden.
- API polling adds up to 15s worst case for persistence verification.

## Acceptance Criteria
- Zero `waitForTimeout` calls in the file
- Zero silent-pass `if` guards around assertions
- Both tests pass on 3 consecutive runs

## Testing
```bash
pnpm test:e2e --grep "table" --reporter=list
```
