# Future Spec: Remaining Test Failures & Flaky Tests

Tests that require app code changes, major refactoring, or complex timing fixes beyond simple test adjustments.

## Hard Failures Requiring App Code Changes

### Bulk Selection Focus Management (5 tests)
- bulk-selection.spec.ts:356 — arrow down moves focus to next row
- bulk-selection.spec.ts:382 — arrow up moves focus to previous row
- bulk-selection.spec.ts:751 — j key moves focus to first/next item
- bulk-selection.spec.ts:784 — k key moves focus to previous item
- bulk-selection.spec.ts:884 — hovering over row sets keyboard focus

**Root cause:** All 5 tests fail because the app's focus management for keyboard navigation (arrow keys and vim-style j/k) doesn't reliably move focus to table rows. This is a pre-existing issue — these tests failed before Phase 3 changes. Fixing requires changes to the focus management logic in the bulk selection/issues list components, not just test timing adjustments.

**Effort:** Medium-High. Requires understanding the React focus management in the issues table, possibly using `tabIndex`, `aria-activedescendant`, or a custom focus manager.

### Accessibility: Hover Controls on Focus (1 test)
- accessibility-remediation.spec.ts:407 — controls shown on hover are also shown on focus

**Root cause:** The app shows certain controls (edit buttons, action menus) only on hover via CSS `:hover`. WCAG 1.4.13 requires these controls to also appear on keyboard focus. This is a feature gap — the app needs to add `:focus-within` or JavaScript-based focus detection alongside the hover styles.

**Effort:** Medium. Each hover-only control needs a corresponding focus trigger. Could be a systematic CSS fix or per-component JavaScript changes.

## Flaky Tests Requiring Investigation

### Timing-Dependent Tests (CI-only flakiness)
These tests pass locally but fail intermittently on CI due to slower execution. They may need app-side throttle/debounce adjustments or more robust state management, not just test timing fixes.

| Test | File:Line | Root Cause |
|------|-----------|------------|
| Multiple images persist in order | data-integrity.spec.ts:256 | Yjs persistence ordering race — images may persist out of order under load |
| Alt text from filename | images.spec.ts:307 | File upload + metadata extraction timing |
| Enter estimate as free text | issue-estimates.spec.ts:34 | Input blur/commit timing |
| Archive via context menu | issues-bulk-operations.spec.ts:42 | Context menu retry still flaky — may need app-side menu registration timing fix |
| Retro edits visible on /my-week | my-week-stale-data.spec.ts:68 | Yjs persistence race improved but not eliminated — fundamental async persistence issue |
| Many images don't crash editor | performance.spec.ts:365 | Memory pressure on CI runners, may need image lazy-loading |
| Clicking sprint card selects it | program-mode-week-ux.spec.ts:369 | Chart animation/rendering timing |
| Double-clicking sprint navigates | program-mode-week-ux.spec.ts:389 | Double-click detection + navigation race |
| Rapid save no conflict | race-conditions.spec.ts:70 | Yjs save debounce timing under load |
| Expired message after logout | session-timeout.spec.ts:225 | App redirect may not always include `expired=true` param — needs app code investigation |
| Clicking retro cell navigates | status-overview-heatmap.spec.ts:104 | Seed data may not create retro documents for all weeks — needs seed data adjustment |
| Collapse program header | team-mode.spec.ts:381 | "Unassigned N" button text assumption may not match app's actual UI text |
| Source=internal retained | feedback-consolidation.spec.ts:302 | Table pagination/lazy-loading may hide the target row |

**Priority:** Low-Medium. These are intermittent CI failures that don't affect production. Fix as time allows, prioritizing the Yjs persistence issues (data-integrity, my-week, race-conditions) since they share a common root cause.
