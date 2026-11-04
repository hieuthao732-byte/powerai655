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

## Expanded validation

The next workflow run expands C to 30 target draws with ten random null portfolios per target, and D to 200 target draws with five random rankings per target. This is still retrospective research, not prospective proof or a guarantee of future performance.

## Interpretation rules

- Ranking scores are not probabilities of winning.
- A candidate-pool comparison only tests ranking inside that pool; it does not establish coverage of all 28,989,675 possible six-number combinations.
- C's null preserves the portfolio incidence geometry and randomizes its number labels; it tests the mapping/relabeling strategy, not all aspects of portfolio construction.
- A7/C geometry constraints apply to whole portfolios. Mixing individual tickets through ONE does not preserve those whole-set invariants automatically.
- The third-party data mirror must be verified against the official Vietlott archive before production data integration.
- No engine is promoted on these results alone.
