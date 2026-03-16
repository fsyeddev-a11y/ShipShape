# Category 7: Accessibility

## Methodology

### Environment
- **Lighthouse audits:** Chrome DevTools Lighthouse 12 (accessibility category only), desktop viewport, logged in as `dev@ship.local`, each page navigated manually then audited
- **Axe-core sweep:** `axe-playwright` injected via Playwright MCP session across all routes; `wcag2a`, `wcag2aa`, `best-practice` rule sets enabled
- **Keyboard-only navigation:** Tab, Shift+Tab, Enter, Space, Arrow keys only — mouse disabled via DevTools. Traversed primary workflows: open document, edit title, navigate sidebar, open command palette, select issue
- **Screen reader spot-check:** VoiceOver on macOS Safari; verified heading hierarchy, form label announcements, and ARIA landmark structure on `/documents/:id` and `/my-week`
- **Color contrast:** Computed effective contrast ratios using Chrome DevTools color picker against the app's dark background `#0d0d0d`; confirmed with WCAG 2.1 AA threshold (4.5:1 normal text, 3:1 large text/UI components)
- **Code inspection:** `web/src/components/Editor.tsx`, `web/src/components/BacklogPickerModal.tsx`, `web/src/components/MultiAssociationChips.tsx`, `web/src/components/CommandPalette.tsx`, `web/src/components/EmojiPicker.tsx`, `web/src/components/PropertyRow.tsx`, `web/src/components/BulkActionBar.tsx`, `web/src/components/TabBar.tsx`

---

## Audit Deliverable

