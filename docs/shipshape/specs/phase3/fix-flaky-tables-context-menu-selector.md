# Spec: Fix tables add-row test to use getByRole for new context menu

## Functional Area
Editor — Tables

## Problem
tables.spec.ts:69 uses getByText(/Add row|Insert row/i) to find the context menu item. After F3.13 added the TableContextMenu component, the menu items are rendered as ContextMenuItem components with role="menuitem". getByRole('menuitem') is more reliable than getByText for matching these custom components.

## Files to Modify
- e2e/tables.spec.ts

## Changes Required
Replace `page.getByText(/Add row|Insert row/i)` with `page.getByRole('menuitem', { name: /Add row/i })`. Add waitForTimeout(300) before right-click to ensure cell selection is registered by TipTap (needed for isInTable() to return true).

Example:
```typescript
// Wait for cell selection to register
await page.waitForTimeout(300);

// Right-click to open context menu
await cell.click({ button: 'right' });

// Use role-based selector for menu item
await page.getByRole('menuitem', { name: /Add row/i }).click();
```

## Tradeoffs
The getByRole selector is strictly more specific. If the menu item's role changes, the selector breaks — but role="menuitem" is a standard ARIA role set by the ContextMenuItem component.

## Acceptance Criteria
- Test passes on 3 consecutive CI runs.
