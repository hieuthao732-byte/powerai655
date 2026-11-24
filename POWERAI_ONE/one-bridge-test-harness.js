"use strict";
/* Test support for one-web-bridge.js. Not shipped to the website (build.mjs copies an explicit file list).
   - createFakeServer(): in-memory stand-in for the Supabase REST API that follows the contract of
     supabase/migrations/20261123000000_one_portfolio_locks.sql (server-set locked_at and hash, immutable rows,
     10-minute unlock window, one unlock per draw, duplicate lock refused).
   - createDevice():     runs the REAL bridge source inside a vm context with a mocked DOM, localStorage and PowerAIAuth.
   The SQL itself is tested separately against a real Postgres in supabase/tests/. */
const fs = require("node:fs");
const vm = require("node:vm");
const crypto = require("node:crypto");

const SOURCE = fs.readFileSync(__dirname + "/one-web-bridge.js", "utf8");
const UID_A = "aaaaaaaa-0000-0000-0000-000000000001";
const UID_B = "bbbbbbbb-0000-0000-0000-000000000002";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

function element() {
  return {
    textContent: "", className: "", disabled: false, hidden: false, innerHTML: "", children: [], listeners: {}, dataset: {},
    addEventListener(name, fn) { this.listeners[name] = fn; },
    setAttribute() {}, querySelector() { return null; },
    append(...items) { this.children.push(...items); },
    replaceChildren(...items) { this.children = [...items]; },
  };
}

