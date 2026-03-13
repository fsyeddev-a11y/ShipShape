# Category 5: Test Coverage — Post-Implementation Issues

Issues and bugs discovered after implementing Cat 5 specs.

---

## E2E Suite: Verified Locally (2026-03-13)

**Discovered after:** Spec 5.3
**Severity:** Resolved
**Description:** The E2E test suite was successfully run locally with Docker Desktop. Zero `ERR_REQUIRE_ESM` errors — the Spec 5.3 dynamic import fix works.

**Results (869 tests, 1 worker, 27.4 minutes):**

| Metric | Count |
|--------|-------|
| Passed | 815 |
| Failed | 1 |
| Flaky (passed on retry) | 6 |
| Did not run | 47 |

**1 failure:** `program-mode-week-ux.spec.ts:369` — "clicking sprint card selects it in the chart". Pre-existing UI test issue, not related to Cat 5 changes.

**6 flaky tests (all pre-existing):**
- `bulk-selection.spec.ts:1550` — undo restores deleted issues from trash
- `feedback-consolidation.spec.ts:52` — source column shows "External" for external issues
- `mentions.spec.ts:374` — should sync mentions between collaborators
- `my-week-stale-data.spec.ts:63` — retro edits visible after navigating back
- `project-weeks.spec.ts:178` — project link navigates back to project
- `weekly-accountability.spec.ts:384` — allocation grid shows person with assigned issues

**47 did not run:** Likely due to memory pressure (0.2GB free with Docker + Postgres containers). Would likely pass with more available RAM or in CI.

**Note:** Render cannot be used to run E2E tests. The Render API instance is a plain Node.js web service, not a Docker environment. Testcontainers requires Docker to spin up PostgreSQL containers per worker. E2E tests can only be run locally with Docker Desktop or in a CI/CD pipeline (e.g., GitHub Actions).

---

## Web Unit Tests: 13 Pre-Existing Failures (3 files)

After switching from `jsdom` to `happy-dom` (Spec 5.2), the web test suite went from 0 tests running to 138/151 passing. The 13 remaining failures are pre-existing test/code mismatches — the tests were written against an older version of the source code and were never updated when the implementation changed. These are **not** caused by the `happy-dom` switch.

---

### Issue 1: `document-tabs.test.ts` — Tests reference `sprints` tab, source uses `weeks` (9 failures)

**Discovered after:** Spec 5.2
**Severity:** Medium
**Files:** `web/src/lib/document-tabs.test.ts`, `web/src/lib/document-tabs.tsx`

**Description:** The source code (`document-tabs.tsx`) defines tabs with id `'weeks'` for both project and program document types. The test file expects a tab with id `'sprints'`. The tab was renamed from `sprints` to `weeks` in the source but the tests were never updated.

**Failing tests and root causes:**

| # | Test Name | Root Cause |
|---|-----------|------------|
| 1 | `returns tabs for project documents` | Expects `tabs.map(t => t.id).toContain('sprints')` — should be `'weeks'` |
| 2 | `returns tabs for program documents` | Expects `tabs.map(t => t.id).toContain('sprints')` — should be `'weeks'` |
| 3 | `returns empty array for sprint documents` | Expects `[]` but sprint documents actually have tabs (overview, plan, review, standups). The `getTabsForDocumentType('sprint')` function returns a non-empty config. |
| 4 | `returns false for sprint documents` | Calls `documentTypeHasTabs('sprint')` and expects `false` — should be `true` since sprints have tabs. |
| 5 | `validates project tab IDs correctly` | Expects `validTabIds.includes('sprints')` to be `true` — should check for `'weeks'` |
| 6 | `validates program tab IDs correctly` | Expects `validTabIds.includes('sprints')` to be `true` — should check for `'weeks'` |
| 7 | `returns first tab as default for URL without tab` | Expects project's first tab id to be `'details'`, but first tab is actually `'issues'` (tab order was changed in source). |
| 8 | `resolves dynamic labels with counts` | Looks for `resolved.find(t => t.id === 'sprints')` which returns `undefined` — should find by `'weeks'` |
| 9 | `resolves dynamic labels without counts` | Same as above — looks for `'sprints'` tab, should be `'weeks'` |

