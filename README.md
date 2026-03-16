# ShipShape — Performance Audit & Optimization

A project management platform audited and improved across 7 categories with measurable, reproducible results.

**[Overview](#overview)** | **[Cat 1: Type Safety](#category-1-type-safety)** | **[Cat 2: Bundle Size](#category-2-bundle-size)** | **[Cat 3: API Response](#category-3-api-response-time)** | **[Cat 4: DB Queries](#category-4-database-query-efficiency)** | **[Cat 5: Test Coverage](#category-5-test-coverage)** | **[Cat 6: Error Handling](#category-6-runtime-error-handling)** | **[Cat 7: Accessibility](#category-7-accessibility)** | **[Discoveries](#discoveries)** | **[AI Analysis](#ai-cost-analysis)** | **[Running Tests](#running-tests)**

---

## Overview

ShipShape is a real-time collaborative project management app (React + Express + PostgreSQL + Yjs). This fork implements 24 optimization specs across 7 audit categories, with all 7 improvement targets met or exceeded.

### Results at a Glance

| Category | Baseline | After | Change | Target |
|----------|----------|-------|--------|--------|
| **Type Safety** | 708 explicit violations | 397 | **-44%** | 25% reduction — MET |
| **Bundle Size** | 2,073 KB monolithic chunk | 955 KB largest + 784 KB deferred | **-54% largest chunk** | 20% initial load — MET |
| **API Response** | Wiki p99 142ms (c=50) | 71ms | **-50%** | 20% P95 on 2+ — MET |
| **DB Queries** | 25 queries/page load | ~16 | **-36%** | 20% on 1+ flow — MET |
| **Test Coverage** | 451/1,479 running (30%) | 1,463/1,471 (99.5%) | **+1,012 tests** | Fix 3 gaps — EXCEEDED |
| **Error Handling** | 6 silent failures | 1 remaining | **5 fixed** | Fix 3 — EXCEEDED |
| **Accessibility** | 3 Critical + 10 Serious | 0 + 0 | **13 violations fixed** | Fix all on 3 pages — MET |

### Deployments

| Environment | URL |
|-------------|-----|
| **Production** (all fixes) | [shipshape-prod-web.onrender.com](https://shipshape-prod-web.onrender.com/) |
| **API** | [shipshape-prod-api.onrender.com](https://shipshape-prod-api.onrender.com/) |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, TailwindCSS |
| Editor | TipTap + Yjs (real-time collaboration) |
| Backend | Express, Node.js |
| Database | PostgreSQL |
| Real-time | WebSocket + Yjs CRDTs |
| Testing | Playwright E2E, Vitest |
| Infrastructure | Docker, Render |
| Package Manager | pnpm workspaces |

### Project Structure

```
api/          Express backend + WebSocket collaboration server
web/          React + Vite frontend
shared/       TypeScript types shared between packages
e2e/          Playwright E2E tests (869 tests)
docs/
  benchmark/
    phase1-baseline_Audit/   Original audit baselines (7 categories)
    phase2-MVP/              Phase 2 benchmark results + comparison
    phase3-Final/            Phase 3 benchmark results
  specs/
    implemented/    Per-category implementation documentation
    phase2/         Phase 2 fix specifications
    phase3/         Phase 3 test fix specifications
    futurePhase/    Future work specifications
```

### Documentation

| Document | Description |
|----------|-------------|
| [Final Audit Report](docs/final-audit-report.md) | Comprehensive before/after analysis for all 7 categories |
| [Phase 2 Audit Comparison](docs/benchmark/phase2-MVP/phase2-audit-comparison.md) | Side-by-side baseline vs post-fix metrics |
| [Spec Tracker](docs/specs/spec-tracker.md) | Status of all specs across Phase 2 and Phase 3 |
| [Original Audit Report](docs/benchmark/phase1-baseline_Audit/audit-report.md) | Baseline findings and methodology |

### Branching Strategy

Each category was implemented on its own branch and merged to master with `--no-ff`:

```
master
  ├── cat1-type-safety
  ├── cat2-bundle-size
  ├── cat3-api-response-time
  ├── cat4-db-query-efficiency
  ├── cat5-test-coverage        (Phase 2 + Phase 3 test fixes)
  ├── cat6-runtime-error-handling
  └── cat7-accessibility
```

---

## Category 1: Type Safety

**Branch:** `cat1-type-safety` | **Target:** 25% violation reduction | **Result: MET (44% explicit)**

### Before/After

| Metric | Baseline | After | Change |
|--------|----------|-------|--------|
| Explicit `any` | 392 | 70 | **-82%** |
| Type assertions (`as`) | 280 | 283 | +1% |
| Non-null assertions (`!`) | 35 | 43 | +23% |
| Total explicit violations | 708 | 397 | **-44%** |

### What Changed

4 specs eliminated untyped pipelines across the codebase:

- **Spec 1.1 (DB Row Types):** Added explicit TypeScript interfaces for all database query results in `projects.ts` and `weeks.ts`. Previously, query results were typed as `any`, so accessing `row.nonexistent` compiled without errors.
- **Spec 1.2 (Discriminated Union):** Created a discriminated union for the 5 document types (wiki, issue, project, sprint, program). Before this, switching on `document_type` required unsafe type assertions. After, TypeScript narrows the type automatically.
- **Spec 1.3 (Yjs Converter):** Added TipTap JSON types to the Yjs-to-HTML conversion pipeline in `yjsConverter.ts`. This file had 15 `any` types — now zero.
- **Spec 1.4 (Web tsconfig):** Enabled `noUncheckedIndexedAccess` and `noImplicitReturns` in the web package. This surfaced 102 type errors that were fixed.

### Tradeoffs

25 non-null assertions were added for bounds-checked array access (where the index is known safe). Type assertions (`as`) stayed roughly flat because structural union types (sidebar data, panel props) don't correlate with document types.

### Reproducible Benchmark Commands

```bash
# Count explicit any
grep -rn ': any' api/src web/src shared/src --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | wc -l

# Count type assertions
grep -rn ' as [A-Z]' api/src web/src shared/src --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | wc -l

# Count non-null assertions
grep -rn '\!' api/src web/src shared/src --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '!=\|!=' | wc -l

# Full type check
pnpm type-check
```

---

## Category 2: Bundle Size

**Branch:** `cat2-bundle-size` | **Target:** 20% initial load reduction | **Result: MET**

### Before/After

| Metric | Baseline | After | Change |
|--------|----------|-------|--------|
| Total JS (raw) | 2,197 KB | 2,992 KB | +36% (splitting overhead) |
| Largest chunk | 2,073 KB (94.4%) | 955 KB (31.9%) | **-54%** |
| Deferred via lazy loading | 0 KB | 784 KB | New capability |
| Number of route chunks | 1 (monolith) | 23 | Code split |

### What Changed

5 specs broke apart the monolithic bundle:

- **Spec 2.2 (Route Splitting):** Converted all 23 page routes to `React.lazy()` with `<Suspense>` fallbacks. Previously, navigating to `/login` downloaded the entire app including the editor, emoji picker, and admin dashboard.
- **Spec 2.3 (Lazy Emoji Picker):** Deferred `emoji-picker-react` (271 KB) — only loaded when a user clicks the emoji button.
- **Spec 2.4 (Lazy Highlight.js):** Deferred `lowlight` syntax highlighting (195 KB) — loaded only when a code block is present.
- **Spec 2.5 (Lazy Upload Extensions):** Deferred upload extensions (9 KB) — loaded on first file/image insert.
- **Spec 2.1 (Devtools):** Moved `@tanstack/react-query-devtools` to devDependencies.

### Tradeoffs

Total bundle size increased 36% because code splitting adds chunk overhead (module wrappers, dynamic import boilerplate). However, initial page load is significantly smaller — users only download what they need for the current route.

### Reproducible Benchmark Commands

```bash
pnpm build:web
# Vite prints chunk sizes in the build output
# Look for: dist/assets/*.js with sizes
```

---

## Category 3: API Response Time

**Branch:** `cat3-api-response-time` | **Target:** 20% P95 on 2+ endpoints | **Result: MET**

### Before/After

| Endpoint | Baseline p99 (c=50) | After p99 (c=50) | Change |
|----------|---------------------|-------------------|--------|
| `GET /api/documents?type=wiki` | 142ms | 71ms | **-50%** |
| `GET /api/issues` (paginated) | 120ms (unpaginated) | 76ms | **-37%** |
| Issues payload | 310 KB | 47 KB (paginated) | **-85%** |

### What Changed

- **Spec 3.1 (Remove Content):** Dropped `d.content` from the issues list SQL query. The list view only shows titles and metadata — content was being serialized and transferred for no reason.
- **Spec 3.2 (Pool Tuning):** Increased `pg-pool` max connections from 20 to 25. At 50 concurrent requests, all 20 connections were occupied, causing queuing. The extra 5 connections eliminated contention.
- **Spec 3.3 (Cursor Pagination):** Added cursor-based pagination to the issues endpoint. Instead of returning all 218 issues (310 KB), returns 50 per page (47 KB).

### Tradeoffs

Opening an individual issue now requires a separate content fetch (one additional query). Pagination uses `created_at DESC` ordering instead of priority sort.

### Reproducible Benchmark Commands

```bash
# Prerequisite: database seeded, API running
pnpm db:seed
cd api && tsx src/index.ts &

# Benchmark with autocannon (install: npm i -g autocannon)
# Replace COOKIE with a valid session cookie from browser DevTools
autocannon -c 50 -d 30 -H "Cookie: session=COOKIE" "http://localhost:3001/api/documents?type=wiki"
autocannon -c 50 -d 30 -H "Cookie: session=COOKIE" "http://localhost:3001/api/issues?limit=50"
```

---

## Category 4: Database Query Efficiency

**Branch:** `cat4-db-query-efficiency` | **Target:** 20% query reduction on 1+ flow | **Result: MET on all flows**

### Before/After

| User Flow | Baseline Queries | After | Change |
|-----------|-----------------|-------|--------|
| Load main page | 25 | ~16 | **-36%** |
| View a document | 4 | ~2 | **-50%** |
| List issues | 5 | ~4 | **-20%** |
| Load sprint board | 16 | ~10 | **-38%** |
| Search content | 9 | ~6 | **-33%** |
| Auth queries/request | 3 | 1 | **-67%** |

### What Changed

- **Spec 4.1 (Auth Consolidation):** The auth middleware ran 3 separate queries per request (session lookup, user fetch, workspace fetch). Combined into a single JOIN query with a 60-second throttle on `last_activity` updates. This alone eliminated 60% of page load queries.
- **Spec 4.2 (Remove Person JOIN):** Issues list queries included an expensive self-JOIN on `person_doc` to check if the assignee was archived. Removed from list views (kept in detail views).
- **Spec 4.4 (Assignee Index):** Created a functional B-tree index on `(properties->>'assignee_id')` for issues. Dashboard queries filtering by assignee went from sequential scan to index scan.
- **Spec 4.5 (N+1 Batch):** Scope-changes endpoint had an N+1 loop fetching removed issues one at a time. Replaced with a single `WHERE id = ANY($1)` batch query.

### Tradeoffs

`last_activity` can be up to 60 seconds stale (acceptable given the 15-minute session timeout). Archived-assignee badge removed from list views. Functional index adds ~10 KB storage.

### Reproducible Benchmark Commands

```bash
# Prerequisite: database seeded
pnpm db:seed

# Count queries per flow using pg_stat_statements or application logging
# EXPLAIN ANALYZE for individual queries:
psql -d ship -c "EXPLAIN (ANALYZE, BUFFERS) SELECT ... FROM documents WHERE ..."
```

---

## Category 5: Test Coverage

**Branch:** `cat5-test-coverage` | **Target:** Fix 3 critical test gaps | **Result: EXCEEDED**

### Before/After

| Metric | Audit Baseline | Phase 2 | Phase 3 (Final) |
|--------|---------------|---------|-----------------|
| Total tests written | 1,479 | 1,457 | 1,471 |
| Tests passing | 451 (30%) | 1,444 (99%) | **1,463 (99.5%)** |
| Hard failures | N/A | 13 | **4** (pre-existing) |
| Flaky tests | N/A | 7 | **4** (pre-existing) |
| Web unit tests | 0/162 (broken) | 138/151 | **151/151 (100%)** |
| E2E tests | Not run | 855/855 | **861/869 (99.1%)** |
| CI runtime | N/A | N/A | **~5 min (8 shards)** |

### What Changed

**Phase 2 — Infrastructure Fixes:**
- **Spec 5.2:** Replaced `jsdom` with `happy-dom` to fix ESM/CJS incompatibility that broke all 162 web unit tests.
- **Spec 5.3:** Changed static `import` to dynamic `import()` for `get-port` to fix E2E test setup.

**Phase 3 — Test Quality Fixes:**
- Fixed 13 unit test failures (stale assertions from code refactors)
- Fixed 10 of 14 flaky E2E tests with documented root cause analysis
- Built 8-shard GitHub Actions CI pipeline (~5 min vs ~25 min)
- Discovered 3 app bugs: Yjs character truncation, missing table context menu, TipTap code block input rule
- Documented WCAG 1.4.13 vs 2.5.8 conflict (attempted fix, reverted with analysis)

**Common flaky test root causes:**

| Pattern | Tests Affected | Fix |
|---------|---------------|-----|
| `networkidle` with WebSockets | 21+ | Remove — WebSockets prevent idle |
| `waitForTimeout(N)` | 15+ | Replace with `toBeVisible()` or `toPass()` |
| Non-retrying assertions | 5 | Use Playwright auto-retrying assertions |
| `Meta+` on Linux CI | 3 | Use `ControlOrMeta+` |
| Silent-pass `if` guards | 2 | Remove — let tests fail visibly |

### Remaining Failures (all pre-existing, not caused by our changes)

| Test | Root Cause |
|------|-----------|
| accessibility-remediation:407 | Tree items lack tabIndex — WCAG 1.4.13 vs 2.5.8 conflict |
| syntax-highlighting:154 | Yjs truncates characters during persistence (app bug) |
| data-integrity:356 | Mentions don't persist after reload (Yjs race) |
| drag-handle:310 | Drag handle elements not found (rendering timing) |

### Reproducible Benchmark Commands

```bash
# Unit tests (local)
pnpm test                        # API: 451 tests, ~12s
pnpm --filter @ship/web test     # Web: 151 tests, ~1.2s

# E2E tests (CI — 8-shard pipeline)
git push origin cat5-test-coverage   # Triggers GitHub Actions

# E2E tests (local — requires Docker + 8GB+ free RAM)
pnpm test:e2e                    # 869 tests, runtime depends on available workers
```

---

## Category 6: Runtime Error Handling

**Branch:** `cat6-runtime-error-handling` | **Target:** Fix 3 error gaps | **Result: EXCEEDED (5 fixed)**

### Before/After

| Silent Failure | Baseline | After |
|----------------|----------|-------|
| No root ErrorBoundary | Blank screen on provider crash | Recovery UI with retry button |
| WS reconnect storm on 429 | Fixed 3s retry indefinitely | Exponential backoff 3s-60s, 429 awareness |
| Rate-limit counter leak | Connections counted but never released | release() on disconnect |
| Title >255 chars silently fails | Title reverts with no explanation | maxLength={255} + character counter |
| ROLLBACK errors swallowed | .catch(() => {}) | Error logging + retry 3x + toast notification |
| No unhandledRejection handler | Process terminates silently | Not addressed (low priority) |

### What Changed

- **Spec 6.1:** Added `RootErrorBoundary` in `main.tsx`, wrapping all providers. Shows error message with retry button instead of blank screen.
- **Spec 6.2:** Replaced fixed 3s WebSocket reconnect with exponential backoff (3s, 6s, 12s, 24s, 60s max) with jitter. On 429, jumps to 24s minimum. Shows "Connection blocked" message.
- **Spec 6.3:** Added `release()` function returned by `recordConnectionAttempt()`. Called on WebSocket close to decrement the connection counter.
- **Spec 6.4:** Added `maxLength={255}` on title input with character counter appearing at 230+.
- **Spec 6.5:** Replaced `.catch(() => {})` with error logging, 3x mutation retry with exponential backoff, and toast notification on final failure.
- **Spec 6.6 (Phase 3):** Added real-time title sync via WebSocket `broadcastToWorkspace()` and fixed `useAutoSave` throttle double-fire.

### Reproducible Benchmark Commands

```bash
# Manual verification:
# 1. ErrorBoundary: Temporarily throw in a provider, verify recovery UI
# 2. WS backoff: Open DevTools Network tab, throttle to offline, verify backoff timing
# 3. Title guard: Type 256+ characters in title, verify counter and enforcement
# 4. Save failure: Disconnect DB mid-save, verify toast appears
```

---

## Category 7: Accessibility

**Branch:** `cat7-accessibility` | **Target:** Fix all Critical/Serious on 3 pages | **Result: MET**

### Before/After

| Severity | Baseline | After | Change |
|----------|----------|-------|--------|
| Critical violations | 3 | 0 | **-3** |
| Serious violations | 10 | 0 | **-10** |
| Contrast failures | 6 | 0 (on target pages) | **-6** |

### What Changed

- **Spec 7.1 (Document Page — 6 fixes):** Removed invalid `aria-expanded` from ProseMirror textbox, fixed title placeholder contrast from ~1.6:1 to 4.5:1, added `aria-label` to emoji picker/search/backlog modal, associated PropertyRow labels with inputs via `useId()`.
- **Spec 7.2 (My Week Page — 2 fixes):** Fixed line number contrast from ~3.2:1 to 4.5:1, implemented WAI-ARIA tabs pattern with ArrowLeft/Right/Home/End keyboard navigation and roving tabindex.
- **Spec 7.3 (Projects Page — 3 fixes):** Added `aria-hidden="true"` to 20 decorative SVG icons, added `focus-visible` ring to SelectableList rows, fixed WorkspaceSettings button contrast.
- **Phase 3 (F3.10):** Fixed CSS class collision where `focus-visible:ring-2` class name collided with a test regex matching `ring-2`. Resolved 5 bulk-selection test failures.

### Reproducible Benchmark Commands

```bash
# Axe-core E2E tests
pnpm test:e2e --grep "axe-core"

# Lighthouse (Chrome DevTools)
# 1. Open Chrome DevTools > Lighthouse tab
# 2. Select "Accessibility" only, Desktop viewport
# 3. Run on /documents/:id, /my-week, /projects
```

---

## Discoveries

### 1. "Everything is a Document" Polymorphic Pattern

**Found in:** `shared/src/types/document.ts` (lines 34-330)

ShipShape stores every entity type — wikis, issues, projects, programs, sprints, even individual weeks — in a single `documents` table with a `document_type` discriminator. Each type has its own properties schema, but they all share a common structure: title, content (via Yjs), ownership, visibility, and parent-child relationships. This means any document can link to any other document. A sprint links to its project, which links to its program, which contains wiki documentation — all queryable through one table with one set of APIs.

The TypeScript discriminated union ensures type safety at compile time: switching on `document_type` automatically narrows the type, so `issue.properties.state` is valid but `wiki.properties.state` is a compiler error. No type assertions needed.

This design gives the application true flexibility as a project management tool. Instead of switching between a wiki, a task tracker, and a spreadsheet, everything lives in one system and can be connected.

**How I would apply this:** I recently worked on integrating AI agents into openEMR, an open-source electronic medical records system used by clinics and hospitals. openEMR's database has significant overhead — dozens of specialized tables for encounters, prescriptions, lab results, referrals, billing codes, and clinical notes, each with their own schemas and query patterns.

A "everything is a document" approach with type-specific properties defined through JSON schemas and Zod validation would simplify this considerably. Patient visits, prescriptions, referrals, and lab results could all be stored as documents with rigid type-specific requirements enforced at the application layer rather than the database schema layer. Lab results pulled from an external lab system could be stored directly as a document and immediately linked to the patient encounter, the ordering physician, and the diagnosis — all in one queryable system. The doctor would see the full picture without switching between modules. The discriminated union pattern from ShipShape would make this type-safe in TypeScript while keeping the database schema simple and extensible.

### 2. Yjs CRDT Real-Time Collaboration Architecture

**Found in:** `api/src/collaboration/index.ts` (lines 1-872)

ShipShape uses a hybrid persistence model for real-time collaboration: Yjs binary state for fast client-to-client sync, and a materialized JSON view for REST API reads. The collaboration server manages per-document Yjs instances, handles bidirectional sync between WebSocket clients and PostgreSQL, converts between Yjs binary state and TipTap JSON, and debounces persistence to avoid database thrashing. Cursor and presence data are tracked separately from document content.

This architecture solves a critical problem: keeping real-time collaboration and REST API responses consistent. Rather than storing only JSON, ShipShape stores both Yjs binary state (efficient for operational transforms) and JSON content (for API reads that bypass the collaboration server). A cache invalidation layer keeps them in sync when external API updates occur.

Understanding this dual-persistence model was essential for diagnosing the Cat 5 flaky tests. The `waitForTimeout(2000)` pattern assumed Yjs had flushed to PostgreSQL, but the "Saved" indicator only means client-to-client sync completed — not database persistence. This insight led to the API polling fix pattern (`toPass()`) used across 6+ flaky test fixes. It also led to discovering the Yjs character truncation bug (syntax-highlighting:154).

### 3. useAutoSave Hook with Throttle + Retry

**Found in:** `web/src/hooks/useAutoSave.ts` (lines 1-79)

A custom React hook that implements throttled auto-save with sequential queuing and exponential backoff retry. It saves at most every 500ms, queues changes that occur during in-flight saves instead of discarding them, retries failures with increasing delays, and uses a sequence number to prevent stale saves from overwriting newer ones.

Understanding this hook was essential for diagnosing the title sync bug (Spec 6.6). The throttle was firing both an immediate and trailing save on every keystroke, causing WebSocket spam when changing document titles. Each title change created a new WebSocket message instead of updating through the existing connection. The fix ensured only one save fires per throttle window.

---

## AI Cost Analysis

### Development Costs

| Item | Details |
|------|---------|
| Primary AI tool | Claude Code (Anthropic) — Claude MAX plan, $200/month |
| Secondary AI tool | ChatGPT (OpenAI) — supplementary research |
| Estimated total tokens (this project) | ~10M+ tokens across Phase 1-3 sessions |
| Other paid AI services | None |
| Total project time | ~70 hours |

### Reflection

**Which parts of the audit were AI tools most helpful for?**

Planning, automation, and documentation. Claude Code's sub-agent capability allowed parallel task execution that significantly reduced iteration time. The biggest efficiency gain came from pushing the E2E test suite to GitHub Actions with 8 parallel shards — the full 869-test suite dropped from 60 minutes locally (single worker, limited RAM) to approximately 5 minutes on CI. Before this, each test run consumed an hour, and multiple runs per day were needed to verify that fixes didn't introduce regressions. For Cat 5 alone, this saved dozens of hours. AI tools were also effective at generating structured documentation — the spec files, commit messages, and benchmark comparisons followed a consistent format that would have been tedious to maintain manually across 50+ commits.

**Which parts were AI tools least helpful for?**

Code changes without well-defined specifications. When given vague instructions like "fix the flaky accessibility test," Claude Code either made poor implementation choices or fabricated test results instead of actually running the suite. It consistently sought the path of least resistance. The solution was a spec-first workflow: define the problem, root cause, expected fix, and acceptance criteria in a spec file, then let the AI implement against that spec. Without these guardrails, it produced unreliable work. Additionally, AI tools sometimes entered loops when fixing test failures — one fix would break another test, which it would then "fix" by weakening assertions, creating a cycle that required manual intervention to break.

**Did AI tools help you understand the codebase, or did they shortcut understanding?**

Both. Claude Code was effective at navigating the codebase and explaining architectural decisions when given explicit constraints and rules. The CLAUDE.md file was essential — it defined commit conventions, testing requirements, branching strategy, and category-specific gotchas that kept the AI aligned with project standards. However, when left without guardrails, Claude Code took shortcuts that undermined understanding. It fabricated benchmark numbers, made "educated guesses" about test outcomes instead of running them, and occasionally generated plausible-sounding explanations for code behavior that were wrong. The key lesson was that AI tools amplify the developer's direction — they accelerate good workflows and also accelerate bad ones.

**Where did you have to override or correct AI suggestions?**

Frequent steering was required throughout the project:

- **Commit discipline:** Claude Code repeatedly force-merged branches to master without preserving commit history or following the structured commit format (problem/fix/tradeoffs/measured improvement). This was resolved by defining strict commit rules in CLAUDE.md and manually reviewing every commit message before allowing a push.
- **Fabricated test results:** Claude Code generated fake pass/fail numbers for tests it hadn't actually run. Moving E2E tests to GitHub Actions CI eliminated this problem entirely — CI results are verifiable and can't be fabricated.
- **Regression-causing fixes:** Multiple fixes broke other tests, requiring immediate reverts. The spec-first workflow (write the spec, review the plan, implement, verify) reduced this significantly but didn't eliminate it. Three fixes were ultimately reverted after CI confirmed they caused more failures than they solved.
- **Unauthorized actions:** Claude Code committed and pushed code without approval on several occasions, requiring explicit instructions to always present the commit message for review first.
- **Over-engineering:** Left unchecked, Claude Code added unnecessary abstractions, extra error handling, and "while I'm here" refactors that weren't requested. The CLAUDE.md rule "Don't add unnecessary code" was added specifically to address this.

**What percentage of final code changes were AI-generated vs. hand-written?**

Approximately 95% AI-generated, 5% hand-written. The human contribution was primarily in directing the work (defining specs, choosing priorities), reviewing output (commit messages, code changes, test results), reverting bad changes, and making final decisions on what to ship. The AI was the implementer; the human was the architect and quality gate.

---

## Running Tests

### Prerequisites

- Node.js 20+
- pnpm 10.27+
- PostgreSQL (local or Docker)

### Quick Start

```bash
pnpm install                  # Install all dependencies
pnpm build:shared             # Build shared types (required first)
pnpm dev                      # Start full dev environment

# Run tests
pnpm test                     # API unit tests (451 tests, ~12s)
pnpm --filter @ship/web test  # Web unit tests (151 tests, ~1.2s)
pnpm test:e2e                 # E2E tests (869 tests, requires Docker)

# Build
pnpm build                    # Build all packages
pnpm build:web                # Build web only (shows bundle sizes)

# Database
pnpm db:seed                  # Seed with 501 docs, 218 issues, 22 users, 35 sprints
pnpm db:migrate               # Run database migrations

# Type checking
pnpm type-check               # TypeScript check all packages
pnpm lint                     # Lint all packages
```

### CI Pipeline

E2E tests run on GitHub Actions with 8 parallel shards:

```bash
# Trigger manually
gh workflow run "E2E Tests"

# Or push to cat5-test-coverage branch
git push origin cat5-test-coverage
```

Each shard runs ~109 tests with its own PostgreSQL container. Total CI time: ~5 minutes.

---

## Further Reading

| Resource | Path |
|----------|------|
| Final Audit Report | [docs/final-audit-report.md](docs/final-audit-report.md) |
| Phase 2 Comparison | [docs/benchmark/phase2-MVP/phase2-audit-comparison.md](docs/benchmark/phase2-MVP/phase2-audit-comparison.md) |
| Phase 3 Benchmarks | [docs/benchmark/phase3-Final/](docs/benchmark/phase3-Final/) |
| Spec Tracker | [docs/specs/spec-tracker.md](docs/specs/spec-tracker.md) |
| Original Audit | [docs/benchmark/phase1-baseline_Audit/audit-report.md](docs/benchmark/phase1-baseline_Audit/audit-report.md) |
| Phase 2 Specs | [docs/specs/phase2/](docs/specs/phase2/) |
| Phase 3 Specs | [docs/specs/phase3/](docs/specs/phase3/) |
| Future Phase Specs | [docs/specs/futurePhase/](docs/specs/futurePhase/) |
| Implementation Docs | [docs/specs/implemented/](docs/specs/implemented/) |
