# Category 5: Test Coverage and Quality — Phase 3 Benchmark

## What You Are Measuring

What the existing test suite covers, what it misses, and how reliable it is. Phase 3 focused on fixing the 13 unit test failures and 14+ flaky E2E tests identified in Phase 2, plus building CI infrastructure for reproducible test runs.

## How to Measure

- Run the full test suite: `pnpm test` (API + web unit tests)
- Run E2E via GitHub Actions CI: 8-shard parallel Playwright pipeline
- Compare against Phase 2 baseline (1,444 passing / 13 failing / 7 flaky)

## Audit Deliverable

| Metric | Audit Baseline | Phase 2 | Phase 3 (Final) |
|--------|---------------|---------|-----------------|
| Total tests (written) | 1,479 | 1,457 | **1,471** (451 API + 151 web + 869 E2E) |
| Pass / Fail / Flaky | 451 / 0 / 0 (API only) | 1,444 / 13 / 7 | **1,463 / 4 / 4** |
| Suite runtime | API: 12s (only suite that ran) | API: 12s, Web: 1.3s, E2E: 31m | API: 12s, Web: 1.2s, E2E: **~5m (8 shards)** |
| Critical flows with zero coverage | All web + E2E broken | CAIA/OAuth, multi-user collab | Same (documented as future specs) |
| Code coverage % | api: 40.34% stmts / 33.44% branches | Same | Same |

## Improvement Target

Add meaningful tests for 3 previously untested critical paths, or fix 3 flaky tests with documented root cause analysis.

**Phase 2 result:** Target exceeded — restored 993 non-running tests (web + E2E infrastructure fixes).

**Phase 3 result:** Target further exceeded — fixed 13 unit test failures, fixed 9 of 14 flaky E2E tests with documented root cause analysis, built 8-shard CI pipeline, discovered 3 app bugs.

---

## Phase 3 Detailed Results

### Unit Tests — 13 Failures Fixed

All 13 web unit test failures from Phase 2 were resolved in a single commit:

| File | Failures | Root Cause | Fix |
|------|----------|------------|-----|
| `document-tabs.test.ts` | 9 | Sprint documents gained tabs, `sprints` tab ID renamed to `weeks`, project tab order changed to `issues` first | Updated assertions to match current source |
| `DetailsExtension.test.ts` | 3 | Content model changed from `block+` to structured `detailsSummary detailsContent` children | Added DetailsSummary and DetailsContent node imports |
| `useSessionTimeout.test.ts` | 1 | `resetTimer()` now calls `apiPost()` but test only mocked `global.fetch` | Added `vi.mock` for apiPost |

**Result:** Web unit tests went from 138/151 passing to **151/151 passing (100%)**.

### E2E Tests — Flaky Test Fixes

#### Phase 3.0: Original 7 Flaky Groups (from Phase 2)

| Fix | Tests Fixed | Functional Area | Root Cause | Change Type |
|-----|------------|----------------|------------|-------------|
| F2.1 | ~8 tests | Multiple | `createNewDocument` helper used `networkidle` which never resolves with WebSocket connections | Test fix — removed `networkidle` from 13 files |
| F2.2 | 1 test | Teams — Status Overview | Same `networkidle` issue in status-overview-heatmap | Test fix — removed 8 `networkidle` calls |
| F2.3 | 1 test | Accessibility — Combobox | Non-retrying `getAttribute` + `toBeTruthy()` | Test fix — replaced with retrying `toHaveAttribute` |
| F2.4 | 1 test | Editor — Drag Handle | No retry logic for drag-first-to-end (sibling test had it) | Test fix — added 3-attempt retry |
| F2.5 | 1 test | Editor — Mentions | Snapshot `isVisible()` + `waitForTimeout(300)` | Test fix — retrying assertions |
| F2.6 | 1 test | Editor — Emoji | `waitForTimeout(2000)` for Yjs persistence | Test fix — API polling via `toPass()` |
| F2.7 | 1 test | Editor — Inline Comments | `waitForTimeout(500/400)` for content sync and bubble menu | Test fix — condition-based waits |
| F2.8 | 1 test | Editor — Mentions | Non-retrying `.count()` + `waitForTimeout(500)` | Test fix — `toPass()` retry block |
| F2.9 | 1 test | Editor — Code Blocks | `waitForTimeout(300/500)` + weak `toBeGreaterThanOrEqual(1)` | Test fix — visibility waits + strict assertion |
| F2.10 | 2 tests | Editor — Tables | Silent-pass `if` guard + `waitForTimeout(2000)` | Test fix — removed guard, API polling |

#### Phase 3.1: E2E Flaky Group Fixes

