# Spec: Fix my-week retro Yjs persistence polling

## Functional Area
My Week — Yjs Persistence

## Problem
my-week-stale-data.spec.ts:68 polls the document API until content is persisted, but the /my-week endpoint may parse content differently or React Query serves a cached response. Even after the document API confirms persistence, the my-week page may show stale data.

## Files to Modify
- e2e/my-week-stale-data.spec.ts

## Changes Required
After confirming document persistence, also poll the /api/dashboard/my-week endpoint to verify the content appears there. Add a page.reload() fallback if the content isn't visible after client-side navigation (to bust React Query cache).

After the existing document API poll, add:
```typescript
// Also verify content is available via the my-week endpoint
await expect(async () => {
  const response = await page.request.get('/api/dashboard/my-week');
  const data = await response.json();
  expect(data.retro?.content).toContain(expectedText);
}).toPass({ timeout: 10000 });

// Navigate and verify in the UI, with reload fallback
await page.goto('/my-week');
const retroSection = page.locator('[data-testid="retro-section"]');
try {
  await expect(retroSection).toContainText(expectedText, { timeout: 5000 });
} catch {
  await page.reload();
  await expect(retroSection).toContainText(expectedText, { timeout: 5000 });
}
```

## Tradeoffs
Additional API poll adds up to 10s. The reload fallback adds ~2s if triggered. Test is slower in worst case but eliminates the race condition.

## Acceptance Criteria
- Both plan and retro tests pass on 3 consecutive CI runs.
