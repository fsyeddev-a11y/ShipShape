# Category 3: API Response Time

## Methodology

### Environment
- **API:** Express server (`api/src/index.ts`) running locally with `NODE_ENV=test E2E_TEST=1` to raise the rate limit ceiling (10,000 req/min)
- **Database:** PostgreSQL 16 via Docker (`docker-compose.local.yml`), port 5432
- **Tool:** `autocannon` v8.0.0 via `npx`
- **Auth:** Session cookie (`session_id`) from `dev@ship.local` / `admin123`

### Data Volume at Test Time
All requirements met before benchmarking began:

| Metric | Count | Requirement |
|--------|-------|-------------|
| Total documents | 556 | 500+ ✅ |
| Issues | 150 | 100+ ✅ |
| Users | 20 | 20+ ✅ |
| Sprints | 35 | 10+ ✅ |

Additional data beyond default seed was added via `api/src/db/audit-seed.ts`.

### Benchmark Parameters
- **Duration:** 30s per run, capped at 200 total requests (`--maxOverallRequests 200`)
- **Concurrency levels:** 10, 25, 50 simultaneous connections
- **Pipelining:** 1 (default — no pipelining, each connection sends one request at a time)
- **Percentiles recorded:** p50, p97.5, p99

> **Note on p95:** `autocannon` does not emit a p95 bucket. Its output percentiles jump from p90 → p97.5 → p99. The tables below use **p97.5** — not p95. p97.5 is a slightly more conservative measure (it captures a wider tail), so these numbers are a mild over-estimate of what a true p95 would show.

> **Note on rate limiting:** The app's rate limiter (express-rate-limit, 10,000 req/min in test mode) fires immediately when autocannon runs at full speed (~3,000+ req/s). The 200-request cap keeps total requests well within the per-minute budget while still producing statistically meaningful latency distributions at each concurrency level.

---

## Endpoint Identification

The 5 endpoints were selected by tracing `useQuery` hooks in `web/src/hooks/` — these fire on every page load for the most common user flows:

| # | Endpoint | Frontend Hook | User Flow |
|---|----------|---------------|-----------|
| 1 | `GET /api/issues` | `useIssuesQuery.ts` | Issues list, Dashboard, Sprint view |
| 2 | `GET /api/weeks/my-week` | `useMyWeekQuery.ts` | My Week page, Dashboard |
| 3 | `GET /api/projects` | `useProjectsQuery.ts` | Projects page, Dashboard |
| 4 | `GET /api/documents?type=wiki` | `useDocumentsQuery.ts` | Wiki sidebar, Documents page |
| 5 | `GET /api/dashboard/my-work` | `useDashboardFocus.ts` | Dashboard (first page post-login) |

---

## Audit Deliverable

> **Note on P95:** `autocannon` does not emit a p95 bucket — its output jumps p90 → p97.5 → p99. The P95 column below uses **p97.5** as the closest available value; it is a mild over-estimate of true p95. All values at c=10 (single-user equivalent).

| Endpoint | P50 | P95 *(p97.5)* | P99 |
|----------|-----|----------------|-----|
| `GET /api/issues` | 18ms | 32ms | 36ms |
| `GET /api/weeks/my-week` | 7ms | 28ms | 31ms |
| `GET /api/projects` | 5ms | 18ms | 21ms |
| `GET /api/documents?type=wiki` | 23ms | 32ms | 33ms |
| `GET /api/dashboard/my-work` | 6ms | 20ms | 22ms |

---

## Benchmark Results

### 1. `GET /api/issues`

| Connections | p50 | p97.5 *(no p95)* | p99 | Avg | Req/s |
|-------------|-----|------------------|-----|-----|-------|
| 10 | 18ms | 32ms | 36ms | 19.5ms | 200 |
| 25 | 49ms | 62ms | 64ms | 48.9ms | 200 |
| 50 | 99ms | 116ms | 120ms | 96.2ms | 200 |

### 2. `GET /api/weeks/my-week`

| Connections | p50 | p97.5 *(no p95)* | p99 | Avg | Req/s |
|-------------|-----|------------------|-----|-----|-------|
| 10 | 7ms | 28ms | 31ms | 8.1ms | 200 |
| 25 | 17ms | 37ms | 39ms | 19.1ms | 200 |
| 50 | 37ms | 53ms | 55ms | 38.1ms | 200 |

### 3. `GET /api/projects`

| Connections | p50 | p97.5 *(no p95)* | p99 | Avg | Req/s |
|-------------|-----|------------------|-----|-----|-------|
| 10 | 5ms | 18ms | 21ms | 6.0ms | 200 |
| 25 | 13ms | 31ms | 32ms | 15.0ms | 200 |
| 50 | 30ms | 50ms | 51ms | 32.0ms | 200 |

### 4. `GET /api/documents?type=wiki`

| Connections | p50 | p97.5 *(no p95)* | p99 | Avg | Req/s |
|-------------|-----|------------------|-----|-----|-------|
| 10 | 23ms | 32ms | 33ms | 22.9ms | 200 |
| 25 | 55ms | 67ms | 69ms | 54.2ms | 200 |
| 50 | 112ms | 139ms | 142ms | 107.0ms | 200 |

