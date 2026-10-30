# PowerAI ONE — Domain Layer

This folder contains the isolated domain layer for the ONE migration. It is not loaded by the production entry point.

## First implementation
- domain.js: pure normalization and validation for legacy draw rows, historical cutoffs, tickets, portfolios, portfolio audit, stable hashes and ticket scoring.
- domain.test.js: Node built-in assertion tests for valid/invalid rows, special-number separation, strict historical cutoff, duplicate draw IDs, portfolio shape and scoring.

## Run locally
```bash
node POWERAI_ONE/domain.test.js
```

## Integration rule
Do not add domain.js to index.html or change existing app.js call paths until legacy fixtures and browser parity tests are in place. The current app expects draw.result to contain six main numbers and may contain the seventh special number; the adapter supports that shape without merging special into main.

## Portfolio orchestration
- portfolio-service.js: engine registry and explicit generation orchestration. It applies strict pre-target history cutoff, validates canonical portfolios and preserves evaluation-lane provenance.
- portfolio-service.test.js: mock-engine tests for cutoff, provenance, unknown engine rejection and shadow-lane isolation.

Register a real legacy engine only after its input/output mapping is documented and golden fixtures are captured. The service intentionally has no default engine and never silently falls back.

## Unified final portfolio architecture
A/B/C/L/D are candidate providers, not independent final ticket selectors. The intended ONE runtime calls `unified-portfolio-pipeline.js` once; the pipeline gathers candidates and calls `unified-selector.js` exactly once for the final portfolio. Provider-specific hard validity checks remain in each adapter. Source scores are ranked within their own source group before aggregation, so raw scores from unrelated engines are never directly compared.

Files:
- unified-selector.js / unified-selector.test.js
- unified-portfolio-pipeline.js / unified-portfolio-pipeline.test.js

The pipeline remains isolated from the live app until legacy parity fixtures and prospective walk-forward tests justify integration.
