# Spec F.4: Throttle last_used_at UPDATE for API Tokens (Future Phase)

## Functional Area

API — Auth Middleware Performance

**Category:** 3/4 — API Response Time / DB Query Efficiency
**Priority:** Future
**Audit Finding:** From previous human audit

---

## Problem

The `UPDATE api_tokens SET last_used_at = NOW() WHERE id = $1` runs on **every single API token request**. Under 285 RPS, that's 285 extra DB write queries per second just for token usage tracking.

This is distinct from the session `last_activity` UPDATE (covered in Spec 4.1) — this is specifically for API token `last_used_at`.

## Fix

Throttle `last_used_at` updates to once per minute per token:

```typescript
const LAST_USED_THROTTLE_MS = 60_000;
const lastUsedCache = new Map<string, number>();

async function updateLastUsed(tokenId: string) {
  const now = Date.now();
  const lastUpdate = lastUsedCache.get(tokenId) || 0;
  if (now - lastUpdate > LAST_USED_THROTTLE_MS) {
    await pool.query('UPDATE api_tokens SET last_used_at = NOW() WHERE id = $1', [tokenId]);
    lastUsedCache.set(tokenId, now);
  }
}
```

## Impact

- Reduces write queries by ~99% for high-frequency API token usage
- `last_used_at` accuracy changes from "exact request time" to "within 1 minute" — acceptable for usage tracking
- Related to Spec 4.1 (session last_activity throttle) — same pattern, different table
