# Spec: Fix Bulk Selection Focus Ring CSS Class Collision

## Functional Area
Issues — Keyboard Navigation

## Problem
5 E2E tests in bulk-selection.spec.ts fail because the tests check for `ring-2` in the element's class string using a regex (`toHaveClass(/ring-2/)`), but every `<tr>` row in `SelectableList.tsx` has the static Tailwind utility `focus-visible:ring-2` in its className. This string always contains "ring-2" as a substring regardless of whether the element is focused, causing the regex to match even when the row is NOT focused.

The actual React focus management code (`moveFocus`, `setFocusedId`, `useGlobalListNavigation`) works correctly. The `isFocused` conditional on line 244 correctly adds/removes `ring-2 ring-accent ring-inset`. The bug is purely a CSS class naming collision.

## Root Cause
`SelectableList.tsx` line 242 has both:
- Static: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` (always in class string)
- Dynamic: `isFocused && 'ring-2 ring-accent ring-inset'` (added/removed by React state)

The test regex `/ring-2/` matches the static `focus-visible:ring-2` even when `isFocused` is false.

## Files to Modify
- `web/src/components/SelectableList.tsx`

## Changes Required
Remove `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` from the static className on line 242. The React-managed `isFocused` conditional already handles focus ring visuals. The `focus-visible:` classes are redundant because:
- The `<tr>` has an `onFocus` handler that calls `setFocusedId(itemId)`
- This sets `isFocused=true` which applies `ring-2 ring-accent ring-inset`
- So tabbing into a row already triggers the React-managed ring

```ts
// BEFORE (line 242):
'group cursor-pointer border-b border-border/50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',

// AFTER:
'group cursor-pointer border-b border-border/50 transition-colors outline-none',
```

## Tradeoffs
Removes the browser-native `focus-visible` ring in favor of the React-managed ring. If there were ever a case where a `<tr>` gets DOM focus without the React `onFocus` handler firing, there would be no visible focus indicator. The `onFocus` handler on the `<tr>` prevents this scenario. The `outline-none` class remains, which is correct since the React ring replaces the browser outline.

## Acceptance Criteria
- All 5 bulk-selection focus tests pass (lines 356, 382, 751, 784, 884)
- 80 other bulk-selection tests continue to pass
- Focus ring is visually correct when navigating with arrow keys, j/k, and Tab