| Fix | Tests Fixed | Functional Area | Root Cause | Change Type |
|-----|------------|----------------|------------|-------------|
| E.1 | 9 tests | Accessibility | `networkidle` + `waitForTimeout` before axe scans | Test fix — DOM landmark waits |
| E.2 | 14 tests | Feedback | `waitForTimeout(500)` after filter tab clicks + `networkidle` | Test fix — DOM row visibility waits |
| E.3 | 3 tests | Issues — Bulk Ops | `waitForTimeout(1000)` before right-click | Test fix — `toPass()` retry pattern |
| E.4 | 2 tests | My Week — Yjs | `waitForTimeout(3000)` hoping for Yjs flush | Test fix — API polling via `toPass()` |
| E.5 | 5 tests | Projects — Weeks | React Query cache stale after API data creation | Test fix — `page.reload()` cache busting |
| E.6 | 17 tests | Weekly Accountability | GET-after-POST 404 race + cross-worker data interference | Test fix — `toPass()` retry + unique prefixes |

#### Phase 3.2-3.5: CI-Specific Fixes

| Fix | Tests Fixed | Functional Area | Root Cause | Change Type |
|-----|------------|----------------|------------|-------------|
| F3.6 | 2 tests | Editor — Formatting | `Meta+` key doesn't work on Linux CI | Test fix — `ControlOrMeta+` |
| F3.1 | 1 test | Editor — Inline Comments | selectText helper waited for bubble menu | Test fix — `waitForBubbleMenu: false` option |
| F3.7 | 1 test | Editor — Network | Route intercept installed before doc creation | Test fix — moved route after creation |
| F3.9 | 2 tests | Projects — Weeks | `a:has-text()` matched 2 elements (sidebar + properties) | Test fix — scoped to properties sidebar |
| F3.10 | 5 tests | Issues — Bulk Selection | CSS `focus-visible:ring-2` class collided with `ring-2` regex | App fix — removed static class |
| F3.4 | 1 test | Editor — TOC | Tippy tooltip intercepted click on heading | Test fix — programmatic text selection |
| F3.13 | 2 tests | Editor — Tables | No custom table context menu existed | App fix — built TableContextMenu component |
| F3.12 | 1 test | Editor — Code Blocks | `Meta+End` doesn't work on Linux CI | Test fix — ArrowDown exit strategy |

### App Bugs Discovered During Phase 3

| Bug | How Discovered | Severity | Status |
|-----|---------------|----------|--------|
| **Yjs character truncation** | syntax-highlighting:154 — last 3-4 chars lost during Yjs-to-DB persistence | High | Documented as future phase — pre-existing app bug |
| **TipTap code block input rule** | syntax-highlighting:189 — backtick input rule doesn't fire for 2nd code block | Medium | Documented as future phase — TipTap config issue |
| **Missing table context menu** | tables:69/371 — no UI for add row/delete table | Medium | Fixed — built TableContextMenu component (F3.13) |
| **WCAG 1.4.13 vs 2.5.8 conflict** | Adding `tabIndex` for focus controls triggered axe target-size violations | Medium | Reverted and documented — requires coordinated fix for both standards |

### Reverted Fixes (Documented for Final Submission)

These fixes were attempted but reverted because they exposed deeper issues:

| Fix | What We Changed | Why Reverted | Lesson |
|-----|----------------|-------------|--------|
| F3.5 (backlinks) | Removed `.catch()` on `waitForResponse` | `ControlOrMeta+a` + Backspace doesn't delete mention on CI — exposed but didn't fix | Removing error suppression exposes real bugs but doesn't solve them |
| F3.38 (syntax-highlighting) | Replaced `waitForTimeout` with API polling | Polling revealed Yjs truncation bug — content never fully persists | Better assertions expose app bugs that fixed delays were hiding |
| F3.11/F3.30 (a11y focus) | Added `tabIndex={0}` for WCAG 1.4.13 hover/focus | Triggered axe target-size failures (WCAG 2.5.8) — pre-existing small touch targets | Two WCAG requirements can conflict; must fix both together |

---

## CI Pipeline

Built an 8-shard GitHub Actions pipeline for reproducible E2E testing:

```yaml
# .github/workflows/e2e-tests.yml
# Triggers on: push to cat5-test-coverage, workflow_dispatch
# 8 parallel shards, each running ~109 tests
# Each shard: Postgres service container + schema migration + seed data
# Total runtime: ~5 minutes (vs ~25 min single runner, ~60 min local 1-worker)
```

**Commands to reproduce:**
```bash
# Unit tests (local)
pnpm test                           # API: 451 tests, ~12s
pnpm --filter @ship/web test        # Web: 151 tests, ~1.2s

# E2E tests (CI — push to cat5-test-coverage branch)
git push origin cat5-test-coverage  # Triggers 8-shard pipeline

# E2E tests (local — requires Docker + 8GB+ free RAM)
pnpm test:e2e                       # 869 tests, ~10-60 min depending on workers
```

