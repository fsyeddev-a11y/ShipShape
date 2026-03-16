# Spec: Fix `accessibility-remediation` — Non-retrying `getAttribute` assertions

## Problem
`e2e/accessibility-remediation.spec.ts:144` ("combobox has required ARIA attributes") reads ARIA attributes using `getAttribute()` then asserts on the value. `getAttribute()` is a one-shot DOM read — it doesn't retry. If the combobox renders before its ARIA attributes are attached (common with React's async rendering), `getAttribute` returns `null` and the test fails. The subsequent selector `#${ariaControls}` becomes `#null`, which never matches.

## Files to Modify
- `e2e/accessibility-remediation.spec.ts`

## Changes Required
Replace non-retrying `getAttribute` + `expect` with Playwright's auto-retrying `toHaveAttribute`:

```ts
// BEFORE:
const ariaControls = await combobox.getAttribute('aria-controls')
expect(ariaControls).toBeTruthy()
const ariaExpanded = await combobox.getAttribute('aria-expanded')
expect(ariaExpanded).toBeTruthy()

// AFTER:
await expect(combobox).toHaveAttribute('aria-controls', /.+/, { timeout: 5000 })
await expect(combobox).toHaveAttribute('aria-expanded', /.+/, { timeout: 5000 })
const ariaControls = await combobox.getAttribute('aria-controls')
```

The retrying assertions ensure the attributes exist before reading their values.

## Tradeoffs
- Adds up to 5s per assertion if attributes are slow to attach. In practice this adds negligible time since attributes are usually set within milliseconds of render.

## Acceptance Criteria
- The combobox ARIA test passes on 3 consecutive runs
- No non-retrying `getAttribute` calls used for assertion purposes

## Testing
```bash
pnpm test:e2e --grep "combobox" --reporter=list
```