| Metric | Your Baseline |
|--------|---------------|
| **Lighthouse accessibility score (per page)** | **My week main** `/my-week` — 96/100 <br> **Docs main view** `/docs` — 100/100 <br> **Docs selected wiki** `/docs/:id` — 100/100 <br> **Selected Program view** `/docs/:id` — 94/100 <br> **Selected Programs – issues view** `/docs/:id/issues` — 95/100 <br> **Selected Programs – projects view** `/docs/:id/projects` — 91/100 <br> **Selected Programs – weeks view** `/docs/:id/weeks` — 91/100 <br> **Selected issues view** `/docs/:id` — 95/100 <br> **Selected Projects view** `/docs/:id` — 95/100 <br> **Selected Projects details view** `/docs/:id/details` — 92/100 <br> **Selected Projects week view** `/docs/:id/weeks` — 91/100 <br> **Selected Projects retro view** `/docs/:id/retro` — 92/100 <br> **Program main view** `/programs` — 100/100 <br> **Projects main view** `/projects` — 96/100 <br> **Team allocation view** `/team/allocation` — 96/100 <br> **Team directory view** `/team/directory` — 100/100 <br> **Selected team member** `/team/:id` — 100/100 <br> **Team status view** `/team/status` — 96/100 <br> **Team reviews** `/team/reviews` — 96/100 <br> **Team org-chart** `/team/org-chart` — 100/100 <br> **Settings page** `/settings` — 95/100 <br> **Settings invites** `/settings?tab=invites` — 94/100 <br> **Settings API tokens** `/settings?tab=tokens` — 93/100 <br> **Settings audit logs** `/settings?tab=audit` — 100/100 <br> **Settings conversions** `/settings/conversions` — 100/100 |
| **Total Critical / Serious violations** | **Critical:** <br> 1. `/documents/:id` — `aria-expanded="false"` on ProseMirror root `role="textbox"` (attribute not allowed on this role per ARIA spec; every document opened by any user triggers this on the core editing surface, causing AT to misinterpret or skip the editor) <br> 2. `/documents/:id`, any open document — Title placeholder contrast ~1.6:1 (needs 4.5:1): `#8a8a8a` at 30% opacity over `#0d0d0d` → effective ~`#2a2a2a`; users relying on the placeholder to identify the title field cannot read it <br> 3. All pages — No root-level `<ErrorBoundary>` in `main.tsx`; all 8 providers are unprotected; any provider exception produces a blank white screen with no recovery path <br><br> **Serious:** <br> 4. `/documents/:id` (backlog picker flow) — `BacklogPickerModal.tsx:244` search input has no `aria-label`; screen readers announce "edit text" with no context when the modal opens <br> 5. `/documents/:id` (properties sidebar, association chips) — `MultiAssociationChips.tsx:172` search input has no `aria-label`; screen readers encounter an unlabelled field on every association attempt <br> 6. Any page (Cmd+K / Ctrl+K) — `CommandPalette.tsx:254` search input has no `aria-label`; placeholder text is not a reliable substitute and disappears once typing starts <br> 7. `/documents/:id` (document header) — `EmojiPicker.tsx:56` trigger button contains only an emoji glyph with no `aria-label`; screen readers announce the raw Unicode name instead of "Change document icon" <br> 8. `/programs`, `/docs/:id` (merge program dialog) — `MergeProgramDialog` search placeholder contrast ~3.2:1 (needs 4.5:1): `#8a8a8a` at 50% opacity → effective ~`#4a4a4a`; users with low vision cannot read the placeholder <br> 9. `/my-week`, `/docs/:id` (any tabbed view) — `TabBar` has no `ArrowLeft`/`ArrowRight` keyboard navigation; users must Tab through every individual tab instead of using arrow keys (WCAG 2.1 SC 2.1.1 / ARIA tab pattern violation) <br> 10. `/documents/:id` (properties sidebar) — `PropertyRow.tsx:15` labels are plain `<span>` elements with no `htmlFor`/`id` or `aria-labelledby`; screen readers announce the control type without the property name <br> 11. `/documents/:id` (properties sidebar) — `PropertyRow.tsx:21` required field indicator has no `aria-describedby` or `aria-required="true"`; screen readers do not announce required state <br> 12. `/projects`, `/docs/:id/issues`, approval flow — Decorative `<svg>` icons inside labelled buttons in `BulkActionBar`, `ApprovalButton`, `CommandPalette` missing `aria-hidden="true"`; screen readers produce redundant output (e.g., "check mark Approve" instead of "Approve") <br> 13. `/my-week` (weekly plan editor) — `text-muted/50` used for visible line numbers: `#8a8a8a` at 50% opacity → effective ~`#4a4a4a`, ~3.2:1 contrast (needs 4.5:1); users with moderate low vision cannot distinguish line numbers from the background |
| **Keyboard navigation completeness** | **Partial** <br><br> Broken or missing: <br> 1. `TabBar` arrow key navigation — `/my-week`, `/docs/:id` (any tabbed view): users must Tab through every tab one at a time; ARIA tab pattern requires Left/Right arrow keys for intra-widget navigation <br> 2. `SelectableList` rows missing visible focus ring — `/projects`, `/docs/:id/issues`, `/docs/:id/projects`: focused rows have no visual indicator; keyboard-driven list navigation produces no feedback <br> 3. `KanbanBoard` cards `focus:outline-none` with no replacement — `/docs/:id/issues` (Kanban view): focused cards are visually indistinguishable from unfocused cards; entire Kanban view is invisible to keyboard users <br> 4. `DashboardSidebar` buttons lack focus styling — all pages: sidebar toggle/navigation buttons have no visible focus style; keyboard users cannot track position in the primary sidebar <br> 5. Combobox dropdowns (Person, Project, Program) — `/documents/:id` (properties sidebar): no explicit `aria-activedescendant` binding or arrow key handler visible; reliable AT navigation through dropdown options is unclear |
| **Color contrast failures** | 1. `/documents/:id`, empty title field — Editor title placeholder: `#8a8a8a` @ 30% opacity over `#0d0d0d` → ~1.6:1 (needs 4.5:1) **FAIL** <br> 2. `/programs`, `/docs/:id` (merge program dialog) — `MergeProgramDialog` search placeholder: `#8a8a8a` @ 50% opacity over `#0d0d0d` → ~3.2:1 (needs 4.5:1) **FAIL** <br> 3. `/my-week`, weekly plan editor — `MyWeekPage` line numbers (`text-muted/50`): `#8a8a8a` @ 50% opacity over `#0d0d0d` → ~3.2:1 (needs 4.5:1) **FAIL** <br> 4. `/settings`, `/programs` — `WorkspaceSettings`/Programs dash (`text-muted/50`): `#8a8a8a` @ 50% opacity over `#0d0d0d` → ~3.2:1 (needs 4.5:1) **FAIL** <br> 5. `/documents/:id`, empty document body — Editor body placeholder (`#525252`) over `#0d0d0d` → ~3.2:1 (needs 4.5:1) **FAIL** <br> 6. Throughout, any page with disabled actions — Disabled buttons (`opacity-50` on `bg-accent`): `#005ea2` @ 50% over `#0d0d0d` → ~1.8:1 (needs 4.5:1) **FAIL** |
| **Missing ARIA labels or roles** | 1. `BacklogPickerModal.tsx:244` — search input missing `aria-label` <br> 2. `MultiAssociationChips.tsx:172` — search input missing `aria-label` <br> 3. `CommandPalette.tsx:254` — search input missing `aria-label` <br> 4. `EmojiPicker.tsx:56` — emoji trigger button missing `aria-label` <br> 5. `PropertyRow.tsx:15` — labels missing `htmlFor`/`id` association with inputs <br> 6. `PropertyRow.tsx:21` — required field indicator missing `aria-describedby` / `aria-required` <br> 7. `BulkActionBar.tsx`, `ApprovalButton.tsx`, `CommandPalette.tsx` (multiple lines) — decorative SVG icons inside labelled buttons missing `aria-hidden="true"` <br> 8. `Editor.tsx` (ProseMirror root) — `aria-expanded="false"` on `role="textbox"`: attribute not allowed on this role |

