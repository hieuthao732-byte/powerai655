# Track L — Learning extraction

Status: pure learned-weight candidate engine extracted; provider is **shadow** only.

- `track-l-adapter.js`: baseline weights, bounded learned-weight adjustment, maturity gates, challenger weight proposal, verified-feed log filter, and candidate scoring.
- `track-l-provider.js`: sends L candidates to ONE; it never selects a final 20-ticket portfolio.
- `track-l-adapter.test.js`: tests weight normalization, verified-only log filtering, maturity, deterministic candidate generation and strict target cutoff.

## Preserved behavior and limits

- Baseline weights: Heat 0.40, Pair 0.30, OddEven 0.10, SmallBig 0.10, Sum 0.10.
- Learning alpha capped at 25%, growing linearly to the cap at 20 verified observations.
- Challenger only exists at 10 observations; marked ready at 20, but this is eligibility for validation, not promotion.
- Only logs with source `feed` and six actual main numbers pass the verified-log filter. Manual/replay data must not train L.
- Candidate pool defaults to 50,000 and retains the legacy target seed formula `target*1301081+660066`.
- L uses B's frozen validity/model/component implementation, but does not call legacy `portfolioSelect`; ONE owns final selection.

## Explicit parity gap

The legacy Learning report depends on app-level locked A/B/C snapshots and recomputes per-signal correlations from historical B tickets, then ranking calibration from A/B/C locks. Those localStorage reads and lock semantics have not been ported into this pure adapter. The provider accepts an explicit precomputed `learningReport` on the pipeline request; absent a report it uses baseline B weights. It remains shadow until report-generation parity, prospective lock behavior and walk-forward tests are implemented. No legacy localStorage key is read or written here.
