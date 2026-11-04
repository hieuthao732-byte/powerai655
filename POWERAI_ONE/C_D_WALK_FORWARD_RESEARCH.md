# PowerAI ONE — C RC6 and D Adaptive walk-forward research

Status: research only. No official logs, learning state, locks, or production data are written.

## Dataset and cutoff discipline

- Source: third-party Vietlott Power 6/55 JSONL mirror.
- Snapshot: 1,419 valid draws, IDs 00001–01419, zero rejected rows.
- SHA-256: `3668ec0888e8ce6ef7a7bb8d0bc3508c5b2fe97250e1c7922184d1d19239fffd`.
- Each target is evaluated using only draws with ID lower than the target. The evaluator rejects future cutoff leakage.
- Six main numbers are scored separately from the special number.

## Initial live results (superseded by expanded run in progress)

### C RC6 — 10 targets, 200 tickets

Comparison: C's mapped whole portfolio versus A7's unoptimized random relabeling of the same incidence geometry. Ten random relabelings per target were not yet used in this initial run; this report used one null portfolio per target.

| Metric | C | Null |
|---|---:|---:|
| Portfolios with at least one ticket hitting 3+ main numbers | 3/10 (30%) | 1/10 (10%) |
| Ticket hit rate, 3+ main numbers | 2.0% | 0.5% |
| Ticket hit rate, 4+ main numbers | 0% | 0% |
| Special-number hits | 22 | 22 |

Ten targets are far too few for a conclusion. The null comparison is a random relabeling of the same geometry, not a whole-universe random-ticket benchmark.

### D Adaptive — 50 targets, 1,000 tickets

Comparison: D's ranking versus five random rankings over the exact same D candidate pool per target, with the same ONE selector constraints.

| Metric | D | Random ranking |
|---|---:|---:|
| Portfolio rate with 3+ main hits | 22.0% (11/50) | 25.6% (64/250) |
| Portfolio rate with 4+ main hits | 4.0% (2/50) | 0.8% (2/250) |
| Ticket rate with 3+ main hits | 1.9% | 1.42% |
| Ticket rate with 4+ main hits | 0.3% | 0.04% |

D did not beat its random-ranking null on the 3+ portfolio metric. Its 4+ result is based on only two D portfolios and two null portfolios; it is highly unstable. Do not interpret this as a proven advantage.

## Expanded live validation — 2026-11-04

The expanded workflow completed successfully on the 1,419-draw snapshot (same SHA-256 above).

### C RC6 — 30 targets, 600 C tickets; 300 null portfolios

C's mapped portfolio was compared with ten random relabelings of the same incidence geometry for each target.

| Metric | C | Random relabeling |
|---|---:|---:|
| Portfolios with 3+ main hits | 30.0% (9/30) | 20.0% (60/300) |
| Portfolios with 4+ main hits | 0% (0/30) | 6.67% (20/300) |
| Ticket rate, 3+ main hits | 1.67% (10/600) | 1.00% (60/6,000) |
| Ticket rate, 4+ main hits | 0% | 0.33% (20/6,000) |
| Special-number hits | 65 | 650 |

Interpretation: C shows a higher 3+ portfolio rate in this small window, but no 4+ portfolios while the null has 20. The result is mixed and the target count is only 30. This is not evidence to promote C.

### D Adaptive — 200 targets, 4,000 D tickets; 1,000 null portfolios

D ranking was compared with five random rankings over the exact same D candidate pool for each target, using the same ONE selector constraints.

| Metric | D | Random ranking |
|---|---:|---:|
| Portfolios with 3+ main hits | 20.5% (41/200) | 24.1% (241/1,000) |
| Portfolios with 4+ main hits | 3.5% (7/200) | 1.1% (11/1,000) |
| Ticket rate, 3+ main hits | 1.425% (57/4,000) | 1.315% (263/20,000) |
| Ticket rate, 4+ main hits | 0.20% (8/4,000) | 0.055% (11/20,000) |
| Special-number hits | 427 | 2,183 |

Interpretation: D loses on the primary 3+ portfolio metric (20.5% vs 24.1%) but has a higher 4+ portfolio rate (3.5% vs 1.1%). The 4+ counts are sparse, and five null portfolios per target are not independent target draws. This is mixed evidence, not a proven edge.

## Interpretation rules

## Interpretation rules

- Ranking scores are not probabilities of winning.
- A candidate-pool comparison only tests ranking inside that pool; it does not establish coverage of all 28,989,675 possible six-number combinations.
- C's null preserves the portfolio incidence geometry and randomizes its number labels; it tests the mapping/relabeling strategy, not all aspects of portfolio construction.
- A7/C geometry constraints apply to whole portfolios. Mixing individual tickets through ONE does not preserve those whole-set invariants automatically.
- The third-party data mirror must be verified against the official Vietlott archive before production data integration.
- No engine is promoted on these results alone.