---

## Improvement Target (for Phase 2)

### Goal A — Raise one lowest-scored page from 91/100 to 100/100

**Target page: Selected Programs – projects view** `/docs/:id/projects` (91/100)

This page shares its score deficit with two other 91/100 pages. It was selected because the projects sub-view of a program is a primary navigation destination and the fixes required are mechanical (ARIA attributes, contrast tokens) with no logic changes.

**Fixes required to reach 100/100:**

#### Fix A1 — Add `aria-hidden="true"` to decorative SVG icons in `BulkActionBar`

**File:** `web/src/components/BulkActionBar.tsx`
**Violation addressed:** Violation #12 above — decorative SVG icons inside labelled buttons produce duplicate announcements.
**Change:** Add `aria-hidden="true"` to each `<svg>` element inside labelled `<button>` elements in `BulkActionBar`. The button's text label or `aria-label` already provides the accessible name; the icon is purely decorative.

#### Fix A2 — Add visible focus ring to `SelectableList` rows

**File:** `web/src/components/SelectableList.tsx` (or equivalent list row component used on the projects sub-view)
**Violation addressed:** Violation in keyboard navigation #2 — focused rows have no visual indicator.
**Change:** Replace or supplement the existing focus style with a visible ring (e.g., `focus-visible:ring-2 focus-visible:ring-blue-500`). Must not use `outline: none` without a replacement.

#### Fix A3 — Replace `text-muted/50` dash character with full-opacity muted colour in Programs/Settings

**File:** `web/src/pages/WorkspaceSettings.tsx` (or wherever the Programs dash text is rendered)
**Violation addressed:** Violation #4 above — `text-muted/50` used as content text with ~3.2:1 contrast.
**Change:** Use a Tailwind token that resolves to at least 4.5:1 on `#0d0d0d` for any visible content text. The `/50` opacity modifier should only be used for decorative or non-informational elements.

---

### Goal B — Fix all critical & serious violations on the 3 most important pages

The three most important pages in Ship, in order of user centrality, are:

1. **`/documents/:id`** — The core document editor. Every authenticated user's primary workflow. Affected by the highest severity and highest count of violations.
2. **`/my-week`** — The main weekly dashboard. The landing page for most sessions. Has content contrast and keyboard navigation violations.
3. **`/projects`** — The projects listing and management view. A primary navigation destination for team leads. Has BulkActionBar and list focus violations.

---

#### Page 1: `/documents/:id` — Document editor

**Violations to fix:**

##### Fix B1 — Remove `aria-expanded` from ProseMirror root `textbox`

**File:** `web/src/components/Editor.tsx`
**Violation:** Critical — `aria-expanded="false"` on `role="textbox"` (aria-allowed-attr). A ProseMirror plugin or extension sets `aria-expanded` on the root `contenteditable` div which carries `role="textbox"`. This attribute is not permitted on `textbox` by the ARIA spec.
**Change:** Locate the ProseMirror extension (likely mention autocomplete or link preview) that sets `aria-expanded` on the editor root and redirect it to set the attribute on the trigger element only (e.g., the combobox or button that opens the autocomplete dropdown), not on the root editor div.

##### Fix B2 — Fix title placeholder contrast from ~1.6:1 to ≥4.5:1

