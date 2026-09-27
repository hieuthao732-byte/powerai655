import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', err => pageErrors.push(String(err?.stack || err)));

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });

  // 1) Guest/auth shell: modal and login/signup switching must work without touching Supabase.
  await page.locator('#authOpenBtn').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#authOpenBtn').click();
  await page.locator('#authModal').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#authModeSignup').click();
  assert.equal(await page.locator('#authSignupPanel').isVisible(), true, 'signup panel did not open');
  await page.locator('#authModeLogin').click();
  assert.equal(await page.locator('#authLoginPanel').isVisible(), true, 'login panel did not reopen');
  await page.locator('#authCloseBtn').click();
  assert.equal(await page.locator('#authModal').isHidden(), true, 'auth modal did not close');

  // 2) Wait for the real app engine to finish the current prospective A/B/C portfolios.
  await page.waitForFunction(() => {
    return typeof latest !== 'undefined' && latest && Number(targetId) > 0 &&
      geo?.tickets?.length === 20 && legacy?.length === 20 && hybrid?.length === 20;
  }, null, { timeout: 180000 });

  const initial = await page.evaluate(() => ({
    target: Number(targetId),
    latest: Number(latest?.id || 0),
    known: knownTargetResult(targetId),
    historyReady: historyReadyForTarget(targetId),
    previous: previousNavigableTarget(),
    aHash: simpleHash(geo.tickets),
    bHash: simpleHash(legacy.map(x => x.a)),
    cHash: simpleHash(hybrid.map(x => x.a))
  }));
  assert.equal(initial.known, false, 'fresh context should open a prospective target');
  assert.equal(initial.historyReady, true, 'prospective target should have official predecessor history');
  assert.ok(initial.previous !== null, 'no historical draw available for replay test');

  // 3) Lock A/B/C, then synthesize a valid L portfolio from the already-built A tickets and lock it.
  // This checks storage/lock semantics without changing the production algorithms.
  const lockCheck = await page.evaluate(() => {
    const t = Number(targetId);
    localStorage.removeItem(lockKey(t));
    localStorage.removeItem(learningLockKey(t));
    lockBoth();
    const abc = getLock(t);
    if (!abc) return { ok: false, reason: 'ABC lock missing' };

    learningPortfolio = abc.A.tickets.map((a, i) => ({ a: [...a], score: 100 - i }));
    learningPortfolioMeta = { mode: 'ci-state-regression', syntheticForTest: true };
    lockLearningPortfolio();
    const ll = getLearningLock(t);

    return {
      ok: !!abc && !!ll,
      target: t,
      aCount: abc?.A?.tickets?.length || 0,
      bCount: abc?.B?.tickets?.length || 0,
      cCount: abc?.C?.tickets?.length || 0,
      lCount: ll?.tickets?.length || 0,
      aHash: abc?.A?.hash || null,
      bHash: abc?.B?.hash || null,
      cHash: abc?.C?.hash || null,
      lHash: ll?.hash || null
    };
  });
  assert.equal(lockCheck.ok, true, `lock failure: ${lockCheck.reason || 'unknown'}`);
  assert.deepEqual(
    [lockCheck.aCount, lockCheck.bCount, lockCheck.cCount, lockCheck.lCount],
    [20, 20, 20, 20],
    'A/B/C/L locks should each contain 20 tickets'
  );
  assert.equal(lockCheck.aHash, initial.aHash, 'A lock changed the already-built portfolio');
  assert.equal(lockCheck.bHash, initial.bHash, 'B lock changed the already-built portfolio');
  assert.equal(lockCheck.cHash, initial.cHash, 'C lock changed the already-built portfolio');
  assert.ok(lockCheck.lHash, 'L lock hash missing');

  // 4) Historical replay: go one official draw backward, verify replay semantics, then return.
  const previousTarget = Number(initial.previous);
  await page.evaluate(() => previousDraw());
  await page.waitForFunction(prev => Number(targetId) === Number(prev), previousTarget, { timeout: 180000 });
  const replay = await page.evaluate(() => ({
    target: Number(targetId),
    known: knownTargetResult(targetId),
    replay: isReplayTarget(targetId),
    actual: nums((draws || []).find(d => Number(d.id) === Number(targetId)))
  }));
  assert.equal(replay.target, previousTarget, 'previousDraw opened the wrong draw');
  assert.equal(replay.known, true, 'historical replay target should have an official result');
  assert.equal(replay.replay, true, 'historical target should be marked replay');
  assert.equal(replay.actual.length, 6, 'historical replay did not resolve six main numbers');

  await page.evaluate(() => nextDraw());
  await page.waitForFunction(cur => Number(targetId) === Number(cur), initial.target, { timeout: 180000 });
  const restored = await page.evaluate(t => {
    const abc = getLock(t), ll = getLearningLock(t);
    return {
      target: Number(targetId),
      aHash: abc?.A?.hash || null,
      bHash: abc?.B?.hash || null,
      cHash: abc?.C?.hash || null,
      lHash: ll?.hash || null
    };
  }, initial.target);
  assert.equal(restored.target, initial.target, 'nextDraw did not return to the prospective target');
  assert.equal(restored.aHash, lockCheck.aHash, 'A lock was lost after replay navigation');
  assert.equal(restored.bHash, lockCheck.bHash, 'B lock was lost after replay navigation');
  assert.equal(restored.cHash, lockCheck.cHash, 'C lock was lost after replay navigation');
  assert.equal(restored.lHash, lockCheck.lHash, 'L lock was lost after replay navigation');

  // 5) Cloud state bridge: mocked login hydrate -> save -> logout clear.
  // No real credentials or Supabase writes are used in CI.
  const cloud = await page.evaluate(async () => {
    const originalAuth = window.PowerAIAuth;
    const calls = [];
    const remoteState = { powerai_rc6_ci_remote: 'REMOTE_OK' };
    window.PowerAIAuth = {
      getUser: () => null,
      request: async (path, options = {}) => {
        calls.push({ path, options: JSON.parse(JSON.stringify(options || {})) });
        if (String(path).startsWith('/rest/v1/user_app_state?user_id=')) {
          return [{
            local_state: remoteState,
            active_draw_id: null,
            locked_draw_id: null,
            abc_locked: false,
            l_locked: false
          }];
        }
        if (String(path).startsWith('/rest/v1/user_app_state?on_conflict=')) return null;
        throw new Error('Unexpected mock cloud path: ' + path);
      }
    };

    cloudUser = null;
    await applyCloudUser({ id: 'ci-user', email: 'ci@example.test' }, { reload: false });
    const hydrated = localStorage.getItem('powerai_rc6_ci_remote');

    localStorage.setItem('powerai_rc6_ci_remote', 'LOCAL_CHANGED');
    await cloudSaveState();
    const saveCall = calls.find(x => String(x.path).startsWith('/rest/v1/user_app_state?on_conflict='));
    const savedValue = saveCall?.options?.body?.local_state?.powerai_rc6_ci_remote || null;

    await applyCloudUser(null, { reload: false });
    const remainingPowerAIKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('powerai_rc6_')) remainingPowerAIKeys.push(k);
    }

    window.PowerAIAuth = originalAuth;
    return {
      hydrated,
      savedValue,
      remainingPowerAIKeys,
      getCalls: calls.filter(x => String(x.path).includes('user_id=eq.')).length,
      saveCalls: calls.filter(x => String(x.path).includes('on_conflict=user_id')).length
    };
  });
  assert.equal(cloud.hydrated, 'REMOTE_OK', 'cloud login did not hydrate remote local_state');
  assert.equal(cloud.savedValue, 'LOCAL_CHANGED', 'cloud save did not persist current local_state into payload');
  assert.deepEqual(cloud.remainingPowerAIKeys, [], 'logout did not clear PowerAI per-user local state');
  assert.ok(cloud.getCalls >= 1, 'cloud hydrate request was not made');
  assert.ok(cloud.saveCalls >= 1, 'cloud save request was not made');

  if (pageErrors.length) {
    throw new Error(`uncaught page errors:\n${pageErrors.join('\n---\n')}`);
  }

  console.log('PASS deep state regression: auth shell, locks, replay, navigation, cloud hydrate/save/logout');
} finally {
  await context.close();
  await browser.close();
}
