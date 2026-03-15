# Spec F.3: Add Index on api_tokens.token_hash (Future Phase)

**Category:** 3/4 — API Response Time / DB Query Efficiency
**Priority:** Future
**Audit Finding:** From previous human audit

---

## Problem

There is no index on `api_tokens.token_hash`. Bearer token authentication performs a `SELECT * FROM api_tokens WHERE token_hash = $1` which does a full table scan. At current scale the impact is < 1ms, but it scales linearly with token count.

## Fix

Add a B-tree index on `token_hash`:

```sql
CREATE INDEX CONCURRENTLY idx_api_tokens_token_hash
ON api_tokens (token_hash);
```

### Migration File

Create `api/src/db/migrations/NNN_add_token_hash_index.sql`:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_tokens_token_hash
ON api_tokens (token_hash);
```

## Impact

- Minor at current scale (< 1ms improvement)
- Prevents linear degradation as API token count grows
- Important for production environments with many service-to-service API tokens
