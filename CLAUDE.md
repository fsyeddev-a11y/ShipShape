# ShipShape — Claude Code Rules

## Project Overview

ShipShape is a project management app (think Linear/Jira) with a monorepo structure:

- **`api/`** — Express + PostgreSQL backend (`@ship/api`)
- **`web/`** — React + Vite frontend (`@ship/web`)
- **`shared/`** — Shared TypeScript types (`@ship/shared`)
- **`e2e/`** — Playwright E2E tests

Package manager: **pnpm** (v10.27+). Never use npm or yarn. Uses `workspace:*` protocol.

## Key Commands

```bash
pnpm install                  # Install all deps
pnpm build                    # Build all packages
pnpm build:shared             # Build shared (must run before api/web builds)
pnpm dev                      # Start full dev environment
pnpm test                     # Run API tests (vitest)
pnpm test:e2e                 # Run Playwright E2E tests
pnpm db:seed                  # Seed database (500+ docs, 218 issues, 22 users, 35 sprints)
pnpm db:migrate               # Run database migrations
pnpm type-check               # TypeScript check all packages
pnpm lint                     # Lint all packages
```

## Deployment

Deployed on **Render**:
- Web: Static site (`pnpm --filter @ship/shared build && pnpm --filter @ship/web build`)
- API: Web service (`cd api && node dist/index.js`)
- Two PostgreSQL databases (see Database Strategy below)

Environment: `VITE_API_URL` is a build-time variable for the web app. Do not override it in build scripts.

---

## Phase 2: Optimization Specs

We are implementing fixes from an audit across 7 categories. All specs live in `docs/specs/`. The full spec index is in `docs/specs/README.md`.

### Branching Strategy

Each category has its own branch, already created:

| Category | Branch | DB Changes? |
|----------|--------|-------------|
| Cat 5 — Test Coverage | `cat5-test-coverage` | No |
| Cat 2 — Bundle Size | `cat2-bundle-size` | No |
| Cat 3 — API Response Time | `cat3-api-response-time` | No |
| Cat 4 — DB Query Efficiency | `cat4-db-query-efficiency` | Yes (2 additive indexes) |
| Cat 1 — Type Safety | `cat1-type-safety` | No |
| Cat 6 — Error Handling | `cat6-runtime-error-handling` | No |
| Cat 7 — Accessibility | `cat7-accessibility` | No |

**Workflow:** Implement category on its branch -> test -> merge to master -> rebase next category branch from master.

### Database Strategy

Two PostgreSQL instances on Render:
1. **Baseline DB** — Untouched, matches original `master`. Used for benchmark comparisons.
2. **Working DB** — Shared across all category branches. Only Cat 4 adds indexes (non-destructive).

---

## Rules for All Sessions

### Before Starting Work

1. **Read the spec first.** Every spec is in `docs/specs/cat{N}-*.md`. Read the full spec before writing any code.
2. **Check the branch.** Make sure you're on the correct category branch before making changes. Run `git branch` to confirm.
3. **Read existing code before modifying.** Understand what's there. Don't guess at implementations.
4. **Build shared first.** If touching types in `shared/`, run `pnpm build:shared` before testing api or web.

### While Implementing

5. **Follow the spec exactly.** Each spec has specific files to modify, acceptance criteria, and testing instructions. Don't deviate.
6. **One spec at a time.** Implement, test, verify, then document before moving to the next spec.
7. **Don't break other things.** After each spec, run the relevant test suite to confirm no regressions:
   - Cat 1, 4: `pnpm type-check` + `pnpm test`
   - Cat 2: `pnpm build:web` (check output sizes)
   - Cat 3: `pnpm test` + benchmark endpoints
   - Cat 5: `pnpm test` + `pnpm test:e2e`
   - Cat 6: `pnpm test` + manual verification
   - Cat 7: E2E axe tests or manual a11y check
8. **Don't add unnecessary code.** No extra features, no "while I'm here" refactors, no speculative abstractions. Implement exactly what the spec asks for.
9. **Preserve existing functionality.** All existing tests must still pass after your changes.

### After Each Spec Is Verified

10. **Document in the implemented file.** Go to `docs/category/implemented/cat{N}-*.md` and fill in the section for the completed spec. Replace the HTML comment placeholders with real content:

    - **What Changed:** Concrete description of code changes (files modified, what was added/removed/refactored).
    - **Why the Original Code Was Suboptimal:** Explain the specific problem — not just "it was bad" but the measurable impact (e.g., "every issues list query transferred 2.3MB of unused content fields").
    - **Why This Approach Is Better:** Explain why your solution works and reference the improvement (e.g., "reduces payload by 67%, query time drops from 340ms to 120ms").
    - **Tradeoffs:** Be honest about what you gave up or what could go wrong (e.g., "content must now be fetched separately when opening an issue, adding one extra query per issue view").