function createFakeServer(options) {
  const cfg = Object.assign({ windowMs: 10 * 60 * 1000, maxUnlocks: 1 }, options || {});
  const s = { clock: Date.parse("2026-11-23T12:00:00.000Z"), locks: new Map(), log: [], calls: [], failures: [], gates: [], cfg };
  const iso = () => new Date(s.clock).toISOString();
  const key = (uid, target) => uid + "|" + target;

  function validTicket(t) {
    const n = t && Array.isArray(t.main) ? t.main.map(Number) : [];
    return n.length === 6 && new Set(n).size === 6 && n.every((x) => Number.isInteger(x) && x >= 1 && x <= 55);
  }
  function insertLock(uid, body, headers) {
    if (body.user_id !== uid) throw new Error("not_owner");
    if (!Array.isArray(body.tickets) || body.tickets.length !== 20) throw new Error("invalid_ticket_count");
    if (!body.tickets.every(validTicket)) throw new Error("invalid_ticket");
    if (!(Number(body.cutoff_draw_id) < Number(body.target_draw_id))) throw new Error('new row for relation "one_portfolio_locks" violates check constraint "one_lock_cutoff_before_target"');
    const k = key(uid, body.target_draw_id);
    if (s.locks.has(k)) throw new Error('duplicate key value violates unique constraint "one_portfolio_locks_pkey"');
    const row = {
      user_id: uid, target_draw_id: Number(body.target_draw_id), cutoff_draw_id: Number(body.cutoff_draw_id),
      selection_hash: body.selection_hash, model: body.model || null, tickets: clone(body.tickets),
      client_generated_at: body.client_generated_at || null, client_locked_at: body.client_locked_at || null,
      // Set by the database, whatever the client sent:
      locked_at: iso(), tickets_sha256: crypto.createHash("sha256").update(JSON.stringify(body.tickets)).digest("hex"),
    };
    s.locks.set(k, row);
    return headers && headers.Prefer === "return=representation" ? [clone(row)] : null;
  }
  function project(rows, params) {
    let out = rows.slice();
    const order = params.get("order");
    if (order) { const [col, dir] = order.split("."); out.sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === "desc" ? -1 : 1)); }
    const limit = Number(params.get("limit"));
    if (limit) out = out.slice(0, limit);
    const cols = (params.get("select") || "*").split(",");
    return clone(out.map((r) => (cols[0] === "*" ? r : Object.fromEntries(cols.map((c) => [c, r[c]])))));
  }
  function filter(rows, uid, params) {
    let out = rows.filter((r) => r.user_id === uid); // row level security: own rows only
    const t = params.get("target_draw_id");
    if (t && t.startsWith("eq.")) out = out.filter((r) => String(r.target_draw_id) === t.slice(3));
    const u = params.get("user_id");
    if (u && u.startsWith("eq.")) out = out.filter((r) => r.user_id === decodeURIComponent(u.slice(3)));
    return out;
  }
  function unlock(uid, body) {
    const target = Number(body && body.p_target_draw_id);
    const k = key(uid, target), row = s.locks.get(k);
    if (!row) return false;
    if (s.clock - Date.parse(row.locked_at) > cfg.windowMs) throw new Error("unlock_window_expired");
    if (s.log.filter((l) => l.user_id === uid && l.target_draw_id === target).length >= cfg.maxUnlocks) throw new Error("unlock_limit_reached");
    s.locks.delete(k);
    s.log.push({ user_id: uid, target_draw_id: target, selection_hash: row.selection_hash, tickets_sha256: row.tickets_sha256, locked_at: row.locked_at, unlocked_at: iso() });
    return true;
  }

  async function handle(uid, path, opts) {
    const { method = "GET", body = null, headers = {} } = opts || {};
    s.calls.push({ uid, method, path, body: clone(body), headers: clone(headers) });
    const u = new URL("http://x" + path), p = u.pathname, tag = method + " " + p;
    const fi = s.failures.findIndex((f) => f.match.test(tag));
    const failure = fi >= 0 ? s.failures.splice(fi, 1)[0] : null;
    if (failure && failure.when === "before") throw new Error(failure.message);
    let result, error = null;
    try {
      if (method === "POST" && p === "/rest/v1/one_portfolio_locks") result = insertLock(uid, body, headers);
      else if (method === "GET" && p === "/rest/v1/one_portfolio_locks") result = project(filter([...s.locks.values()], uid, u.searchParams), u.searchParams);
      else if (method === "GET" && p === "/rest/v1/one_portfolio_unlock_log") result = project(filter(s.log, uid, u.searchParams), u.searchParams);
      else if (method === "POST" && p === "/rest/v1/rpc/powerai_unlock_one_portfolio") result = unlock(uid, body);
      else throw new Error("Could not find the table '" + p + "' in the schema cache");
    } catch (e) { error = e; }
    const gi = s.gates.findIndex((g) => g.match.test(tag));
    if (gi >= 0) { const g = s.gates[gi]; g.hits++; await g.promise; }
    if (failure && failure.when === "after") throw new Error(failure.message);
    if (error) throw error;
    return result === undefined ? null : result;
  }

  s.requestFor = (uid) => (path, opts) => handle(uid, path, opts);
  s.advance = (ms) => { s.clock += ms; };
  s.failNext = (match, message, when) => { s.failures.push({ match, message, when: when || "before" }); };
  // Holds matching responses until release(). The request still executes on arrival, so the response is "in flight".
  s.gate = (match) => { let release; const g = { match, hits: 0, promise: new Promise((r) => { release = r; }) }; g.release = () => { s.gates.splice(s.gates.indexOf(g), 1); release(); }; s.gates.push(g); return g; };
  s.callsTo = (re) => s.calls.filter((c) => re.test(c.method + " " + c.path));
  s.lockRow = (uid, target) => s.locks.get(key(uid, target)) || null;
  return s;
}

