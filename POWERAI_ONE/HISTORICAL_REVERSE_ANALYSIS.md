# PowerAI ONE — Historical Reverse Analysis Snapshot

Snapshot date: 2026-11-04  
Source: [vietlott-data Power 6/55 JSONL mirror](https://github.com/vietvudanh/vietlott-data/blob/main/data/power655.jsonl)  
Raw dataset SHA-256: `3668ec0888e8ce6ef7a7bb8d0bc3508c5b2fe97250e1c7922184d1d19239fffd`

## Data integrity

- 1,419 draws, IDs 00001–01419.
- Date range: 2017-08-01 through 2026-11-03.
- 0 rejected rows; 1 draw has no special-number value.
- 1,418 special numbers were available for separate analysis.
- This is a third-party GitHub mirror, not a direct official Vietlott feed. Verify against the official result archive before using it as the permanent production source.

## Six main numbers

| Metric | Result |
|---|---:|
| Expected count per number under uniform draws | 154.80 |
| Observed mean | 154.80 |
| Standard deviation across 55 numbers | 11.94 |
| Coefficient of variation | 7.71% |
| Minimum / maximum count | 126 / 181 |

Most frequent main numbers in this snapshot:

| Number | Main appearances |
|---:|---:|
| 22 | 181 |
| 41 | 178 |
| 51 | 173 |
| 29 | 171 |
| 34 | 170 |
| 08 | 169 |
| 32 | 169 |
| 11 | 167 |
| 43 | 167 |
| 09 | 165 |

Least frequent main number: 04 (126 appearances).

The main-number spread is fairly tight relative to the expected count. Its observed standard deviation (11.94) is close to the binomial marginal standard deviation under uniform selection (about 11.74). The historical hot/cold ranking is descriptive only; it is not evidence that any number is more likely in the next draw.

## Special number — kept separate

| Metric | Result |
|---|---:|
| Expected count per number across 1,418 available specials | 25.78 |
| Observed mean | 25.78 |
| Standard deviation | 5.41 |
| Coefficient of variation | 20.98% |
| Minimum / maximum count | 13 / 38 |

Most frequent special number: 50 (38 appearances).  
Least frequent special number: 06 (13 appearances).

The special-number distribution is more spread out in relative terms than the six-main-number distribution. This does not make the least- or most-frequent special numbers predictive.

## Draw structure

- Mean sum of six main numbers: 169.27 (SD 37.39; range 52–288).
- Mean odd numbers per draw: 3.08. Exactly 3 odd / 3 even occurred 473 times.
- Mean low numbers (01–27) per draw: 2.92. A 3-low / 3-high split occurred 441 times.
- At least one consecutive pair occurred in 43.48% of draws.
- Mean overlap between adjacent draws: 0.659 main numbers.
- All 1,485 possible unordered number pairs appeared at least once. The most frequent pair was 03–41 (30 draws), tied with 11–22 (30 draws).

## Method and interpretation

The analysis counts the six main numbers and the special number in separate channels. It also reports pair co-occurrence, sum, odd/even, low/high, consecutive-number incidence, and adjacent-draw overlap.

These are retrospective descriptive statistics over the supplied dataset. They are not a predictive model, do not establish a causal pattern, and do not improve the mathematical odds of a future lottery draw. The snapshot is reproducible from the runner:

`node POWERAI_ONE/analyze-live-history.js`

The runner prints the dataset SHA-256 so future snapshots can be compared without silently mixing different feed versions.