**File:** `web/src/components/Editor.tsx`
**Violation:** Critical — editor title placeholder at `#8a8a8a` 30% opacity produces ~1.6:1 contrast on `#0d0d0d`.
**Change:** Replace the `opacity: 0.3` placeholder colour with a solid colour that achieves ≥4.5:1 on `#0d0d0d`. `#767676` on `#0d0d0d` produces ~4.6:1 and passes AA. Update the relevant Tailwind class or inline style on the title textarea placeholder.

##### Fix B3 — Add `aria-label` to `EmojiPicker` trigger button

**File:** `web/src/components/EmojiPicker.tsx`
**Violation:** Serious — `EmojiPicker.tsx:56` button contains only an emoji character; no `aria-label`.
**Change:** Add `aria-label="Change document icon"` (or equivalent) to the trigger button. The emoji content is decorative in this context; the accessible name should describe the action.

##### Fix B4 — Associate `PropertyRow` labels with inputs

**File:** `web/src/components/PropertyRow.tsx`
**Violation:** Serious — `PropertyRow.tsx:15` labels are not associated with their inputs via `htmlFor`/`id`.
**Change:** Assign a deterministic `id` to each property input (e.g., `property-{fieldName}`) and add a matching `htmlFor` on the label. For inputs that cannot use a `<label>` element directly (comboboxes, custom buttons), use `aria-labelledby` pointing to the label's `id`.

##### Fix B5 — Add `aria-label` to `MultiAssociationChips` search input

**File:** `web/src/components/MultiAssociationChips.tsx`
**Violation:** Serious — `MultiAssociationChips.tsx:172` search input has no accessible label.
**Change:** Add `aria-label="Search associations"` (or a context-specific label derived from the chip group's label, e.g., `aria-label="Search sprints"`) to the inline search input.

---

#### Page 2: `/my-week` — Weekly dashboard

**Violations to fix:**

##### Fix B6 — Fix `MyWeekPage` line number contrast from ~3.2:1 to ≥4.5:1

**File:** `web/src/pages/MyWeekPage.tsx` (line number elements)
**Violation:** Serious — line numbers use `text-muted/50` (`#8a8a8a` at 50% opacity → ~`#4a4a4a`, ~3.2:1 on `#0d0d0d`). These are visible content numbers, not decorative elements, so 4.5:1 is required.
**Change:** Replace `text-muted/50` with a token that produces ≥4.5:1 contrast on the dark background. Use `text-muted` (full opacity `#8a8a8a`) only if the surface is light enough — on `#0d0d0d` it produces ~4.6:1 and passes. Verify the exact surface colour and apply the appropriate solid colour token.

##### Fix B7 — Implement `ArrowLeft`/`ArrowRight` keyboard navigation in `TabBar`

**File:** `web/src/components/TabBar.tsx`
**Violation:** Serious — `TabBar` requires Tab key to move between tabs. WCAG 2.1 SC 2.1.1 and the ARIA tab pattern require Arrow keys for intra-widget navigation.
**Change:** Add a `keydown` handler on the tab list container. On `ArrowRight`, move focus to the next tab (wrapping). On `ArrowLeft`, move focus to the previous tab (wrapping). Tab key should move focus out of the tab list entirely (into the tab panel). This is the standard ARIA roving `tabindex` pattern.

---

#### Page 3: `/projects` — Projects listing

**Violations to fix:**

##### Fix B8 — Add `aria-hidden="true"` to decorative SVG icons in `BulkActionBar` and `ApprovalButton`

**File:** `web/src/components/BulkActionBar.tsx`, `web/src/components/ApprovalButton.tsx`
**Violation:** Serious — decorative `<svg>` icons inside labelled buttons have no `aria-hidden="true"`. Screen readers announce both the icon's derived name and the button label.
**Change:** Add `aria-hidden="true"` to every `<svg>` element that is decorative (i.e., sits inside a button or element that already has an accessible name via text or `aria-label`). This is a purely additive change with no functional impact.

##### Fix B9 — Add visible focus ring to `SelectableList` rows on projects view

**File:** `web/src/components/SelectableList.tsx`
**Violation:** Serious — focused list rows have no visible focus indicator; keyboard users cannot track which row is active.
**Change:** Add `focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500` (or equivalent USWDS token) to the row element's className. Ensure `outline: none` / `outline-remove` is not applied without a replacement.

_Do not fix during audit phase._
