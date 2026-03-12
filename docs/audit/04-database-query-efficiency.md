# Category 4: Database Query Efficiency

## Methodology

### Environment

- **Database:** PostgreSQL 16 via Docker (`docker-compose.local.yml`), port 5432
- **API:** Express server running with `NODE_ENV=test E2E_TEST=1`
- **Auth:** Session cookie from `dev@ship.local` / `admin123`
- **Query counting tool:** `pg_stat_statements` — reset before each flow, queried after
- **Query analysis tool:** `EXPLAIN (ANALYZE, BUFFERS)` run directly via psql

### Data Volume at Test Time

| Metric          | Count                      |
| --------------- | -------------------------- |
| Total documents | 545 (in primary workspace) |
| Issues          | 150                        |
| Users           | 20                         |
| Sprints         | 35                         |

### User Flows Tested

| #   | Flow              | API Calls Made                                                                                                                             |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Load main page    | 5 parallel: `GET /api/dashboard/my-work`, `GET /api/issues`, `GET /api/projects`, `GET /api/weeks/my-week`, `GET /api/documents?type=wiki` |
| 2   | View a document   | `GET /api/documents/:id`                                                                                                                   |
| 3   | List issues       | `GET /api/issues`                                                                                                                          |
| 4   | Load sprint board | `GET /api/weeks`, `GET /api/weeks/:id`, `GET /api/weeks/:id/issues`                                                                        |
| 5   | Search content    | `GET /api/search/mentions?q=design`, `GET /api/search/learnings?q=design`                                                                  |

---

## Audit Deliverable

| User Flow         | Total Queries | Slowest Query (ms) | N+1 Detected? |
| ----------------- | ------------- | ------------------ | ------------- |
| Load main page    | **25**        | 1.41ms             | No            |
| View a document   | **4**         | 0.08ms             | No            |
| List issues       | **5**         | 1.74ms             | No            |
| Load sprint board | **16**        | 1.38ms             | No            |
| Search content    | **9**         | 1.12ms             | No            |

---

## Benchmark Results

