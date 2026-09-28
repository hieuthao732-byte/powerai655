# Track D — Adaptive Research Engine

## Trạng thái
- Phase 1 Core: xong
- Phase 2 App integration: xong
- Phase 3 Adaptive cycle: xong
- Phase 4 Validation Lab: xong
- Phase 5 Integrity hardening: xong D14 snapshot reproducibility guard

## Engine
- D1 Residual Pair Matrix
- D2 Gap Transition Matrix
- D3 Shape-Conditional Matrix
- D4 Spectral Residual Graph
- Multi-horizon: 30 / 60 / 120 / 250
- Stability penalty + matched-random benchmark
- 20 vé D deterministic, diversity/exposure/entropy guard

## Adaptive cycle
- Rolling drift detector
- Champion / tối đa 2 challenger
- Shadow >= 6 kỳ official
- Stress gate trước promote
- Slow weight update, quarantine expert yếu
- Negative memory + hypothesis registry + lineage
- Orthogonality so A/B/C/L

## Validation
- Historical walk-forward, cutoff luôn `< target`
- Counterfactual Lab
- Change-point flag so matched-null
- Marginal novelty audit
- Bayesian paired evidence
- Validation không ghi vào official log / weights / promotion

## D14 Integrity Guard
Mỗi lock prospective lưu model hash, portfolio hash, seed và generator config. Trước khi chấm feed official, D phải dựng lại snapshot và pass toàn bộ:
- ticket shape hợp lệ;
- portfolio hash khớp;
- audit khớp;
- cutoff `< target` và đúng snapshot;
- model hash khớp;
- tái sinh 20 vé từ seed cho cùng portfolio hash.

Nếu fail bất kỳ mục nào: `INVALID`, không ghi official D log và không dùng kỳ đó cho adaptive learning.

## Quy tắc dữ liệu
- Chỉ `source === feed` được dùng cho official learning.
- Manual và Replay không train.
- Không dùng target/future draw để build feature.
- Score nội bộ không phải xác suất trúng.
