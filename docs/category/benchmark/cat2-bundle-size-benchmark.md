# Category 2: Bundle Size — Benchmark

## What You Are Measuring

The size of the production frontend bundle. Large bundles slow down initial page load, hurt performance on slow networks, and waste bandwidth. You are looking for oversized dependencies, missing code splitting, unused imports, and opportunities to reduce what the browser has to download.

## How to Measure

- Build the production frontend and record the total output size
- Use a bundle visualization tool (e.g., `rollup-plugin-visualizer`, `vite-bundle-analyzer`, or `source-map-explorer`) to generate a treemap of the bundle
- Identify the largest chunks and the largest individual dependencies within them
- Check for unused dependencies: cross-reference `package.json` dependencies against actual imports in the source code
- Evaluate whether code splitting is in use and where lazy loading could reduce initial load

## Audit Deliverable

| Metric | Your Baseline |
|--------|---------------|
| Total production bundle size | ___ KB |
| Largest chunk | ___ (name + size) |
| Number of chunks | ___ |
| Top 3 largest dependencies | List with sizes |
| Unused dependencies identified | List |

## Improvement Target

15% reduction in total production bundle size, or implement code splitting that reduces initial page load bundle by 20%. Provide before/after bundle analysis output. Removing functionality to shrink the bundle does not count.
