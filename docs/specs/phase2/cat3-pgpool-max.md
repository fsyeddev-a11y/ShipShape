# Spec 3.2: Increase pg-pool Max Connections

**Category:** 3 — API Response Time
**Priority:** High
**Severity:** High
**Audit Finding:** Category 3, Finding 2

---

## Problem

`GET /api/documents?type=wiki` degrades 4.3x from c=10 (33ms p99) to c=50 (142ms p99). The degradation is driven by pg-pool connection contention — the default pool max is 10 connections, meaning at c=50, 40 requests queue for a database connection.

## Fix

Increase the pg-pool `max` configuration from 10 to 25.

### Steps

1. Locate the pg pool configuration (likely in `api/src/db/index.ts` or `api/src/db/pool.ts`)
2. Change the `max` pool setting:
   ```typescript
   const pool = new Pool({
     max: 25,  // was 10 (default)
     // ... rest of config
   });
   ```
3. Consider making this configurable via environment variable:
   ```typescript
   max: parseInt(process.env.PG_POOL_MAX || '25', 10),
   ```

### Sizing Rationale

- PostgreSQL default `max_connections` is 100
- With a single API server instance, 25 connections provides headroom for c=50 load without exhausting the database
- For multi-instance deployments, ensure total pool across instances stays under PostgreSQL's max_connections

## Verification

- Re-run autocannon benchmark at c=50 against `GET /api/documents?type=wiki`
- Target: p99 ≤ 114ms (20% reduction from 142ms)
- No connection exhaustion errors under sustained load

## Audit Targets Addressed

- Addresses Category 3 improvement target: `GET /api/documents` target ≤114ms p99 at c=50
- Reduces connection queuing for all endpoints under concurrent load
