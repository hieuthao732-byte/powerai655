# PowerAI — Monte Carlo Validation Report 01

Date: 2026-10-30
Branch: `research/reverse-analysis-framework`
Dataset: `vietvudanh/vietlott-data/data/power655.jsonl`
Valid draws: 1,416 (draws 00001–01417); malformed draw 00944 excluded because it has only six values.

## 1. Model and method

For each simulated draw:
1. Select six distinct main numbers uniformly without replacement from 1–55.
2. Select one special number uniformly from the 49 numbers not selected as main numbers.
3. Treat draws as independent.

The conditional special-number rule models the special ball as one of the remaining 49 values. If the official rules for the historical period differ, rerun under the verified rule.

Monte Carlo tests:
- 3,000 simulated full histories for overall main/special dispersion and maximum pair/triple co-occurrence.
- 5,000 simulated full histories for the maximum chi-square statistic across each fixed block partition (100, 200, 500 draws).
- Empirical upper-tail p-value uses (exceedances + 1)/(replicates + 1).
- Fixed deterministic pseudo-random seeds were used for reproducibility in this implementation. These are approximate Monte Carlo p-values, not exact analytical tests.

## 2. Overall frequency dispersion

| Statistic | Observed | Null median | Null 95th percentile | Empirical upper-tail p |
|---|---:|---:|---:|---:|
| Main-number chi-square (54 df) | 50.54 | 48.59 | 65.58 | 0.423 |
| Special-number chi-square (54 df) | 62.09 | 53.70 | 71.87 | 0.222 |

Interpretation: neither main-number nor special-number overall frequency dispersion is unusually high under the simulated draw process. The main-number count vector is close to the random baseline; the special-number dispersion is somewhat higher than the null median but not unusual at conventional thresholds.

## 3. Pair and triple co-occurrence

The observed maximum is evaluated against the maximum over all possible combinations, not against a single preselected pair/triple. This accounts for the fact that many combinations were searched.

| Statistic | Observed maximum count | Null 95th percentile | Null 99th percentile | Empirical upper-tail p |
|---|---:|---:|---:|---:|
| Maximum among 1,485 pairs | 30 | 32 | 33 | 0.233 |
| Maximum among 26,235 triples | 7 | 9 | 9 | 0.969 |

Most frequent observed pairs:
- 03–41: 30
- 11–22: 30
- 08–39: 27
- 18–22: 26
- 22–43: 26
- 38–55: 26
- 42–51: 26

Most frequent observed triples (7 appearances each):
- 08–19–46
- 08–36–39
- 10–29–34
- 11–22–28
- 12–33–40
- 21–29–41

Interpretation: the strongest pair is not unusual after accounting for the search across all pairs. The strongest triple is entirely ordinary under the maximum-statistic null. These are descriptive rankings, not predictive signals.

## 4. Fixed-block frequency dispersion

For each block size, the statistic tested is the maximum chi-square value among all complete, non-overlapping blocks of that size. This accounts for selecting the most unusual block within the partition.

| Block size | Complete blocks | Largest observed chi-square | Null median of maximum | Null 95th percentile | Empirical p |
|---|---:|---:|---:|---:|---:|
| 100 draws | 14 | 60.37 | 65.68 | 77.78 | 0.825 |
| 200 draws | 7 | 53.54 | 61.88 | 75.36 | 0.915 |
| 500 draws | 2 | 38.13 | 53.89 | 69.88 | 0.988 |

Interpretation: even the most uneven fixed block at each tested scale is less extreme than typical simulated maxima. There is no evidence of unusual block-level frequency dispersion in these tests.

Note: incomplete tails are excluded consistently (16 draws for 100-block partition, 16 for 200-block partition, and 416 for 500-block partition). These tests use the first complete blocks from the oldest draw onward.

## 5. Conclusions

1. Overall main-number frequency dispersion is compatible with random selection.
2. Special-number dispersion is also compatible with the specified conditional random model.
3. The most frequent pair and triple are not statistically exceptional after correcting for the search across all combinations.
4. Fixed 100/200/500-draw block frequency dispersion shows no unusual block under the maximum-statistic test.
5. No predictive signal has been identified. The correct conclusion is **no evidence of a non-random frequency or co-occurrence effect in these tests**.

## 6. Limitations and next steps

- This is one source dataset; verify malformed/missing rows against official results before finalizing the canonical dataset.
- Monte Carlo p-values have finite simulation error. Increase replications for any result near a decision threshold.
- This report tests selected frequency and co-occurrence statistics only. It does not prove independence of all draw features.
- Next: simulate and test sum, parity, low/high, spread, gap, consecutive runs, lag overlap, waiting times, and special-number relationships. Then perform chronological holdout tests for any candidate signal.
- Do not use these descriptive findings to weight number selections in the production engine.
