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
assert.match(await page.locator('#dModelHash').innerText(),/mã mô hình [A-F0-9]{8}/i,'D model hash missing');
assert.match(await page.locator('#dContext').innerText(),/Dữ liệu gần nhất/i,'D cutoff context missing');
assert.equal(await page.locator('#dCopyBtn').isDisabled(),false,'D copy should be enabled after build');

// D v1.2 compact UI: tickets come first while research panels remain collapsed by default.
await page.waitForFunction(()=>window.PowerAIAdaptiveEvidence&&document.querySelector('#dAdvancedToggle')&&document.querySelector('#dEvidencePanel'),null,{timeout:30000});
assert.equal(await page.locator('#adaptiveDTab').evaluate(el=>el.classList.contains('dCompactV12')),true,'D v1.2 compact class missing');
assert.equal(await page.locator('#adaptiveDTab').evaluate(el=>el.classList.contains('dShowAdvanced')),false,'Detailed analysis should be collapsed by default');
assert.match(await page.locator('#dAdvancedToggle').innerText(),/Xem phân tích chi tiết/i,'Compact analysis toggle missing');
assert.equal(await page.locator('#dEvidenceSample').innerText(),'0/12','Clean browser evidence ledger must start at 0/12');
const order=await page.evaluate(()=>{
  const pane=document.querySelector('#adaptiveDTab'),hero=pane?.querySelector('.dHero'),tickets=pane?.querySelector('.dTicketsPanel');
  return !!(hero&&tickets&&hero.nextElementSibling===tickets);
});
assert.equal(order,true,'20 D tickets should be placed immediately after the compact hero');

// D v1.3 adds a multi-window evidence view and an experiment registry without changing D decisions.
await page.waitForFunction(()=>window.PowerAIAdaptiveConfidence&&document.querySelector('#dConfidenceMini')&&document.querySelector('#dConfidencePanel')&&document.querySelector('#dExperimentPanel'),null,{timeout:30000});
const v13=await page.evaluate(()=>({
  mini:document.querySelector('#dConfidenceMini')?.textContent||'',
  sample:document.querySelector('#dConfSample')?.textContent||'',
  current:document.querySelector('#dRegistryCurrent')?.textContent||'',
  count:Number(document.querySelector('#dRegistryCount')?.textContent||0)
}));
assert.match(v13.mini,/D v1\.3/i,'D v1.3 mini status missing');
assert.match(v13.mini,/ĐANG TÍCH LŨY/i,'Clean browser confidence should start in accumulation');
assert.equal(v13.sample,'0/24','Clean browser confidence window must start at 0/24');
assert.match(v13.current,/^D-/,'Experiment registry must expose current D engine');
assert.ok(v13.count>=1,'Experiment registry should include the current engine');

await page.locator('#dAdvancedToggle').click();
assert.equal(await page.locator('#adaptiveDTab').evaluate(el=>el.classList.contains('dShowAdvanced')),true,'Detailed analysis toggle should expand research panels');
assert.match(await page.locator('#dConfidencePanel').innerText(),/Mức bằng chứng hiện tại/i,'D v1.3 confidence panel missing after expand');
assert.match(await page.locator('#dExperimentPanel').innerText(),/Phiên bản đã dùng và đã thử/i,'D v1.3 experiment registry missing after expand');
await page.locator('#dAdvancedToggle').click();
assert.equal(await page.locator('#adaptiveDTab').evaluate(el=>el.classList.contains('dShowAdvanced')),false,'Detailed analysis toggle should collapse research panels again');

// D14 reproducibility guard: a prospective lock must rebuild to the same model + portfolio hash.
await page.locator('#dLockBtn').click();
await page.waitForFunction(()=>/ĐÃ XÁC MINH/.test(document.querySelector('#dIntegrity')?.textContent||''),null,{timeout:90000});
const integrity=await page.evaluate(()=>{
  const id=Number((document.querySelector('#targetId')?.textContent||'').replace(/\D/g,''));
  const x=JSON.parse(localStorage.getItem('powerai_rc6_d_lock_'+id)||'null');
  return x?.integrity||null;
});
assert.equal(integrity?.ok,true,'D lock integrity must be verified');
assert.ok(Object.values(integrity?.checks||{}).every(Boolean),'Every D integrity check must pass');

// Phase 3 adaptive cycle is loaded and visible, but starts in warmup on a clean browser.
await page.waitForFunction(()=>window.PowerAIAdaptiveCycle&&document.querySelector('#dCyclePanel'),null,{timeout:30000});
await page.waitForFunction(()=>/ĐANG TÍCH LŨY DỮ LIỆU|CHƯA THẤY LỢI THẾ|ĐANG CAO HƠN MỐC NGẪU NHIÊN/.test(document.querySelector('#dCycleBaseline')?.textContent||''),null,{timeout:30000});
assert.match(await page.locator('#dCycleChampion').innerText(),/^D-/,'Adaptive cycle champion missing');
assert.match(await page.locator('#dCycleBaseline').innerText(),/ĐANG TÍCH LŨY DỮ LIỆU|CHƯA THẤY LỢI THẾ|ĐANG CAO HƠN MỐC NGẪU NHIÊN/,'Adaptive baseline state missing');
assert.equal(await page.locator('#dCycleChallengeCount').innerText(),'0','Clean browser must not invent a challenger');
assert.match(await page.locator('#dCycleProgress').innerText(),/Không có phiên bản mới đang thử/i,'Adaptive shadow warmup note missing');

// D v1.1 rolling scorecard must start clean and only count official prospective logs.
await page.waitForFunction(()=>document.querySelector('#dRollSample')&&document.querySelector('#dRollStatus'),null,{timeout:30000});
await page.waitForFunction(()=>/ĐANG TÍCH LŨY DỮ LIỆU/.test(document.querySelector('#dRollStatus')?.textContent||''),null,{timeout:30000});
assert.equal(await page.locator('#dRollSample').innerText(),'0/12','Clean browser rolling sample must start at 0/12');
assert.equal(await page.locator('#dRollStatus').innerText(),'ĐANG TÍCH LŨY DỮ LIỆU','Clean browser rolling state must be warmup');
assert.equal((await page.locator('#dRollHigh').innerText()).trim(),'0 / 0','Clean browser high-hit counter must start at zero');
assert.match(await page.locator('#dRollAction').innerText(),/12 kỳ theo dõi/i,'Rolling warmup action missing');

// Phase 4 retrospective validation lab is visible but isolated from official D state.
await page.waitForFunction(()=>window.PowerAIAdaptiveValidation&&document.querySelector('#dValidationPanel'),null,{timeout:30000});
await page.waitForFunction(()=>/Kiểm tra lại trên nhiều kỳ/i.test(document.querySelector('#dValidationPanel')?.innerText||''),null,{timeout:30000});
assert.match(await page.locator('#dValidationPanel').innerText(),/Kiểm tra lại trên nhiều kỳ/i,'D validation lab missing');
assert.match(await page.locator('#dValidationPanel').innerText(),/tách riêng khỏi kết quả chính thức/i,'D validation isolation note missing');
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
assert.match(await page.locator('[data-perf-pane="D"]').innerText(),/D • KẾT QUẢ/i);

assert.equal(pageErrors.length,0,'Browser page errors: '+pageErrors.join(' | '));
await browser.close();
console.log('Track D browser smoke passed.');
