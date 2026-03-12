# Ship Codebase Audit Report

**Date:** 2026-03-11
**Scope:** `api/src/`, `web/src/`, `shared/src/`, `e2e/`
**Branch:** `master`
**Auditor:** Claude Code (automated + manual verification)

All 7 categories are baselined here. Individual category files with full methodology, EXPLAIN ANALYZE plans, and raw benchmark data are archived in `audit/01-*.md` through `audit/07-*.md`.

---

## Category 1 — Type Safety

| Metric | Baseline |
|--------|----------|
| Total violations | **1,417** |
| Explicit `any` types | **392** |
| Type assertions (`as`) | **280** |
| Non-null assertions (`!`) | **35** |
| Implicit `any` (untyped params, returns, missing generics) | **~709** |
| `@ts-ignore` / `@ts-expect-error` | **0 / 1** |
| Strict mode enabled | Yes (all packages) |
| Top violation-dense files | `UnifiedEditor.tsx` (25 `as`), `projects.ts` (18 `any`), `yjsConverter.ts` (15 `any`), `PropertiesPanel.tsx` (13 `as`), `y-protocols.d.ts` (13 `any`) |

### Top Findings

| # | Finding | Severity |
|---|---------|----------|
| 1 | Unsafe document subtype casting in `UnifiedEditor.tsx` and `PropertiesPanel.tsx` — no discriminated union or type guards; runtime crashes if document shape diverges | High |
| 2 | `any` throughout API route handlers for DB rows (`projects.ts`, `weeks.ts`) — schema changes invisible to compiler | High |
| 3 | ~709 implicit `any` violations from untyped function parameters, missing return types, and unparameterized generics | High |
| 4 | Yjs conversion pipeline fully untyped (`yjsConverter.ts`) — malformed CRDT data reaches the editor silently | Medium |
| 5 | `web/tsconfig.json` missing `noUncheckedIndexedAccess` and `noImplicitReturns` — weaker type config than the backend | Medium |

### Improvement Target

- Eliminate 25% of violations (≈354) in Phase 2
- Add DB row types in `projects.ts` (~18 `any` removed)
- Introduce discriminated union in `UnifiedEditor.tsx` (~25 `as` removed)
- Type TipTap JSON schema in `yjsConverter.ts` (~15 `any` removed)
- Add return type annotations and typed function parameters across route handlers and hooks
- Align `web/tsconfig.json` to extend root config

---

## Category 2 — Bundle Size

| Metric | Baseline |
|--------|----------|
| Total production JS (raw / gzip) | **2,197 KB / ~620 KB** |
| Largest chunk | `index.js` — 2,073 KB raw / 589 KB gzip (94.4% of total JS) |
| Number of chunks | **261** (1 main + 14 tab components + 246 SVG icons) |
| Top 3 heaviest dependencies | `@tiptap/core` + extensions (~3.3 MB dist), `emoji-picker-react` (2.3 MB dist), `yjs` + `y-websocket` + `y-indexeddb` (~2.2 MB) |
| Unused dependencies in prod | `@tanstack/react-query-devtools` — in `dependencies` (not `devDependencies`), shipped unconditionally to all users |

### Top Findings

| # | Finding | Severity |
|---|---------|----------|
| 1 | 94% of JS in one monolithic chunk — Vite warns at 500 KB; zero page-level code splitting | High |
| 2 | `@tanstack/react-query-devtools` ships to production — ~256 KB of dev tooling downloaded on every page load | High |
| 3 | `emoji-picker-react` (2.3 MB dist) loads on every page — statically imported, only used in one popover | Medium–High |
| 4 | All 15+ page routes are static imports in `main.tsx` — TipTap, Yjs, and all providers initialize on first load regardless of page | Medium–High |

### Improvement Target

- Target 15% reduction in total bundle OR 20% reduction in initial load
- Move `react-query-devtools` to `devDependencies` + `NODE_ENV` guard (immediate ~256 KB saving)
- Convert page imports in `main.tsx` to `React.lazy()` (largest potential gain)
- Lazy-load `EmojiPicker.tsx` on popover open

---

## Category 3 — API Response Time

> P95 column uses p97.5 (closest available autocannon bucket). All values at c=10 (single-user equivalent).

| Endpoint | P50 | P95 (p97.5) | P99 |
|----------|-----|-------------|-----|
| `GET /api/issues` | 18ms | 32ms | 36ms |
| `GET /api/weeks/my-week` | 7ms | 28ms | 31ms |
| `GET /api/projects` | 5ms | 18ms | 21ms |
| `GET /api/documents?type=wiki` | 23ms | 32ms | 33ms |
| `GET /api/dashboard/my-work` | 6ms | 20ms | 22ms |

**At c=50 (peak load), worst performers:**