### After All Specs in a Category Are Done

11. **Run benchmarks.** Use the benchmark template in `docs/category/benchmark/cat{N}-*-benchmark.md`. Fill in the tables with real measured values. These must be measured against the **Working DB** with full seed data.
12. **Compare against baseline.** The Baseline DB exists specifically so benchmarks can be re-run on `master` for comparison. Note any before/after metrics.

---

## Category-Specific Rules and Gotchas

### Category 1 — Type Safety (1,417 violations baseline)

- **Spec files:** `cat1-db-row-types.md`, `cat1-discriminated-union.md`, `cat1-type-yjs-converter.md`, `cat1-align-web-tsconfig.md`
- The baseline is 1,417 violations from a human audit. The automated audit said different numbers — use the human audit number.
- Replacing `any` with `unknown` without proper type narrowing does NOT count as a fix. Every type must be meaningful and reflect actual data shapes.
- Spec 1.4 (tsconfig changes) will likely surface new errors across the web package. Fix the errors it surfaces — don't just suppress them.
- Run `pnpm type-check` after every change to track violation count.
- **Benchmark:** Count violations by type (any, as, !, ts-ignore) across all packages before and after.

### Category 2 — Bundle Size

- **Spec files:** `cat2-devtools-to-devdeps.md`, `cat2-route-level-splitting.md`, `cat2-lazy-emoji-picker.md`, `cat2-lazy-highlightjs.md`, `cat2-lazy-editor-extensions.md`
- Always build production (`pnpm build:web`) and check output chunk sizes. Vite prints them.
- When lazy-loading with `React.lazy()`, always wrap with `<Suspense fallback={...}>`. Don't leave loading states blank.
- Spec 2.1 (devtools): Make sure the devtools still work in development. Only exclude from production bundle.
- Spec 2.2 (route splitting): Test that direct URL navigation still works (not just client-side routing).
- **Benchmark:** Record total bundle size, largest chunks, and chunk count before and after.

### Category 3 — API Response Time

- **Spec files:** `cat3-issues-remove-content.md`, `cat3-pgpool-max.md`, `cat3-issues-pagination.md`
- The database MUST be seeded (`pnpm db:seed`) with full data before benchmarking. Empty DB benchmarks are meaningless.
- Spec 3.1: When removing `d.content` from the issues list query, make sure the document detail/edit view still fetches content. Don't break the editor.
- Spec 3.3 (pagination): Cursor-based, not offset-based. The spec is specific about this.
- Use `autocannon` or similar for benchmarking. Record P50, P95, P99 at 10, 25, and 50 concurrent connections.
- **Benchmark:** Measure the 5 most-used API endpoints under load.

### Category 4 — Database Query Efficiency

- **Spec files:** `cat4-auth-query-consolidation.md`, `cat4-issues-remove-person-join.md`, `cat4-wiki-index-fix.md`, `cat4-assignee-functional-index.md`, `cat4-scope-changes-batch.md`
- **This is the only category that modifies the database schema** (specs 4.3 and 4.4 add indexes).
- Write proper migrations for the index additions. These are additive only — no destructive changes.
- Spec 4.1 (auth consolidation): This touches the auth middleware which runs on EVERY request. Test thoroughly. A bug here breaks everything.
- Spec 4.5 (N+1 batch): The fix is `WHERE id = ANY($1)` — a single query replacing a loop. Make sure the array parameter is properly typed.
- Use `EXPLAIN ANALYZE` to verify query plans before and after index changes.
- **Benchmark:** Count total queries on main page load (baseline: 22 from human audit). Measure query execution times.

### Category 5 — Test Coverage (Highest Priority)

- **Spec files:** `cat5-e2e-esm-fix.md`, `cat5-web-unit-test-fix.md`
- Spec 5.1: Pin `get-port` to exactly `6.1.2`. Higher versions are ESM-only and break CJS require in the E2E test setup.
- Spec 5.2: Replace `html-encoding-sniffer` with `happy-dom` in web unit tests. The ESM/CJS incompatibility causes tests to fail silently.
- After fixes, ALL existing tests must pass. Run `pnpm test` and `pnpm test:e2e` to verify.
- **Benchmark:** Test pass/fail counts and coverage percentages before and after.

### Category 6 — Runtime Error Handling

