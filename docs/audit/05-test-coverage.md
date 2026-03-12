# Category 5: Test Coverage and Quality

## Methodology

### Environment
- **API unit tests:** Vitest 4.0.17, Node.js environment, `pnpm test` (runs `pnpm --filter @ship/api test`)
- **Web unit tests:** Vitest 4.0.17, jsdom environment, `cd web && pnpm vitest run`
- **E2E tests:** Playwright 1.57.0 with Testcontainers (per-worker isolated PostgreSQL + API + Vite preview)
- **Flakiness check:** API unit suite run 3× consecutively; E2E suite not re-run (requires full build + Docker)
- **Coverage tooling:** `@vitest/coverage-v8` via `pnpm vitest run --coverage` in `api/`; web coverage not measurable (test suite broken)

### Test Inventory

| Layer | Files | Test Cases | Runner |
|-------|-------|------------|--------|
| API unit/integration | 28 files | 451 | Vitest (`pnpm test`) |
| Web component unit | 16 files | 162 | Vitest (`cd web && pnpm vitest run`) |
| E2E (Playwright) | 71 spec files | 866 | Playwright (`pnpm test:e2e`) |
| **Total written** | **115 files** | **1,479** | — |

### What `pnpm test` runs
The root `pnpm test` command runs **only** `pnpm --filter @ship/api test` — the 28 API unit test files. Web unit tests and E2E tests are **not** included in the default `pnpm test` run.

---

## Audit Deliverable

| Metric | Your Baseline |
|--------|---------------|
| Total tests (written) | **1,479** (451 API + 162 web + 866 E2E) |
| Pass / Fail / Flaky | **451 / 0 / 0** (API only — the only suite that runs via `pnpm test`) |
| Suite runtime | **12.7s** (API unit suite) |
| Critical flows with zero coverage | CAIA/OAuth government login, real-time WebSocket collaboration (multi-user), session timeout (E2E path) |
| Code coverage % (if measured) | **api: 40.34% statements / 33.44% branches** · **web: 0%** (test suite broken — dependency incompatibility) |

---

## Test Suite Status by Layer

### API Unit Tests — 28 files, 451 tests, all passing

Run `pnpm test` (or `pnpm --filter @ship/api test`). Passes 451/451 consistently across 3 runs.

**Consistent stderr warnings (not failures):**
- `Activity fetch error: Error: Database connection failed` — expected, from error-path test in `activity.test.ts` that intentionally triggers a DB error to verify the route's error handler. The test passes; the stderr is the simulated error being logged.
- `Auth middleware error: Error: DB connection failed` — same pattern in `auth.test.ts` error-path tests.
- `CAIA not configured, skipping initialization` — info log from `caia.ts` service startup on routes that import it. Not a failure.

**Files and test counts (selected):**

| File | Tests |
|------|-------|
| `src/__tests__/auth.test.ts` | 15 |
| `src/__tests__/activity.test.ts` | 13 |
| `src/routes/documents.test.ts` | ~50+ |
| `src/routes/issues.test.ts` | ~30+ |
| `src/routes/weeks.test.ts` | — |
| `src/routes/search.test.ts` | 11 |
| `src/routes/projects.test.ts` | 14 |
| `src/routes/project-retros.test.ts` | 11 |
| `src/routes/sprint-reviews.test.ts` | 10 |
| `src/routes/issues-history.test.ts` | 12 |
| `src/routes/files.test.ts` | 7 |
| `src/utils/__tests__/business-days.test.ts` | 27 |
| `src/collaboration/__tests__/collaboration.test.ts` | — |
| *(+ 15 more files)* | — |
| **Total** | **451** |

### Web Unit Tests — 16 files, 162 tests, **0 running (all fail)**

**Root cause:** All 16 web test files fail with `ERR_REQUIRE_ESM` at worker startup — before any test executes:

```
Error: [vitest-pool]: Failed to start forks worker for test files ...
Caused by: Error: require() of ES Module
  /node_modules/.pnpm/@exodus+bytes@1.8.0/.../encoding-lite.js
  from .../html-encoding-sniffer/lib/html-encoding-sniffer.js not supported.
```

The dependency chain: `vitest jsdom environment` → `jsdom` → `html-encoding-sniffer@6.0.0` → `@exodus/bytes@1.8.0` (ESM-only) — which cannot be `require()`d by the CJS interop layer. This is a package compatibility issue introduced by a dependency upgrade. **Zero of 162 web tests run.**

**Affected files (all 16):**
- `web/src/components/editor/DragHandle.test.ts`
- `web/src/components/editor/MentionExtension.test.ts`
- `web/src/components/editor/TableOfContents.test.ts`
- `web/src/components/editor/DetailsExtension.test.ts`
- `web/src/components/editor/FileAttachment.test.ts`
- `web/src/components/editor/ImageUpload.test.ts`
- `web/src/hooks/useSelection.test.ts`
- `web/src/hooks/useSessionTimeout.test.ts`
- `web/src/lib/document-tabs.test.ts`
- `web/src/lib/accountability.test.ts`
- `web/src/components/PlanQualityBanner.test.tsx`
- `web/src/components/icons/uswds/Icon.test.tsx`
- `web/src/components/ui/ScrollFade.test.tsx`
- `web/src/contexts/SelectionPersistenceContext.test.tsx`
- `web/src/pages/Dashboard.test.tsx`
- `web/src/styles/drag-handle.test.ts`