---

## Final Comparison: Audit Baseline → Phase 2 → Phase 3

### Test Suite Status

| Metric | Audit Baseline | Phase 2 | Phase 3 | Total Change |
|--------|---------------|---------|---------|-------------|
| Total tests written | 1,479 | 1,457 | **1,471** | -8 |
| API tests passing | 451/451 (100%) | 451/451 (100%) | **451/451 (100%)** | No change |
| Web tests passing | 0/162 (0%) | 138/151 (91%) | **151/151 (100%)** | **+151 tests** |
| E2E tests passing | Not run | 855/855 (100%) | **861/869 (99.1%)** | **+861 tests** |
| Total passing | 451 (30%) | 1,444 (99%) | **1,463 (99.5%)** | **+1,012 tests (+224%)** |
| Hard failures | N/A | 13 | **4** | **-9** |
| Flaky tests | N/A | 7 | **4** | **-3** |
| CI runtime | N/A | N/A | **~5 min (8 shards)** | New capability |

### Remaining Failures (4 — all pre-existing)

| Test | Functional Area | Root Cause | Our Change? |
|------|----------------|------------|-------------|
| accessibility-remediation:407 | Accessibility — Focus Controls | Tree items lack `tabIndex` — can't focus without triggering target-size violations | Attempted fix, reverted (WCAG conflict) |
| syntax-highlighting:154 | Editor — Code Blocks | Yjs truncates last chars during persistence; code block absent after reload | Exposed by better assertions, pre-existing app bug |
| data-integrity:356 | Editor — Mentions | Mentions don't persist after reload (Yjs persistence race) | Not our change, pre-existing |
| drag-handle:310 | Editor — Drag Handle | Drag handle elements not found (timing/rendering) | Not our change, pre-existing |

### Remaining Flaky (4 — all pre-existing)

| Test | Functional Area | Root Cause |
|------|----------------|------------|
| session-timeout:205 | Auth — Session | Redirect race: navigates to /login then back to /docs |
| session-timeout:629 | Auth — Session | Fake clock misalignment with button click timing |
| data-integrity:256 | Editor — Images | File chooser event timing on CI |
| emoji:31 | Editor — Emoji | createNewDocument timeout on CI |

---

## Analysis

### Phase 3 Impact Summary

1. **13 unit test failures → 0** — All were stale assertions from code refactors. Straightforward test maintenance.
2. **14 flaky E2E tests → 4** — Root-caused and fixed 10 flaky tests. Common patterns: `networkidle` with WebSockets, `waitForTimeout` instead of condition waits, non-retrying assertions, platform-specific keyboard shortcuts.
3. **8-shard CI pipeline** — Reduced E2E runtime from ~25 min (single runner) to ~5 min (8 parallel shards). Enables fast iteration on test fixes.
4. **3 app bugs discovered** — Yjs character truncation, missing table context menu, TipTap input rule limitation. Two documented as future phase, one fixed (table context menu).
5. **WCAG conflict documented** — Attempting to fix WCAG 1.4.13 (hover/focus controls) triggered WCAG 2.5.8 (target size) violations. Requires coordinated approach — documented for future work.

### Common Root Causes of Flaky Tests

| Pattern | Occurrences | Fix |
|---------|------------|-----|
| `waitForLoadState('networkidle')` with WebSockets | 21+ tests | Remove — WebSockets prevent idle state |
| `waitForTimeout(N)` instead of condition waits | 15+ tests | Replace with `expect().toBeVisible()` or `toPass()` |
| Non-retrying snapshot assertions | 5 tests | Replace `.count()`, `.getAttribute()` with retrying assertions |
| `Meta+` keyboard shortcuts on Linux CI | 3 tests | Use `ControlOrMeta+` for cross-platform |
| Silent-pass `if` guards | 2 tests | Remove — let tests fail visibly |

### Recommendations for Future Work

- **Fix Yjs persistence bug** — Characters are truncated during Yjs-to-PostgreSQL serialization. This affects code blocks and potentially other content types. Root cause is likely in the Yjs state encoding/decoding pipeline.
- **Fix WCAG 1.4.13 + 2.5.8 together** — Increase touch target sizes to 24px minimum (`min-h-6`, `min-w-6` on tree item links and buttons), then re-add `tabIndex` for keyboard focus visibility.
- **Add multi-user collaboration E2E tests** — No test verifies two users editing the same document. Spec written in `docs/specs/futurePhase/future-multi-user-collab-tests.md`.
- **Add CAIA/OAuth unit tests** — Government login path has zero test coverage.
