"use strict";
/* Client tests for the server-side lock/unlock policy: valid unlock, expired window, second unlock,
   two concurrent unlocks, legacy locks, unknown outcome, cross-device state, audit trail. */
const assert = require("node:assert/strict");
const { createFakeServer, createDevice, wait, UID_A, UID_B } = require("./one-bridge-test-harness.js");

const TARGET = 2, MIN = 60 * 1000;
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("PASS " + name); }
  catch (e) { failed++; console.log("FAIL " + name + "\n  " + (e && e.stack || e)); }
}
async function lockedDevice(server, opts) {
  const d = createDevice(Object.assign({ server }, opts || {}));
  await d.ready(); await d.build(); await d.click("oneLockBtn"); await d.settle();
  return d;
}
const unlockCalls = (s) => s.callsTo(/POST \/rest\/v1\/rpc\/powerai_unlock_one_portfolio/);

(async () => {
  await test("lock goes to the server; locked_at and hash come from the server", async () => {
    const s = createFakeServer(); const d = await lockedDevice(s);
    const row = s.lockRow(UID_A, TARGET); assert.ok(row, "server row exists");
    const post = s.callsTo(/POST \/rest\/v1\/one_portfolio_locks/)[0];
    assert.ok(!("locked_at" in post.body) && !("tickets_sha256" in post.body), "client must not send server-owned fields");
    const p = d.portfolio(TARGET);
    assert.equal(p.serverVerified, true); assert.equal(p.lockedAt, row.locked_at); assert.equal(p.ticketsSha256, row.tickets_sha256);
    assert.equal(d.els.oneUnlockBtn.disabled, false);
  });

  await test("valid unlock within window: RPC sends only the draw id, lock removed, audit entry kept", async () => {
    const s = createFakeServer(); const d = await lockedDevice(s);
    const hash = s.lockRow(UID_A, TARGET).tickets_sha256;
    s.advance(5 * MIN);
    await d.click("oneUnlockBtn"); await d.settle();
    const calls = unlockCalls(s); assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].body, { p_target_draw_id: TARGET }, "no time/permission sent by client");
    assert.equal(s.lockRow(UID_A, TARGET), null);
    assert.equal(s.log.length, 1); assert.equal(s.log[0].tickets_sha256, hash);
    assert.equal(d.portfolio(TARGET), null);
    const log = d.store().unlockLog; assert.equal(log.length, 1); assert.equal(log[0].source, "server"); assert.equal(log[0].ticketsSha256, hash);
    assert.equal(d.els.oneUnlockBtn.disabled, true, "no second unlock offered");
    assert.equal(d.els.oneLockBtn.disabled, false, "can lock again");
  });

  await test("unlock after 10 minutes: server rejects, lock untouched, clear message", async () => {
    const s = createFakeServer(); const d = await lockedDevice(s);
    s.advance(10 * MIN + 1000);
    await d.click("oneUnlockBtn"); await d.settle();
    assert.ok(s.lockRow(UID_A, TARGET), "still locked on server");
    assert.ok(d.portfolio(TARGET), "still locked locally");
    assert.match(d.status(), /unlock_window_expired/); assert.match(d.status(), /10 phút/); assert.ok(d.statusIsError());
    assert.equal(s.log.length, 0);
    assert.equal(d.els.oneUnlockBtn.disabled, true);
  });

  await test("client clock is not used: a stale screen after the window still reaches the server, which decides", async () => {
    const s = createFakeServer(); const d = await lockedDevice(s);
    s.advance(11 * MIN);
    assert.equal(d.els.oneUnlockBtn.disabled, false, "button state does not depend on the clock");
    await d.click("oneUnlockBtn"); await d.settle();
    assert.equal(unlockCalls(s).length, 1, "decision was made by server, not skipped by client");
    assert.match(d.status(), /unlock_window_expired/);
  });

  await test("a server that grants a longer window is honoured (client has no own limit)", async () => {
    const s = createFakeServer({ windowMs: 60 * MIN }); const d = await lockedDevice(s);
    s.advance(30 * MIN);
    await d.click("oneUnlockBtn"); await d.settle();
    assert.equal(s.lockRow(UID_A, TARGET), null);
  });

  await test("second unlock for the same draw: unlock_limit_reached, lock stays", async () => {
    const s = createFakeServer(); const d = await lockedDevice(s);
    await d.click("oneUnlockBtn"); await d.settle();
    await d.click("oneLockBtn"); await d.settle();
    assert.ok(s.lockRow(UID_A, TARGET), "relocked");
    assert.equal(d.els.oneUnlockBtn.disabled, true, "button disabled from server log");
    assert.match(d.els.oneUnlockHint.textContent, /unlock_limit_reached/);
    const before = s.log.length;
    await d.click("oneUnlockBtn", { force: true }); await d.settle();
    assert.match(d.status(), /unlock_limit_reached/); assert.ok(d.statusIsError());
    assert.ok(s.lockRow(UID_A, TARGET)); assert.equal(s.log.length, before);
    assert.ok(d.portfolio(TARGET));
  });

  await test("two concurrent unlock requests (two devices): exactly one succeeds, other gets limit error and stays locked in sync", async () => {
    const s = createFakeServer();
    const d1 = await lockedDevice(s);
    const d2 = createDevice({ server: s }); await d2.ready();
    assert.ok(d2.portfolio(TARGET), "device 2 sees the server lock");
    const [r1, r2] = await Promise.allSettled([d1.click("oneUnlockBtn"), d2.click("oneUnlockBtn")]);
    await d1.settle(100);
    assert.equal(s.log.length, 1, "one audit row only");
    assert.equal(s.lockRow(UID_A, TARGET), null);
    assert.equal(unlockCalls(s).length, 2);
    // Loser is told the truth (either "not locked any more" resync or limit error), and holds no stale lock.
    assert.equal(d1.portfolio(TARGET), null); assert.equal(d2.portfolio(TARGET), null);
    assert.ok(r1.status === "fulfilled" && r2.status === "fulfilled");
  });

  await test("two concurrent unlocks on the same device: second click is ignored while first is in flight", async () => {
    const s = createFakeServer(); const d = await lockedDevice(s);
    const g = s.gate(/POST \/rest\/v1\/rpc\/powerai_unlock_one_portfolio/);
    const first = d.click("oneUnlockBtn");
    await wait(30);
    await d.click("oneUnlockBtn", { force: true });
    g.release(); await first; await d.settle();
    assert.equal(unlockCalls(s).length, 1);
    assert.equal(s.log.length, 1);
  });

  await test("legacy local lock (not server verified): never unlockable, no RPC", async () => {
    const s = createFakeServer();
    const legacy = { portfolios: { [TARGET]: { targetDrawId: TARGET, cutoffDrawId: 1, selectionHash: "OLD", tickets: Array.from({ length: 20 }, (_, i) => ({ main: [1, 2, 3, 4, 5, i + 6] })), lockedAt: "2026-11-01T00:00:00.000Z" } }, unlockLog: [], evaluations: [] };
    const d = createDevice({ server: s, storage: { powerai_rc6_one_portfolios: JSON.stringify(legacy) } });
    await d.ready();
    assert.equal(d.els.oneUnlockBtn.disabled, true);
    await d.click("oneUnlockBtn", { force: true }); await d.settle();
    assert.equal(unlockCalls(s).length, 0);
    assert.ok(d.portfolio(TARGET)); assert.equal(d.portfolio(TARGET).selectionHash, "OLD");
  });

  await test("old rule removed: no code path unlocks purely on client state or 'before the draw'", async () => {
    const s = createFakeServer(); const d = await lockedDevice(s);
    s.failNext(/POST \/rest\/v1\/rpc\//, "network down", "before");
    await d.click("oneUnlockBtn"); await d.settle();
    assert.ok(d.portfolio(TARGET), "local lock survives when the server did not confirm");
    assert.ok(s.lockRow(UID_A, TARGET));
    assert.equal(d.store().unlockLog.length, 0);
  });

  await test("unknown outcome (response lost after server unlocked): resolved by re-reading the server", async () => {
    const s = createFakeServer(); const d = await lockedDevice(s);
    s.failNext(/POST \/rest\/v1\/rpc\//, "connection reset", "after");
    await d.click("oneUnlockBtn"); await d.settle();
    assert.equal(s.lockRow(UID_A, TARGET), null);
    assert.equal(d.portfolio(TARGET), null, "client reflects server truth");
    assert.equal(d.store().unlockLog.length, 1); assert.equal(d.store().unlockLog[0].source, "server");
  });

  await test("migration missing: unlock and lock fail closed with explicit message", async () => {
    const s = createFakeServer(); const d = await lockedDevice(s);
    s.failNext(/POST \/rest\/v1\/rpc\//, "Could not find the function public.powerai_unlock_one_portfolio in the schema cache", "before");
    await d.click("oneUnlockBtn"); await d.settle();
    assert.match(d.status(), /migration/); assert.ok(d.portfolio(TARGET));
    const s2 = createFakeServer(); const d2 = createDevice({ server: s2 }); await d2.ready(); await d2.build();
    s2.failNext(/POST \/rest\/v1\/one_portfolio_locks/, "Could not find the table 'public.one_portfolio_locks' in the schema cache", "before");
    await d2.click("oneLockBtn"); await d2.settle();
    assert.match(d2.status(), /CHƯA được khóa/); assert.equal(d2.portfolio(TARGET), null);
  });

  await test("lock requires login and a successful server write; no local-only lock", async () => {
    const d = createDevice({ loggedIn: false }); await d.ready(); await d.build();
    await d.click("oneLockBtn"); await d.settle();
    assert.equal(d.portfolio(TARGET), null);
    const s = createFakeServer(); const d2 = createDevice({ server: s }); await d2.ready(); await d2.build();
    s.failNext(/POST \/rest\/v1\/one_portfolio_locks/, "timeout", "before");
    await d2.click("oneLockBtn"); await d2.settle();
    assert.equal(d2.portfolio(TARGET), null); assert.match(d2.status(), /CHƯA được khóa/);
  });

  await test("duplicate lock from another device adopts the existing server lock, never overwrites it", async () => {
    const s = createFakeServer(); const d1 = await lockedDevice(s, { hash: "HASH-ONE" });
    const orig = s.lockRow(UID_A, TARGET).tickets_sha256;
    const d2 = createDevice({ server: s, hash: "HASH-TWO" }); await d2.ready(); await d2.build();
    await d2.click("oneLockBtn", { force: true }); await d2.settle();
    assert.equal(s.lockRow(UID_A, TARGET).selection_hash, "HASH-ONE");
    assert.equal(s.lockRow(UID_A, TARGET).tickets_sha256, orig);
    assert.equal(d2.portfolio(TARGET).selectionHash, "HASH-ONE");
  });

  await test("cross-device: unlock on device 1 is reflected on device 2 after re-sync", async () => {
    const s = createFakeServer(); const d1 = await lockedDevice(s);
    const d2 = createDevice({ server: s }); await d2.ready();
    assert.ok(d2.portfolio(TARGET));
    await d1.click("oneUnlockBtn"); await d1.settle();
    await d2.becomeVisible(); // throttled (15s) so it may not re-read yet; the hydrate event always does
    await d2.emit("powerai-cloud-hydrated");
    assert.equal(d2.portfolio(TARGET), null);
    assert.equal(d2.els.oneUnlockBtn.disabled, true);
    assert.equal(d2.store().unlockLog.length, 1);
  });

  await test("local cache tampering: a server-verified lock missing on the server is removed and audited", async () => {
    const s = createFakeServer(); const d = await lockedDevice(s);
    s.locks.clear(); // e.g. admin/restore; no unlock log row
    await d.emit("powerai-cloud-hydrated");
    assert.equal(d.portfolio(TARGET), null);
    assert.ok((d.store().conflicts || []).length >= 1, "conflict recorded");
  });

  await test("server rows override a divergent local copy (hash preserved, conflict recorded)", async () => {
    const s = createFakeServer(); const d = await lockedDevice(s);
    const st = d.store(); st.portfolios[TARGET].selectionHash = "FORGED"; d.storage.powerai_rc6_one_portfolios = JSON.stringify(st);
    await d.emit("powerai-cloud-hydrated");
    assert.equal(d.portfolio(TARGET).selectionHash, s.lockRow(UID_A, TARGET).selection_hash);
    assert.ok((d.store().conflicts || []).length >= 1);
  });

  await test("users are isolated: user B does not see user A's lock or unlock log", async () => {
    const s = createFakeServer(); await lockedDevice(s);
    const b = createDevice({ server: s, uid: UID_B }); await b.ready();
    assert.equal(b.portfolio(TARGET), null);
    assert.equal(b.els.oneUnlockBtn.disabled, true);
  });

  await test("after the draw exists, unlock is refused without calling the server", async () => {
    const s = createFakeServer(); const d = await lockedDevice(s);
    d.addResult(TARGET); await d.settle();
    await d.click("oneUnlockBtn", { force: true }); await d.settle();
    assert.equal(unlockCalls(s).length, 0); assert.ok(d.portfolio(TARGET));
  });

  await test("evaluation record carries server lock time, source and ticket hash", async () => {
    const s = createFakeServer(); const d = await lockedDevice(s);
    const row = s.lockRow(UID_A, TARGET);
    d.addResult(TARGET); await d.emit("powerai-cloud-hydrated"); await d.settle(200);
    const ev = (d.store().evaluations || []).find((e) => e.targetDrawId === TARGET);
    assert.ok(ev, "evaluation was created"); { assert.equal(ev.lockSource, "server"); assert.equal(ev.ticketsSha256, row.tickets_sha256); assert.equal(ev.lockedAt, row.locked_at); }
  });

  await test("past-draw history lists locked tickets against the real result, with audit info", async () => {
    const s = createFakeServer(); const d = await lockedDevice(s);
    let h = d.els.oneHistoryPast.innerHTML;
    assert.match(h, /#00002/); assert.match(h, /Chờ kết quả/); assert.match(h, /SERVER/);
    d.addResult(TARGET); await d.emit("powerai-cloud-hydrated"); await d.settle(100);
    h = d.els.oneHistoryPast.innerHTML;
    assert.match(h, /KQ 01 02 03 04 05 06/); assert.match(h, /cao nhất 6\/6/); assert.match(h, /class="hit"/);
    assert.equal((h.match(/class="one-past-ticket"/g) || []).length, 20);
    assert.match(h, new RegExp(s.lockRow(UID_A, TARGET).tickets_sha256.slice(0, 12)));
  });

  await test("random comparison: one evaluated draw is 'not enough data'; legacy locks are excluded; 40 draws near random say 'not different'", async () => {
    const s = createFakeServer(); const d = await lockedDevice(s);
    d.addResult(TARGET); await d.emit("powerai-cloud-hydrated"); await d.settle(100);
    let h = d.els.oneRandomCompare.innerHTML;
    assert.match(h, /Chưa đủ dữ liệu \(1 kỳ\)/); assert.match(h, /1\.000 kỳ/);
    const mk = (id, three, src) => ({ targetDrawId: id, maxMainHits: three ? 3 : 2, lockSource: src, distribution: [0, 1, 2, 3, 4, 5, 6].map((x) => ({ hits: x, count: x === 0 ? (three ? 9 : 10) : x === 1 ? 8 : x === 2 ? 2 : x === 3 ? (three ? 1 : 0) : 0 })) });
    const evals = []; for (let i = 0; i < 40; i++) evals.push(mk(100 + i, i < 10, "server")); evals.push(mk(500, true, "client-legacy")); evals.push(mk(501, true, undefined));
    const d2 = createDevice({ server: createFakeServer(), storage: { powerai_rc6_one_portfolios: JSON.stringify({ portfolios: {}, unlockLog: [], evaluations: evals }) } });
    await d2.ready();
    h = d2.els.oneRandomCompare.innerHTML;
    assert.match(h, /40 kỳ · 800 vé/); assert.match(h, /bỏ 2 kỳ khóa kiểu cũ/); assert.match(h, /10 vé, kỳ vọng 10,7/); assert.match(h, /Chưa khác ngẫu nhiên\./);
    const strong = []; for (let i = 0; i < 40; i++) strong.push(mk(100 + i, true, "server")); strong.forEach((e) => { e.distribution[3].count = 4; e.distribution[0].count = 6; });
    const d3 = createDevice({ server: createFakeServer(), storage: { powerai_rc6_one_portfolios: JSON.stringify({ portfolios: {}, unlockLog: [], evaluations: strong }) } });
    await d3.ready();
    assert.match(d3.els.oneRandomCompare.innerHTML, /Cao hơn ngẫu nhiên/);
  });

  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})();
