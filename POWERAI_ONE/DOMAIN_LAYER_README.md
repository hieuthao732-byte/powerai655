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