| Endpoint | P99 (c=50) |
|----------|-----------|
| `GET /api/documents?type=wiki` | **142ms** (4.3× degradation from c=10) |
| `GET /api/issues` | **120ms** (3.3× degradation) |

### Top Findings

| # | Finding | Severity |
|---|---------|----------|
| 1 | `GET /api/issues` fetches full `d.content` for all 150 issues — list UI only needs title/state/priority/assignee | High |
| 2 | `GET /api/documents` degrades 4.3× from c=10 to c=50 — driven by pg-pool contention (default 10 connections) | High |
| 3 | Auth middleware runs 3 DB queries on every request — at c=50 this is 150 concurrent session writes | Medium–High |
| 4 | Sequential DB queries in dashboard and projects routes — could run in parallel via `Promise.all` | Medium |

### Improvement Target

- 20% reduction in p99 on at least 2 endpoints
- Remove `d.content` from issues list SELECT (`GET /api/issues` target: ≤96ms p99 at c=50)
- Increase pg-pool `max` from 10 to 25 (`GET /api/documents` target: ≤114ms p99 at c=50)
- Throttle `UPDATE sessions SET last_activity` to once per 60s per session

---

## Category 4 — Database Query Efficiency

| User Flow | Total DB Queries | Slowest Query | N+1 Detected? |
|-----------|-----------------|---------------|---------------|
| Load main page | **25** | 1.41ms | No |
| View a document | **4** | 0.08ms | No |
| List issues | **5** | 1.74ms | No |
| Load sprint board | **16** | 1.38ms | No |
| Search content | **9** | 1.12ms | No |

**Main page query breakdown:** 15 of 25 queries (60%) are auth middleware overhead (3 queries × 5 parallel requests). Route logic accounts for only 10 queries.

### Top Findings

| # | Finding | Severity |
|---|---------|----------|
| 1 | Auth middleware: 3 DB queries per request — SELECT session+user, SELECT workspace_membership, UPDATE last_activity (unconditional) | High |
| 2 | `GET /api/issues` selects `d.content` for all 150 issues; list UI discards it | High |
| 3 | `GET /api/documents?type=wiki` performs full sequential scan (556 rows, 322 discarded) — composite index `idx_documents_active` is unusable because route query omits `deleted_at IS NULL` | Medium–High |
| 4 | `idx_documents_active` has dead partial condition (`deleted_at IS NULL` — 0 rows in table have a `deleted_at` value) | Medium |
| 5 | N+1 in `GET /api/weeks/:id/scope-changes` — one query per removed issue inside a loop; should be batched | Medium |
| 6 | No functional index on `(properties->>'assignee_id')` — dashboard query discards 148/150 rows after a JSONB text comparison | Medium |

### Improvement Target

- 20% reduction in query count on at least one flow, or 50% improvement on slowest query
- Throttle session UPDATE → removes 5 queries from main page load (25 → 20)
- Merge 2 auth SELECTs into single JOIN → removes 5 more (20 → 15, a 40% reduction)
- Add `AND deleted_at IS NULL` to wiki query to enable composite index
- Add functional index: `CREATE INDEX idx_documents_assignee ON documents ((properties->>'assignee_id')) WHERE document_type = 'issue'`
- Batch the scope-changes N+1 with `WHERE id = ANY($1::uuid[])`

---

## Category 5 — Test Coverage

| Metric | Baseline |
|--------|----------|
| Total tests written | **1,479** (451 API + 162 web + 866 E2E) |
| Tests currently passing | **451** (API unit only — the only suite that runs via `pnpm test`) |
| Suite runtime | 12.7s (API unit) |
| API statement coverage | **40.34%** |
| API branch coverage | **33.44%** |
| Web coverage | **0%** (test suite broken — ESM/CJS dependency error; 0 of 162 web tests execute) |
| Critical flows with zero coverage | CAIA/OAuth government login, WebSocket disconnect recovery, concurrent two-user edit conflict |

### Top Findings

| # | Finding | Severity |
|---|---------|----------|
| 1 | All 16 web unit test files broken (`ERR_REQUIRE_ESM`) — 162 written tests, 0 running; frontend has no passing unit coverage | High |
| 2 | CAIA/OAuth government login path has zero test coverage — the only real auth path for Treasury users is completely untested | High |
| 3 | API branch coverage 33% — two-thirds of conditional logic paths (error branches, auth edge cases) run untested in production | Medium–High |
| 4 | `pnpm test` only runs API unit tests — a passing `pnpm test` result hides 16 broken web files and the entire E2E suite | Medium |
| 5 | No multi-browser E2E test for real-time collaboration — a regression in the WebSocket/Yjs layer would not be caught | Medium |

### Improvement Target

- Fix web unit test ESM/CJS breakage (restores 162 tests)
- Add CAIA auth unit tests covering: success, new user provisioning, .gov/.mil rejection, invalid CSRF state, expired token
- Add two-browser Playwright E2E test for collaborative editing

