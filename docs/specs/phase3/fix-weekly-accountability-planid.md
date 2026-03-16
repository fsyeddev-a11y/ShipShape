# Spec: Fix weekly-accountability allocation grid planId null

## Functional Area
Teams — Weekly Accountability

## Problem
weekly-accountability.spec.ts:390 ("Allocation grid shows person with assigned issues and plan/retro status") creates a plan via API, then checks the allocation grid API response for `week1Data.planId === plan.id`. The assertion fails because `planId` is null. The plan was created successfully (the `plan.id` exists) but the accountability grid v3 endpoint doesn't find it. This is likely a timing issue — the plan document is created but the grid API query doesn't see it yet (transaction commit timing), or the grid query filters by sprint/week number and the plan's week number doesn't match.

## Files to Modify
- e2e/weekly-accountability.spec.ts

## Changes Required
After creating the plan document, add a toPass() retry on the grid API call until planId is non-null. This handles transaction commit timing. Also verify the plan document's properties include the correct week_number that the grid query expects.

## Tradeoffs
Adding a retry adds up to 5s worst case. The underlying issue may be a genuine API bug where planId isn't populated in the grid response — if so, the retry will timeout and the test will still fail, correctly surfacing the bug.

## Acceptance Criteria
- weekly-accountability:390 passes on CI.
