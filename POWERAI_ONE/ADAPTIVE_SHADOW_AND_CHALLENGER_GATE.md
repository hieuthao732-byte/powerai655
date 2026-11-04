# PowerAI ONE — Adaptive Shadow & Challenger Evidence Gate

## Purpose

The adaptive governor detects a sustained run of active-portfolio misses (default: 10 consecutive official, verified draws with no ticket reaching 3 main-number hits). It emits a shadow-challenger trigger only. It does not modify the active model or promote a challenger.

The shadow runner replays draws chronologically:
1. Generate the active portfolio using only draws before the target draw.
2. Lock the generated portfolio before the target result is available.
3. Score six main numbers separately from the special number.
4. When the governor reaches its trigger, begin challenger evaluation on the **next** draw, never the trigger draw.
5. Compare active and challenger on the same target draws (paired evaluation).

## Evidence gate

`challenger-evidence-gate.js` evaluates only paired rows carrying `source: "official"` and `verified: true`. Draw IDs must be unique and consecutive. Third-party mirror data and unverified/manual rows are rejected.

Default pre-registered criteria:
- At least 200 paired prospective draws.
- Challenger improves portfolio-level probability of reaching 3+ main hits by at least 2 percentage points.
- One-sided exact paired McNemar test p-value <= 0.05.
- Temporal stability: at least 3 of 4 chronological blocks are non-negative, and no block is worse by more than 5 percentage points.
- 4+ main-hit rate must not regress by more than 2 percentage points.
- Special-number hit rate is checked separately and must not regress by more than 5 percentage points.

The gate returns either `RECOMMEND_HUMAN_REVIEW` or `KEEP_SHADOW`. Even a positive result is **not** an automatic promotion: human review, source verification, frozen configuration review, and independent prospective validation remain required.

## Interpretation limits

Lottery draws are random. This gate controls common evaluation errors and requires evidence before a model can be considered for review; it cannot prove a persistent predictive edge or guarantee future results. Main-number hits and special-number hits are not combined into one score.

## CI coverage

- `adaptive-governor.test.js`
- `adaptive-shadow-runner.test.js`
- `challenger-evidence-gate.test.js`

All changes remain on `feature/powerai-one`. Production branch and deployment are not touched.