---

## Category 6 — Runtime Error Handling

| Metric | Baseline |
|--------|----------|
| Console errors during normal usage | **1** — `401 Unauthorized` from `/api/auth/me` on initial load before auth redirect |
| Unhandled promise rejections (server) | **No global handler** — Node.js 15+ terminates the process on unhandled rejection with only a stderr log |
| Network disconnect recovery | **Partial** — editor buffers changes in IndexedDB; non-editor pages show stale data silently |
| Root-level error boundary | **None** — `main.tsx` has no `ErrorBoundary`; 8 providers are unprotected |
| Silent failures identified | **6** |

### Silent Failures

| # | Failure | Severity |
|---|---------|----------|
| 1 | No root-level `ErrorBoundary` in `main.tsx` — any provider crash produces a blank white screen; `App.tsx:542` only covers page content | High |
| 2 | `useRealtimeEvents` reconnects every 3s on any close including 429 — no backoff, no 429 awareness; client hammers server indefinitely | High |
| 3 | Editor WebSocket has no 429 handling — on rate-limit, editor shows `Offline` indefinitely with no explanation | Medium |
| 4 | Title `<textarea>` has no `maxLength` — saves silently fail (400) above 255 chars; title reverts on next sync with no message | Medium |
| 5 | `ROLLBACK` errors silently swallowed in `documents.ts` and `issues.ts` — `.catch(() => {})` discards rollback failures | Medium |
| 6 | No `process.on('unhandledRejection')` handler — any uncaught async throw terminates the API process with only a stderr log | Medium |

### Improvement Target

- Fix 3 error handling gaps with user-facing impact
- Add exponential backoff (3s → 6s → 12s → 24s → 60s max) with 429 awareness to `useRealtimeEvents`
- Show "Connection blocked — changes saved locally" after 3 consecutive 1006 closes in `Editor.tsx`
- Add `maxLength={255}` + character counter to the document title textarea

---

## Category 7 — Accessibility

| Metric | Baseline |
|--------|----------|
| **Lighthouse accessibility score (per page)** | **My week main** `/my-week` — 96/100 <br> **Docs main view** `/docs` — 100/100 <br> **Docs selected wiki** `/docs/:id` — 100/100 <br> **Selected Program view** `/docs/:id` — 94/100 <br> **Selected Programs – issues view** `/docs/:id/issues` — 95/100 <br> **Selected Programs – projects view** `/docs/:id/projects` — 91/100 <br> **Selected Programs – weeks view** `/docs/:id/weeks` — 91/100 <br> **Selected issues view** `/docs/:id` — 95/100 <br> **Selected Projects view** `/docs/:id` — 95/100 <br> **Selected Projects details view** `/docs/:id/details` — 92/100 <br> **Selected Projects week view** `/docs/:id/weeks` — 91/100 <br> **Selected Projects retro view** `/docs/:id/retro` — 92/100 <br> **Program main view** `/programs` — 100/100 <br> **Projects main view** `/projects` — 96/100 <br> **Team allocation** `/team/allocation` — 96/100 <br> **Team directory** `/team/directory` — 100/100 <br> **Selected team member** `/team/:id` — 100/100 <br> **Team status** `/team/status` — 96/100 <br> **Team reviews** `/team/reviews` — 96/100 <br> **Team org-chart** `/team/org-chart` — 100/100 <br> **Settings** `/settings` — 95/100 <br> **Settings invites** `/settings?tab=invites` — 94/100 <br> **Settings API tokens** `/settings?tab=tokens` — 93/100 <br> **Settings audit logs** `/settings?tab=audit` — 100/100 <br> **Settings conversions** `/settings/conversions` — 100/100 |
| **Total Critical / Serious violations** | **3 Critical, 10 Serious** — see below |
| **Keyboard navigation completeness** | Partial — 5 broken/missing flows |
| **Color contrast failures** | 6 failures |
| **Missing ARIA labels or roles** | 8 locations |

### Critical Violations

| # | Page / Flow | Violation |
|---|-------------|-----------|
| 1 | `/documents/:id` — any open document | `aria-expanded="false"` on ProseMirror root `role="textbox"` — attribute not allowed; AT may skip or misinterpret the entire editor |
| 2 | `/documents/:id` — empty title field | Title placeholder contrast ~1.6:1 (needs 4.5:1): `#8a8a8a` at 30% opacity → effective ~`#2a2a2a` |
| 3 | All pages — provider crash | No root-level `<ErrorBoundary>` in `main.tsx`; 8 providers unprotected; any exception → blank white screen |

### Serious Violations

