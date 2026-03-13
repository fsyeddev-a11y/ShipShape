# Category 4: Database Query Efficiency — Benchmark

## What You Are Measuring

How efficiently the application queries the database. The unified document model (everything in one table) creates specific query patterns worth examining. You are looking for N+1 queries, missing indexes, full table scans, and unnecessary data fetching.

## How to Measure

- Enable PostgreSQL query logging (`log_statement = 'all'` in `postgresql.conf` or via Docker environment variables)
- Execute 5 common user flows: load the main page, view a document, list issues, load a sprint board, search for content
- Count total queries executed per flow
- Run `EXPLAIN ANALYZE` on the slowest queries
- Check for missing indexes by examining `WHERE` clauses against existing indexes
- Identify N+1 patterns: places where a list view triggers one query per item instead of a batch query

## Audit Deliverable

| User Flow | Total Queries | Slowest Query (ms) | N+1 Detected? |
|-----------|---------------|---------------------|----------------|
| Load main page | ___ | ___ms | Yes / No |
| View a document | ___ | ___ms | Yes / No |
| List issues | ___ | ___ms | Yes / No |
| Load sprint board | ___ | ___ms | Yes / No |
| Search content | ___ | ___ms | Yes / No |

## Improvement Target

20% reduction in total query count on at least one user flow, or 50% improvement on the slowest query. Provide before/after `EXPLAIN ANALYZE` output. Document what was inefficient and why your change fixes it.
