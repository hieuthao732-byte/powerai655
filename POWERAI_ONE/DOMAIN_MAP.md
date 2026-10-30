# PowerAI ONE — Domain Map (Initial)

Status: source-derived inventory from `main`; no production changes.

## 1. Core domains identified in `app.js`

| Domain | Representative functions | Current responsibility |
|---|---|---|
| Data and normalization | `load`, `nums`, `specialNum`, `validSpecial`, `drawLabel` | Download draw feed, normalize six main numbers and special number, choose target draw |
| Track A — geometry | `generateIncidenceShape`, `buildIncidence`, `auditGeo`, `simulateGeometry`, `buildGeo` family | Generate 20-ticket geometry portfolio and enforce coverage/exposure/pair/overlap invariants |
| Track B — legacy | `buildLegacyModel`, `validLegacy`, `buildLegacyPortfolio`, `renderLegacyAnalytics` | Historical feature model and legacy portfolio generation |
| Track C — hybrid | `buildMatrixModel`, `buildConstrainedSignals`, `optimizeConstrainedMapping`, `buildHybridPortfolio` | Geometry-constrained historical matrix assignment |
| Track L — learning | `learningSourceLogs`, `evaluateBSignals`, `buildChallenger`, `buildLearningPortfolio`, `runLearning`, `resetLearning` | Learn from eligible completed logs, rank portfolios, report maturity/calibration |
| Lock and snapshot | `lockKey`, `getLock`, `lockBoth`, `learningLockKey`, `getLearningLock`, `lockLearningPortfolio` | Store pre-draw immutable portfolio snapshots |
| Result and prize scoring | `scoreTrack`, `scorePrizeTicket`, `saveResult`, `parseManual`, `checkOfficial`, `prizeInfo` | Parse results, separate special number, compare tickets and score prize tiers |
| Prospective history | `getLog`, `allLogs`, `renderHistory`, `renderTrendChart`, `exportLogs` | Save and summarize official-feed/manual logs with source distinction |
| Descriptive analytics | `rc90HistoryBeforeTarget`, `rc90HistoricalData`, `renderAHistoricalValidation` | Historical validation and pre-target descriptive analysis |
| Number Intelligence | `rc92History`, `rc92WindowCount`, `rc92GapStats`, `rc92Pairs`, `rc92NumData`, `renderNumberIntelligence` | Per-number frequency, gap, recent status, pair links and portfolio exposure |
| Main navigation / UI | `activateTrack`, `setTarget`, `rc93ActivateMain`, `rc93BuildNavigation`, `rc97BuildPerformance` | Navigation, target switching, performance subviews and rendering |
| Account/cloud | `captureLocalState`, `hydrateLocalState`, `cloudLoadState`, `cloudSaveState`, `applyCloudUser` | Local cache, Supabase sync, session transition and user state |

## 2. Track D domain (separate files)

| File | Responsibility | Required boundary |
|---|---|---|
| `adaptive-d.js` | D1–D4 experts, multi-horizon model, deterministic portfolio generation and audit | Pure deterministic engine core |
| `adaptive-d-ui.js` | UI integration, lock integrity, official prospective logs | User-facing adapter; official-feed-only scoring |
| `adaptive-d-cycle.js` | Drift checks, shadow challenger templates, stress gates, promote/reject lifecycle | Shadow-only lifecycle; never mix manual/replay data |
| `adaptive-d-validation.js` | Chronological retrospective walk-forward lab | Research-only; must not mutate champion, official logs or promotion state |

## 3. Persistence namespaces observed

- Auth session: `powerai_auth_session_v1`.
- Main application state: `powerai_rc6_*` prefix.
- Main target / view preferences include `powerai_rc6_active_target`, `powerai_rc6_ui_tab`, `powerai_rc93_main_view`, `powerai_rc97_perf_tab`.
- Main result logs use `powerai_rc6_log_<drawId>`.
- Learning report includes `powerai_rc6_learning_report_v1`.
- Track D has separate lock, logs, state, shadow logs and cycle metadata under `powerai_rc6_d_*`.
- Cloud state is serialized through `user_app_state.local_state` and lock metadata columns.

Important: this is a partial literal-key inventory. Several lock keys are constructed dynamically. Before any migration, enumerate keys from the complete source and test a real account export/restore.

## 4. Initial structural observations

- No duplicate named function declarations were detected in the current `app.js` scan, but that does not prove there are no overlapping responsibilities or wrapper chains.
- Main navigation has been layered over the earlier tab navigation; the new architecture should retain one canonical navigation controller.
- Rendering and computation are interleaved in the current application. Extraction must first preserve outputs, then move pure computations into services.
- Main app and Track D share globals such as `draws`, `targetId`, `nums`, `cloudSyncSoon`. These are hidden coupling points and should be replaced with explicit dependency injection/adapters only after tests exist.

## 5. Recommended extraction order

1. `domain/draw.js`: normalize/validate draw and special-number contracts.
2. `services/draw-data.js`: fetch/cache/source metadata and cutoff selection.
3. `domain/portfolio.js`: canonical ticket and portfolio contracts plus audit.
4. `services/lock-service.js`: immutable snapshots and compatibility with existing keys.
5. `services/result-service.js`: actual results, special ball and prize scoring.
6. `engines/track-a.js`, `track-b.js`, `track-c.js`, `track-l.js`: compatibility wrappers first; preserve exact algorithms.
7. Track D adapter: preserve its four-file split and research-only boundaries.
8. `services/analytics.js` and `evaluation.js`: descriptive analytics vs prospective/walk-forward evaluation.
9. UI modules after service parity tests pass.

Do not move or rename storage keys during the initial extraction.