### E2E Tests — 71 spec files, 866 test cases

E2E tests were **not run** during this audit phase (full run requires Docker for Testcontainers + full build). The suite structure and coverage mapping are assessed via code inspection.

**Infrastructure:** Each Playwright worker gets its own isolated PostgreSQL container (via Testcontainers), dedicated API server, and Vite preview server. Workers scale based on available memory (max 8, typically 4 locally). 1 retry locally, 2 in CI.

**No `test.skip()` or `test.fixme()` calls found** across all 71 spec files (grep result: 0 matches). All 866 E2E test cases are nominally active.

---

## Critical User Flow Coverage Map

| Critical Flow | E2E Coverage | API Unit Coverage | Notes |
|---------------|-------------|-------------------|-------|
| Email/password login | `auth.spec.ts` (5 tests) | `auth.test.ts` (15 tests) | Well covered |
| Logout / session expiry | `auth.spec.ts`, `session-timeout.spec.ts` | `auth.test.ts` | Covered |
| **CAIA/OAuth government login** | **None** | **None** | **Zero coverage** |
| Document CRUD (create/edit/delete) | `documents.spec.ts`, `document-workflows.spec.ts` | `documents.test.ts` | Covered |
| Real-time collaboration (multi-user, same doc) | `data-integrity.spec.ts`, `content-caching.spec.ts` | `collaboration.test.ts` | Unit tests cover Yjs internals; no multi-browser E2E test |
| Issue CRUD + state transitions | `issues.spec.ts`, `issues-bulk-operations.spec.ts` | `issues.test.ts` | Covered |
| Sprint/week creation and management | `weeks.spec.ts`, `accountability-week.spec.ts` | `weeks.test.ts` | Covered |
| Search (mentions, learnings) | `search-api.spec.ts` | `search.test.ts` | Covered |
| File upload | `file-attachments.spec.ts`, `file-upload-api.spec.ts` | `files.test.ts` | Covered |
| Admin workspace member management | `admin-workspace-members.spec.ts` | `workspaces.test.ts` | Covered |
| Cross-workspace isolation | `authorization.spec.ts`, `document-isolation.spec.ts` | — | E2E only |
| **WebSocket disconnect recovery** | **None found** | **None** | **Zero coverage** |
| **Concurrent edit conflict (two users, same doc)** | **None found** | Partial (`collaboration.test.ts` rate limiting) | **No two-browser E2E** |

### Flows with Zero Coverage

1. **CAIA/OAuth government login** — The production authentication path for all U.S. Treasury users is PIV smartcard login via CAIA (`api/src/routes/caia-auth.ts`, `api/src/services/caia.ts`). Zero E2E tests. Zero unit tests. The only test coverage for auth is the email/password dev path (`dev@ship.local`), which is disabled in production. The code path that every real government user takes on every login is completely untested.

2. **WebSocket disconnect and reconnection** — No test verifies that a user who loses their network connection mid-edit reconnects successfully, that their in-flight changes are not lost, and that the document reaches a consistent state. `error-handling.spec.ts` and `data-integrity.spec.ts` reference WebSocket but do not simulate disconnect/reconnect.

3. **Concurrent edit conflict (two simultaneous users)** — No test opens the same document in two separate browser contexts simultaneously and verifies that Yjs CRDT merge produces correct output. The collaboration unit tests exercise internal Yjs functions but do not test the full WebSocket → server → DB → client round-trip with two live users.

---

## Code Coverage

Coverage measured via `pnpm vitest run --coverage` in the `api/` package using `@vitest/coverage-v8`.

| Package | Statements | Branches | Notes |
|---------|-----------|----------|-------|
| `api/` | **40.34%** | **33.44%** | 28 test files, 451 tests |
| `web/` | **0%** | **0%** | Test suite completely broken (ESM/CJS dependency error); no tests execute |

**API coverage context:** 40% statement coverage on a backend with 28 test files means the majority of route handler logic, middleware branches, and service functions are not exercised by the unit suite. Branch coverage at 33% is particularly notable — two-thirds of conditional logic paths (error branches, edge cases, auth states) run in production but never in tests.

**Web coverage:** Zero. The `jsdom` environment fails before any test runs due to the `@exodus/bytes` ESM incompatibility. All 162 web tests are written but none execute.

---

## Flakiness Check

**API unit suite — 3 runs, all passing:**

| Run | Tests | Pass | Fail | Duration |
|-----|-------|------|------|----------|
| 1 | 451 | 451 | 0 | 12.71s |
| 2 | 451 | 451 | 0 | 12.75s |
| 3 | 451 | 451 | 0 | 12.75s |

No flaky tests detected in the API unit suite. Results are deterministic and consistent.

