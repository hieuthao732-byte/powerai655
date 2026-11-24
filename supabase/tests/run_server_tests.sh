#!/usr/bin/env bash
# Server-side tests for the ONE lock/unlock migration against a throwaway local Postgres.
# Never touches a real Supabase project. Needs PostgreSQL binaries (PGBIN) and, when run as root, the `postgres` user.
set -u
SRC="$(cd "$(dirname "$0")" && pwd)"; HERE="$SRC"; MIG="$SRC/../migrations"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PORT="${PGPORT_TEST:-54329}"; DATA="$(mktemp -d)"; SOCK="$DATA/sock"; mkdir -p "$SOCK"
RUN=""; if [ "$(id -u)" = 0 ]; then chmod 755 "$DATA"; chown -R postgres "$DATA"; RUN="runuser -u postgres --"; mkdir "$DATA/in"; cp -r "$SRC" "$DATA/in/tests"; cp -r "$SRC/../migrations" "$DATA/in/migrations"; chmod -R a+rX "$DATA/in"; HERE="$DATA/in/tests"; MIG="$DATA/in/migrations"; fi
A=aaaaaaaa-0000-0000-0000-000000000001; B=bbbbbbbb-0000-0000-0000-000000000002
FAILS=0; PASSES=0
cleanup(){ $RUN "$PGBIN/pg_ctl" -D "$DATA/db" -m immediate stop >/dev/null 2>&1; rm -rf "$DATA"; }
trap cleanup EXIT
$RUN "$PGBIN/initdb" -D "$DATA/db" -U postgres --auth=trust >/dev/null || { echo "initdb failed"; exit 2; }
$RUN "$PGBIN/pg_ctl" -D "$DATA/db" -o "-p $PORT -k $SOCK -c listen_addresses=''" -w start >/dev/null || { echo "start failed"; exit 2; }
psql_(){ $RUN "$PGBIN/psql" -h "$SOCK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -v VERBOSITY=terse -qAtX "$@"; }
psql_ -f "$HERE/00_stub_supabase.sql" >/dev/null || { echo "stub failed"; exit 2; }
for f in "$MIG"/*.sql; do psql_ -f "$f" >/dev/null 2>"$DATA/err" || { echo "migration $f failed"; cat "$DATA/err"; exit 2; }; done
for f in "$MIG"/*.sql; do psql_ -f "$f" >/dev/null 2>"$DATA/err" || { echo "migration $f is not re-runnable"; cat "$DATA/err"; exit 2; }; done

# as <uid> <sql>: run as authenticated user; prints result or the ERROR line
as(){ psql_ -c "set role authenticated; select set_config('request.jwt.claim.sub','$1',false); $2" 2>&1 | grep -v '^$' | grep -v "^$1$" | grep -v '^SET$' | tail -1; }
asv(){ psql_ -c "set role authenticated; select set_config('request.jwt.claim.sub','$1',false); $2" 2>&1 | tail -1; }
super(){ psql_ -c "$1" 2>&1 | tail -1; }
check(){ if [ "$2" = "$3" ]; then PASSES=$((PASSES+1)); echo "PASS $1"; else FAILS=$((FAILS+1)); echo "FAIL $1 (expected '$3', got '$2')"; fi; }
checkm(){ if echo "$2" | grep -qE "$3"; then PASSES=$((PASSES+1)); echo "PASS $1"; else FAILS=$((FAILS+1)); echo "FAIL $1 (expected /$3/, got '$2')"; fi; }

tickets(){ python3 -c "import json;print(json.dumps([{'main':[1,2,3,4,5,i+6]} for i in range(20)]))"; }
T="$(tickets)"
ins(){ echo "insert into public.one_portfolio_locks(user_id,target_draw_id,cutoff_draw_id,selection_hash,tickets) values ('$1',$2,$3,'H$2','$T'::jsonb) returning 'ok'"; }
unl(){ echo "select public.powerai_unlock_one_portfolio($1)"; }

# --- lock -------------------------------------------------------------
check "lock insert ok" "$(asv $A "$(ins $A 100 99)")" "ok"
check "server sets locked_at (forged value ignored)" "$(super "insert into public.one_portfolio_locks(user_id,target_draw_id,cutoff_draw_id,selection_hash,tickets,locked_at,tickets_sha256) values ('$A',101,100,'H','$T'::jsonb,'2000-01-01','forged')" >/dev/null; psql_ -tc "select (locked_at>now()-interval '1 minute') and tickets_sha256<>'forged' from public.one_portfolio_locks where target_draw_id=101")" "t"
super "delete from public.one_portfolio_locks where target_draw_id=101" >/dev/null
checkm "duplicate lock refused" "$(asv $A "$(ins $A 100 99)")" "duplicate key"
checkm "cannot lock for another user" "$(asv $B "$(ins $A 102 101)")" "not_owner|row-level security"
checkm "19 tickets refused" "$(asv $A "insert into public.one_portfolio_locks(user_id,target_draw_id,cutoff_draw_id,selection_hash,tickets) values ('$A',103,102,'H','[]'::jsonb)")" "invalid_ticket_count"
checkm "bad ticket refused" "$(asv $A "insert into public.one_portfolio_locks(user_id,target_draw_id,cutoff_draw_id,selection_hash,tickets) values ('$A',103,102,'H',(select jsonb_agg(jsonb_build_object('main',jsonb_build_array(1,1,2,3,4,5))) from generate_series(1,20))::jsonb)")" "invalid_ticket"
checkm "cutoff must precede target" "$(asv $A "$(ins $A 104 104)")" "check constraint|violates"
checkm "owner cannot UPDATE lock" "$(asv $A "update public.one_portfolio_locks set selection_hash='X' where target_draw_id=100")" "permission denied"
checkm "owner cannot DELETE lock" "$(asv $A "delete from public.one_portfolio_locks where target_draw_id=100")" "permission denied"
checkm "owner cannot write unlock log" "$(asv $A "insert into public.one_portfolio_unlock_log(user_id,target_draw_id,selection_hash,tickets_sha256,locked_at) values ('$A',100,'x','y',now())")" "permission denied"
check "user B cannot see A's lock" "$(as $B "select count(*) from public.one_portfolio_locks")" "0"
check "owner sees own lock" "$(as $A "select count(*) from public.one_portfolio_locks")" "1"
checkm "anon cannot call unlock" "$(psql_ -c "set role anon; select public.powerai_unlock_one_portfolio(100)" 2>&1 | tail -1)" "permission denied"
checkm "unauthenticated (no uid) unlock refused" "$(psql_ -c "set role authenticated; select set_config('request.jwt.claim.sub','',false); select public.powerai_unlock_one_portfolio(100)" 2>&1 | tail -1)" "not_authenticated"
check "user B unlock of A's draw returns false" "$(as $B "$(unl 100)")" "f"

# --- valid unlock -----------------------------------------------------
HASH_BEFORE="$(psql_ -tc "select tickets_sha256 from public.one_portfolio_locks where target_draw_id=100")"
check "valid unlock inside window" "$(as $A "$(unl 100)")" "t"
check "lock removed" "$(psql_ -tc "select count(*) from public.one_portfolio_locks where target_draw_id=100")" "0"
check "log row keeps hash" "$(psql_ -tc "select tickets_sha256 from public.one_portfolio_unlock_log where target_draw_id=100")" "$HASH_BEFORE"
check "log row keeps selection_hash and locked_at" "$(psql_ -tc "select selection_hash='H100' and locked_at is not null from public.one_portfolio_unlock_log where target_draw_id=100")" "t"

# --- second unlock ----------------------------------------------------
check "relock after unlock ok" "$(asv $A "$(ins $A 100 99)")" "ok"
checkm "second unlock refused (unlock_limit_reached)" "$(asv $A "$(unl 100)")" "unlock_limit_reached"
check "lock still present after refused second unlock" "$(psql_ -tc "select count(*) from public.one_portfolio_locks where target_draw_id=100")" "1"
check "still exactly one log row" "$(psql_ -tc "select count(*) from public.one_portfolio_unlock_log where target_draw_id=100")" "1"

# --- expired window ---------------------------------------------------
asv $A "$(ins $A 200 199)" >/dev/null
super "update public.one_portfolio_locks set locked_at=now()-interval '9 minutes 50 seconds' where target_draw_id=200" >/dev/null
check "unlock at 9m50s still allowed" "$(as $A "$(unl 200)")" "t"
asv $A "$(ins $A 201 200)" >/dev/null
super "update public.one_portfolio_locks set locked_at=now()-interval '10 minutes 5 seconds' where target_draw_id=201" >/dev/null
checkm "unlock at 10m05s refused (unlock_window_expired)" "$(asv $A "$(unl 201)")" "unlock_window_expired"
check "expired lock untouched" "$(psql_ -tc "select count(*) from public.one_portfolio_locks where target_draw_id=201")" "1"
check "expired attempt wrote no log row" "$(psql_ -tc "select count(*) from public.one_portfolio_unlock_log where target_draw_id=201")" "0"
asv $A "$(ins $A 202 201)" >/dev/null
check "client-supplied timestamps cannot extend the window" "$(psql_ -tc "select count(*) from pg_proc where proname='powerai_unlock_one_portfolio' and pronargs=1")" "1"

# --- two concurrent unlocks ------------------------------------------
asv $A "$(ins $A 300 299)" >/dev/null
( as $A "select public.powerai_unlock_one_portfolio(300), pg_sleep(0.3)" | cut -d'|' -f1 > "$DATA/c1" ) &
( as $A "select public.powerai_unlock_one_portfolio(300), pg_sleep(0.3)" | cut -d'|' -f1 > "$DATA/c2" ) &
wait
RES="$(sort "$DATA/c1" "$DATA/c2" | tr '\n' ' ')"
check "concurrent unlocks: exactly one true, one false" "$RES" "f t "
check "concurrent unlocks: exactly one log row" "$(psql_ -tc "select count(*) from public.one_portfolio_unlock_log where target_draw_id=300")" "1"
check "concurrent unlocks: lock gone" "$(psql_ -tc "select count(*) from public.one_portfolio_locks where target_draw_id=300")" "0"

# --- concurrent lock+unlock must not duplicate or lose audit ---------
asv $A "$(ins $A 400 399)" >/dev/null
( as $A "$(unl 400)" > "$DATA/d1" ) & ( asv $A "$(ins $A 400 399)" > "$DATA/d2" ) & wait
check "lock count for 400 is 0 or 1, log <=1" "$(psql_ -tc "select (select count(*) from public.one_portfolio_locks where target_draw_id=400)<=1 and (select count(*) from public.one_portfolio_unlock_log where target_draw_id=400)<=1")" "t"

# --- privileges / hardening migration --------------------------------
check "anon cannot execute admin RPCs" "$(psql_ -tc "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('powerai_admin_summary','powerai_admin_users','powerai_admin_set_role','powerai_admin_set_user_enabled','powerai_delete_my_account','assign_powerai_role','is_powerai_admin_email') and has_function_privilege('anon',p.oid,'EXECUTE')")" "0"
check "authenticated has no TRUNCATE on user_app_state" "$(psql_ -tc "select has_table_privilege('authenticated','public.user_app_state','TRUNCATE')")" "f"
check "RLS enabled on both new tables" "$(psql_ -tc "select count(*) from pg_class where relname in ('one_portfolio_locks','one_portfolio_unlock_log') and relrowsecurity")" "2"
check "user_app_state.version starts at 0 and bumps to 1 on update" "$(psql_ -tc "insert into public.user_app_state(user_id) values ('$B'); update public.user_app_state set preferences='{\"a\":1}' where user_id='$B'; select version from public.user_app_state where user_id='$B'" | tail -1)" "1"

echo; echo "server tests: $PASSES passed, $FAILS failed"
# --- end-to-end: real bridge against this database ---------------------
if command -v node >/dev/null; then
  psql_ -c "delete from public.one_portfolio_locks; delete from public.one_portfolio_unlock_log" >/dev/null
  PGBIN="$PGBIN" PGSOCK="$SOCK" PGPORT_TEST="$PORT" PG_RUN="${RUN:+runuser}" node "$SRC/e2e_bridge_vs_postgres.js" || FAILS=$((FAILS+1))
fi
[ "$FAILS" = 0 ]