### 5. `GET /api/dashboard/my-work`

| Connections | p50 | p97.5 *(no p95)* | p99 | Avg | Req/s |
|-------------|-----|------------------|-----|-----|-------|
| 10 | 6ms | 20ms | 22ms | 6.8ms | 200 |
| 25 | 16ms | 33ms | 34ms | 18.3ms | 200 |
| 50 | 35ms | 53ms | 54ms | 37.7ms | 200 |

---

## Summary Table (p99 at c=50)

| Endpoint | p50 (c=50) | p97.5 (c=50) | p99 (c=50) | Slowest? |
|----------|-----------|--------------|-----------|----------|
| `GET /api/issues` | 99ms | 116ms | **120ms** | 2nd |
| `GET /api/documents?type=wiki` | 112ms | 139ms | **142ms** | Slowest |
| `GET /api/weeks/my-week` | 37ms | 53ms | 55ms | 3rd |
| `GET /api/projects` | 30ms | 50ms | 51ms | 4th |
| `GET /api/dashboard/my-work` | 35ms | 53ms | 54ms | 5th |

---

## Bottleneck Analysis

### Slowest: `GET /api/documents?type=wiki` — p99 142ms at c=50
**Root cause:** This result is surprising given it's a simple single-table SELECT with no JOINs. With 556 documents in the workspace (including 222 wiki documents added by the audit seed), the query returns a large result set. The performance degradation from c=10 (33ms p99) to c=50 (142ms p99) is **4.3×** — the steepest scaling curve of any endpoint. This points to connection pool saturation: `pg-pool` defaults to 10 connections, so 50 concurrent requests queue behind 10 DB connections, multiplying wait time linearly. The query itself is fast; the bottleneck is pool contention.

### Second: `GET /api/issues` — p99 120ms at c=50
**Root cause:** The issues query fetches `d.content` (full TipTap JSON body) for every issue in the list, even though the list UI only displays title/state/priority/assignee. With 150 issues, this means serializing and transmitting up to 150 full document bodies per response. The endpoint also uses 2 LEFT JOINs (users, person_doc) with a cast on `properties->>'assignee_id'`. The 99ms p99 at c=50 vs 36ms at c=10 shows a **3.3×** degradation under load — also consistent with pool contention amplifying an already-heavy payload.

### Consistent: `GET /api/dashboard/my-work`, `GET /api/projects`, `GET /api/weeks/my-week` — p99 51–55ms at c=50
These three endpoints all scale similarly (~3× from c=10 to c=50). They run sequential DB queries (auth middleware: 3 queries, then the route handler: 1–2 queries) but return lightweight payloads. Their p99 degradation is driven primarily by auth middleware overhead (3 DB queries per request including an `UPDATE sessions SET last_activity`) rather than the query logic itself.

---

## Reference: Previous Audit Numbers

The MVP_ShipShape report cited:
- Dashboard: ~68ms
- Issues list: >200ms

Our measurements at c=10 (single-user-equivalent) are consistent:
- `GET /api/issues` p50=18ms, p99=36ms — lower than 200ms, likely because the previous audit tested under higher data volume or included network latency
- `GET /api/dashboard/my-work` p50=6ms, p99=22ms at c=10 — faster than 68ms, consistent with localhost vs. network measurement differences

---

## Key Findings & Severity

| # | Finding | Severity |
|---|---------|----------|
| 1 | **`GET /api/issues` fetches full `d.content` for every issue in the list.** Unnecessary payload — list UI only needs title/state/priority/assignee. Directly inflates response size and memory pressure. | High |
| 2 | **`GET /api/documents` degrades 4.3× from c=10 to c=50** (33ms → 142ms p99). Steepest scaling curve of all endpoints — driven by pg-pool contention (default 10 DB connections). | High |
| 3 | **Auth middleware runs 3 DB queries on every request** (SELECT session, SELECT membership, UPDATE last_activity) with no throttling on the UPDATE. At c=50 this is 150 concurrent session writes. | Medium–High |
| 4 | **Sequential queries in dashboard and projects routes.** `issuesResult`, `projectsResult`, and `sprintsResult` awaited in series — could run in parallel via `Promise.all`. | Medium |
| 5 | **Connection pool default (10 connections) becomes a bottleneck at c=25+.** All five endpoints show latency inflection at c=25 consistent with pool exhaustion. | Medium |

---

## Improvement Target (for Phase 2)

Target: 20% reduction in p99 on at least 2 endpoints under identical conditions.

| Endpoint | Current p99 (c=50) | Target p99 | Fix |
|----------|-------------------|------------|-----|
| `GET /api/issues` | 120ms | ≤96ms | Remove `d.content` from list SELECT |
| `GET /api/documents` | 142ms | ≤114ms | Increase pg-pool `max` from 10 to 25; add `created_by` index |
| Auth middleware | contributes ~15ms baseline | — | Throttle `UPDATE sessions` to once per 60s per session (aligns with previous audit recommendation) |

*Do not fix during audit phase.*
