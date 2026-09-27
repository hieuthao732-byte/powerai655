import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const appPath = join('dist', 'app.js');
const htmlPath = join('dist', 'index.html');
const cssPath = join('dist', 'style.css');

let app = readFileSync(appPath, 'utf8');
let html = readFileSync(htmlPath, 'utf8');
let css = readFileSync(cssPath, 'utf8');

function mustReplace(src, from, to, label) {
  if (!src.includes(from)) throw new Error(`RC9.6 patch failed: ${label}`);
  return src.replace(from, to);
}

// Keep main-number hits green, but render the Power special number ("bóng vàng") in gold.
const oldPrizeBadge = `function prizeBadge(ticket,actual,special){
  if(!actual||!actual.length)return '';
  const p=prizeInfo(ticket,actual,special);
  return '<div class="ticketPrize '+p.key+'"><b>'+p.label+'</b><span>'+p.detail+'</span></div>';
}`;

const newPrizeBadge = `function ballsPrize(a,actual=[],special=null){
  const main=new Set(actual),sp=validSpecial(special);
  return a.map(n=>{
    const mainHit=main.has(n),specialHit=sp!==null&&n===sp;
    const cls=specialHit?'specialHit':(mainHit?'hit':'');
    const title=specialHit?' title="Số đặc biệt • bóng vàng"':'';
    return '<span class="ball '+cls+'"'+title+'>'+String(n).padStart(2,"0")+'</span>';
  }).join('');
}
function prizeBadge(ticket,actual,special){
  if(!actual||!actual.length)return '';
  const p=prizeInfo(ticket,actual,special),r=scorePrizeTicket(ticket,actual,special);
  let detail=p.detail;
  if(r.specialHit&&p.key==='jp2')detail='Hit 5/6 số chính + bóng vàng';
  else if(r.specialHit)detail+=' • Trúng bóng vàng';
  return '<div class="ticketPrize '+p.key+(r.specialHit?' hasSpecial':'')+'"><b>'+p.label+'</b><span>'+detail+'</span></div>';
}`;

app = mustReplace(app, oldPrizeBadge, newPrizeBadge, 'special-number renderer and prize detail');

const ticketBalls = 'balls(p.a,actual)';
const count = app.split(ticketBalls).length - 1;
if (count < 4) throw new Error(`RC9.6 expected at least 4 ticket ball renderers, found ${count}`);
app = app.split(ticketBalls).join('ballsPrize(p.a,actual,currentSpecialForTarget())');

const runtimePatch = String.raw`
/* =========================
   RC9.6 — SPECIAL NUMBER / BÓNG VÀNG HIGHLIGHT
   Green = hit 6 main numbers. Gold = hit special number.
   ========================= */
function rc96AddResultLegend(){
  const head=document.querySelector('.rc94ResultDockHead');
  if(!head||head.querySelector('.rc96HitLegend'))return;
  const legend=document.createElement('div');
  legend.className='rc96HitLegend';
  legend.innerHTML='<span><i class="main"></i>Số chính trùng</span><span><i class="special"></i>Số đặc biệt / bóng vàng</span>';
  const state=head.querySelector('.rc94ResultState');
  if(state)state.insertAdjacentElement('beforebegin',legend);else head.appendChild(legend);
}
rc96AddResultLegend();
window.addEventListener('load',rc96AddResultLegend,{once:true});
`;
if (!app.includes('RC9.6 — SPECIAL NUMBER / BÓNG VÀNG HIGHLIGHT')) app += '\n'+runtimePatch+'\n';

html = html.replaceAll('RC9.4', 'RC9.6').replaceAll('v=9.4', 'v=9.6');
html = html.replace(
  '<span class="versionPill">RESULT DOCK • RC9.6</span>',
  '<span class="versionPill">SPECIAL BALL • RC9.6</span>'
);

css += `
/* RC9.6 — MAIN HIT GREEN / SPECIAL HIT GOLD */
.ball.specialHit{
  color:#3f2a00!important;
  background:linear-gradient(180deg,#ffe79a,#ffc84f)!important;
  border-color:#ffe9a8!important;
  box-shadow:0 0 0 2px rgba(255,196,54,.30),0 0 18px rgba(255,190,42,.28),0 5px 12px rgba(120,76,0,.22)!important;
}
.ticketPrize.hasSpecial{border-color:rgba(255,201,107,.34)}
.ticketPrize.hasSpecial span{color:#f0cd82}
.jp2Special{color:#ffd46f!important;border-color:rgba(255,201,107,.50)!important;background:rgba(255,201,107,.09)!important}
.rc96HitLegend{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-left:auto}
.rc96HitLegend span{display:inline-flex;align-items:center;gap:6px;font-size:8px;font-weight:800;color:var(--muted);white-space:nowrap}
.rc96HitLegend i{width:12px;height:12px;border-radius:50%;display:inline-block;border:1px solid rgba(255,255,255,.55);box-shadow:0 2px 6px rgba(0,0,0,.18)}
.rc96HitLegend i.main{background:linear-gradient(180deg,#9af1c3,#64d99e);border-color:#aaf3cc}
.rc96HitLegend i.special{background:linear-gradient(180deg,#ffe79a,#ffc84f);border-color:#ffe9a8;box-shadow:0 0 0 1px rgba(255,196,54,.20),0 2px 6px rgba(0,0,0,.18)}
@media(max-width:760px){.rc96HitLegend{order:3;width:100%;margin-left:0}.rc94ResultDockHead{flex-wrap:wrap}}
`;

writeFileSync(appPath, app);
writeFileSync(htmlPath, html);
writeFileSync(cssPath, css);
console.log('RC9.6 applied — special number is highlighted gold and labeled as bóng vàng');