function createDevice(o) {
  o = Object.assign({ uid: UID_A, loggedIn: true, answerConfirm: true, storage: {}, server: null, hash: "TESTHASH" }, o || {});
  const els = {}, storage = Object.assign({}, o.storage), toasts = [], confirms = [], listeners = {}, docListeners = {};
  const state = { answerConfirm: o.answerConfirm, hash: o.hash, user: o.loggedIn ? { id: o.uid, email: "t@test" } : null };
  const anchor = { insertAdjacentElement(_pos, node) { if (node && node.id) els[node.id] = node; } };
  els.onePanel = Object.assign(element(), { querySelector: (sel) => (sel === ".one-audit-panel" ? anchor : null) });
  const getById = (id) => { if (id === "oneWorkspace") return els.oneWorkspace || null; if (!els[id]) els[id] = element(); return els[id]; };
  const localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
  };
  const runtime = { registerProvider() {}, buildPortfolio: async (req) => ({ portfolio: {
    targetDrawId: req.targetDrawId, cutoffDrawId: req.targetDrawId - 1, selectionHash: state.hash,
    tickets: Array.from({ length: 20 }, (_, i) => ({ main: [1, 2, 3, 4, 5, i + 6] })),
    ranked: Array.from({ length: 20 }, () => ({ sources: ["A7", "B1.3"] })), audit: { coverage: 25, repeatedPairs: 0, maxOverlap: 4 } } }) };
  const request = o.server ? o.server.requestFor(o.uid) : () => Promise.reject(new Error("no server"));
  const ctx = {
    console, setTimeout, setInterval, clearInterval, localStorage,
    addEventListener(name, fn) { (listeners[name] = listeners[name] || []).push(fn); },
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    confirm: (msg) => { confirms.push(String(msg)); return state.answerConfirm; },
    showToast: (m, t) => toasts.push({ m, t }),
    document: { readyState: "complete", visibilityState: "visible", getElementById: getById, createElement: () => element(), addEventListener(n, f) { docListeners[n] = f; } },
    draws: [{ id: 1, date: "2026-01-01", result: [1, 2, 3, 4, 5, 6, 7] }], latest: { id: 1 }, targetId: 2,
    historyReadyForTarget: () => true,
    PowerAIAuth: { getUser: () => state.user, request },
    PowerAIDomain: {}, PowerAIUnifiedSelector: {}, PowerAIOnePipeline: {}, PowerAIOneAdaptiveGovernor: {}, PowerAIOneAfterDrawEvaluation: {},
    PowerAIOneAdaptiveShadowRunner: {}, PowerAIOneChallengerGate: {}, PowerAIOneRuntime: { create: () => runtime },
    PowerAIOneA: {}, PowerAIOneB: {}, PowerAIOneAProvider: { register() {} }, PowerAIOneBProvider: { register() {} },
  };
  ctx.window = ctx;
  vm.runInNewContext(SOURCE, ctx);

  const d = { ctx, els, toasts, confirms, state, storage };
  d.status = () => els.oneStatus.textContent;
  d.statusIsError = () => /\bbad\b/.test(els.oneStatus.className);
  d.store = () => JSON.parse(storage.powerai_rc6_one_portfolios || "{}");
  d.portfolio = (target) => (d.store().portfolios || {})[String(target)] || null;
  d.ready = async () => { for (let i = 0; i < 100; i++) { if (/ONE sẵn sàng/.test(d.status())) { await wait(30); return; } await wait(30); } throw new Error("bridge never became ready: " + d.status()); };
  // Click like a user: a disabled button does nothing unless force is set (used to simulate a stale screen).
  d.click = async (id, opts) => { const b = els[id]; if (!b || !b.listeners.click) throw new Error("no click handler on " + id); if (b.disabled && !(opts && opts.force)) return "disabled"; return b.listeners.click(); };
  d.build = async () => { await d.click("oneBuildBtn"); };
  d.emit = async (name) => { for (const fn of listeners[name] || []) fn({ detail: {} }); await wait(40); };
  d.becomeVisible = async () => { if (docListeners.visibilitychange) docListeners.visibilitychange(); await wait(40); };
  d.addResult = (id) => { ctx.draws.push({ id, date: "2026-11-24", result: [1, 2, 3, 4, 5, 6, 7] }); ctx.latest = { id }; };
  d.settle = (ms) => wait(ms || 60);
  return d;
}

module.exports = { createFakeServer, createDevice, wait, UID_A, UID_B };
