# PowerAI 6/55 — RC6.0 Geometry-Constrained Matrix Hybrid

## Decision
The RC5 additive-weight / combination-search branch is CLOSED.

Observed RC5 research:
- RC5.2: ablation winner failed independent Validation vs A/B.
- RC5.3: no individual component reached the pre-registered 4/5 stability rule.
- RC5.4: all 63 non-empty component combinations were searched; top combo reached only 3/5 folds, so Confirmation remained unopened.

RC6 changes architecture instead of hunting more weights.

## Track A — Geometry V5
Frozen benchmark.

Geometry invariants:
- 20 tickets x 6
- coverage 55/55
- 45 numbers appear x2
- 10 numbers appear x3
- repeated number-pair = 0
- max overlap between any two tickets <= 1

## Track B — Legacy V1.3
Frozen historical benchmark.

## Track C — Geometry-Constrained Matrix Hybrid

### 1. Fixed skeleton
RC6 derives the incidence slots directly from Track A's geometry.
Historical analysis CANNOT change:
- slot exposures,
- pair-repeat constraint,
- ticket overlap constraint,
- coverage.

### 2. Robust historical signal
For windows 30 / 60 / 120 / 250:
- Frequency rank
- Gap/Overdue rank
- Heat rank
- Matrix-centrality rank

Legacy-B portfolio exposure is added as a fifth rank signal.

RC6 uses the MEDIAN rank across those five signals.
There are no tuned additive weights in RC6.0.

### 3. Exposure allocation
- top 10 robust-consensus numbers -> the 10 triple-exposure slots (x3)
- remaining 45 numbers -> double-exposure slots (x2)

### 4. Pair-matrix assignment
A robust smoothed pair-affinity matrix is built as the median normalized affinity over the four windows.
A deterministic multi-restart hill-climb swaps labels only:
- triple number <-> triple number
- double number <-> double number

This improves historical pair-affinity while preserving geometry exactly.

### 5. Hard invariant audit
Track C is rejected if any of these fail:
- coverage != 55
- exposure outside 2/3
- triple count != 10
- double count != 45
- repeated pair != 0
- max overlap > 1
- unique portfolio pairs != 300

## Prospective use
A/B/C must be locked before the draw.
Do not alter RC6 based on one or a few outcomes.

Historical signal values and pair affinities are empirical summaries, not calibrated probabilities that a number will be drawn next.


RC8.3: xem README_RC8_3_AUTH_GUEST.md

RC8.4: xem README_RC8_4_AUTH_UI.md

Deployment source is now GitHub main branch. RC8.6 production sync trigger: 2026-09-27.
