# Category 4: Database Query Efficiency — Implemented Specs

---

## 4.1 — Auth Query Consolidation

**Spec:** [cat4-auth-query-consolidation.md](../../specs/cat4-auth-query-consolidation.md)

**What Changed:**
Three changes to `api/src/middleware/auth.ts`, plus route updates in `dashboard.ts` and `weeks.ts`:
- **Fix A:** Merged the session/user SELECT and workspace_memberships SELECT into a single query with `LEFT JOIN workspace_memberships wm` and `LEFT JOIN workspaces w`. The membership check now reads `session.membership_id` from the JOIN result instead of running a separate query.
- **Fix B:** Added a 60-second throttle on the `UPDATE sessions SET last_activity` query. Only fires if `inactivityMs > 60_000`.
- **Fix C:** Extended the combined query to also select `w.sprint_start_date`. Attached it to `req.workspaceConfig` so downstream routes can read it without a separate query. Updated `dashboard.ts` (`/my-work`) and `weeks.ts` (`/my-week`) to check `req.workspaceConfig` first, falling back to a direct query if absent.
- Updated auth test mocks (`auth.test.ts`) to match the new single-query structure, and switched `vi.clearAllMocks()` to `vi.resetAllMocks()` to prevent mock leakage between tests.

**Why the Original Code Was Suboptimal:**
The auth middleware ran 2–3 separate queries on every authenticated request: session lookup, workspace membership check, and an unconditional `last_activity` UPDATE. On a main page load (4 parallel API requests), this produced 11 auth-related queries out of 22 total — 50% overhead. The `sprint_start_date` was also fetched independently by both `/my-work` and `/my-week`, adding a duplicate query.

