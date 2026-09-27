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

// Historical targets must stay replay-only and cannot be prospectively locked.
const targetSelect=page.locator('#targetSelect');
await page.waitForFunction(()=>document.querySelector('#targetSelect')?.options?.length>1,null,{timeout:90000});
const initial=Number((await page.locator('#targetId').innerText()).replace(/\D/g,''));
const hist=await targetSelect.locator('option').evaluateAll((opts,initial)=>opts.map(o=>Number(o.value)).filter(v=>v<initial).sort((a,b)=>b-a)[0],initial);
if(Number.isFinite(hist)){
  await targetSelect.selectOption(String(hist));
  await page.waitForFunction(v=>Number((document.querySelector('#targetId')?.textContent||'').replace(/\D/g,''))===v,hist,{timeout:90000});
  await page.waitForFunction(()=>document.querySelectorAll('#dTickets .dTicket').length===20,null,{timeout:90000});
  assert.equal(await page.locator('#dLockBtn').isDisabled(),true,'Replay target must not allow D lock');
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
