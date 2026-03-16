# Spec: Fix project-weeks navigation timeout for async name resolution

## Functional Area
Projects — Weeks Tab

## Problem
project-weeks.spec.ts:182 may time out waiting for the project link in the Properties sidebar because the async name resolution takes longer than the default assertion timeout.

## Files to Modify
- e2e/project-weeks.spec.ts

## Changes Required
Increase timeout on the projectLink visibility assertion from default (5s) to 10s to allow time for async name resolution. This is the same file as spec 9 — both changes should be applied together.

Example:
```typescript
await expect(projectLink).toBeVisible({ timeout: 10000 });
```

## Tradeoffs
Longer timeout means slower failure detection if the feature is genuinely broken. 10s is reasonable for an async API lookup.

## Acceptance Criteria
- Test passes on 3 consecutive CI runs.
