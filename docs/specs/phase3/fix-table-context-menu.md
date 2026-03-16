# Spec: Fix Table Context Menu Selectors

## Problem
tables.spec.ts tests 69 and 371 right-click table cells expecting a context menu with "Add row"/"Insert row" and "Delete table"/"Remove table" text. The TipTap table extension may use different menu item text, or the custom context menu may not appear (browser native menu appears instead). After removing the silent-pass guard, this is now a hard failure.

## Files to Modify
- e2e/tables.spec.ts

## Changes Required
Inspect the actual TipTap table context menu items in the running app (check the ContextMenu component for table-specific items). Update the regex selectors to match the actual text. If no custom table context menu exists, use TipTap's table toolbar buttons instead of right-click, or use keyboard shortcuts for row/table operations.

## Tradeoffs
If the app doesn't have a custom table context menu at all, these tests need a fundamentally different interaction approach (toolbar buttons or commands).

## Acceptance Criteria
- Table row insertion test uses selectors that match the actual menu item text
- Table deletion test uses selectors that match the actual menu item text
- Both tests interact with the correct UI element (custom context menu or toolbar, whichever the app provides)
- Tests pass without relying on silent-pass guards or `.catch()` swallowing
