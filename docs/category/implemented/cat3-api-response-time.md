# Category 3: API Response Time — Implemented Specs

---

## 3.1 — Remove content from issues list

**Spec:** [cat3-issues-remove-content.md](../../specs/cat3-issues-remove-content.md)

**What Changed:**
Removed `d.content` from the SELECT clause in two queries in `api/src/routes/issues.ts`: the main issues list (`GET /api/issues`, line 125) and the children list (`GET /api/issues/:id/children`, line 440). Updated `extractIssueFromRow()` to conditionally include `content` only when present in the row, so detail endpoints (`GET /api/issues/:id` and `GET /api/issues/by-ticket/:number`) still return full content.

**Why the Original Code Was Suboptimal:**
The issues list query selected `d.content` — the full TipTap JSON document body — for every issue. The list UI only renders title, state, priority, assignee, and ticket number. The `content` field inflated the response payload from ~38 KB to ~310 KB (an 88% overhead) and forced the server to serialize large JSON blobs that the client immediately discarded. At 50 concurrent connections, this wasted ~15 MB/s of bandwidth and serialization CPU.

**Why This Approach Is Better:**
Dropping `d.content` from list queries reduces payload by ~88%. The database reads fewer columns (less I/O), the server serializes less JSON, and the client parses a smaller response. Individual issue content is still available via `GET /api/documents/:id` when a user opens a specific issue. The frontend `Issue` interface already doesn't include a `content` field, so no frontend changes were needed.

**Tradeoffs:**
Content must be fetched separately when opening an individual issue, but this was already the case via `GET /api/documents/:id`. No functional impact since the list view never displayed content.

---

## 3.2 — Increase pg-pool max connections

**Spec:** [cat3-pgpool-max.md](../../specs/cat3-pgpool-max.md)

**What Changed:**
Updated `api/src/db/client.ts` to increase the pool `max` from 20 (production) / 10 (development) to a configurable value defaulting to 25 in production and 10 in development. Added `PG_POOL_MAX` environment variable support: `max: parseInt(process.env.PG_POOL_MAX || (isProduction ? '25' : '10'), 10)`.

**Why the Original Code Was Suboptimal:**
With the default pool max of 20 connections in production, at 50 concurrent requests, 30 requests would queue for a database connection. This caused `GET /api/documents?type=wiki` to degrade 4.3x from 33ms p99 (c=10) to 142ms p99 (c=50). The bottleneck was connection contention, not query complexity.

**Why This Approach Is Better:**
Increasing to 25 connections reduces queuing under concurrent load. The environment variable makes it configurable for different deployment scenarios (single instance vs. multi-instance). PostgreSQL's default `max_connections` is 100, so 25 for a single API instance leaves plenty of headroom.

**Tradeoffs:**
More connections means more memory per connection on both the app server (~10 MB per idle connection) and PostgreSQL. For multi-instance deployments, the total pool across instances must stay under PostgreSQL's `max_connections`. The env var provides an escape hatch for tuning.

**Alternatives Considered:**
The pool increase was chosen as the simplest, lowest-risk fix for the immediate bottleneck. More robust alternatives exist for production scale:

- **PgBouncer** — A connection pooler proxy that multiplexes many app connections over fewer DB connections. The production-grade solution for connection contention at scale, especially with multiple API instances.
- **`Promise.all` in auth middleware** — The auth middleware runs 3 sequential DB queries per request. Parallelizing them would cut connection hold time by ~2/3 for auth alone, reducing contention without increasing pool size. This is addressed in Spec 4.1 (Cat 4).
- **Throttle `UPDATE sessions SET last_activity`** — Currently runs on every request. Throttling to once per 60s would eliminate 1 query per request, freeing connections faster.
- **Redis/in-memory caching for session lookups** — Would eliminate 2 of the 3 auth queries for repeat requests, dramatically reducing connection demand.
- **Shorter `idleTimeoutMillis`** — Releasing idle connections faster (currently 30s) so they're available sooner for other requests.

The most impactful alternative would be combining `Promise.all` in auth middleware with session update throttling — this would reduce per-request connection hold time enough that even 10 pool connections could handle c=50 without contention.

---

## 3.3 — Issues pagination

**Spec:** [cat3-issues-pagination.md](../../specs/cat3-issues-pagination.md)

**What Changed:**
**Backend:** Added optional `limit` and `cursor` query parameters to `GET /api/issues` in `api/src/routes/issues.ts`. When `limit` is provided, the endpoint uses cursor-based pagination keyed on `(created_at, id)` with `ORDER BY d.created_at DESC, d.id DESC`, fetches `limit + 1` rows to determine `hasMore`, and returns `{ issues, nextCursor, hasMore }`. Without `limit`, the endpoint returns the flat array with priority-based sorting (backward compatible).

**Frontend:** Added `useIssuesInfiniteQuery` hook in `web/src/hooks/useIssuesQuery.ts` using `@tanstack/react-query`'s `useInfiniteQuery`. Updated `IssuesContext` to use the infinite query, flattening pages into a single `issues` array and exposing `fetchNextPage`/`hasNextPage`/`isFetchingNextPage`. Added `onLoadMore` and `isLoadingMore` props to `IssuesList` component with an `IntersectionObserver` sentinel that triggers loading the next page when the user scrolls near the bottom (200px margin).

**Why the Original Code Was Suboptimal:**
The endpoint returned all issues in a single response with no pagination. At current scale (218 issues), this was manageable but response size and query time would degrade linearly with growth. Combined with Spec 3.1 (remove content), the initial payload was ~310 KB. With pagination, each page is ~13 KB (50 issues × ~260 bytes).

**Why This Approach Is Better:**
Cursor-based pagination using `(created_at, id)` provides stable ordering that doesn't shift when items are updated (unlike `updated_at`). The backend is backward compatible — existing consumers that don't pass `limit` still get all issues. The frontend uses `IntersectionObserver` with a 200px root margin to prefetch the next page before the user reaches the bottom, providing seamless infinite scroll.

**Tradeoffs:**
- When paginating, sort order is `created_at DESC` instead of the priority-based sort used in the non-paginated response. The client can re-sort if needed.
- Real-time updates (new issues created by others) may cause items to appear at the top of the next cursor page, though duplicates are unlikely since cursors use immutable `(created_at, id)`.
- Other consumers (`ProgramIssuesTab`, `BacklogPickerModal`) continue using the non-paginated `useIssuesQuery` hook, which still fetches all issues in a single request. This is intentional — these views typically have smaller, filtered result sets.
