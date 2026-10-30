# Track D — Adaptive Research extraction

Status: pure candidate-generation API exposed and connected to ONE as a shadow provider.

- Legacy core remains `adaptive-d.js`; it now exposes `generateCandidates(model)`, which uses the frozen weighted-ticket sampler and base ticket score but does not call D's legacy portfolio selector.
- `track-d-adapter.js` normalizes canonical history, builds D model under strict target cutoff, and returns the candidate pool plus model hash, weights, horizons and confidence.
- `track-d-provider.js` registers D as `shadow`; only ONE selects the final 20.
- Existing D research lifecycle (official locks, shadow challenger logs, cycle promotion, retrospective validation) remains separate and is not imported into ONE. No D localStorage keys are read or written by this adapter.
- Candidate count defaults to 3,200; seed formula preserves D's target-based default.
- D requires at least 12 valid historical draws and preserves its four expert model, horizon aggregation and confidence gate.

D is not eligible for prospective promotion through ONE until parity and walk-forward tests are complete. Its original research lifecycle remains isolated.
