# Spec 4.1: Auth Query Consolidation

**Category:** 4 — Database Query Efficiency (also Category 3 — API Response Time)
**Priority:** High
**Severity:** High
**Audit Finding:** Category 4 Finding 1, Category 3 Finding 3

---

## Problem

The main page load runs 22 DB queries. 11 of those 22 are auth/permission overhead. The auth middleware currently runs multiple separate queries per request that can be consolidated or throttled.

**Corrected baseline (from human audit):** 22 queries per page load, 11 auth overhead, across 4 parallel API requests.

### Current Auth Queries Per Request

1. **Token/session lookup** — SELECT session + user data
2. **Workspace role check** — SELECT workspace_membership
3. **last_used_at UPDATE** — UPDATE unconditionally on every request
4. **sprint_start_date SELECT** — duplicated across dashboard and weeks routes

## Fix

Three separate optimizations that together reduce main page queries from 22 to 14 (36% reduction):

### Fix A: Combine token lookup + workspace role check (saves 3)

Merge the two SELECT queries into a single JOIN:

```sql
-- Before: 2 queries
SELECT s.id, s.user_id, s.workspace_id, s.expires_at, u.is_super_admin
FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = $1;

SELECT id FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2;

-- After: 1 query
SELECT s.id, s.user_id, s.workspace_id, s.expires_at, u.is_super_admin, wm.id AS membership_id
FROM sessions s
JOIN users u ON s.user_id = u.id
LEFT JOIN workspace_memberships wm ON wm.workspace_id = s.workspace_id AND wm.user_id = s.user_id
WHERE s.id = $1;
```

This saves 1 query per request. Across the 3 non-super-admin requests on main page load: **saves 3 queries**.

### Fix B: Throttle last_used_at UPDATE to once per minute (saves 4)

The `UPDATE sessions SET last_activity = $1 WHERE id = $2` runs on every single request. During a page load, 4 requests fire within milliseconds of each other — 3 of those UPDATEs are redundant.

```typescript
// In auth middleware
const LAST_ACTIVITY_THROTTLE_MS = 60_000; // 1 minute

// Only update if last_activity is older than 1 minute
if (Date.now() - session.last_activity.getTime() > LAST_ACTIVITY_THROTTLE_MS) {
  await pool.query('UPDATE sessions SET last_activity = $1 WHERE id = $2', [now, session.id]);
}
```

On a fresh page load (first request in >1 minute), only 1 of the 4 requests writes. **Saves 3-4 queries** depending on timing. The human audit counted this as saving 4.

### Fix C: Combine duplicate SELECT sprint_start_date (saves 1)

Both `GET /api/dashboard/my-work` and `GET /api/weeks/my-week` independently run `SELECT sprint_start_date FROM workspaces WHERE id = $1`. Since these fire in parallel on page load, the result can't be shared via a simple cache within a single request — but they can share a short-lived per-session cache:

```typescript
// Attach workspace config to the request object in auth middleware
// (it's already querying the workspace for membership)
req.workspaceConfig = { sprint_start_date: row.sprint_start_date };
```

Alternatively, include `sprint_start_date` in the auth middleware's workspace membership query (Fix A already JOINs workspace_memberships — extend the JOIN to include the workspaces table).

**Saves 1 query** (one of the two duplicates is eliminated).

## Steps

1. Modify auth middleware (`api/src/middleware/auth.ts`):
   - Merge session+user SELECT with workspace_memberships SELECT into a single JOIN query
   - Add throttle logic for last_activity UPDATE
   - Include workspace config (sprint_start_date) in the JOIN result
2. Attach workspace config to `req` object so routes can use it without a separate query
3. Update `dashboard/my-work` and `weeks/my-week` routes to read workspace config from `req` instead of querying
4. Run API unit tests
5. Benchmark main page load query count

## Verification

- Main page load query count drops from 22 to ~14 (36% reduction)
- Auth behavior unchanged: expired sessions still rejected, workspace access still verified
- last_activity still updates (just throttled to once per minute)
- Routes that use sprint_start_date still get the correct value

## Query Count After Fix

| Source | Before | After | Savings |
|--------|--------|-------|---------|
| Token lookup + workspace check | 2 per request × 4 = 8 | 1 per request × 4 = 4 | -4 (note: 3 from non-super-admin, 1 if super admin also benefited) |
| last_used_at UPDATE | 1 per request × 4 = 4 | 1 total | -3 |
| sprint_start_date | 2 (duplicated) | 1 | -1 |
| **Total auth overhead** | **11** | **3** | **-8** |
| Route queries | 11 | 11 | 0 |
| **Total** | **22** | **14** | **-8 (36%)** |

## Audit Targets Addressed

- Exceeds the 20% query reduction target (achieves 36%)
- Directly addresses Category 3 target: throttle session UPDATE
- Aligns with previous human audit recommendation: "Combine duplicate login checks into a single trip"
