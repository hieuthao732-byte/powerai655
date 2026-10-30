# PowerAI ONE — Legacy Engine Adapter Map

Status: source-inspected integration map. No legacy engine code has been changed.

## A — Geometry / Simulation Optimizer
- Core structure generator: generateIncidenceShape(target, salt).
- Label permutation: relabelIncidenceShape(P, target, shapeSeed).
- Invariant audit: auditGeo(P).
- Display / simulation analysis: simulateGeometry(P, samples, detail), geometryStructureStats(P), ensureGeoAnalysis().
- Runtime state: global geo object; targetId and draws are global.
- Extraction status: `track-a-adapter.js` wraps the exact frozen A7 algorithm block (`seeded` through `auditGeo`) and exposes `generate(targetDrawId)`, returning canonical main-number tickets plus original audit, seed and analysis metadata. `track-a-provider.js` maps A7 into the ONE candidate-provider contract; ONE performs the only final selection. A does not consume historical draws; its adapter intentionally accepts only target ID. Tests cover repeatability, geometry invariants, and the full A7→ONE pipeline. DOM rendering and progress UI are excluded.

## B — Legacy Analytics V1.3
- Historical model: buildLegacyModel(ds).
- Candidate constraints: validLegacy(a).
- Candidate generation: randomValidPool(n, seed).
- Scoring: legacyComponents(a, model).
- Portfolio selection: portfolioSelect(ranked, 20).
- Current UI orchestration: async buildLegacyPortfolio(), which performs official-history readiness checks, progress updates, global state mutation, and then renders.
- Extraction status: `track-b-adapter.js` extracts the frozen pure model, validity filter, scoring and seeded 50,000-candidate generator. `track-b-provider.js` maps B1.3 candidates into the ONE pipeline; legacy `portfolioSelect` is deliberately not called because ONE owns the only final selection. Provider defaults to the legacy 50,000 candidate count and preserves the original target seed formula. UI readiness gates remain in service/policy.

## C — Geometry-Constrained Matrix Hybrid
- Signals: buildConstrainedSignals(ds, A, B).
- Mapping optimizer: optimizeConstrainedMapping(A, signals, target).
- Portfolio orchestration: buildHybridPortfolio(), currently depends on global geo, legacy, targetId, readiness state and UI.
- Extraction status: `track-c-adapter.js` extracts the RC6 rank-fusion, matrix affinity and constrained mapping optimizer. `track-c-provider.js` registers it as `shadow`; it consumes A geometry and B top-20 score-ranked candidates as support, then emits C-ranked candidates for ONE. It preserves windows [30,60,120,250], median rank consensus, five restarts × 4,500 iterations, and audits the 55-number / 300-pair geometry. The B support approximation differs from the old B-selected portfolio and is documented in `TRACK_C_EXTRACTION.md`; C is not eligible for prospective champion use until parity and portfolio-level constraints are solved.

## L — Learning
- Historical source logs: learningSourceLogs().
- Model/portfolio path: buildLearningPortfolio(report) with preparation in prepareAndBuildLearningPortfolio().
- Lock: lockLearningPortfolio(); learning snapshots are stored under powerai_rc6_learning_lock_<drawId>.
- Extraction requirement: separate the pure signal/report/portfolio calculations from localStorage, UI, readiness checks and lock writes. The adapter must receive an explicit report and eligible official logs. Preserve current maturity and eligibility thresholds. Manual/replay logs must not silently enter training.

## D — Adaptive Research
- Pure core API: window.PowerAIAdaptiveD exposes normalizeHistory, buildModel, buildPortfolio, auditPortfolio, scorePortfolio, matchedNullBenchmark, evaluateDrift, promotionDecision, confidenceGate, and research-state helpers.
- D input history currently uses {id, result:[six main numbers]} and strict target cutoff.
- D lock and official prospective integration live in adaptive-d-ui.js.
- Challenger lifecycle lives in adaptive-d-cycle.js.
- Retrospective-only validation lives in adaptive-d-validation.js.
- Extraction requirement: adapt canonical Draw.main to D's expected result array without adding special to the main numbers. Keep official, shadow and retrospective storage/evaluation lanes separate.

## Integration order
1. Capture golden fixtures for A, B, C, L and D from the current production-compatible branch.
2. Extract A as the first deterministic, UI-independent engine and compare exact tickets/audit/hash.
3. Extract B, then C (C consumes A and B).
4. Extract L only after official log eligibility and learning-lock behavior are covered.
5. Add D adapter with lane guards and rebuild-integrity checks.
6. Keep the old app entry point active until every adapter has parity evidence.

## Explicit non-goals for this phase
- No changes to production index.html or app.js.
- No localStorage key rename, migration, or cleanup.
- No Supabase schema, RLS, or RPC changes.
- No algorithm tuning, new prediction claims, or automatic promotion.
