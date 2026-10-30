# PowerAI — Reverse Analysis Framework (Research Track)

> Status: research blueprint / isolated branch. This document does not change the production engine, existing ticket templates, RC6, or Track D.

## 1. Research objective

Analyze the actual Power 6/55 draw history as a sequence of observations, then compare empirical features with the assumptions and signals used by PowerAI algorithms.

The unit of analysis is one draw:
- Main numbers: 6 distinct values from 1–55.
- Special number: the 7th value, stored and analyzed separately.
- Draw metadata: draw ID and date.

The objective is to test whether any stable, reproducible structure exists beyond the expected behavior of a random 6/55 draw. Historical frequency is descriptive, not a probability forecast.

## 2. Data contract and quality control

Source currently used: `vietvudanh/vietlott-data/data/power655.jsonl`.

Latest retrieval checked: 2026-10-30; newest record is draw 01417 dated 2026-10-29.

Initial audit:
- 1,417 source rows.
- 1,416 valid seven-number rows.
- Draw 00944 (2022-09-23) contains only six values and is excluded from analyses requiring the special number.
- Never silently impute a missing special number.
- Preserve source row, draw ID, date, six main values, and special value in a normalized dataset.
- Validate range 1–55, uniqueness within a draw, exactly six main numbers, and one special number.
- Sort by draw ID/date and detect duplicate IDs, duplicate dates, missing draw IDs, malformed rows, and changes in source schema.
- Record source URL, retrieval timestamp, row count, rejected rows, and dataset hash for every analysis run.

If the official result for an incomplete row is later verified, add it as a documented correction; do not overwrite the raw source record.

## 3. Analysis layers

### A. Marginal distributions
Run separately for main and special numbers:
- Count and rate for each value 1–55.
- Expected count under the uniform model.
- Standardized residual / z-score.
- Chi-square goodness-of-fit, with assumptions and degrees of freedom stated.
- Multiple-comparison correction when inspecting individual numbers.
- Rank stability across fixed time windows.

Main-number expected count per value for N draws: N × 6/55.
Special-number expected count per value for N draws: N/55.

### B. Time stability and drift
Use predeclared, non-overlapping blocks of 100, 200, and 500 draws, plus rolling windows only as a secondary diagnostic:
- Count vector mean, standard deviation, coefficient of variation, min/max.
- Chi-square statistic versus the uniform null.
- Hot/cold rank persistence between adjacent blocks.
- Change-point / drift tests, corrected for repeated window searches.
- Compare early, middle, and recent periods without selecting periods after seeing the results.

A number being “hot” in a historical block is not a predictive claim. Test whether the effect persists in the next unseen block.

### C. Shape of each six-number draw
- Sum and sum distribution.
- Odd/even count.
- Low/high count, with boundary fixed at 27/28 unless a separate sensitivity analysis is registered.
- Range (maximum minus minimum).
- Sorted gaps between adjacent numbers.
- Consecutive pairs and runs.
- Decade / band occupancy.
- Number of repeated values versus previous draw.

Compare each feature with its theoretical or simulated random baseline. Do not infer predictive value from the most common shape alone.

### D. Pair and triple structure
- Pair and triple co-occurrence counts.
- Expected counts under random sampling without replacement.
- Residuals / lift with shrinkage for sparse cells.
- Correct for the large number of pairs (1,485) and triples (26,235).
- Use permutation or Monte Carlo maximum-statistic tests to assess whether the strongest observed pair/triple is more extreme than expected after searching all combinations.
- Confirm any candidate on a later holdout period.

Raw top-pair or top-triple rankings are exploratory only.

### E. Sequential dependence
- Overlap between consecutive draws.
- Lag 1–k autocorrelation for number indicators and draw-shape features.
- Repeat intervals / waiting-time distributions.
- Conditional frequencies after previous-draw features.
- Test whether a conditional effect improves holdout log-loss or another predeclared score versus the uniform baseline.

### F. Special-number relationships
Treat the special number as its own outcome:
- Its marginal distribution and temporal stability.
- Relationship to the six main numbers in the same draw (e.g. distance, parity, bands).
- Whether it appeared among previous draw's main numbers or previous special number.
- Never pool special-number counts with main-number counts.

## 4. Null models and statistical safeguards

Primary null:
- Each draw selects six distinct main numbers uniformly from 1–55.
- The special number is modeled according to the actual game rule. If the rule is one additional number from the remaining pool, simulate it conditionally from the 49 remaining values.
- Draws are independent unless the official mechanics or evidence justify a different model.

Safeguards:
1. Pre-register each hypothesis, feature, window, metric, and acceptance threshold.
2. Separate exploration from confirmation.
3. Use Monte Carlo simulation for complex statistics and maximum-over-many-comparisons questions.
4. Apply family-wise error or false-discovery control where appropriate.
5. Use chronological train/validation/test splits; never shuffle time-series draws for the primary evaluation.
6. Compare every proposed signal against the uniform/random baseline.
7. Require repeated out-of-sample confirmation before a signal can influence a candidate model.
8. Keep a complete experiment log, including failed hypotheses.

