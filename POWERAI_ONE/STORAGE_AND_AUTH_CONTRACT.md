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
