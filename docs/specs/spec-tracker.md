# ShipShape — Spec Tracker

All specs derived from the [audit report](../audit/audit-report.md) and human audit findings. Grouped by phase, then by audit category.

**Corrected baselines:** Where the automated audit diverges from the human audit, the human audit numbers are used (e.g., 22 queries for main page load, not 25).

---

# Phase 2 — Optimization Fixes (Complete)

29 specs across 7 categories. All implemented and merged to master.

## Category 5 — Test Coverage (Highest Priority)

| # | Spec | Summary | Severity | Status |
|---|------|---------|----------|--------|
| 5.1 | ~~[E2E ESM/CJS Fix](phase2/cat5-e2e-esm-fix.md)~~ | ~~Pin `get-port` to 6.1.2~~ — Deprecated, see 5.3 | High | Deprecated |
| 5.2 | [Web Unit Test ESM/CJS Fix](phase2/cat5-web-unit-test-fix.md) | Switch from `html-encoding-sniffer` to `happy-dom` | High | Done |
| 5.3 | [E2E Dynamic Import Fix](phase2/cat5-e2e-dynamic-import-fix.md) | Use dynamic `import()` for `get-port` to fix ERR_REQUIRE_ESM | High | Done |

## Category 2 — Bundle Size

| # | Spec | Summary | Severity | Status |
|---|------|---------|----------|--------|
| 2.1 | [Move react-query-devtools](phase2/cat2-devtools-to-devdeps.md) | Move to devDependencies + NODE_ENV guard | High | Done |
| 2.2 | [Route-Level Code Splitting](phase2/cat2-route-level-splitting.md) | Convert static route imports to React.lazy() | Medium-High | Done |
| 2.3 | [Lazy-Load Emoji Picker](phase2/cat2-lazy-emoji-picker.md) | Dynamic import on popover open | Medium-High | Done |
| 2.4 | [Lazy-Load highlight.js](phase2/cat2-lazy-highlightjs.md) | Dynamic import on code block render | Medium-High | Done |
| 2.5 | [Lazy-Load Editor Extensions](phase2/cat2-lazy-editor-extensions.md) | Deferred loading of FileAttachment + ImageUpload TipTap extensions | Medium | Done |

## Category 3 — API Response Time

| # | Spec | Summary | Severity | Status |
|---|------|---------|----------|--------|
| 3.1 | [Remove content from issues list](phase2/cat3-issues-remove-content.md) | Drop d.content from GET /api/issues SELECT | High | Done |
| 3.2 | [Increase pg-pool max connections](phase2/cat3-pgpool-max.md) | Raise pool max from 10 to 25 | High | Done |
| 3.3 | [Issues pagination](phase2/cat3-issues-pagination.md) | Add cursor-based pagination to GET /api/issues | Medium-High | Done |

## Category 4 — Database Query Efficiency

| # | Spec | Summary | Severity | Status |
|---|------|---------|----------|--------|
| 4.1 | [Auth Query Consolidation](phase2/cat4-auth-query-consolidation.md) | Combine token+workspace into 1 query, throttle last_used_at, dedupe sprint_start_date | High | Done |
| 4.2 | [Issues List Remove person_doc JOIN](phase2/cat4-issues-remove-person-join.md) | Move archived-assignee check to single-issue view only | High | Done |
| 4.3 | [Wiki Index Fix](phase2/cat4-wiki-index-fix.md) | Fix deleted_at partial condition so idx_documents_active is usable | Medium-High | Done |
| 4.4 | [Assignee Functional Index](phase2/cat4-assignee-functional-index.md) | Add btree index on (properties->>'assignee_id') | Medium | Done |
| 4.5 | [Scope-Changes N+1 Batch](phase2/cat4-scope-changes-batch.md) | Replace loop query with WHERE id = ANY($1) | Medium | Done |

## Category 1 — Type Safety (1,417 total violations)

| # | Spec | Summary | Severity | Status |
|---|------|---------|----------|--------|
| 1.1 | [DB Row Types for Route Handlers](phase2/cat1-db-row-types.md) | Add typed interfaces for projects.ts, weeks.ts DB rows | High | Done |
| 1.2 | [Discriminated Union for Document Types](phase2/cat1-discriminated-union.md) | Replace unsafe `as` casts in UnifiedEditor/PropertiesPanel | High | Done |
| 1.3 | [Type Yjs Conversion Pipeline](phase2/cat1-type-yjs-converter.md) | Add TipTap JSON schema types to yjsConverter.ts | Medium | Done |
| 1.4 | [Align Web TSConfig](phase2/cat1-align-web-tsconfig.md) | Add noUncheckedIndexedAccess + noImplicitReturns to web | Medium | Done |

## Category 6 — Runtime Error Handling

| # | Spec | Summary | Severity | Status |
|---|------|---------|----------|--------|
| 6.1 | [Root ErrorBoundary](phase2/cat6-root-error-boundary.md) | Add ErrorBoundary wrapping all providers in main.tsx | High | Done |
| 6.2 | [WebSocket Backoff + 429 Handling](phase2/cat6-ws-backoff-429.md) | Exponential backoff for useRealtimeEvents + 429 awareness | High | Done |
| 6.3 | [WS Rate Limit Connection Tracking](phase2/cat6-ws-rate-limit-tracking.md) | Remove closed connections from rate limit counter | High | Done |
| 6.4 | [Title maxLength Guard](phase2/cat6-title-maxlength.md) | Add maxLength={255} + character counter to title textarea | Medium | Done |
| 6.5 | [Silent Save Failure Handling](phase2/cat6-silent-save-failure.md) | Surface ROLLBACK errors + DB save failures to users | Medium | Done |
| 6.6 | [Title Real-Time Sync Failure](phase2/cat6-title-realtime-sync.md) | Broadcast title changes via /events WebSocket + fix useAutoSave throttle double-fire | Medium-High | Done |