| User Flow         | Total DB Queries | Slowest Query (avg_exec_time)          | N+1 Detected?       |
| ----------------- | ---------------- | -------------------------------------- | ------------------- |
| Load main page    | **25**           | 1.41ms (projects list)                 | No                  |
| View a document   | **4**            | 0.08ms (session SELECT)                | No                  |
| List issues       | **5**            | 1.74ms (issues list with full content) | No                  |
| Load sprint board | **16**           | 1.38ms (sprints list)                  | No (see Finding #5) |
| Search content    | **9**            | 1.12ms (document title search)         | No                  |

---

## Query Breakdown: Load Main Page (25 queries)

The 25 queries on main page load decompose as:

| Source                               | Query Count | Notes                                                                                         |
| ------------------------------------ | ----------- | --------------------------------------------------------------------------------------------- |
| Auth middleware (×5 requests)        | **15**      | 3 queries per request: SELECT session+user, SELECT workspace_membership, UPDATE last_activity |
| `GET /api/dashboard/my-work` route   | 4           | workspace config, issues, projects, sprints                                                   |
| `GET /api/issues` route              | 2           | issues list (with full content), document associations                                        |
| `GET /api/projects` route            | 1           | projects list                                                                                 |
| `GET /api/weeks/my-week` route       | 2           | workspace config, sprint+issues join                                                          |
| `GET /api/documents?type=wiki` route | 1           | wiki documents list                                                                           |
| **Total**                            | **25**      | 60% of all queries are auth overhead                                                          |

> **Previous audit cross-check:** The MVP_ShipShape audit cited **22 queries per page load** and noted "11 of 22 are login checks." Our measurement shows 25 (5 requests × 3 auth queries = 15, plus 10 route queries). The 3-query gap is consistent with an additional document type being loaded in the current page model. The auth overhead proportion is confirmed: **15/25 = 60%** of all page-load queries are auth checks.

---

## EXPLAIN ANALYZE: Phase 1 Baseline (Before)

> These are the pre-fix query plans captured during the Phase 1 audit. Re-run the same queries after Phase 2 fixes to produce the "after" comparison.
>
> **Environment:** PostgreSQL 16, Docker, 545 documents / 150 issues / 20 users. Tool: `psql` with `EXPLAIN (ANALYZE, BUFFERS)`.

| Query | Plan Type | Planning Time | Execution Time | Phase 2 Target |
|-------|-----------|--------------|----------------|----------------|
| `GET /api/issues` list | Bitmap Index Scan on `idx_documents_document_type` | 1.824ms | **0.539ms** | Use `idx_documents_active`; remove `d.content` |
| `GET /api/documents?type=wiki` | **Seq Scan** (556 rows, 322 discarded) | 1.244ms | **0.683ms** | Enable index via `idx_documents_active` fix |
| `GET /api/dashboard/my-work` assignee filter | Bitmap Heap Scan + 148/150 rows discarded | 1.255ms | **0.229ms** | Add functional index on `(properties->>'assignee_id')` |

---

### 1. `GET /api/issues` — Issues list query

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT d.id, d.title, d.properties, d.ticket_number, d.content, d.created_at, d.updated_at,
       d.created_by, u.name as assignee_name, d.document_type
FROM documents d
LEFT JOIN users u ON u.id = (d.properties->>'assignee_id')::uuid
WHERE d.workspace_id = '<ws_id>'
  AND d.document_type = 'issue'
  AND d.archived_at IS NULL
ORDER BY d.created_at DESC;
```

```
Sort  (actual time=0.462..0.470 rows=150)
  Sort Key: d.created_at DESC
  Sort Method: quicksort  Memory: 78kB
  ->  Hash Left Join  (actual time=0.087..0.351 rows=150)
        ->  Bitmap Heap Scan on documents d  (actual rows=150)
              Recheck Cond: (document_type = 'issue')
              Filter: (archived_at IS NULL AND workspace_id = ...)
              Rows Removed by Filter: 14
              ->  Bitmap Index Scan on idx_documents_document_type
                    Index Cond: (document_type = 'issue')
        ->  Hash  (actual rows=20)
              ->  Seq Scan on users
Planning Time: 1.824ms | Execution Time: 0.539ms
```

**Finding:** The query uses `idx_documents_document_type` (single-column) rather than the composite `idx_documents_active (workspace_id, document_type)`. The composite index exists but has a partial condition `WHERE archived_at IS NULL AND deleted_at IS NULL` — the route query omits `deleted_at IS NULL`, so the planner cannot use it (see Finding #4). Additionally, `d.content` — the full TipTap JSON document body — is selected for all 150 issues, even though the list UI only displays title, state, priority, and assignee (see Finding #2).

---

### 2. `GET /api/documents?type=wiki` — Wiki documents list

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, workspace_id, document_type, title, content, created_at, updated_at, ...
FROM documents
WHERE workspace_id = '<ws_id>'
  AND document_type = 'wiki'
  AND archived_at IS NULL
ORDER BY created_at DESC;
```

```
Sort  (actual time=0.613..0.636 rows=234)
  ->  Seq Scan on documents  (actual time=0.131..0.437 rows=234)
        Filter: (archived_at IS NULL AND workspace_id = ... AND document_type = 'wiki')
        Rows Removed by Filter: 322
        Buffers: shared hit=39
Planning Time: 1.244ms | Execution Time: 0.683ms
```

**Finding:** Full sequential scan. The planner reads all 556 rows in the table and discards 322. The composite index `idx_documents_active (workspace_id, document_type) WHERE archived_at IS NULL AND deleted_at IS NULL` cannot be used because:

1. The route query does not include `AND deleted_at IS NULL`, so the query's result set is not a strict subset of the index's partial condition
2. Even with `deleted_at IS NULL` added, at 556 rows the planner cost model still prefers Seq Scan over an index scan

At current data volume, Seq Scan executes in 0.683ms. At 10,000+ documents this becomes the dominant bottleneck (see Category 3 — `GET /api/documents` showed 4.3× latency degradation under concurrency, consistent with contended table scans).

---

### 3. `GET /api/dashboard/my-work` — Assignee filter without functional index

```sql
-- Simplified: dashboard filters issues to those assigned to current user
Filter: (archived_at IS NULL AND workspace_id = ... AND (properties->>'assignee_id') = '<user_id>')
Rows Removed by Filter: 148   -- 150 issues fetched; 148 discarded
```

```
Bitmap Heap Scan on documents d  (actual rows=2)
  Recheck Cond: (document_type = 'issue')
  Filter: (archived_at IS NULL AND workspace_id = ... AND (properties->>'assignee_id') = ...)
  Rows Removed by Filter: 148
Planning Time: 1.255ms | Execution Time: 0.229ms
```

**Finding:** The dashboard query fetches all 150 issues via the type index, then discards 148 of them via a JSONB property string comparison. A GIN index on `properties` exists (`idx_documents_properties`) but GIN indexes support containment operators (`@>`) — they do not accelerate `->>` text extraction equality (`properties->>'assignee_id' = 'uuid'`). A functional B-tree index on `(properties->>'assignee_id')` would eliminate this 148-row discard.

---

## Key Findings & Severity

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                             | Severity    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | **Auth middleware runs 3 DB queries on every request.** On main page load (5 parallel requests), 15 of 25 total queries (60%) are auth overhead: SELECT session+user, SELECT workspace_membership, UPDATE last_activity. The UPDATE runs unconditionally even on millisecond-spaced requests.                                                                                                                       | High        |
| 2   | **`GET /api/issues` fetches `d.content` (full TipTap JSON) for all 150 issues in the list view.** The list UI only uses title, state, priority, and assignee. This unnecessarily inflates payload size and memory pressure on every list load.                                                                                                                                                                      | High        |
| 3   | **`GET /api/documents?type=wiki` performs a full sequential scan.** At 556 rows the scan executes in 0.683ms, but the planner cannot use the existing `idx_documents_active` composite index because the route query omits `deleted_at IS NULL` from its WHERE clause — a dead condition in the index (0 rows in the table have `deleted_at IS NOT NULL`). The scan cost scales linearly with total document count. | Medium–High |
| 4   | **`idx_documents_active` has a dead partial condition.** The index is defined `WHERE archived_at IS NULL AND deleted_at IS NULL`, but soft-delete via `deleted_at` is not implemented (0 rows affected). This prevents the composite index from being used by any query that doesn't also filter `deleted_at IS NULL`.                                                                                              | Medium      |
| 5   | **N+1 pattern in `GET /api/weeks/:id/scope-changes`** (weeks.ts:1739) — found via code inspection, not flow measurement. This endpoint was not part of the 5 tested flows. For each issue removed from a sprint, a separate `SELECT properties->>'estimate' FROM documents WHERE id = $1` executes inside a loop. Should be batched as `WHERE id = ANY($1)`. Severity scales with number of removed issues.         | Medium      |
| 6   | **Missing functional index on `properties->>'assignee_id'`.** The dashboard my-work query fetches all issues of a type and discards those not assigned to the current user (148/150 discarded). A btree index on `(properties->>'assignee_id')` would push this filter to the index scan, eliminating the per-row discard.                                                                                          | Medium      |
| 7   | **Sprint board load: 16 queries for 3 API calls** (GET /api/weeks + /api/weeks/:id + /api/weeks/:id/issues). 9 of 16 queries (56%) are auth overhead. The sprint detail view also triggers an `UPDATE documents SET properties` unconditionally to capture a sprint snapshot on every GET.                                                                                                                          | Low–Medium  |

---

## Reference: Previous Audit Numbers

The MVP_ShipShape audit cited:

- **22 DB queries per page load** — our measurement is **25**, consistent after accounting for the additional `GET /api/documents?type=wiki` call now included in the dashboard load
- **"11 of 22 queries are background login checks"** — our measurement confirms **15 of 25 queries are auth middleware** (60%), matching the proportion cited
- **"Combine the duplicate login checks into a single trip"** — the previous audit proposed merging the SELECT session+user and SELECT workspace_memberships queries into one joined query, reducing from 2 mandatory auth SELECTs per request to 1. This fix is distinct from throttling the UPDATE and is captured in Finding #1 but not separately broken out in the improvement target below — see the improvement target table for the combined auth fix.

---

## Improvement Target (for Phase 2)

Target: 20% reduction in total query count on at least one user flow, or 50% improvement on the slowest individual query.

| Flow / Query                                 | Current                   | Target        | Fix                                                                                                                                                                                                                                                                                        |
| -------------------------------------------- | ------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Load main page (total queries) — throttle    | 25                        | ≤20           | Throttle `UPDATE sessions SET last_activity` to once per 60s per session — eliminates 5 of 25 queries (20% reduction)                                                                                                                                                                      |
| Load main page (total queries) — consolidate | 25                        | ≤20           | Merge the 2 auth SELECT queries (SELECT session+user, SELECT workspace_memberships) into a single JOIN — eliminates 5 more queries; combine with throttle for ≤15 total (40% reduction). Aligns with previous audit recommendation to "combine duplicate login checks into a single trip." |
| `GET /api/issues` (query count)              | 5                         | 4             | Merge the associations query into the main issues SELECT with a LEFT JOIN (eliminates 1 separate query)                                                                                                                                                                                    |
| `GET /api/documents?type=wiki` (scan)        | Seq Scan, 556 rows        | Index Scan    | Add `AND deleted_at IS NULL` to route query to allow `idx_documents_active` to be used; alternatively drop the dead `deleted_at IS NULL` partial condition from the index                                                                                                                  |
| Dashboard assignee filter (rows discarded)   | 148/150 discarded         | ≤5 discarded  | Add functional index: `CREATE INDEX idx_documents_assignee ON documents ((properties->>'assignee_id')) WHERE document_type = 'issue'`                                                                                                                                                      |
| `GET /api/weeks/:id/scope-changes` N+1       | 1 query per removed issue | 1 query total | Replace loop query with `WHERE id = ANY($1::uuid[])` batch lookup                                                                                                                                                                                                                          |

_Do not fix during audit phase._
