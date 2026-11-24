# PowerAI ONE — server-side locks and cross-device sync

Status: design + SQL migrations proposed. **Nothing has been applied to Supabase and no client code has changed.**
Files: `supabase/migrations/20261123000000_one_portfolio_locks.sql`, `supabase/migrations/20261123000100_harden_public_privileges.sql`.

## 1. Problems this addresses (observed in source and in the live project, 2026-11-23)

1. **Lost updates across devices.** `cloudSaveState()` (app.js) upserts the whole `local_state` snapshot with
   `Prefer: resolution=merge-duplicates`. Remote state is pulled only at login (`applyCloudUser`). A device holding a stale
   cache overwrites a lock created on another device the next time it saves.
2. **Lock time is not evidence.** `lockedAt` is `new Date()` in the browser, and "no overwrite" is enforced in the UI only.
   `adaptive-governor`, `after-draw-evaluation` and the challenger gate trust `lockedAt < resultAt` to call a result prospective.
3. **Locks are not queryable.** ONE locks live inside the `local_state` JSON blob under `powerai_rc6_one_portfolios`;
   the dedicated `abc_locked` / `l_locked` columns describe the legacy A/B/C/L locks only.

## 2. Design

### 2.1 `one_portfolio_locks` (one row per user + target draw)
- Primary key `(user_id, target_draw_id)`, so a draw can be locked once. RLS: select/insert own rows only; **no UPDATE or DELETE policy**
  and the privileges are revoked, so rows are immutable from the API.
- A `BEFORE INSERT` trigger validates the set (20 tickets, each 6 distinct numbers in 1..55), forces `locked_at := now()`
  and computes `tickets_sha256` from the stored JSON. Client-sent values for those two columns are ignored.
- `client_locked_at` / `client_generated_at` are kept for debugging only and must never be used as evidence.

### 2.2 Unlocking (decided 2026-11-23: limited correction window)
- The only way to remove a lock is `powerai_unlock_one_portfolio(target)`, which deletes the caller's own row and appends it to
  `one_portfolio_unlock_log` (append-only, select-own).
- **Window:** allowed only within 10 minutes of the server `locked_at`; later calls raise `unlock_window_expired`.
- **Limit:** at most 1 unlock per user and draw (counted in the log); another attempt raises `unlock_limit_reached`.
  Without the limit, lock/unlock/lock could be repeated until the draw and the window would mean nothing.
- Both numbers are constants at the top of the function. The window protects against mistakes (wrong draw, misclick), not against
  a change of mind after looking at the tickets, which is why it is short.
- The database does not know when a draw happens. Integrity against late changes still comes from the evaluator rule in 2.4.

### 2.3 Optimistic concurrency for `user_app_state`
- New column `version bigint`, incremented by the existing `touch_user_app_state_updated_at` trigger on every UPDATE.
  Client-supplied values are overwritten.
- A conditional write `PATCH /rest/v1/user_app_state?user_id=eq.<id>&version=eq.<seen>` with `Prefer: return=representation`
  returns an empty array when another device wrote first. That is the conflict signal.

### 2.4 Evaluator rules (change in `after-draw-evaluation.js` / `adaptive-governor.js` once locks come from the table)
- Use `locked_at` from the table, never `lockedAt` from the client.
- Count a draw as prospective only if `locked_at < official draw time` **and** the draw has no unlock-log entry with `unlocked_at`
  after its first `locked_at` followed by a re-lock. Report such draws separately instead of dropping them silently.
- Verify `tickets_sha256` against the tickets used for scoring.

## 3. Client changes

### 3.0 Implemented in `one-web-bridge.js` / `app.js` (covered by `one-web-bridge-unlock.test.js`)
- `lockCurrent` inserts into `one_portfolio_locks` first (`Prefer: return=representation`, no `locked_at` / `tickets_sha256` sent) and writes the
  local copy only from the server row. Duplicate key: the existing server lock is adopted. Not logged in, server error or migration missing: **no lock**
  (fail closed), with an explicit message.
- `unlockCurrent` calls `powerai_unlock_one_portfolio(p_target_draw_id)` and sends nothing else. The old "any time before the draw" rule is gone;
  there is no client-only unlock path. The client never compares times: the button state comes only from server facts (lock is `serverVerified`,
  no unlock-log row, draw not yet played), and the server decides the 10-minute window and the one-unlock limit.
  `unlock_window_expired` and `unlock_limit_reached` are shown in the status line, toast and the hint under the button; the lock is left untouched.
- A lock created before this change (no `serverVerified`) is final and cannot be unlocked from the app.
- Unknown outcome (timeout, response lost): the client re-reads the server and reports what the server says; it never guesses.
- `syncFromServer` reconciles on start, on `powerai-cloud-hydrated` (dispatched by `app.js` after cloud state is applied or cleared) and on
  `visibilitychange` (throttled to once per 15 s). The server table wins over the local/blob copy; differences are kept in `conflicts`.
- Unlock log entries from the server are merged into `unlockLog` (`source: "server"`); evaluations record `lockedAt` (server time),
  `lockSource` and `ticketsSha256`.
- The texts "10 phút" / "1 lần" in the UI are display only; changing the policy means editing the SQL constants and those two strings.

### 3.0.1 Still to do
1. `cloudLoadState`: also select `version`; keep it in memory (`cloudVersion`).
2. `cloudSaveState`: if a row exists, send the conditional PATCH above and update `cloudVersion` from the response; if the array is
   empty, **do not overwrite**: reload remote state, merge (3.1), then retry once. Use POST only when no row exists yet.
3. Merge policy 3.1 as a pure function with unit tests.
4. Encode filter values (`encodeURIComponent`); a bare `+` in a timestamp becomes a space in a query string. The `version` filter avoids this.

### 3.1 Merge policy on conflict (proposal, needs a pure function with unit tests)
| Data | Rule |
|---|---|
| ONE locks | table is authoritative; blob copy is discarded if it disagrees |
| `powerai_rc6_lock_*`, `powerai_rc6_learning_lock_*`, `powerai_rc6_log_*` | union by key; remote wins on a same-key difference; keep the losing local value under a `conflicts` list |
| ONE `evaluations`, `unlockLog` | union by (`targetDrawId`) / (`targetDrawId`, `at`) |
| UI preferences (`ui_tab`, `main_view`, `perf_tab`, `active_target`) | local wins |

## 4. Tests required before the client change ships
These extend the list in `STORAGE_AND_AUTH_CONTRACT.md` section 8.
- Device A locks, device B (stale cache, same user) edits and saves: A's lock survives and B receives it.
- Two devices lock the same target at once: exactly one row; the other device adopts it.
- User A, logout, guest, user B: no state from A remains.
- Cloud read failure during hydration does not delete local state.
- Unlock inside the window works once; a second unlock for the same draw is refused; unlock after the window is refused.
- Unlock, re-lock after the draw: evaluator rejects it (`locked_at` later than draw time).

## 5. Limits
- The project owner has database access and can still edit rows. For results shown to other people, publish `tickets_sha256`
  before each draw (for example in the repo) so the commitment exists outside the database.
- Nothing here changes lottery odds. This only makes the evaluation of "did ONE beat random" trustworthy.
- Leaked-password protection in Supabase Auth is off; it is a dashboard setting (Authentication, password security), not SQL.
- The admin identity is a single email address hard-coded in five database functions (`assign_powerai_role`, `is_powerai_admin_email`,
  `powerai_admin_set_role`, `powerai_admin_set_user_enabled`, `powerai_delete_my_account`). It works, but moving it to a table or setting
  would make it easier to change. The address is deliberately not written here because this repository is public.
