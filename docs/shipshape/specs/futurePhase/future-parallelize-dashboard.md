# Spec F.1: Parallelize Dashboard Sequential Queries (Future Phase)

## Functional Area

API — Dashboard Performance

**Category:** 3 — API Response Time
**Priority:** Future
**Audit Finding:** Category 3, Finding 4

---

## Problem

`GET /api/dashboard/my-week` calls 7 sequential DB queries: person lookup → workspace config → weekly plan → retro → standups → etc. Each query is fast individually, but sequential execution stacks latency additively. At 50 connections, connection pool contention amplifies this.

Several queries are independent (plan + retro + standups) and can run in parallel.

## Fix

Group independent queries and execute them with `Promise.all()`:

```typescript
// Before: sequential
const person = await getPersonByUserId(userId);
const config = await getWorkspaceConfig(workspaceId);
const plan = await getWeeklyPlan(personId, weekId);
const retro = await getRetro(personId, weekId);
const standups = await getStandups(personId, weekId);

// After: parallel where possible
const [person] = await Promise.all([getPersonByUserId(userId)]);
const config = await getWorkspaceConfig(workspaceId);  // needs workspace from auth (Spec 4.1 provides this)
const [plan, retro, standups] = await Promise.all([
  getWeeklyPlan(person.id, weekId),
  getRetro(person.id, weekId),
  getStandups(person.id, weekId),
]);
```

## Depends On

- **Spec 4.1** (auth consolidation) — if workspace config is attached to the request, one fewer query needed here
