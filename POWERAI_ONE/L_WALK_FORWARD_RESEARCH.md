# PowerAI ONE — Track L prequential walk-forward research

Status: research only. No official logs or persistent learning state are written.

## First completed live comparison — 50 targets

- Snapshot: 1,419 valid draws, IDs 00001–01419.
- Source: third-party GitHub JSONL mirror, not official-verified.
- SHA-256: `3668ec0888e8ce6ef7a7bb8d0bc3508c5b2fe97250e1c7922184d1d19239fffd`.
- Targets: IDs 01370–01419.
- Every target's calibration used only earlier draws. Calibration itself used 20 earlier target events, each with 500 B-valid candidate tickets; target comparison used 3,000 B-valid candidates.
- L and B were checked to use the exact same candidate ticket pool, seed, 20-ticket ONE selector, max overlap 4, candidate limit 120, beam width 24 and node budget 200,000.
- Baseline: frozen B1.3 ranking over the same candidate pool, one B portfolio per target.

| Metric | L learned weights | B1.3 frozen |
|---|---:|---:|
| Targets / portfolios | 50 | 50 |
| Tickets | 1,000 | 1,000 |
| Portfolio with 3+ main hits | 32.0% (16/50) | 32.0% (16/50) |
| Portfolio with 4+ main hits | 4.0% (2/50) | 4.0% (2/50) |
| Ticket rate, 3+ main hits | 1.7% (17/1,000) | 1.7% (17/1,000) |
| Ticket rate, 4+ main hits | 0.2% (2/1,000) | 0.2% (2/1,000) |
| Special-number hits | 95 | 96 |

### Interpretation

The aggregate hit distributions are identical for L and B in this 50-target window. L's learned weights moved slightly around the frozen B baseline, but there is no measured performance gain in these results. This is not a reason to promote L. A larger 200-target run has been configured to test whether the result persists.

The exact ticket-level overlap between selected L and B portfolios was not recorded in this first report, so identical hit distributions must not be misread as proof that L selected identical tickets.

## Methodology and guardrails

- L estimates component signal strengths using only historical candidate pools and the subsequent historical draw available at each calibration step; every calibration event has its own earlier cutoff.
- The final target draw is never used to create its own learning report.
- L is compared with B1.3 on the exact same candidate ticket pool, avoiding a candidate-generation coverage confound.
- Main-number hits and special-number hits are reported separately.
- The third-party mirror is not an official verified log source.
- These retrospective tests do not establish predictive advantage or change the mathematical odds of a future draw.
- Ranking scores are not probabilities of winning. L remains shadow/research only.

## Next test

Expand L vs B1.3 to 200 target draws with the same candidate-pool parity and ONE selector constraints. Compare portfolio 3+ and 4+ rates, ticket hit distributions, special hits, and whether the selected portfolios actually differ. Do not promote L unless a repeatable improvement is demonstrated prospectively.