| # | Page / Flow | Violation |
|---|-------------|-----------|
| 4 | `/documents/:id` — backlog picker | `BacklogPickerModal.tsx:244` search input missing `aria-label` |
| 5 | `/documents/:id` — properties sidebar, association chips | `MultiAssociationChips.tsx:172` search input missing `aria-label` |
| 6 | Any page — Cmd+K / Ctrl+K | `CommandPalette.tsx:254` search input missing `aria-label` |
| 7 | `/documents/:id` — document header | `EmojiPicker.tsx:56` trigger button missing `aria-label` |
| 8 | `/programs`, `/docs/:id` — merge program dialog | `MergeProgramDialog` search placeholder contrast ~3.2:1 (needs 4.5:1) |
| 9 | `/my-week`, `/docs/:id` — any tabbed view | `TabBar` no `ArrowLeft`/`ArrowRight` navigation (WCAG 2.1 SC 2.1.1 violation) |
| 10 | `/documents/:id` — properties sidebar | `PropertyRow.tsx:15` labels not associated with inputs via `htmlFor`/`id` |
| 11 | `/documents/:id` — properties sidebar | `PropertyRow.tsx:21` required field indicator missing `aria-describedby`/`aria-required` |
| 12 | `/projects`, `/docs/:id/issues`, approval flow | Decorative SVG icons in `BulkActionBar`, `ApprovalButton`, `CommandPalette` missing `aria-hidden="true"` |
| 13 | `/my-week` — weekly plan editor | `text-muted/50` line numbers: ~3.2:1 contrast (needs 4.5:1) |

### Color Contrast Failures

| Location | Effective Ratio | Required | Result |
|----------|----------------|----------|--------|
| `/documents/:id` title placeholder (`#8a8a8a` @ 30%) | ~1.6:1 | 4.5:1 | FAIL |
| Merge dialog search placeholder (`#8a8a8a` @ 50%) | ~3.2:1 | 4.5:1 | FAIL |
| `/my-week` line numbers (`text-muted/50`) | ~3.2:1 | 4.5:1 | FAIL |
| `/settings`, `/programs` dash text (`text-muted/50`) | ~3.2:1 | 4.5:1 | FAIL |
| `/documents/:id` body placeholder (`#525252`) | ~3.2:1 | 4.5:1 | FAIL |
| Disabled buttons (`opacity-50` on `bg-accent`) — all pages | ~1.8:1 | 4.5:1 | FAIL |

### Improvement Target

**Goal A — Raise `/docs/:id/projects` from 91/100 to 100/100:**
- Add `aria-hidden="true"` to decorative SVGs in `BulkActionBar`
- Add `focus-visible:ring` to `SelectableList` rows
- Replace `text-muted/50` with a full-opacity token on content text in `WorkspaceSettings`

**Goal B — Fix all critical & serious violations on 3 most important pages:**

| Page | Fixes |
|------|-------|
| `/documents/:id` | Remove `aria-expanded` from ProseMirror textbox root; fix title placeholder contrast; add `aria-label` to `EmojiPicker`; associate `PropertyRow` labels; add `aria-label` to `MultiAssociationChips` |
| `/my-week` | Fix line number contrast (`text-muted/50` → solid token); implement `TabBar` arrow key navigation |
| `/projects` | Add `aria-hidden="true"` to `BulkActionBar`/`ApprovalButton` SVGs; add focus ring to `SelectableList` rows |

---

## Cross-Category Summary

| Category | Key Risk | Priority |
|----------|----------|----------|
| Type Safety | 1,417 violations; unsafe document casting can crash the editor silently | High |
| Bundle Size | 2.1 MB monolithic chunk; devtools shipped to production users | High |
| API Response Time | `GET /api/documents` degrades 4.3× under load; issues payload oversized | High |
| DB Query Efficiency | 60% of page-load queries are auth overhead; sequential scan on wiki list | High |
| Test Coverage | Web tests fully broken (0%); CAIA auth path zero coverage | High |
| Runtime Error Handling | No root ErrorBoundary; WS reconnect storm on 429; silent title revert | High |
| Accessibility | Critical ARIA violation on editor root (every document); 6 contrast failures | High |

### Highest-Impact Phase 2 Fixes (Quick Wins)

1. **Move `react-query-devtools` to `devDependencies`** — 1 line change, saves ~256 KB for all users
2. **Add root `<ErrorBoundary>` in `main.tsx`** — 5 lines, eliminates blank-screen crash for all users
3. **Add `aria-label` to `CommandPalette`, `BacklogPickerModal`, `MultiAssociationChips` inputs** — 3 attribute additions
4. **Throttle session UPDATE to once per 60s** — removes 5 queries from every page load (20% reduction)
5. **Remove `d.content` from issues list SELECT** — 1 column removed, directly cuts issues payload
6. **Fix `useRealtimeEvents` backoff** — prevents reconnect storm from making rate-limits permanent
