import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';

async function waitVisible(page, selector, timeout = 90000) {
  await page.locator(selector).waitFor({ state: 'visible', timeout });
}

async function runViewport(browser, name, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(String(err?.stack || err)));

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitVisible(page, '.rc94ResultDock');
  await waitVisible(page, '.rc93MainNav');

  // Guest mode is intentionally read-only: auth.js marks <main> inert and
  // aria-disabled. Verify that security/UX guard first. Then lift only those
  // two DOM flags inside this isolated test page so we can traverse the
  // already-rendered UI without fabricating a Supabase session or changing
  // production auth behavior.
  const guestGuard = await page.evaluate(() => ({
    guest: document.body.classList.contains('guestMode'),
    inert: !!document.querySelector('main')?.inert,
    ariaDisabled: document.querySelector('main')?.getAttribute('aria-disabled'),
    guestBarVisible: (() => {
      const el = document.getElementById('guestReadOnlyBar');
      return !!el && !el.hidden;
    })()
  }));
  assert.equal(guestGuard.guest, true, `${name}: expected unsigned browser to start in guest mode`);
  assert.equal(guestGuard.inert, true, `${name}: guest mode must keep <main> read-only`);
  assert.equal(guestGuard.ariaDisabled, 'true', `${name}: guest mode should expose aria-disabled=true`);
  assert.equal(guestGuard.guestBarVisible, true, `${name}: guest read-only notice should be visible`);

  await page.evaluate(() => {
    const main = document.querySelector('main');
    if (main) {
      main.inert = false;
      main.setAttribute('aria-disabled', 'false');
    }
  });

  // Draw selector mirrors Mega UX while preserving Power setTarget/replay semantics.
  const targetSelect = page.locator('#targetSelect');
  assert.equal(await targetSelect.count(), 1, `${name}: Power target selector missing`);
  await page.waitForFunction(() => {
    const s=document.getElementById('targetSelect');
    return !!s && !s.disabled && s.options.length >= 2;
  }, null, { timeout: 90000 });
  const targetOptions = await targetSelect.locator('option').evaluateAll(opts => opts.map(o => ({value:o.value,text:o.textContent||''})));
  const initialTarget = Number((await page.locator('#targetId').innerText()).replace(/\D/g,''));
  assert.ok(targetOptions.some(o => Number(o.value) < initialTarget), `${name}: selector has no historical draw option`);
  assert.ok(targetOptions.some(o => /kỳ tiếp theo/i.test(o.text)), `${name}: selector missing next-draw option`);
  assert.equal(Number(await targetSelect.inputValue()), initialTarget, `${name}: selector is not synced to active target`);
  // Actual target switching/replay and anti-leak behavior are covered in state-regression.mjs;
  // this browser smoke keeps the new selector check structural to avoid rebuilding B/C twice per viewport.

  // Result is deliberately outside the main navigation after RC9.4.
  assert.equal(await page.locator('.rc94ResultDock').count(), 1, `${name}: Result Dock missing`);
  assert.equal(await page.locator('.rc93MainNav [data-main-view]').count(), 3, `${name}: main nav should have 3 sections`);
  assert.equal(await page.locator('[data-main-view="result"]').count(), 0, `${name}: result must not be a main tab`);

  // Chọn vé: A/B/C/L are secondary tabs and each pane can be opened.
  await page.locator('[data-main-view="choose"]').click();
  await waitVisible(page, '[data-main-pane="choose"]');
  for (const pane of ['geometryTab', 'legacyTab', 'hybridTab', 'learningTab']) {
    const tab = page.locator(`.trackTabs [data-tab="${pane}"]`);
    assert.equal(await tab.count(), 1, `${name}: missing ticket tab ${pane}`);
    await tab.click();
    await waitVisible(page, `#${pane}`);
  }

  // Phân tích: Number Intelligence must render 55 selectable numbers from pre-target history.
  await page.locator('[data-main-view="analysis"]').click();
  await waitVisible(page, '[data-main-pane="analysis"]');
  await waitVisible(page, '#numberIntelTab');
  await page.waitForFunction(() => document.querySelectorAll('#numberIntelGrid [data-num]').length === 55, null, { timeout: 90000 });
  const antiLeak = await page.evaluate(() => {
    const h = rc92History();
    return {
      target: Number(targetId),
      count: h.length,
      bad: h.filter(d => Number(d.id) >= Number(targetId)).map(d => Number(d.id)).slice(0, 5)
    };
  });
  assert.ok(antiLeak.count > 0, `${name}: Number Intelligence history is empty`);
  assert.deepEqual(antiLeak.bad, [], `${name}: Number Intelligence leaked target/future draw data`);

  // Hiệu suất: overview + A/B/C/L all exist. Performance logs must be official-feed only.
  await page.locator('[data-main-view="performance"]').click();
  await waitVisible(page, '[data-main-pane="performance"]');
  await waitVisible(page, '.rc97PerformanceCenter');
  for (const perf of ['overview', 'A', 'B', 'C', 'L']) {
    const tab = page.locator(`.rc97PerfTab[data-perf-tab="${perf}"]`);
    assert.equal(await tab.count(), 1, `${name}: missing performance tab ${perf}`);
    await tab.click();
    await waitVisible(page, `.rc97PerfPane[data-perf-pane="${perf}"]`);
  }
  const perfSources = await page.evaluate(() => rc97Logs().map(x => x?.source));
  assert.ok(perfSources.every(x => x === 'feed'), `${name}: Performance Center included non-feed logs`);
  assert.equal(await page.locator('.rc97HighPrizeBoard').count(), 1, `${name}: high-prize multi-draw summary missing`);
  const highPrizeCheck = await page.evaluate(() => {
    const score=(best,{jp1=0,jp2=0,first=0,second=0,third=0}={})=>({best,total:best,jp1,jp2,first,second,third,g3:0,g4:second,g5:first+jp2+jp1});
    const logs=[
      {source:'feed',targetId:1,A:score(4,{second:1}),B:score(3,{third:1}),C:score(5,{first:1}),L:score(4,{second:1})},
      {source:'feed',targetId:2,A:score(5,{jp2:1}),B:score(3,{third:1}),C:score(3,{third:1}),L:score(2)},
      {source:'feed',targetId:3,A:score(3,{third:1}),B:score(2),C:score(3,{third:1})}
    ];
    const r=rc97HighPrizeStats(logs);
    return {counts:Object.fromEntries(r.stats.map(s=>[s.key,s.highDraws])),leaders:r.leaders,max:r.max};
  });
  assert.deepEqual(highPrizeCheck,{counts:{A:2,B:0,C:1,L:1},leaders:['A'],max:2},`${name}: high-prize draw counting regression`);

  // Prize classification regression tests, independent of any live draw.
  const prizeCheck = await page.evaluate(() => {
    const actual = [1,2,3,4,5,6], special = 49;
    const jp1 = scorePrizeTicket([1,2,3,4,5,6], actual, special);
    const jp2 = scorePrizeTicket([1,2,3,4,5,49], actual, special);
    const first = scorePrizeTicket([1,2,3,4,5,50], actual, special);
    const second = scorePrizeTicket([1,2,3,4,50,51], actual, special);
    const third = scorePrizeTicket([1,2,3,50,51,52], actual, special);
    const rendered = ballsPrize([1,49,50,51,52,53], actual, special);
    return {
      jp1: jp1.jp1,
      jp2: jp2.jp2 && jp2.specialHit && jp2.mainHits === 5,
      first: first.first,
      second: second.second,
      third: third.third,
      green: rendered.includes('ball hit'),
      gold: rendered.includes('specialHit') && rendered.includes('49')
    };
  });
  assert.deepEqual(prizeCheck, {
    jp1: true,
    jp2: true,
    first: true,
    second: true,
    third: true,
    green: true,
    gold: true
  }, `${name}: prize/special-ball regression`);

  // Basic mobile/desktop layout guard: core navigation must not escape the viewport.
  const navRect = await page.locator('.rc93MainNav').boundingBox();
  assert.ok(navRect && navRect.x >= -1 && navRect.x + navRect.width <= viewport.width + 2, `${name}: main nav overflows viewport`);

  if (pageErrors.length) {
    throw new Error(`${name}: uncaught page errors:\n${pageErrors.join('\n---\n')}`);
  }

  await context.close();
  console.log(`PASS ${name} ${viewport.width}x${viewport.height}`);
}

const browser = await chromium.launch({ headless: true });
try {
  await runViewport(browser, 'desktop', { width: 1440, height: 1000 });
  await runViewport(browser, 'mobile', { width: 390, height: 844 });
} finally {
  await browser.close();
}