## Category 7 — Accessibility

| # | Spec | Summary | Severity | Status |
|---|------|---------|----------|--------|
| 7.1 | [Document Page A11y Fixes](phase2/cat7-document-page-fixes.md) | Fix ProseMirror aria-expanded, title contrast, ARIA labels, PropertyRow labels | Critical/Serious | Done |
| 7.2 | [My-Week A11y Fixes](phase2/cat7-my-week-fixes.md) | Fix line number contrast, TabBar arrow key navigation | Serious | Done |
| 7.3 | [Projects Page A11y Fixes](phase2/cat7-projects-page-fixes.md) | SVG aria-hidden, focus rings on SelectableList | Serious | Done |

---

# Phase 3 — Test Stability Fixes (In Progress)

13 unit test failures and 7 flaky E2E test groups discovered during Phase 2 benchmarking. None are regressions from Phase 2 — they are stale assertions and timing-based flakiness.

## Unit Test Failures (13 failures, 5 specs)

| # | Spec | File | Failures | Root Cause | Status |
|---|------|------|----------|------------|--------|
| T.1 | [Sprint Tabs Added](phase3/fix-document-tabs-sprint-tabs.md) | `document-tabs.test.ts` | 2 | Sprint tabs added to source; tests still expect empty | Todo |
| T.2 | [Sprints → Weeks Rename](phase3/fix-document-tabs-sprints-to-weeks.md) | `document-tabs.test.ts` | 5 | Tab ID `sprints` renamed to `weeks`; tests use old name | Todo |
| T.3 | [Project Tab Order](phase3/fix-document-tabs-project-tab-order.md) | `document-tabs.test.ts` | 2 | Tab order changed (`issues` first); tests assert old order | Todo |
| T.4 | [DetailsExtension Content Model](phase3/fix-details-extension-tests.md) | `DetailsExtension.test.ts` | 3 | Content model changed to structured children; tests missing child nodes | Todo |
| T.5 | [Session Timeout Mock](phase3/fix-session-timeout-tests.md) | `useSessionTimeout.test.ts` | 1 | `resetTimer()` calls `apiPost`; test only mocks `global.fetch` | Todo |

## Flaky E2E Tests (7 groups)

| # | Spec | File | Tests | Root Cause | Status |
|---|------|------|-------|------------|--------|
| E.1 | [Accessibility E2E](phase3/fix-accessibility-e2e-flakiness.md) | `accessibility-*.spec.ts` | 55+ | 102 timing calls (`waitForTimeout` + `networkidle`) | Todo |
| E.2 | [Feedback E2E](phase3/fix-feedback-e2e-flakiness.md) | `feedback-consolidation.spec.ts` | 14 | Serial state mutation + `waitForTimeout(500)` | Todo |
| E.3 | [Issues Bulk Ops E2E](phase3/fix-issues-bulk-ops-e2e-flakiness.md) | `issues-bulk-operations.spec.ts` | 3 | `waitForTimeout(1000)` before context menu clicks | Todo |
| E.4 | [My-Week Stale Data E2E](phase3/fix-my-week-stale-data-flakiness.md) | `my-week-stale-data.spec.ts` | 2 | Yjs-to-DB async persistence race condition | Todo |
| E.5 | [Project Weeks E2E](phase3/fix-project-weeks-e2e-flakiness.md) | `project-weeks.spec.ts` | 5 | API data creation → UI navigation cache timing | Todo |
| E.6 | [Weekly Accountability E2E](phase3/fix-weekly-accountability-e2e-flakiness.md) | `weekly-accountability.spec.ts` | 17 | Multi-step API setup chain cascade | Todo |

---

# Future Phase — Performance Optimizations (Planned)

Additional optimizations identified during audit but deferred from Phase 2.

| # | Spec | Summary | Category | Status |
|---|------|---------|----------|--------|
| F.1 | [Parallelize Dashboard Queries](futurePhase/future-parallelize-dashboard.md) | Promise.all() for sequential my-week queries | Cat 3 | Planned |
| F.2 | [Issues Sequential Query Batch](futurePhase/future-issues-query-batch.md) | Parallelize issues + associations queries | Cat 3 | Planned |
| F.3 | [API Token Hash Index](futurePhase/future-token-hash-index.md) | Add index on api_tokens.token_hash | Cat 3/4 | Planned |
| F.4 | [Throttle last_used_at UPDATE](futurePhase/future-throttle-last-used.md) | Throttle to once per minute (auth overhead at scale) | Cat 3/4 | Planned |

---

## Render Database Strategy

Two PostgreSQL instances on Render:

1. **Baseline DB** — Untouched, matches the original `master` code. Used for re-running benchmarks and comparing before/after metrics across all categories.
2. **Working DB** — Shared across all category branches. Only Category 4 introduces DB schema changes (two additive indexes in specs 4.3 and 4.4), which are non-destructive and don't require rollback.

All other categories (1, 2, 3, 5, 6, 7) are code-only changes and share the working DB safely.
