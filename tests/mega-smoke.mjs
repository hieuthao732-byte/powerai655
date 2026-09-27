import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE_URL=process.env.BASE_URL||'http://127.0.0.1:4173';

async function run(viewport,name){
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e?.stack||e)));
  try{
    await page.goto(BASE_URL+'/mega.html',{waitUntil:'domcontentloaded',timeout:90000});
    await page.locator('#megaStatus').filter({hasText:'Feed OK'}).waitFor({state:'visible',timeout:90000});

    assert.equal(await page.locator('#megaATickets .ticket').count(),20,`${name}: Track A != 20 tickets`);
    assert.equal(await page.locator('#megaBTickets .ticket').count(),20,`${name}: Track B != 20 tickets`);
    assert.equal(await page.locator('#megaCTickets .ticket').count(),20,`${name}: Track C != 20 tickets`);
    assert.equal(await page.locator('#megaNumberGrid [data-num]').count(),45,`${name}: Number Intelligence != 45 numbers`);
    assert.equal(await page.locator('.specialHit').count(),0,`${name}: Mega must not render Power special ball`);

    const target=Number((await page.locator('#megaTargetId').innerText()).replace(/\D/g,''));
    const cutoff=Number((await page.locator('#megaCutoffId').innerText()).replace(/\D/g,''));
    assert.ok(cutoff<target,`${name}: history cutoff leaked target/future draw`);

    await page.locator('[data-view="analysis"]').click();
    await page.locator('[data-pane="analysis"]').waitFor({state:'visible'});
    await page.locator('#megaNumberGrid [data-num="1"]').click();
    assert.match(await page.locator('#megaNumberDetail').innerText(),/không phải xác suất/i,`${name}: number disclaimer missing`);

    await page.locator('[data-view="economics"]').click();
    await page.locator('[data-pane="economics"]').waitFor({state:'visible'});
    const econ=await page.locator('#megaEconomicsCards').innerText();
    assert.match(econ,/81[,.]45/i,`${name}: full-cover cost not rendered near 81.45b`);
    assert.match(econ,/234/,`${name}: exact 5-of-6 count missing`);
    assert.match(econ,/11\.115/,`${name}: exact 4-of-6 count missing`);

    // Replay the newest official draw. Engine must rebuild from pre-target history and show a six-number result.
    const sel=page.locator('#megaTargetSelect');
    const values=await sel.locator('option').evaluateAll(opts=>opts.map(o=>o.value));
    assert.ok(values.length>=2,`${name}: no replay option`);
    await sel.selectOption(values[1]);
    await page.waitForFunction(()=>document.querySelectorAll('#megaOfficialResult .ball').length===6,null,{timeout:90000});
    assert.equal(await page.locator('#megaOfficialResult .ball').count(),6,`${name}: replay result must have 6 numbers`);
    const replayTarget=Number((await page.locator('#megaTargetId').innerText()).replace(/\D/g,''));
    const replayCutoff=Number((await page.locator('#megaCutoffId').innerText()).replace(/\D/g,''));
    assert.ok(replayCutoff<replayTarget,`${name}: replay leaked target draw into history`);

    await page.locator('[data-view="tickets"]').click();
    for(const track of ['A','B','C']){
      await page.locator(`.megaTrackBtn[data-track="${track}"]`).click();
      await page.locator(`.megaTrackPane[data-track-pane="${track}"]`).waitFor({state:'visible'});
    }

    const nav=await page.locator('.megaNav').boundingBox();
    assert.ok(nav&&nav.x>=-1&&nav.x+nav.width<=viewport.width+2,`${name}: Mega nav overflows viewport`);
    if(errors.length)throw new Error(`${name}: uncaught page errors:\n${errors.join('\n---\n')}`);
    console.log(`PASS Mega ${name} ${viewport.width}x${viewport.height}`);
  } finally {await browser.close()}
}

await run({width:1440,height:1000},'desktop');
await run({width:390,height:844},'mobile');
