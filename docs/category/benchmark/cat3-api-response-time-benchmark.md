# Category 3: API Response Time — Benchmark

## What You Are Measuring

How fast the backend responds under realistic conditions. This is not about testing with an empty database. Seed the database with meaningful volume, then measure.

## How to Measure

- Seed the database with realistic data: 500+ documents, 100+ issues, 20+ users, 10+ sprints. Use `pnpm db:seed` or write your own seed script
- Identify the 5 most important API endpoints by tracing the frontend's network requests during common user flows
- Benchmark each endpoint using a load testing tool (`autocannon`, `k6`, `hey`, or similar). Record P50, P95, and P99 response times
- Test under concurrent load: 10, 25, and 50 simultaneous connections
- Identify the slowest endpoints and hypothesize why they are slow

## Audit Deliverable

| Endpoint | P50 | P95 | P99 |
|----------|-----|-----|-----|
| 1. ___ | ___ms | ___ms | ___ms |
| 2. ___ | ___ms | ___ms | ___ms |
| 3. ___ | ___ms | ___ms | ___ms |
| 4. ___ | ___ms | ___ms | ___ms |
| 5. ___ | ___ms | ___ms | ___ms |

## Improvement Target

20% reduction in P95 response time on at least 2 endpoints. You must provide before/after benchmarks run under identical conditions (same data volume, same concurrency, same hardware). Document the root cause of each bottleneck.
