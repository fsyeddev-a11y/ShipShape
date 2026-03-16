# Spec: Fix Backlinks Sync Timing After Mention Deletion

## Functional Area
Editor — Backlinks/Mentions

## Problem
backlinks.spec.ts:110 deletes a mention (via Cmd+A + Backspace), then immediately checks that the backlink is removed. The backlink removal relies on a `/links` POST that is debounced at 500ms. The test `.catch()`-es the response wait, meaning if the POST doesn't fire in time, the test proceeds with stale backlink data.

## Files to Modify
- e2e/backlinks.spec.ts

## Changes Required
Remove the `.catch()` on the link-sync response wait so failures are visible. Add a retry assertion for backlink absence using `toPass()` — poll until the backlink is no longer shown, with a timeout that accounts for the 500ms debounce.

## Tradeoffs
`toPass()` polling adds up to 5-10s worst case. The debounce delay means we can't eliminate the wait entirely — we have to wait for at least 500ms for the sync to fire.

## Acceptance Criteria
- The `.catch()` on the link-sync response wait is removed
- Backlink removal is verified using a retrying assertion (`toPass()` or `expect.poll()`)
- The timeout accounts for the 500ms debounce plus network time
- The test fails visibly if the backlink sync never fires (no silent swallowing)