- **Spec files:** `cat6-root-error-boundary.md`, `cat6-ws-backoff-429.md`, `cat6-ws-rate-limit-tracking.md`, `cat6-title-maxlength.md`, `cat6-silent-save-failure.md`
- Spec 6.1 (ErrorBoundary): Wrap at the root level in `main.tsx`, OUTSIDE all providers. This catches provider initialization errors too.
- Spec 6.2 (WebSocket backoff): Use exponential backoff with jitter. Don't use fixed retry intervals.
- Spec 6.3 (rate limit tracking): The bug is that closed connections aren't removed from the counter. Fix the cleanup, not the limit.
- Spec 6.5 (silent save): The current code swallows ROLLBACK errors. Surface them to the user via toast/notification.
- **Benchmark:** Trigger error scenarios and verify recovery behavior. Document error UX before and after.

### Category 7 — Accessibility

- **Spec files:** `cat7-document-page-fixes.md`, `cat7-my-week-fixes.md`, `cat7-projects-page-fixes.md`
- Use `@axe-core/playwright` for automated a11y testing (already in devDependencies).
- WCAG 2.1 AA is the target compliance level.
- Contrast fixes: Use the exact color values specified in the specs. Don't pick your own colors.
- ARIA attributes: Follow WAI-ARIA 1.2 patterns. Don't invent custom ARIA patterns.
- Spec 7.1 has the most items (4 distinct fixes). Implement and test each independently.
- **Benchmark:** Run axe scans on the 3 target pages, record violation counts before and after.

---

## Benchmarking Rules

When the user asks you to benchmark a category, follow this exact process:

### Step 1 — Read the Benchmark Template

Read `docs/category/benchmark/cat{N}-*-benchmark.md`. This contains:
- What you are measuring
- How to measure it (specific commands and tools)
- An **Audit Deliverable** table with blank fields to fill in
- An improvement target with pass/fail criteria

### Step 2 — Read the Original Audit Baseline

Read the corresponding original audit file at `docs/audit/{NN}-*.md` (e.g., `docs/audit/01-type-safety.md` for Cat 1). This contains the **baseline measurements** from the initial audit — the "before" numbers you're comparing against.

The audit files and their categories:
| Audit File | Category |
|------------|----------|
| `docs/audit/01-type-safety.md` | Cat 1 |
| `docs/audit/02-bundle-size.md` | Cat 2 |
| `docs/audit/03-api-response-time.md` | Cat 3 |
| `docs/audit/04-database-query-efficiency.md` | Cat 4 |
| `docs/audit/05-test-coverage.md` | Cat 5 |
| `docs/audit/06-runtime-error-handling.md` | Cat 6 |
| `docs/audit/07-accessibility.md` | Cat 7 |

### Step 3 — Run the Measurements

Run the actual benchmarks/measurements as described in the benchmark template. Use the same methodology as the original audit so comparisons are apples-to-apples. Use the **Working DB** (seeded with `pnpm db:seed`) for all measurements.

### Step 4 — Fill in the Benchmark File

Write the results into `docs/category/benchmark/cat{N}-*-benchmark.md`:

1. **Fill in the Audit Deliverable table** with your measured values (replace all `___` placeholders).
2. **Add a `## Comparison with Baseline` section** after the Audit Deliverable table containing:
   - A side-by-side table: `| Metric | Audit Baseline | Post-Fix | Change |`
   - Pull the "Audit Baseline" column values directly from the `docs/audit/` file
   - Calculate the percentage change for each metric
   - Note whether the improvement target was met
3. **Add a `## Analysis` section** with:
   - Which specs contributed most to the improvement
   - Any metrics that did NOT improve (and why)
   - Any unexpected results or regressions discovered during benchmarking
   - Recommendations for further optimization (reference Future Phase specs from `docs/specs/README.md` if relevant)

### Benchmark Rules

- **Same conditions.** Benchmarks must run under the same conditions as the original audit (same seed data volume, same hardware, same concurrency levels). If conditions differ, document the differences.
- **Database is pre-seeded.** The Working DB on Render already has 501 documents, 218 issues, 22 users, and 35 sprints. No need to re-seed unless the schema changes (Cat 4 indexes). If benchmarking locally, run `pnpm db:seed` first.
- **Run multiple times.** Run each measurement at least 3 times and use the median. Single-run numbers are unreliable.
- **Don't cherry-pick.** Report all metrics, including ones that didn't improve. Honest benchmarks are more useful than flattering ones.
- **Show your work.** Include the exact commands you ran so results can be reproduced.

---

## File Structure Reference

```
docs/
  audit/                            # Original audit baselines (read-only reference)
    01-type-safety.md               #   through 07-accessibility.md
    audit-report.md                 # Full audit report
  specs/                            # Fix specs (read-only reference)
    README.md                       # Spec index + database strategy
    cat{N}-*.md                     # Individual specs
  category/
    implemented/                    # Fill in after each spec is done
      cat{N}-*.md                   # Per-category implementation docs
    benchmark/                      # Fill in after all specs in category are done
      cat{N}-*-benchmark.md         # Per-category benchmark results + comparison
```
