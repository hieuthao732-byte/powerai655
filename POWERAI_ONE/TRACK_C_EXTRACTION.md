# Track C — RC6 constrained mapping extraction

Status: extracted as a **shadow candidate provider**. It is not an official selector and does not write locks or production state.

- Pure adapter: `track-c-adapter.js`.
- Provider: `track-c-provider.js`, status `shadow`.
- Legacy signal windows: 30, 60, 120, 250.
- Rank consensus: median of frequency, overdue/gap, heat, matrix centrality and B support ranks; tie-break by mean.
- Pair affinity: median normalized affinity across the four windows.
- Mapping optimizer: 5 deterministic restarts × 4,500 swap iterations.
- Hard RC6 geometry audit: coverage 55; 45 numbers exposed twice; 10 exposed three times; 300 unique pairs; zero repeated pairs; maximum ticket overlap 1.

## Compatibility boundary

The C optimizer depends on A's 20-ticket geometry skeleton and B support. In the unified architecture, B support is currently represented by the top 20 candidates ranked by B's frozen score, rather than invoking B's legacy portfolio selector. This keeps ONE as the only final portfolio selector, but is a deliberate compatibility deviation from the old C call path and must be evaluated in shadow/retrospective parity tests.

C emits 20 ranked candidate tickets with its full-set audit attached as provenance. The generic ONE greedy selector may choose a subset or mix providers, so the C full-set geometry audit does **not** automatically apply to the final ONE portfolio. Do not promote C to enabled until ONE supports explicit portfolio-level constraints/bundles and walk-forward parity confirms the intended behavior.