**Web unit suite:** Cannot assess — all 16 files fail before any test executes. Flakiness is not measurable.

**E2E suite:** Not run during audit. Playwright config sets `retries: 1` locally (1 retry before counting as failed). The presence of retry helpers in `e2e/fixtures/test-helpers.ts` (`triggerMentionPopup`, `hoverWithRetry`, `waitForTableData`) indicates known timing sensitivities in at least 3 areas (mention popups, hover assertions, table loading). These are documented workarounds rather than root-cause fixes, suggesting latent flakiness.

---

## Key Findings & Severity

| # | Finding | Severity |
|---|---------|----------|
| 1 | **All 16 web unit test files are completely broken (`ERR_REQUIRE_ESM`).** 162 tests are written but 0 run. The `jsdom` environment dependency chain hits an ESM/CJS incompatibility introduced by a package upgrade. Frontend components (editor extensions, hooks, UI components, Dashboard page) have no passing unit test coverage. | High |
| 2 | **CAIA/OAuth government login path has zero test coverage.** The email/password path (`dev@ship.local`) works in dev only — it is disabled in production. Every real Treasury user authenticates via CAIA PIV smartcard OAuth. This flow is completely untested at unit and E2E levels. Any regression breaks all government user logins silently. | High |
| 3 | **API branch coverage is 33%.** Two-thirds of conditional logic paths are untested. Statement coverage is 40%. Web coverage is 0% (test suite broken). The majority of error-handling branches, auth edge cases, and service logic run in production without any automated test verification. | Medium–High |
| 4 | **`pnpm test` only runs API unit tests.** The root test command does not include web unit tests or E2E tests. A developer running `pnpm test` gets a green result even with all 16 web test files broken and the E2E suite untouched. There is no single command that runs the full test suite. | Medium |
| 5 | **No multi-browser E2E test for real-time collaboration.** The primary differentiating feature (Yjs CRDT collaborative editing) has no end-to-end test with two simultaneous users. A regression in the WebSocket collaboration server would not be caught by automated tests. | Medium |
| 6 | **WebSocket disconnect/reconnection is untested.** No test verifies data integrity after a network drop during active editing. The previous audit cited "database connection drops lose work permanently" as a Critical finding (Cat 6); no regression test guards against this. | Medium |
| 7 | **E2E flakiness is managed by workaround helpers, not root-cause fixes.** Three documented retry helpers (`triggerMentionPopup`, `hoverWithRetry`, `waitForTableData`) mask timing-sensitive test paths. Playwright's `retries: 1` config absorbs additional flakiness. True flake rate is not measured. | Low–Medium |

---

## Reference: Previous Audit Numbers

The previous audit (README_Audit.md / MVP_ShipShape) cited:
- **1,333 written tests, only 34% actually running** (~453 passing)
- **"Broken test suites because of mismatched code file formats"**
- **"Zero automated tests for government login paths"**

Our measurement:

| Metric | Previous Audit | Current Audit | Delta |
|--------|---------------|---------------|-------|
| Total tests written | 1,333 | **1,479** | +146 |
| Tests currently running | ~453 (34%) | **451** (API unit only) | Flat |
| Broken suites | "mismatched file formats" | **16 web files — ESM/CJS error** | Different root cause, same symptom |
| Government login coverage | Zero | **Zero** | Unchanged |

**Cross-check:** The previous audit's "34%" figure (453/1,333) and our current "API-only" count (451/1,479 = 30%) are consistent. The web unit suite has been broken throughout — the previous audit's "mismatched code file formats" and the current `ERR_REQUIRE_ESM` are different manifestations of the same underlying problem: the web test environment is incompatible with the current dependency tree. The count grew from 1,333 to 1,479 (new tests added), but the runnable fraction did not improve — it decreased slightly (34% → 30%).

---

## Improvement Target (for Phase 2)

Target: Add meaningful tests for 3 previously untested critical paths, or fix 3 flaky tests with documented root cause analysis.

| Priority | Fix | Impact |
|----------|-----|--------|
| 1 | **Fix web unit test ESM/CJS breakage** — pin or upgrade `jsdom`/`html-encoding-sniffer`/`@exodus/bytes` to a compatible combination, or switch Vitest pool mode to `vmForks` which avoids the `require()` interop issue | Restores 162 tests to running; unblocks all frontend coverage |
| 2 | **Install `@vitest/coverage-v8`** and run `pnpm vitest run --coverage` to produce baseline line/branch numbers for the API | Makes coverage debt visible; enables regression tracking |
| 3 | **Add CAIA auth unit tests** — mock the CAIA OAuth callback flow in `caia-auth.ts` to cover: successful login (email match), new user provisioning, email not in .gov/.mil (rejection), invalid state token (CSRF), and expired state | Catches the highest-risk zero-coverage path |
| 4 | **Add two-browser E2E test for collaborative editing** — open the same document in two Playwright browser contexts simultaneously; type in both; verify both see each other's changes | Tests the core differentiating feature end-to-end |

_Do not fix during audit phase._
