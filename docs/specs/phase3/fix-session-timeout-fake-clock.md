# Spec: Fix Session Timeout Fake Clock Mismatch

## Problem
session-timeout.spec.ts:629 ("Stay Logged In calls extend session") uses `page.clock.runFor()` to advance fake timers. The route mock returns a response with `expiresAt` based on `Date.now()` which is the real clock, not the fake clock. This mismatch means the app thinks the session is already expired when it processes the response. Also, `runFor()` may advance too fast, causing the warning modal to appear and immediately timeout before the test can click "Stay Logged In".

## Files to Modify
- e2e/session-timeout.spec.ts

## Changes Required
Use `page.clock.fastForward()` instead of `runFor()` for the timer advancement. Align the mock response timestamps with the fake clock time.

## Tradeoffs
`fastForward()` skips intermediate timer callbacks which may miss some app behavior, but it's more reliable for testing the end state.

## Acceptance Criteria
- The mock response `expiresAt` timestamp aligns with the fake clock time, not `Date.now()`
- Timer advancement uses `fastForward()` or another approach that allows the test to interact with the warning modal
- The "Stay Logged In" button click happens while the warning modal is visible
- The test verifies that the session extension API call is made successfully
