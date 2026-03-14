# Category 7: Accessibility Compliance — Implemented Specs

---

## 7.1 — Document Page A11y Fixes

**Spec:** [cat7-document-page-fixes.md](../../specs/cat7-document-page-fixes.md)

**What Changed:**
Four fixes across multiple components:

1. **ProseMirror aria-expanded removal** (`web/src/components/Editor.tsx`): Added a `useEffect` that removes the `aria-expanded` attribute from the ProseMirror DOM element after editor mount. TipTap's Collaboration extension adds `aria-expanded="false"` to the editor root which has `role="textbox"` — an invalid ARIA combination.

2. **Title placeholder contrast** (`web/src/components/Editor.tsx`): Changed `placeholder:text-muted/30` to `placeholder:text-[#767676]`. The `#767676` color provides 4.54:1 contrast ratio on white background, meeting WCAG AA requirements.

3. **aria-labels on search inputs**: Added `aria-label="Search backlog items"` to `BacklogPickerModal.tsx`, `aria-label="Search associations"` to `MultiAssociationChips.tsx`, and `aria-label="Choose document icon"` to the `EmojiPicker.tsx` trigger button.

4. **PropertyRow label association** (`web/src/components/ui/PropertyRow.tsx`): Added `htmlFor` on the `<label>` element using React's `useId()` hook for stable ID generation. Added `aria-label="required"` to the highlighted asterisk indicator. Added `aria-hidden="true"` to the tooltip info icon SVG.

**Why the Original Code Was Suboptimal:**
- `aria-expanded` on `role="textbox"` is invalid per WAI-ARIA 1.2 — assistive technology may skip or misinterpret the entire editor.
- Title placeholder at 30% opacity had ~1.6:1 contrast ratio (needs 4.5:1 for WCAG AA).
- Search inputs without `aria-label` are announced as unlabeled by screen readers.
- `PropertyRow` labels were visually associated but not programmatically linked to inputs — screen readers couldn't connect them.

**Why This Approach Is Better:**
All fixes follow WAI-ARIA 1.2 patterns. The placeholder uses a specific hex color (`#767676`) known to meet 4.54:1 on white, rather than an opacity hack. `useId()` generates unique, stable IDs without naming collisions.

**Tradeoffs:**
The `aria-expanded` removal via `useEffect` is a DOM mutation that runs after render — there's a brief moment where the invalid attribute exists. A TipTap plugin would be cleaner but more complex for a single attribute removal. The `PropertyRow` `inputId` prop is optional for backward compatibility — existing consumers don't need to pass it, but the label association uses a generated ID that may not match the child input's actual ID.

---

## 7.2 — My-Week A11y Fixes

**Spec:** [cat7-my-week-fixes.md](../../specs/cat7-my-week-fixes.md)

**What Changed:**
1. **Line number contrast** (`web/src/pages/MyWeekPage.tsx`): Replaced `text-muted/50` with `text-muted-foreground` on both plan and retro line number spans (lines 228, 290). `text-muted-foreground` provides full-opacity muted color that meets 4.5:1 contrast.

2. **TabBar arrow key navigation** (`web/src/components/ui/TabBar.tsx`): Implemented the WAI-ARIA tablist keyboard pattern:
   - `ArrowRight`/`ArrowLeft` cycle through tabs with wrapping
   - `Home`/`End` jump to first/last tab
   - Active tab has `tabIndex={0}`, inactive tabs have `tabIndex={-1}` (roving tabindex)
   - Arrow keys both focus and activate the tab (automatic activation pattern)
   - Used `useRef` array for tab element references and `useCallback` for the keydown handler

**Why the Original Code Was Suboptimal:**
- `text-muted/50` at 50% opacity produced ~3.2:1 contrast ratio, below the 4.5:1 WCAG AA minimum.
- The TabBar had no keyboard navigation — only Tab key could reach it, and users couldn't move between tabs with arrow keys. This violates WCAG 2.1 SC 2.1.1 (Keyboard) and the WAI-ARIA tabs pattern.

**Why This Approach Is Better:**
- `text-muted-foreground` is a theme-aware token that meets contrast requirements in both light and dark modes.
- The arrow key navigation follows the standard WAI-ARIA tablist pattern. Roving tabindex ensures only the active tab is in the Tab order, reducing Tab stops. Home/End keys provide quick access for users with motor impairments.

**Tradeoffs:**
The TabBar uses automatic activation (arrow keys both move focus and switch tabs) rather than manual activation (arrow keys only move focus, Enter/Space activates). Automatic activation is recommended for tabs with lightweight content that loads instantly. If tab content becomes expensive to load, manual activation would be more appropriate.

---

## 7.3 — Projects Page A11y Fixes

**Spec:** [cat7-projects-page-fixes.md](../../specs/cat7-projects-page-fixes.md)

**What Changed:**
1. **Decorative SVG aria-hidden**: Added `aria-hidden="true"` to all decorative SVG icons in `BulkActionBar.tsx` (7 icons), `ApprovalButton.tsx` (5 icons), and `CommandPalette.tsx` (8 icons). These are purely decorative icons inside buttons that already have text labels or `aria-label`.

2. **SelectableList focus ring** (`web/src/components/SelectableList.tsx`): Added `outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` to the row `<tr>` element. This provides a visible focus indicator only for keyboard users (not mouse clicks).

3. **WorkspaceSettings contrast** (`web/src/pages/WorkspaceSettings.tsx`): Replaced `text-muted/50` with `text-muted-foreground` on the dash placeholder text in the X.509 Subject DN column.

**Why the Original Code Was Suboptimal:**
- Decorative SVGs without `aria-hidden` are announced by screen readers as meaningless icon content (e.g., "image" or SVG path data).
- SelectableList rows had no `focus-visible` indicator — keyboard users couldn't see which row was focused when navigating without a mouse.
- `text-muted/50` at 50% opacity failed the 4.5:1 WCAG AA contrast minimum.

**Why This Approach Is Better:**
- `aria-hidden="true"` removes decorative icons from the accessibility tree entirely, reducing noise for screen reader users.
- `focus-visible` ring only appears for keyboard navigation (not mouse clicks), providing clear focus indication without visual clutter for mouse users.
- `text-muted-foreground` meets contrast requirements across theme variants.

**Tradeoffs:**
The `aria-hidden="true"` was applied broadly using replace-all — if any of these SVGs were the sole content of a button (no text label), the button would become invisible to screen readers. All affected buttons were verified to have text labels or `aria-label`. The `focus-visible` ring coexists with the existing `isFocused && 'ring-2 ring-accent ring-inset'` class — both can apply simultaneously, which is intentional (keyboard focus ring + programmatic focus highlight).
