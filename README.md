# ShipShape — Performance Audit & Fix Showcase

A forked project management platform used to demonstrate measurable performance, accessibility, and code quality improvements across 7 audit categories.

## Live Deployments

| Environment             | Branch                        | URL | Description                                                   |
| ----------------------- | ----------------------------- | --- | ------------------------------------------------------------- |
| **Production**          | `master`                      | TBD | All fixes merged                                              |
| **Baseline**            | `base`                        | TBD | Original codebase — no fixes applied                          |
| **Type Safety**         | `cat1-type-safety`            | TBD | 1,417 violations reduced by 25%+                              |
| **Bundle Size**         | `cat2-bundle-size`            | TBD | 2.1 MB monolithic chunk broken up, devtools removed from prod |
| **API Response Time**   | `cat3-api-response-time`      | TBD | p99 reduced 20%+ on worst endpoints                           |
| **DB Query Efficiency** | `cat4-db-query-efficiency`    | TBD | Main page queries cut from 22 → 14 (36% reduction)            |
| **Test Coverage**       | `cat5-test-coverage`          | TBD | Broken test suites restored (0 → 1,028 passing)               |
| **Error Handling**      | `cat6-runtime-error-handling` | TBD | Root ErrorBoundary, WebSocket backoff, rate limit fix         |
| **Accessibility**       | `cat7-accessibility`          | TBD | Critical ARIA violations fixed, Lighthouse scores raised      |

## Tech Stack

- **Frontend:** React, Vite, TipTap editor, Yjs (real-time collaboration)
- **Backend:** Express, PostgreSQL, WebSocket
- **Shared:** TypeScript monorepo (pnpm workspaces)

## Project Structure

```
api/          Express backend + WebSocket collaboration server
web/          React + Vite frontend
shared/       TypeScript types shared between packages
docs/
  audit/      Audit report and detailed findings per category
  specs/      Phase 2 fix specifications (30 specs across 7 categories)
e2e/          Playwright end-to-end tests
ship_archive/ Archived files from the original repo (terraform, old docs, etc.)
```

## Audit Summary

| Category            | Baseline                                                            | Target                                            |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| Type Safety         | 1,417 violations (392 `any`, 280 `as`, 35 `!`, ~709 implicit)       | Eliminate 25% (≈354)                              |
| Bundle Size         | 2,197 KB raw / 620 KB gzip — 94% in one chunk                       | 15% total reduction or 20% initial load reduction |
| API Response Time   | `GET /api/issues` p99 120ms, `GET /api/documents` p99 142ms at c=50 | 20% p99 reduction on 2+ endpoints                 |
| DB Query Efficiency | 22 queries per page load, 11 auth overhead                          | 36% reduction (22 → 14)                           |
| Test Coverage       | 451 passing / 1,479 written (web tests broken, E2E blocked)         | Restore all 1,479 tests to executable             |
| Error Handling      | No root ErrorBoundary, WS reconnect storm on 429                    | Fix 3 user-facing error handling gaps             |
| Accessibility       | 3 critical, 10 serious violations, 6 contrast failures              | Fix all critical + serious on 3 key pages         |

## Local Development

Requires PostgreSQL running locally.

```bash
pnpm install        # Install dependencies
pnpm dev            # Start API + web dev servers
pnpm test           # Run API unit tests
pnpm build          # Production build
```

## Documentation

- [Audit Report](docs/audit/audit-report.md) — Full findings across all 7 categories
- [Fix Specs](docs/specs/README.md) — 30 implementation specs with priority ordering
- [Detailed Findings](docs/audit/) — Per-category methodology, EXPLAIN ANALYZE plans, benchmarks
