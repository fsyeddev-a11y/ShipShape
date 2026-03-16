# Spec: Add Table Context Menu to Editor

## Functional Area
Editor — Tables

## Problem
The app has no custom right-click context menu for tables. When a user right-clicks a table cell, only the browser's native context menu appears. There is no UI to add rows, add columns, delete rows, delete columns, or delete the entire table. All TipTap table commands (`addRowAfter`, `deleteTable`, etc.) are available on the editor instance but have no UI surface.

Tests at tables.spec.ts:69 ("should add rows to table") and tables.spec.ts:371 ("should delete entire table") fail because they right-click a cell expecting a custom context menu that doesn't exist.

## Files to Create
- `web/src/components/editor/TableContextMenu.tsx`

## Files to Modify
- `web/src/components/Editor.tsx` (replace imperative onContextMenu handler with React state-driven approach)

## Changes Required

### A — Create TableContextMenu.tsx
A stateless component that renders table-specific menu items using the existing `ContextMenu` UI component. Each item calls a TipTap table command:

- "Add row" → `editor.commands.addRowAfter()`
- "Add column" → `editor.commands.addColumnAfter()`
- "Delete row" → `editor.commands.deleteRow()`
- "Delete column" → `editor.commands.deleteColumn()`
- "Delete table" → `editor.commands.deleteTable()`

Labels must match E2E test regex expectations (`/Add row|Insert row/i`, `/Delete table|Remove table/i`, etc.).

### B — Modify Editor.tsx onContextMenu handler
Replace the imperative DOM-based context menu (lines 1015-1039) with React state:

1. Add state: `const [editorContextMenu, setEditorContextMenu] = useState<{ x: number; y: number; type: 'comment' | 'table' } | null>(null)`
2. Add `isInTable` helper that walks `$from.depth` to check if cursor is inside a table node
3. Replace `onContextMenu` handler:
   - If cursor is in table → show table menu
   - Else if text selected → show comment menu
   - Else → let browser default menu appear
4. Render `<ContextMenu>` with conditional content based on `type`

### C — Import existing ContextMenu components
Import `ContextMenu`, `ContextMenuItem`, `ContextMenuSeparator` from `@/components/ui/ContextMenu` (already exists with full keyboard navigation, viewport adjustment, and accessibility support).

## Tradeoffs
- Right-clicking in a table with text selected shows the table menu, not the comment menu. This is acceptable since the bubble menu already provides "Add Comment" on text selection.
- The imperative DOM context menu code is replaced entirely. If any other code references the `.comment-context-menu` class div, it would break. Need to verify no other code depends on it.
- ~80 lines of new code across 2 files.

## Acceptance Criteria
- Right-clicking a table cell shows a custom context menu with row/column/table operations
- tables.spec.ts:69 ("should add rows to table") passes
- tables.spec.ts:371 ("should delete entire table") passes
- The existing "Add Comment" right-click menu still works for text selections outside tables
- Menu items are keyboard navigable (inherited from ContextMenu component)
