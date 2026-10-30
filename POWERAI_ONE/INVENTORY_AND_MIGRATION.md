# PowerAI ONE — Codebase Inventory & Migration Plan

Status: initial repository audit, branch-only. No production files or user data changed.

## 1. Repository baseline

- Repository: `hieuthao732-byte/powerai655`
- Production/default branch at audit: `main`
- New isolated implementation branch: `feature/powerai-one` (created from `main`)
- Existing research branch remains separate: `research/reverse-analysis-framework`
- Existing deployed application: `https://powerai655.vercel.app/`
- Current app is a static HTML/CSS/JavaScript application with Supabase HTTP auth/cloud state.

## 2. Confirmed entry points and runtime files

| File | Confirmed responsibility | Migration decision |
|---|---|---|
| `index.html` | Main app shell, auth/account/admin modals, navigation, panels, metadata/SEO, loads styles and scripts | Replace presentation progressively; preserve stable DOM contracts until modules are separated |
| `app.js` | Large monolithic runtime: data fetch/normalization, A/B/C/L generation, scoring, locks, result comparison, cloud state, rendering, analytics, number intelligence, navigation additions | Split by domain behind compatibility adapters; do not rewrite all at once |
| `auth.js` | Supabase Auth HTTP bridge, login/register/recovery/session/account/admin interactions | Keep auth behavior and cloud ownership; isolate as account service |
| `style.css` | Main visual system and all current layouts/components | Replace in stages with design tokens and component styles |
| `adaptive-d.js` | Referenced by HTML; adaptive Track D runtime is a separate module | Audit implementation and its data contract before integration |
| `README.md` | RC6 architecture and frozen A/B/C constraints; references RC8 auth docs | Preserve as historical architecture record; add ONE docs separately |

## 3. Existing product surface confirmed in HTML / runtime

### Main navigation
RC9.3 introduces four primary views:
- Choose tickets
- Analysis
- Results
- Performance

The ticket-selection area includes A / B / C / L; a separate N number-intelligence view is also present in the source.

### Engines / research tracks
- A — geometry/simulation portfolio.
- B — historical-data legacy portfolio.
- C — geometry-constrained matrix hybrid.
- L — learning/adaptive portfolio.
- N — descriptive number intelligence (01–55).
- Track D — separate adaptive expert/challenger runtime; must be audited independently.

### Shared workflows
- Draw history fetch from the current JSONL source.
- Select target draw and enforce historical cutoff for eligible analyses.
- Generate, lock and compare portfolios.
- Enter/record actual draw results and score ticket/prize outcomes, including special number.
- Prospective history/logs and multi-draw performance views.
- Per-user local cache + Supabase cloud state.
- Guest read-only mode.
- Login/register/password recovery, account controls, admin dashboard.

## 4. Architecture and UX issues confirmed

1. The product surface has grown through successive RC patches (RC8.x / RC9.x) in a single HTML/CSS/JS application.
2. `app.js` contains multiple domain responsibilities and later render/navigation wrappers; this increases coupling and makes changes risky.
3. The HTML contains many large panels and nested sections. The UI needs a task-first information hierarchy rather than exposing every analysis at once.
4. The same data and portfolio concepts are consumed by generation, comparison, number intelligence and performance views. They need shared typed contracts and a single state/data layer.
5. Track labels and release labels are not fully aligned in the visible shell (e.g. RC9.7 header, RC7.0 hero copy, RC9.3 navigation comments). Normalize release/product labeling only after behavior inventory.
6. The reverse-analysis research track is isolated from production and must remain so until validated.

## 5. Non-negotiable preservation rules

- Do not modify `main`, production deployment settings, Supabase schema/RLS, or the production URL as part of this branch.
- Do not remove or mutate existing localStorage/cloud keys until a migration and rollback plan exists.
- Do not change A/B/C/L/D algorithm semantics while doing UI consolidation.
- Keep the special number separate from the six main numbers in all data and scoring contracts.
- Preserve draw locks, immutable snapshots, target draw identity, guest read-only behavior and per-user data isolation.
- Research results and unvalidated challenger features remain visibly separated from production engines.

## 6. Proposed PowerAI ONE target architecture

```
PowerAI ONE UI
  ├─ Home / Overview
  ├─ Generate (A / B / C / L / D, only enabled engines)
  ├─ Analysis (draw statistics, main vs special, number/pair/gap)
  ├─ Results (draw input/import, ticket comparison, prize scoring)
  ├─ Performance (prospective logs, walk-forward, engine comparison)
  └─ Settings (account, sync, data source, advanced controls)

Application services
  ├─ DrawDataService       — fetch, validate, normalize, cache, source metadata
  ├─ PortfolioService      — engine adapters and common ticket contract
  ├─ LockService           — immutable pre-draw snapshots
  ├─ ResultService         — actual result, special number, prize scoring
  ├─ AnalyticsService      — descriptive statistics only
  ├─ EvaluationService     — prospective and walk-forward evaluation
  ├─ AccountService        — auth, cloud state, permissions
  └─ ResearchService       — isolated reverse-analysis experiments

Engine adapters
  ├─ A / B / C / L         — compatibility adapters, behavior frozen
  └─ D                     — separate challenger adapter, shadow mode by default

Persistence
  ├─ Existing localStorage contract (compatibility layer)
  └─ Existing Supabase user_app_state contract (no schema changes)
```

## 7. Migration sequence

### Phase 0 — Inventory and safety (in progress)
- [x] Create `feature/powerai-one` from `main`.
- [x] Confirm main entry files and current navigation/engine surface.
- [ ] Enumerate every script, stylesheet, asset and deployment/config file.
- [ ] Map all app.js functions to domains and identify wrappers/duplicates.
- [ ] Audit adaptive Track D and auth/cloud persistence behavior.
- [ ] Record storage keys, snapshots, locks and data contracts.

### Phase 1 — Stable contracts
- Define canonical Draw, Portfolio, Ticket, SpecialNumber, LockSnapshot, DrawResult and Evaluation records.
- Add compatibility adapters around current A/B/C/L/D outputs.
- Add validation and golden tests for scoring, locks and geometry invariants.
- No visual rewrite yet.

### Phase 2 — Unified shell
- Build compact task-first navigation.
- Default to a clean Overview / Generate workspace.
- Put deep diagnostics and research under Analysis / Advanced.
- Preserve mobile-first responsive behavior and accessibility.

### Phase 3 — Consolidate services
- Extract data, portfolio, lock, result, analytics, evaluation and account services.
- Remove duplicate rendering paths only after parity tests.
- Keep existing persistence keys until migration is verified.

### Phase 4 — Research integration boundary
- Add research-only views and experiment registry.
- Require chronological holdout and random-baseline comparison.
- Never promote an effect based only on in-sample frequency or a single draw.

### Phase 5 — Validation and preview
- Run regression tests against known snapshots and draw results.
- Test guest, user, admin, logout, cloud hydration and offline/cache cases.
- Deploy only a preview from this feature branch for review; production remains unchanged.

## 8. Immediate next audit tasks

1. Inspect all script/style references from `index.html`, including `adaptive-d.js` and any admin modules.
2. Build a function inventory from `app.js` grouped by data, engines, scoring, state, UI and analytics.
3. Read complete auth bridge and map cloud schema fields without changing them.
4. Inspect `adaptive-d.js` and document Track D inputs/outputs and shadow-mode constraints.
5. Identify exact DOM IDs and event listeners that form the current UI contract.
