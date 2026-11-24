"use strict";
/* End-to-end: the REAL one-web-bridge.js talks to the REAL migration in a throwaway Postgres.
   Only the HTTP layer is replaced by a small adapter that mimics PostgREST (RLS via role + JWT claim). Run by run_server_tests.sh. */
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createDevice, createFakeServer, UID_A, UID_B } = require("../../POWERAI_ONE/one-bridge-test-harness.js");
const E = process.env;
const lit = (v) => "'" + String(v).replace(/'/g, "''") + "'";
function psql(sql) {
  const args = ["-h", E.PGSOCK, "-p", E.PGPORT_TEST, "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=terse", "-qAtX", "-c", sql];
  const run = E.PG_RUN ? [E.PG_RUN, "psql", ...args] : [E.PGBIN + "/psql", ...args];
  const cmd = E.PG_RUN ? "runuser" : run[0];
  const a = E.PG_RUN ? ["-u", "postgres", "--", E.PGBIN + "/psql", ...args] : args;
  try { return execFileSync(cmd, a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { const m = /ERROR:\s+(.*)/.exec(String(e.stderr)); throw new Error(m ? m[1].trim() : String(e.stderr)); }
}
const asUser = (uid, sql) => "set role authenticated; select set_config('request.jwt.claim.sub'," + lit(uid) + ",false); " + sql;
function lastJson(out) { const lines = out.trim().split("\n"); return JSON.parse(lines[lines.length - 1]); }
function request(uid) {
  return async (path, opts) => {
    const { method = "GET", body = null, headers = {} } = opts || {}, u = new URL("http://x" + path), p = u.pathname;
    if (method === "POST" && p === "/rest/v1/rpc/powerai_unlock_one_portfolio")
      return lastJson(psql(asUser(uid, "select to_json(public.powerai_unlock_one_portfolio(" + Number(body.p_target_draw_id) + "))")));
    if (method === "POST" && p === "/rest/v1/one_portfolio_locks") {
      const cols = ["user_id", "target_draw_id", "cutoff_draw_id", "selection_hash", "model", "tickets", "client_generated_at", "client_locked_at"].filter((c) => body[c] !== undefined && body[c] !== null);
      const vals = cols.map((c) => (c === "tickets" ? lit(JSON.stringify(body[c])) + "::jsonb" : lit(body[c])));
      const sql = "insert into public.one_portfolio_locks(" + cols.join(",") + ") values (" + vals.join(",") + ") returning to_json(one_portfolio_locks)";
      try { const out = psql(asUser(uid, sql)).trim().split("\n").filter((l) => l.startsWith("{")); return headers.Prefer === "return=representation" ? [JSON.parse(out[0])] : null; }
      catch (e) { if (/duplicate key/.test(e.message)) throw new Error("duplicate key value violates unique constraint (23505)"); throw e; }
    }
    if (method === "GET" && (p === "/rest/v1/one_portfolio_locks" || p === "/rest/v1/one_portfolio_unlock_log")) {
      const table = p.split("/").pop(), where = [], ord = u.searchParams.get("order");
      const t = u.searchParams.get("target_draw_id"); if (t && t.startsWith("eq.")) where.push("target_draw_id=" + Number(t.slice(3)));
      const sel = (u.searchParams.get("select") || "*").split(",").map((c) => c.replace(/[^a-z_0-9*]/g, "")).join(",");
      const sql = "select coalesce(json_agg(t),'[]'::json) from (select " + sel + " from public." + table + (where.length ? " where " + where.join(" and ") : "") + (ord ? " order by " + ord.split(".")[0].replace(/[^a-z_]/g, "") + (ord.endsWith(".desc") ? " desc" : "") : "") + ") t";
      return lastJson(psql(asUser(uid, sql)));
    }
    throw new Error("Could not find the table '" + p + "' in the schema cache");
  };
}
function realDevice(uid, extra) { // swap the fake server's transport for the Postgres adapter
  const fake = createFakeServer(); fake.requestFor = request;
  return createDevice(Object.assign({ uid, server: fake }, extra || {}));
}
let pass = 0, fail = 0;
async function test(n, f) { try { await f(); pass++; console.log("PASS e2e " + n); } catch (e) { fail++; console.log("FAIL e2e " + n + "\n  " + (e && e.stack || e)); } }
const T = 2;
(async () => {
  await test("lock → unlock inside window → relock → second unlock refused", async () => {
    const d = realDevice(UID_A); await d.ready(); await d.build();
    await d.click("oneLockBtn"); await d.settle(200);
    assert.equal(d.portfolio(T).serverVerified, true);
    assert.equal(psql("select count(*) from public.one_portfolio_locks where target_draw_id=" + T).trim(), "1");
    await d.click("oneUnlockBtn"); await d.settle(300);
    assert.equal(d.portfolio(T), null);
    assert.equal(psql("select count(*) from public.one_portfolio_unlock_log where target_draw_id=" + T).trim(), "1");
    await d.click("oneLockBtn"); await d.settle(200);
    assert.equal(d.els.oneUnlockBtn.disabled, true);
    await d.click("oneUnlockBtn", { force: true }); await d.settle(300);
    assert.match(d.status(), /unlock_limit_reached/);
    assert.ok(d.portfolio(T));
  });
  await test("expired window (row aged in DB) → unlock_window_expired shown, lock untouched", async () => {
    psql("delete from public.one_portfolio_locks; delete from public.one_portfolio_unlock_log;");
    const d = realDevice(UID_A); await d.ready(); await d.build();
    await d.click("oneLockBtn"); await d.settle(200);
    psql("update public.one_portfolio_locks set locked_at=now()-interval '11 minutes'");
    await d.click("oneUnlockBtn"); await d.settle(300);
    assert.match(d.status(), /unlock_window_expired/); assert.match(d.status(), /10 phút/);
    assert.equal(psql("select count(*) from public.one_portfolio_locks").trim(), "1");
    assert.equal(psql("select count(*) from public.one_portfolio_unlock_log").trim(), "0");
  });
  await test("two devices unlock at the same moment → one audit row, both end unlocked", async () => {
    psql("delete from public.one_portfolio_locks; delete from public.one_portfolio_unlock_log;");
    const d1 = realDevice(UID_A); await d1.ready(); await d1.build(); await d1.click("oneLockBtn"); await d1.settle(200);
    const d2 = realDevice(UID_A); await d2.ready();
    assert.ok(d2.portfolio(T));
    await Promise.all([d1.click("oneUnlockBtn"), d2.click("oneUnlockBtn")]); await d1.settle(500);
    assert.equal(psql("select count(*) from public.one_portfolio_unlock_log").trim(), "1");
    assert.equal(psql("select count(*) from public.one_portfolio_locks").trim(), "0");
    assert.equal(d1.portfolio(T), null); assert.equal(d2.portfolio(T), null);
  });
  await test("RLS: another user's device sees no lock", async () => {
    psql("delete from public.one_portfolio_locks; delete from public.one_portfolio_unlock_log;");
    const d1 = realDevice(UID_A); await d1.ready(); await d1.build(); await d1.click("oneLockBtn"); await d1.settle(200);
    const b = realDevice(UID_B); await b.ready();
    assert.equal(b.portfolio(T), null);
  });
  console.log("e2e: " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
})();
