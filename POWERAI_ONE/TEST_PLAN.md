# PowerAI ONE — Regression & Migration Test Plan

Status: specification before runtime extraction. No production code or data changed.

## 1. Strategy
Use layered tests: pure domain validation, golden compatibility fixtures, persistence round-trip, auth/cloud integration, isolated-preview browser smoke tests, and research-lane leakage tests. Add testable modules without switching production entry points; replace one call path at a time after parity.

## 2. Draw/data tests
- Valid draw: six unique integers from 1 to 55, canonical ascending output.
- Reject 5/7 main numbers, duplicates, out-of-range values, non-integers and missing IDs.
- Special remains separate and nullable; never append it to main.
- Malformed feed rows are reported and excluded from inferential calculations.
- Detect duplicate IDs and out-of-order feed rows deterministically.
- For target T, every source draw ID used is strictly less than T.
- Feed refresh never mutates an existing lock snapshot.

## 3. Engine golden tests
Capture representative fixtures from the current branch before changing call paths:
- A: 20 tickets and frozen coverage/exposure/pair/overlap invariants in README.
- B: frozen legacy benchmark and deterministic output for fixed input/config/seed.
- C: constrained matrix hybrid invariants and deterministic output.
- L: eligibility rules, source-log cutoff, maturity/calibration behavior.
- D: D1–D4 deterministic model, portfolio hash, audit and rebuild integrity.

Compare exact ordered ticket content, hashes, audit fields, cutoff/source IDs and lock payload compatibility. If an engine is stochastic without a fixed seed, expose/capture its deterministic seed/config path before parity testing.

## 4. Lock/result tests
- Lock only before official result and according to existing per-target/engine semantics.
- Locked snapshot is immutable; changing selected target does not mutate it.
- Regeneration is disabled after lock or official result.
- Official scoring treats six main numbers and special independently.
- Manual results never become official feed evidence.
- Repeated imports are idempotent or show a visible conflict.
- Corrections preserve audit history and match existing rules.

## 5. Persistence/auth tests
- Legacy keys decode without loss.
- Serialize/deserialize round-trip preserves locks, logs, target selection, learning report and Track D metadata.
- Unknown keys are never deleted.
- Guest mode cannot mutate portfolios, locks, results or user cloud state.
- Explicit states for login, logout, expired token, refresh success/failure, recovery, disabled account and role lookup failure.
- User A cannot read/mutate User B data; verify with backend/RLS integration, not mocked UI alone.
- Cloud outage does not silently erase valid local state.
- Sync conflict behavior is repeatable and documented.
- Admin RPCs reject non-admin server-side.

Use synthetic accounts and redacted fixtures. Never commit real tokens or private ticket data.

## 6. Research isolation tests
- Retrospective validation cannot write official logs, champion weights, lock snapshots or promotion state.
- Shadow challenger rows are not counted as champion performance.
- Only subsequent official feed outcomes score official prospective/shadow records.
- Manual/replay results cannot update drift, reward history, quarantine or promotion decisions.
- Changing the target's own result must not change its pre-draw model hash.
- Research reports show sample size, null baseline and uncertainty; rankings are not win probabilities.

## 7. Isolated preview smoke tests
- No uncaught errors or duplicate DOM IDs.
- Overview, Generate, Analysis, Results, Performance and Settings navigation works.
- Mobile layout has no horizontal overflow; key actions remain reachable.
- Auth/account/guest/admin controls preserve current behavior.
- Password recovery hash/deep-link flow works.
- Feed refresh, target selection, generation, lock, result entry and export work.
- Keyboard navigation, focus, labels and modal close behavior are checked.

## 8. Release gates
Do not merge to main or deploy production until:
- [ ] Legacy behavior and golden fixtures pass.
- [ ] First ONE release requires no localStorage/cloud schema migration.
- [ ] Auth and RLS checks pass on a test account.
- [ ] Research isolation tests pass.
- [ ] Preview smoke tests pass on desktop and mobile.
- [ ] Rollback path is documented and tested.
- [ ] User explicitly approves release/deployment.

## 9. Known limitations
- Source inspection cannot prove deployed Supabase RLS policies or RPC behavior.
- Existing storage-key inventory is not yet exhaustive.
- A test harness/build pipeline has not yet been established.
- UI/architecture tests do not demonstrate predictive edge in a lottery.


## Unified selector gates
- [ ] Every engine adapter emits candidate tickets, not a separately competing final portfolio.
- [ ] A single ONE pipeline invokes the unified selector exactly once per portfolio build.
- [ ] Candidate provenance and provider-local score normalization are retained.
- [ ] Required A/C structural invariants are represented as eligibility constraints before selection.
- [ ] Compare unified policy against each legacy baseline in walk-forward evaluation; do not promote based on in-sample score.
- [ ] Confirm special-number scoring remains separate from main-number hits.
