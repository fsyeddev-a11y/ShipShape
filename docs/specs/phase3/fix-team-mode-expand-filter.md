# Spec: Fix team-mode expand test — "Unassigned" group not found

## Functional Area
Teams — Assignments

## Problem
team-mode.spec.ts:408 ("clicking collapsed header expands the group") fails because the "Unassigned" group button doesn't exist. This is the same root cause as team-mode:381 (addressed in spec F3.27) — the filter mode defaults to "my-team" which may not show any unassigned users. This test at line 408 is a DIFFERENT test from line 381 — it tests expand (after collapse), while 381 tests collapse. Both need the same fix.

## Files to Modify
- e2e/team-mode.spec.ts

## Changes Required
Apply the same localStorage override from F3.27 to this test as well: `page.addInitScript(() => { localStorage.setItem('ship:allocation-filter-mode', 'everyone') })`. Or better, apply it in the `beforeEach` for the entire "Assignments View - Collapse/Expand" describe block so both tests (collapse at 381 and expand at 408) get it.

## Tradeoffs
Same as F3.27 — forces "everyone" filter mode rather than testing the default.

## Acceptance Criteria
- Both team-mode:381 and team-mode:408 pass on CI.
