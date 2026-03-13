# Category 6: Runtime Error and Edge Case Handling — Benchmark

## What You Are Measuring

How the application behaves when things go wrong. This covers error boundaries, unhandled promise rejections, network failure recovery (especially during real-time collaboration), malformed input handling, and user-facing error states.

## How to Measure

- Open browser DevTools and monitor the console during normal usage. Count errors and warnings
- Test network failure: disconnect while editing a document collaboratively, then reconnect. Does data survive? Does the UI recover?
- Test malformed input: submit empty forms, extremely long text, special characters, HTML/script injection
- Test concurrent edge cases: two users editing the same document field simultaneously
- Throttle the network to 3G and use the app. Note every spinner that hangs, every silent failure, every missing loading state
- Check server logs for unhandled errors during all of the above

## Audit Deliverable

| Metric | Your Baseline |
|--------|---------------|
| Console errors during normal usage | ___ |
| Unhandled promise rejections (server) | ___ |
| Network disconnect recovery | Pass / Partial / Fail |
| Missing error boundaries | List locations |
| Silent failures identified | List with reproduction steps |

## Improvement Target

Fix 3 error handling gaps. At least one must involve a real user-facing data loss or confusion scenario (not just a missing loading spinner). Each fix requires reproduction steps, before/after behavior, and a screenshot or recording.
