# PowerAI ONE — Storage & Auth Compatibility Contract

Status: source-derived draft. No runtime, Supabase schema, RLS policy, or user data changed.

## 1. Safety boundary
- Keep main and production deployment untouched.
- Treat browser localStorage as user-owned state. Never clear, rename, or rewrite existing keys during UI migration.
- Treat Supabase ownership and RLS as security boundaries, not UI conventions.
- Never log access tokens, refresh tokens, user identifiers, or private ticket content.
- Guest mode is read-only. Every mutation path must enforce authorization, not merely hide/disable controls.
- Account deletion and admin operations remain explicitly confirmed and server-authorized.

## 2. Observed localStorage namespaces

| Namespace/key | Observed purpose | Compatibility rule |
|---|---|---|
| powerai_auth_session_v1 | Supabase session cache | Auth bridge owns this key; UI modules must not write it. |
| powerai_rc6_* | Main application state | Preserve names and payload shape during extraction. |
| powerai_rc6_active_target | Selected target draw | Read/write through adapter; validate against feed. |
| powerai_rc6_ui_tab | Earlier UI tab preference | Keep readable until migration parity is proven. |
| powerai_rc93_main_view | Main navigation preference | Preserve mapping; unknown values fall back safely. |
| powerai_rc97_perf_tab | Performance subview | Preserve until equivalent destinations exist. |
| powerai_rc6_log_<drawId> | Per-target result/prospective log | Preserve source metadata; never merge manual and official evidence. |
| powerai_rc6_learning_report_v1 | Learning report cache | Read-only compatibility until L parity is verified. |
| powerai_rc6_d_lock_<drawId> | Track D immutable snapshot | Preserve; integrity verifier remains authoritative. |
| powerai_rc6_d_logs | Track D official prospective log | Feed-only records. |
| powerai_rc6_d_state | Track D research/champion state | Keep separate from A/B/C/L and validation outputs. |
| powerai_rc6_d_shadow_logs | Track D challenger shadow outcomes | Never count as champion performance. |
| powerai_rc6_d_cycle_meta | Track D lifecycle metadata | Preserve lineage, rewards, quarantine and decision fields. |

This is not yet a complete key registry. Before migration, scan all localStorage get/set/remove/clear/key call sites and document dynamic keys.

## 3. Cloud contract observed
- Existing auth.js accesses Supabase Auth through REST endpoints for login, signup, refresh, logout, recovery and password update.
- Role lookup reads user_roles; default role is user, elevated role is admin.
- Admin actions use server-side RPCs for summary, user list, role changes, enabled state and account deletion.
- User state is stored through user_app_state, including local_state and lock metadata.
- Admin dashboard reports aggregate/account state and does not read private ticket combinations.
- RLS and RPC authorization must remain server-enforced.

## 4. Auth adapter contract

    type AuthSnapshot = {
      user: { id: string; email?: string } | null;
      role: "user" | "admin";
      authenticated: boolean;
      guestReadOnly: boolean;
    };

    interface AccountService {
      getSnapshot(): AuthSnapshot;
      subscribe(listener: (snapshot: AuthSnapshot) => void): () => void;
      login(email: string, password: string): Promise<void>;
      signup(email: string, password: string): Promise<void>;
      logout(): Promise<void>;
      refreshSession(): Promise<void>;
    }

The existing window.PowerAIAuth is the initial compatibility adapter. Its powerai-auth-changed event is the subscription signal. Do not expose raw tokens to presentation code.

## 5. State ownership
- Local-state adapter owns serialization and legacy key compatibility.
- Account service owns session lifecycle and identity.
- Cloud repository owns Supabase access and user scoping.
- Domain services receive explicit arguments; they must not reach into global localStorage.
- Preserve current sync/conflict behavior until separately tested.
- Guest mode cannot write user-owned state.
- Cloud failure must not silently discard a valid local snapshot.

## 6. Migration protocol — not yet authorized
1. Export a redacted structural fixture: key names and value shapes, no secrets/private tickets.
2. Add read-only adapters and compare old/new decoded state.
3. Add round-trip tests for snapshots, locks, logs, target selection and account transitions.
4. Test with a dedicated test account and isolated preview.
5. Only after explicit approval, add versioned migration with backup and rollback.
6. Never run destructive migration on production as part of a normal deploy.

## 7. Open questions
- Enumerate every main-app localStorage key and schema/version.
- Capture full user_app_state read/write shape and conflict semantics from app.js.
- Confirm whether cloud state includes D locks/logs or only A/B/C/L fields.
- Document expired session, refresh failure, disabled account and cross-device conflict behavior.
- Verify backend RLS/RPC policies separately; source code alone cannot prove them.


## 8. Confirmed sync behavior and high-risk migration detail

The current app.js defines POWERAI_PREFIX as powerai_rc6_. captureLocalState serializes every localStorage key with that prefix, not a hand-maintained list. hydrateLocalState first removes every key with that prefix and then restores the remote string values. applyCloudUser invokes this when switching to a signed-in account; when the active user logs out, it clears every powerai_rc6_ key before reloading the app. The auth session key powerai_auth_session_v1 is outside this prefix and is managed separately by auth.js.

This is an important existing behavior, not a change proposed for ONE. It means:
- Account switching can replace the local cache wholesale with that account's cloud snapshot.
- A cloud snapshot restore can remove locally cached keys that are absent remotely.
- Logout intentionally clears the signed-in user's local app cache and returns to guest/read-only state.
- Any ONE migration that changes the prefix, key family, or hydration order can cause data loss or cross-account leakage if not tested.

Required before touching this path:
1. Test user A → logout → guest → user B, proving no A state remains visible.
2. Test remote snapshot missing a local key and document whether removal is expected.
3. Test cloud read failure: local state must not be destroyed by a failed hydration.
4. Test remote state restore followed by reload and verify locks/logs exactly.
5. Keep auth session handling separate from app-state hydration.
6. Preserve the current prefix contract until a versioned migration and rollback are approved.

## 9. Confirmed exact legacy keys from app.js

- A/B/C combined lock: powerai_rc6_lock_<drawId>.
- Learning lock: powerai_rc6_learning_lock_<drawId>.
- Per-target log: powerai_rc6_log_<drawId>.
- Learning report: powerai_rc6_learning_report_v1.
- Main target: powerai_rc6_active_target.
- Track selection: powerai_rc6_ui_tab.
- Main view: powerai_rc93_main_view.
- Performance subview: powerai_rc97_perf_tab.

Track D's separate files define powerai_rc6_d_lock_<drawId>, powerai_rc6_d_logs, powerai_rc6_d_state, powerai_rc6_d_shadow_logs and powerai_rc6_d_cycle_meta.
