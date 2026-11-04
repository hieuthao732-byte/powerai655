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


## Expanded live comparison — 200 targets

- Snapshot: 1,419 valid draws, IDs 00001–01419; zero rejected rows.
- Source and dataset SHA-256 match the 50-target report above.
- Targets: 200 most recent valid target draws, IDs 01220–01419.
- Candidate pool: 3,000 tickets per target, with exact L/B candidate-pool parity.
- Calibration: 20 prior target events and 500 calibration candidates; strict chronological cutoff.
- ONE selector: 20 tickets, max overlap 4, candidate limit 120, beam width 24, node budget 200,000.

| Metric | L learned weights | B1.3 frozen |
|---|---:|---:|
| Targets / portfolios | 200 | 200 |
| Tickets | 4,000 | 4,000 |
| Portfolio with 3+ main hits | 28.5% (57/200) | 27.0% (54/200) |
| Portfolio with 4+ main hits | 2.5% (5/200) | 2.5% (5/200) |
| Ticket rate, 3+ main hits | 1.55% (62/4,000) | 1.45% (58/4,000) |
| Ticket rate, 4+ main hits | 0.15% (6/4,000) | 0.15% (6/4,000) |
| Special-number hits | 400 | 403 |

### Interpretation

Across this 200-target retrospective window, L is ahead by 1.5 percentage points for portfolios with 3+ main hits and by 0.10 percentage points for individual tickets with 3+ hits. At 4+ portfolio hits and 4+ ticket hits, the rates are tied. L has three fewer special-number hits. The observed differences are small and descriptive; no statistical significance or prospective advantage is established. L remains shadow/research only.

A separate diagnostic run is measuring exact ticket overlap between L and B portfolios. This is needed because similar hit rates do not imply that the selected ticket sets are the same.

## Methodology and guardrails

- L estimates component signal strengths using only historical candidate pools and the subsequent historical draw available at each calibration step; every calibration event has its own earlier cutoff.
- The final target draw is never used to create its own learning report.
- L is compared with B1.3 on the exact same candidate ticket pool, avoiding a candidate-generation coverage confound.
- Main-number hits and special-number hits are reported separately.
- The third-party mirror is not an official verified log source.
- These retrospective tests do not establish predictive advantage or change the mathematical odds of a future draw.
- Ranking scores are not probabilities of winning. L remains shadow/research only.


## Exact selected-ticket overlap — 200 targets

- Diagnostic workflow: run `41814988041`, completed successfully.
- Report artifact: `powerai-one-l-walk-forward-report`.
- Same 200 target draws (01220–01419), same 3,000-ticket candidate pool per target, and same ONE selector constraints as the expanded comparison above.
- Exact ticket identity was compared after canonical sorting of each ticket's six main numbers.

| Overlap metric | Result |
|---|---:|
| Target portfolios compared | 200 |
| Mean exact tickets shared per 20-ticket portfolio | 0 |
| Mean Jaccard similarity | 0 |
| Portfolios identical | 0 / 200 |
| Portfolios with zero shared exact tickets | 200 / 200 |

### Interpretation

L and B selected **different exact ticket sets in all 200 target portfolios**. This confirms the learned-weight path is not simply returning B's selected tickets under a different label. It does not, by itself, establish that L's tickets are better: the observed hit-rate differences remain small, retrospective, and not statistically tested. The source candidate pool is shared, but ranking and selection differ. Keep L in shadow/research status.

## Next test

Run a pre-registered prospective shadow evaluation on future draws: freeze L and B weights before each target, record candidate-pool hashes and selected ticket sets, and score only after the official result is available. Keep the third-party mirror separate from official verification. Do not promote L unless improvement repeats across a sufficiently large prospective sample.