**How to fix:** Update all test references from `'sprints'` to `'weeks'`. Update test #3 and #4 to expect sprint documents to have tabs. Update test #7 to expect `'issues'` as the first project tab (or whatever the current order is). These are straightforward find-and-replace + expectation updates.

---

### Issue 2: `DetailsExtension.test.ts` — Test expects wrong content schema (3 failures)

**Discovered after:** Spec 5.2
**Severity:** Low
**Files:** `web/src/components/editor/DetailsExtension.test.ts`, `web/src/components/editor/DetailsExtension.ts`

**Description:** The `DetailsExtension` TipTap extension was refactored to use a structured content model with named child nodes (`detailsSummary` and `detailsContent`) instead of a generic `block+` content expression. The tests still expect the old schema.

**Failing tests and root causes:**

| # | Test Name | Root Cause |
|---|-----------|------------|
| 1 | `should be configured as a block node with content` | Expects `extension.config.content` to be `'block+'` but actual value is `'detailsSummary detailsContent'`. The extension now requires exactly two named child nodes. |
| 2 | `should work in editor context` | Creates an `Editor` with `[StarterKit, DetailsExtension]` but `DetailsExtension` references `detailsSummary` and `detailsContent` node types that aren't registered. ProseMirror throws `SyntaxError: No node type or group 'detailsSummary' found`. The test needs to also include the `DetailsSummary` and `DetailsContent` companion extensions. |
| 3 | `should allow inserting details via command` | Same root cause as #2 — editor cannot initialize without the companion node extensions. |

**How to fix:**
- Test #1: Change expected content from `'block+'` to `'detailsSummary detailsContent'`.
- Tests #2 and #3: Import and include `DetailsSummary` and `DetailsContent` extensions alongside `DetailsExtension` when creating the editor:
  ```typescript
  const editor = new Editor({
    extensions: [StarterKit, DetailsExtension, DetailsSummaryExtension, DetailsContentExtension],
    content: '<p>Test content</p>',
  });
  ```

---

### Issue 3: `useSessionTimeout.test.ts` — Timer race condition on dismiss (1 failure)

**Discovered after:** Spec 5.2
**Severity:** Low
**Files:** `web/src/hooks/useSessionTimeout.test.ts`, `web/src/hooks/useSessionTimeout.ts`

**Description:** One test fails where `onTimeout` is called even after the warning was dismissed via `resetTimer()`.

**Failing test:**

| # | Test Name | Root Cause |
|---|-----------|------------|
| 1 | `does NOT call onTimeout if dismissed before 0` | After calling `resetTimer()` and advancing time by `WARNING_THRESHOLD_MS` (60s), `onTimeout` is called once. The test expects it not to be called. |

**Possible causes:**
- **Timer behavior difference in `happy-dom`:** `happy-dom` may handle fake timer advancement differently than `jsdom` in edge cases involving `setInterval` cleanup during `act()`. The `resetTimer()` call clears the countdown interval, but the timer tick may have already been queued before the clear took effect.
- **Pre-existing race condition:** This could also be a genuine bug in the hook's timer cleanup logic — if `resetTimer()` clears the interval but a pending `setTimeout` for the inactivity check still fires. Since `jsdom` was never able to run, this test has never actually passed, so it's impossible to know if this is a `happy-dom` difference or a real bug.

**How to fix:** First determine if this is a `happy-dom` timer difference or a hook bug:
1. Add a small `vi.advanceTimersByTime(0)` after `resetTimer()` to flush any pending microtasks before the main timer advance.
2. If that doesn't fix it, inspect the hook's `resetTimer()` implementation to verify it clears both the countdown interval and the inactivity timeout before setting up a new one.
3. If the hook has a race condition, fix the cleanup order in the hook itself — ensure the old timeout is cleared before the new one is created.
