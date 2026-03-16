# Spec: Fix table context menu not appearing on CI

## Functional Area
Editor — Tables

## Problem
tables.spec.ts:69 still fails on CI — the "Add row" text is not found after right-clicking. The F3.13 commit added a TableContextMenu component and modified Editor.tsx's onContextMenu handler to detect table context. Possible issues: (a) The commit may not have been included in this CI build. (b) The onContextMenu handler on the `tiptap-wrapper` div may not fire when right-clicking a table cell because the event target is inside the ProseMirror contenteditable, which may handle contextmenu events differently. (c) The `isInTable()` check may not work because the cursor position changes on right-click.

## Files to Modify
- e2e/tables.spec.ts
- web/src/components/Editor.tsx

## Changes Required
First verify the F3.13 code is in the build by checking the CI commit hash. If it is: (a) Ensure the right-click sets the cursor position in the table cell before the onContextMenu handler fires — add `await firstCell.click()` (left-click) before `firstCell.click({ button: 'right' })` to ensure the TipTap cursor is in the table. (b) Update the test selector from `getByText(/Add row|Insert row/i)` to `getByRole('menuitem', { name: /Add row/i })` for more reliable matching. (c) Add a wait between left-click and right-click for the cursor position to be registered.

## Tradeoffs
Adding a left-click before right-click is an extra interaction but ensures the TipTap selection state is correct for isInTable() to work.

## Acceptance Criteria
- tables:69 passes on CI.
