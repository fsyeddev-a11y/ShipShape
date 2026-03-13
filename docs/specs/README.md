# Phase 2 Fix Specs

Specs derived from the [audit report](../../audit/audit-report.md) and previous human audit findings. Grouped by audit category, ordered by priority within each group.

**Corrected baselines:** Where the automated audit diverges from the human audit, the human audit numbers are used (e.g., 22 queries for main page load, not 25).

---

## Category 5 — Test Coverage (Highest Priority)

| # | Spec | Summary | Severity |
|---|------|---------|----------|
| 5.1 | ~~[E2E ESM/CJS Fix](cat5-e2e-esm-fix.md)~~ | ~~Pin `get-port` to 6.1.2~~ — Deprecated, see 5.3 | High |
| 5.2 | [Web Unit Test ESM/CJS Fix](cat5-web-unit-test-fix.md) | Switch from `html-encoding-sniffer` to `happy-dom` | High |
| 5.3 | [E2E Dynamic Import Fix](cat5-e2e-dynamic-import-fix.md) | Use dynamic `import()` for `get-port` to fix ERR_REQUIRE_ESM | High |

## Category 2 — Bundle Size

| # | Spec | Summary | Severity |
|---|------|---------|----------|
| 2.1 | [Move react-query-devtools](cat2-devtools-to-devdeps.md) | Move to devDependencies + NODE_ENV guard | High |
| 2.2 | [Route-Level Code Splitting](cat2-route-level-splitting.md) | Convert static route imports to React.lazy() | Medium-High |
| 2.3 | [Lazy-Load Emoji Picker](cat2-lazy-emoji-picker.md) | Dynamic import on popover open | Medium-High |
| 2.4 | [Lazy-Load highlight.js](cat2-lazy-highlightjs.md) | Dynamic import on code block render | Medium-High |
| 2.5 | [Lazy-Load Editor Extensions](cat2-lazy-editor-extensions.md) | Deferred loading of FileAttachment + ImageUpload TipTap extensions | Medium |

## Category 3 — API Response Time

| # | Spec | Summary | Severity |
|---|------|---------|----------|
| 3.1 | [Remove content from issues list](cat3-issues-remove-content.md) | Drop d.content from GET /api/issues SELECT | High |
| 3.2 | [Increase pg-pool max connections](cat3-pgpool-max.md) | Raise pool max from 10 to 25 | High |
| 3.3 | [Issues pagination](cat3-issues-pagination.md) | Add cursor-based pagination to GET /api/issues | Medium-High |

## Category 4 — Database Query Efficiency

| # | Spec | Summary | Severity |
|---|------|---------|----------|
| 4.1 | [Auth Query Consolidation](cat4-auth-query-consolidation.md) | Combine token+workspace into 1 query, throttle last_used_at, dedupe sprint_start_date | High |
| 4.2 | [Issues List Remove person_doc JOIN](cat4-issues-remove-person-join.md) | Move archived-assignee check to single-issue view only | High |
| 4.3 | [Wiki Index Fix](cat4-wiki-index-fix.md) | Fix deleted_at partial condition so idx_documents_active is usable | Medium-High |
| 4.4 | [Assignee Functional Index](cat4-assignee-functional-index.md) | Add btree index on (properties->>'assignee_id') | Medium |
| 4.5 | [Scope-Changes N+1 Batch](cat4-scope-changes-batch.md) | Replace loop query with WHERE id = ANY($1) | Medium |

## Category 1 — Type Safety (1,417 total violations)

| # | Spec | Summary | Severity |
|---|------|---------|----------|
| 1.1 | [DB Row Types for Route Handlers](cat1-db-row-types.md) | Add typed interfaces for projects.ts, weeks.ts DB rows | High |
| 1.2 | [Discriminated Union for Document Types](cat1-discriminated-union.md) | Replace unsafe `as` casts in UnifiedEditor/PropertiesPanel | High |
| 1.3 | [Type Yjs Conversion Pipeline](cat1-type-yjs-converter.md) | Add TipTap JSON schema types to yjsConverter.ts | Medium |
| 1.4 | [Align Web TSConfig](cat1-align-web-tsconfig.md) | Add noUncheckedIndexedAccess + noImplicitReturns to web | Medium |

## Category 6 — Runtime Error Handling

| # | Spec | Summary | Severity |
|---|------|---------|----------|
| 6.1 | [Root ErrorBoundary](cat6-root-error-boundary.md) | Add ErrorBoundary wrapping all providers in main.tsx | High |
| 6.2 | [WebSocket Backoff + 429 Handling](cat6-ws-backoff-429.md) | Exponential backoff for useRealtimeEvents + 429 awareness | High |
| 6.3 | [WS Rate Limit Connection Tracking](cat6-ws-rate-limit-tracking.md) | Remove closed connections from rate limit counter | High |
| 6.4 | [Title maxLength Guard](cat6-title-maxlength.md) | Add maxLength={255} + character counter to title textarea | Medium |
| 6.5 | [Silent Save Failure Handling](cat6-silent-save-failure.md) | Surface ROLLBACK errors + DB save failures to users | Medium |

## Category 7 — Accessibility

| # | Spec | Summary | Severity |
|---|------|---------|----------|
| 7.1 | [Document Page A11y Fixes](cat7-document-page-fixes.md) | Fix ProseMirror aria-expanded, title contrast, ARIA labels, PropertyRow labels | Critical/Serious |
| 7.2 | [My-Week A11y Fixes](cat7-my-week-fixes.md) | Fix line number contrast, TabBar arrow key navigation | Serious |
| 7.3 | [Projects Page A11y Fixes](cat7-projects-page-fixes.md) | SVG aria-hidden, focus rings on SelectableList | Serious |

---

## Render Database Strategy

Two PostgreSQL instances are required on Render:

1. **Baseline DB** — Untouched, matches the original `master` code. Used for re-running benchmarks and comparing before/after metrics across all categories.
2. **Working DB** — Shared across all category branches. Only Category 4 introduces DB schema changes (two additive indexes in specs 4.3 and 4.4), which are non-destructive and don't require rollback.

All other categories (1, 2, 3, 5, 6, 7) are code-only changes and share the working DB safely.

---

## Future Phase Specs

| # | Spec | Summary | Category |
|---|------|---------|----------|
| F.1 | [Parallelize Dashboard Queries](future-parallelize-dashboard.md) | Promise.all() for sequential my-week queries | Cat 3 |
| F.2 | [Issues Sequential Query Batch](future-issues-query-batch.md) | Parallelize issues + associations queries | Cat 3 |
| F.3 | [API Token Hash Index](future-token-hash-index.md) | Add index on api_tokens.token_hash | Cat 3/4 |
| F.4 | [Throttle last_used_at UPDATE](future-throttle-last-used.md) | Throttle to once per minute (auth overhead at scale) | Cat 3/4 |