## 5. Initial baseline snapshot

Dataset: 1,416 valid draws, draw 00001 through 01417, excluding malformed draw 00944.

Main numbers:
- Expected appearances per number: 154.47.
- Observed minimum / maximum: 126 / 179.
- Observed standard deviation across the 55 counts: 11.92.
- Theoretical marginal standard deviation: approximately 11.73.
- Pearson chi-square: 50.54 with 54 degrees of freedom; approximate p-value 0.61.

Interpretation: the overall main-number frequency distribution is compatible with a uniform model; the observed spread is close to random expectation. There is no evidence here that “hot” or “cold” numbers have a durable advantage.

Special number:
- Expected appearances per value: 25.75.
- Observed minimum / maximum: 13 / 38.
- Observed standard deviation: 5.39.
- Theoretical marginal standard deviation: approximately 5.03.
- Pearson chi-square: 62.09 with 54 degrees of freedom; approximate p-value 0.21.

Interpretation: the special-number distribution is somewhat more dispersed, but this test does not show a statistically clear departure from uniformity.

Fixed-block check (main-number counts):
- 100-draw blocks: chi-square values ranged approximately 34.52–60.37.
- 200-draw blocks: approximately 30.17–53.54.
- 500-draw blocks: approximately 37.83–38.13 for the two complete blocks.
- These are descriptive checks, not proof of drift or stability. The 100/200/500 block boundaries and incomplete tail must be retained consistently in future reruns.

## 6. Comparison with existing PowerAI components

Keep this research track isolated from production.

For every existing component (RC6 matrix hybrid, Track D experts D1–D4, and any later challenger):
- Document the feature it uses, its lookback horizon, shrinkage/prior, weighting, and intended output.
- Reconstruct the exact historical input available before each target draw.
- Generate predictions walk-forward, with no future data leakage.
- Compare against a uniform 6/55 baseline and a simple frequency baseline.
- Evaluate number-level log-loss / Brier score where calibrated probabilities exist; otherwise use clearly defined ranking and coverage metrics.
- Report uncertainty intervals and performance by time segment.
- Preserve frozen benchmark versions; candidate changes are challengers, not silent replacements.

No algorithm should be described as “predicting winning numbers” unless it demonstrates robust prospective improvement over the baseline. Even then, explain the size and uncertainty of the effect.

## 7. Experiment pipeline

1. Ingest source data.
2. Validate schema and draw integrity.
3. Normalize into draw records.
4. Generate descriptive statistics.
5. Generate null simulations.
6. Run exploratory analyses.
7. Register candidate hypotheses.
8. Confirm chronologically on holdout data.
9. Compare with PowerAI RC6 / Track D using identical cutoffs.
10. Publish a reproducible report and experiment log.
11. Only then propose an isolated model challenger.

Every run should output:
- Dataset version/hash and date range.
- Valid/rejected row counts.
- Parameters and random seed.
- Main-number and special-number results.
- Null-model comparison.
- Multiple-testing method.
- Train/validation/test periods.
- Conclusion: reject, inconclusive, or replicated.
- Whether the finding is descriptive or has demonstrated out-of-sample utility.

## 8. Roadmap

### Phase 1 — Baseline and data integrity
- [x] Retrieve current public JSONL.
- [x] Audit valid and malformed rows.
- [x] Calculate overall main/special frequency distributions.
- [x] Compare overall frequency dispersion with theoretical random expectations.
- [x] Inspect fixed non-overlapping 100/200/500-draw blocks.
- [ ] Add Monte Carlo calibration for global dispersion and block statistics.

### Phase 2 — Structural reverse analysis
- [ ] Full shape distributions against simulated 6/55 draws.
- [ ] Pair/triple maximum-statistic tests.
- [ ] Gap and waiting-time analysis.
- [ ] Sequential dependence and lag tests.
- [ ] Special-number conditional analysis.

### Phase 3 — Algorithm audit
- [ ] Map RC6 and Track D features to the research feature catalog.
- [ ] Rebuild walk-forward predictions with strict historical cutoffs.
- [ ] Compare every expert against the same baselines.
- [ ] Test ablations: remove one feature/expert at a time.
- [ ] Evaluate stability across chronological test segments.

### Phase 4 — Research challenger
- [ ] Only promote signals replicated on unseen data.
- [ ] Build a separate challenger module and preserve production engine.
- [ ] Run shadow evaluation before any integration.
- [ ] Integrate only after explicit review and reproducible evidence.

## 9. Decision policy

- **Reject:** evidence is compatible with random variation or fails holdout.
- **Inconclusive:** sample size, test power, or data quality is insufficient.
- **Replicated descriptive effect:** stable feature distribution, but no demonstrated prediction gain.
- **Replicated predictive utility:** repeated out-of-sample improvement over baseline with uncertainty quantified.

The default stance is that Power 6/55 is random. The burden of proof is on any proposed pattern or algorithmic advantage.
