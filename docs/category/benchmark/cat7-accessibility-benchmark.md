# Category 7: Accessibility Compliance — Benchmark

## What You Are Measuring

Ship claims Section 508 compliance and WCAG 2.1 AA conformance. Your job is to verify those claims. This means automated accessibility scanning, keyboard navigation testing, screen reader testing, and color contrast verification across the application's major pages.

## How to Measure

- Run Lighthouse accessibility audits on every major page of the application. Record the score for each
- Run an automated accessibility scanner (`axe-core`, `pa11y`, or the axe browser extension) and categorize violations by severity (Critical, Serious, Moderate, Minor)
- Test full keyboard navigation: can you reach every interactive element using only Tab, Enter, Escape, and arrow keys?
- Test with a screen reader (VoiceOver, NVDA, or similar). Can you understand the page structure and interact with all controls?
- Check color contrast ratios on text, buttons, and interactive elements against the WCAG 2.1 AA 4.5:1 minimum

## Audit Deliverable

| Metric | Your Baseline |
|--------|---------------|
| Lighthouse accessibility score (per page) | List scores |
| Total Critical/Serious violations | ___ |
| Keyboard navigation completeness | Full / Partial / Broken |
| Color contrast failures | ___ |
| Missing ARIA labels or roles | List locations |

## Improvement Target

Achieve a Lighthouse accessibility score improvement of 10+ points on the lowest-scoring page, or fix all Critical/Serious violations on the 3 most important pages. Provide before/after Lighthouse reports or axe scan output as evidence.
