# Spec: Fix `status-overview-heatmap` — Replace `networkidle` with DOM wait

## Functional Area
Teams — Status Overview

## Problem
`e2e/status-overview-heatmap.spec.ts:109` ("clicking retro cell navigates to weekly retro document") uses `waitForLoadState('networkidle')` after navigating to `/team/status`. Same WebSocket issue as `createNewDocument` — the heatmap page maintains WebSocket connections that prevent network idle from ever being reached. The test races ahead before the heatmap data has loaded and rendered.

## Files to Modify
- `e2e/status-overview-heatmap.spec.ts`

## Changes Required
Replace `waitForLoadState('networkidle')` with a wait for the heatmap's visible content:

```ts
// BEFORE:
await page.waitForLoadState('networkidle')

// AFTER:
await expect(page.getByText('Program / Person')).toBeVisible({ timeout: 10000 })
```

If there are other `waitForLoadState('networkidle')` calls in this file, replace them all with appropriate DOM-based waits.

## Tradeoffs
- Relies on the "Program / Person" text being present on the heatmap page. If this text changes, the wait would fail. But it's already asserted in the existing test, so it's a reliable indicator.

## Acceptance Criteria
- Zero `waitForLoadState('networkidle')` calls in the file
- Test passes on 3 consecutive runs

## Testing
```bash
pnpm test:e2e --grep "heatmap" --reporter=list
```
