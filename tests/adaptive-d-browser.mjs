import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1365,height:900}});
const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));

await page.goto(base,{waitUntil:'domcontentloaded',timeout:90000});
await page.waitForFunction(()=>document.querySelector('#targetId')?.textContent?.match(/\d/),null,{timeout:90000});
await page.waitForFunction(()=>document.querySelector('[data-tab="adaptiveDTab"]')&&document.querySelector('#adaptiveDTab'),null,{timeout:90000});
await page.evaluate(()=>{document.body.classList.remove('guestMode');const m=document.querySelector('main');if(m){m.inert=false;m.removeAttribute('aria-disabled')}});
await page.locator('[data-tab="adaptiveDTab"]').click();
await page.waitForFunction(()=>document.querySelectorAll('#dTickets .dTicket').length===20,null,{timeout:90000});
assert.equal(await page.locator('#dWeights .dExpert').count(),4,'D should render four experts');
assert.match(await page.locator('#dModelHash').innerText(),/model [A-F0-9]{8}/,'D model hash missing');
assert.match(await page.locator('#dContext').innerText(),/Cutoff/i,'D cutoff context missing');
assert.equal(await page.locator('#dCopyBtn').isDisabled(),false,'D copy should be enabled after build');

// Phase 3 adaptive cycle is loaded and visible, but starts in warmup on a clean browser.
await page.waitForFunction(()=>window.PowerAIAdaptiveCycle&&document.querySelector('#dCyclePanel'),null,{timeout:30000});
assert.match(await page.locator('#dCycleChampion').innerText(),/^D-/,'Adaptive cycle champion missing');
assert.match(await page.locator('#dCycleBaseline').innerText(),/WARMUP|NO EDGE DETECTED|ABOVE NULL WINDOW/,'Adaptive baseline state missing');
assert.equal(await page.locator('#dCycleChallengeCount').innerText(),'0','Clean browser must not invent a challenger');
assert.match(await page.locator('#dCycleProgress').innerText(),/Không có shadow test/i,'Adaptive shadow warmup note missing');

// Phase 4 retrospective validation lab is visible but isolated from official D state.
await page.waitForFunction(()=>window.PowerAIAdaptiveValidation&&document.querySelector('#dValidationPanel'),null,{timeout:30000});
assert.match(await page.locator('#dValidationPanel').innerText(),/Walk-forward/i,'D validation lab missing');
assert.match(await page.locator('#dValidationPanel').innerText(),/Không ghi vào official log/i,'D validation isolation note missing');
assert.equal(await page.locator('#dValidationRunBtn').count(),1,'D validation run button missing');

// A draw that is already in the official feed must stay replay-only.
const targetSelect=page.locator('#targetSelect');
await page.waitForFunction(()=>document.querySelector('#targetSelect')?.options?.length>1,null,{timeout:90000});
const initial=Number((await page.locator('#targetId').innerText()).replace(/\D/g,''));
const latestOfficial=Number((await page.locator('#latestId').innerText()).replace(/\D/g,''));
const hist=await targetSelect.locator('option').evaluateAll((opts,latestOfficial)=>opts.map(o=>Number(o.value)).filter(v=>Number.isFinite(v)&&v<=latestOfficial).sort((a,b)=>b-a)[0],latestOfficial);
if(Number.isFinite(hist)){
  await targetSelect.selectOption(String(hist));
  await page.waitForFunction(v=>Number((document.querySelector('#targetId')?.textContent||'').replace(/\D/g,''))===v,hist,{timeout:90000});
  await page.waitForFunction(()=>document.querySelectorAll('#dTickets .dTicket').length===20,null,{timeout:90000});
  await page.waitForFunction(()=>document.querySelector('#dLockBtn')?.disabled===true,null,{timeout:30000});
  assert.equal(await page.locator('#dLockBtn').isDisabled(),true,'Official replay target must not allow D lock');
  await targetSelect.selectOption(String(initial));
}

// Performance Center exposes D as a separate track.
await page.evaluate(()=>{if(typeof rc93ActivateMain==='function')rc93ActivateMain('performance')});
await page.waitForFunction(()=>document.querySelector('[data-perf-tab="D"]'),null,{timeout:30000});
await page.locator('[data-perf-tab="D"]').click();
await page.waitForFunction(()=>!document.querySelector('[data-perf-pane="D"]')?.hidden,null,{timeout:30000});
assert.match(await page.locator('[data-perf-pane="D"]').innerText(),/D • PERFORMANCE/i);

assert.equal(pageErrors.length,0,'Browser page errors: '+pageErrors.join(' | '));
await browser.close();
console.log('Track D browser smoke passed.');