**Why This Approach Is Better:**
Reduces auth overhead from 11 queries to 3 on page load (a 73% reduction in auth queries, 36% reduction in total queries). The combined JOIN adds negligible cost since all tables are indexed on the join keys. The throttle is well within the 15-minute session timeout — worst case, a session appears 60 seconds more active than reality. The `workspaceConfig` pattern uses a fallback to the direct query, so routes still work even for API token auth (which doesn't set `workspaceConfig`).

**Tradeoffs:**
- The `last_activity` timestamp can be up to 60 seconds stale. This is acceptable because the inactivity timeout is 15 minutes — the worst case is a session that lives 60 seconds longer than intended.
- Only two routes (`/my-work` and `/my-week`) consume `req.workspaceConfig`. The remaining 29 `sprint_start_date` queries across 12 other files are unchanged — they could be migrated in a future pass but weren't in scope.
- The combined query is slightly wider (more columns), but all JOINs are on indexed foreign keys, so execution time is comparable to the original single-table SELECT.

---

## 4.2 — Issues List Remove person_doc JOIN

**Spec:** [cat4-issues-remove-person-join.md](../../specs/cat4-issues-remove-person-join.md)

**What Changed:**
Removed the `LEFT JOIN documents person_doc` and the `CASE WHEN person_doc.archived_at IS NOT NULL THEN true ELSE false END as assignee_archived` SELECT clause from 5 list queries across 3 files:
- `api/src/routes/issues.ts`: Issues list query (line ~130) and sub-issues list query (line ~475)
- `api/src/routes/programs.ts`: Program issues list query (line ~383)
- `api/src/routes/weeks.ts`: Sprint issues list (line ~697) and sprint detail issues (line ~1616)

Kept the person_doc JOIN in 2 single-issue detail views:
- `issues.ts`: Single issue by ticket number (line ~393) and single issue by ID (line ~538)

No frontend changes were needed — `assignee_archived` is typed as optional (`?: boolean`) in all 7 consuming components.

**Why the Original Code Was Suboptimal:**
Every issues list request performed a self-JOIN of the `documents` table against itself, matching via a JSONB text extraction (`properties->>'assignee_id'`). This ran across all ~150+ issue rows on every list request, despite archived assignees being an extremely rare condition (near-zero rows affected). The JSONB text comparison cannot use a standard B-tree index, making this a sequential scan within the JOIN.

**Why This Approach Is Better:**
Eliminates the most expensive JOIN in the most frequently called list endpoint. The archived-assignee indicator is only meaningful when viewing a single issue's detail, where the JOIN operates on exactly 1 row (trivially fast). List views no longer pay the cost of scanning the entire documents table for a condition that almost never applies.

**Tradeoffs:**
- List views (issues list, kanban board, sprint boards) no longer show the "(archived)" badge or reduced opacity for archived assignees. Users only see this when opening the individual issue. Given the extreme rarity of archived assignees, this is a negligible UX impact.

---

## 4.3 — Wiki Index Fix

**Spec:** [cat4-wiki-index-fix.md](../../specs/cat4-wiki-index-fix.md)

**What Changed:**
No code changes needed. The `AND deleted_at IS NULL` condition is already present in the documents list query at `api/src/routes/documents.ts:110`. The composite partial index `idx_documents_active (workspace_id, document_type) WHERE archived_at IS NULL AND deleted_at IS NULL` (from migration `007_archived_and_deleted_at.sql`) is already usable by the query planner.

**Why the Original Code Was Suboptimal:**
The spec identified that the wiki query omitted `deleted_at IS NULL`, preventing use of the `idx_documents_active` index and causing a sequential scan across all 556 documents. However, the current codebase already includes this condition, so the issue was previously resolved (likely during an earlier category or code change).

**Why This Approach Is Better:**
With `deleted_at IS NULL` present, the query planner can use the partial composite index, converting a Seq Scan (556 rows, 322 discarded) to an Index Scan. This prevents linear degradation as document count grows.

**Tradeoffs:**
None — the condition is semantically correct (0 rows have `deleted_at` populated) and adds no filtering overhead.

---

## 4.4 — Assignee Functional Index

**Spec:** [cat4-assignee-functional-index.md](../../specs/cat4-assignee-functional-index.md)

**What Changed:**
Created migration `api/src/db/migrations/038_add_assignee_functional_index.sql`:
```sql
CREATE INDEX IF NOT EXISTS idx_documents_assignee
ON documents ((properties->>'assignee_id'))
WHERE document_type = 'issue';
```
This is a functional B-tree index on the extracted `assignee_id` from the JSONB `properties` column, filtered to issue documents only.

**Why the Original Code Was Suboptimal:**
The dashboard `my-work` query fetched all ~150 issues via the `document_type` index, then discarded ~148 of them via a JSONB text comparison (`properties->>'assignee_id' = '<user_id>'`). The existing GIN index on `properties` doesn't accelerate `->>` text extraction equality comparisons. This resulted in 148/150 rows scanned and discarded on every dashboard load.

**Why This Approach Is Better:**
The functional B-tree index allows the query planner to perform an Index Scan directly on the extracted `assignee_id` value, reducing rows scanned from ~150 to ~2 (the actual number of issues assigned to the user). This benefits 27 queries across 11 files that filter on `properties->>'assignee_id'`.

**Tradeoffs:**
- The index adds ~10KB of storage overhead (at current scale) and marginal write overhead on INSERT/UPDATE of issue documents. Both are negligible.
- Used `CREATE INDEX` (not `CONCURRENTLY`) because the migration runner wraps each migration in a transaction, which PostgreSQL doesn't allow with `CONCURRENTLY`. At ~500 documents, the table lock duration is sub-millisecond. For larger deployments, the index could be created manually with `CONCURRENTLY` outside the migration runner.

---

## 4.5 — Scope-Changes N+1 Batch

**Spec:** [cat4-scope-changes-batch.md](../../specs/cat4-scope-changes-batch.md)

**User Flow:** Viewing a sprint/week's scope changes — triggered when a user opens a sprint/week detail view and views the scope change chart (story points added/removed during the sprint). Not part of the main page load.

**What Changed:**
Replaced the N+1 loop in `api/src/routes/weeks.ts` (the `GET /api/weeks/:id/scope-changes` handler, around line 1813). The original code ran a separate `SELECT properties->>'estimate' FROM documents WHERE id = $1` inside a `for` loop for each removed issue. Replaced with:
1. Collect all removed document IDs into an array
2. Single batched query: `SELECT id, COALESCE((properties->>'estimate')::numeric, 0) as estimate FROM documents WHERE id = ANY($1::uuid[])`
3. Build a `Map<string, number>` for O(1) estimate lookups
4. Iterate over removed issues using the map instead of individual queries

Guarded with `if (removedDocIds.length > 0)` to skip the query when there are no removed issues.

**Why the Original Code Was Suboptimal:**
Query count scaled linearly with the number of issues removed from a sprint. For a sprint with 10 removed issues, this fired 10 individual SELECT queries. Each query incurred a full round-trip to the database, including connection checkout, query parsing, and network overhead — all for a simple primary key lookup that returns a single scalar.

**Why This Approach Is Better:**
Reduces the query count from N to 1 (constant), regardless of how many issues were removed. The `WHERE id = ANY($1::uuid[])` clause uses the primary key index for an efficient multi-key lookup in a single round-trip. The `Map` provides O(1) lookups when iterating over removed issues, maintaining the same O(N) overall complexity but with dramatically reduced database overhead.

**Tradeoffs:**
- If no issues were removed (`removedDocIds.length === 0`), the query is skipped entirely — no wasted round-trip. The guard handles this edge case.
- The batched approach loads all estimates into memory at once. At current scale (~150 issues max per sprint), this is negligible. Even at 10,000 issues, the memory footprint would be under 1MB.
