import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const appPath = join('dist', 'app.js');
const htmlPath = join('dist', 'index.html');
const cssPath = join('dist', 'style.css');

let app = readFileSync(appPath, 'utf8');
let html = readFileSync(htmlPath, 'utf8');
let css = readFileSync(cssPath, 'utf8');

function mustReplace(src, from, to, label) {
  if (!src.includes(from)) throw new Error(`RC9.2 patch failed: ${label}`);
  return src.replace(from, to);
}

const tabAnchor = '<button class="tab tabL" data-tab="learningTab"><b>L</b><span>Learning</span><small id="tabSubL">Học quá khứ → tạo vé cho kỳ đang chọn</small></button>\n</nav>';
html = mustReplace(
  html,
  tabAnchor,
  '<button class="tab tabL" data-tab="learningTab"><b>L</b><span>Learning</span><small id="tabSubL">Học quá khứ → tạo vé cho kỳ đang chọn</small></button>\n  <button class="tab tabN" data-tab="numberIntelTab"><b>N</b><span>Số 01–55</span><small>Hồ sơ lịch sử từng số</small></button>\n</nav>',
  'Number Intelligence tab'
);

const numberPane = `
<div id="numberIntelTab" class="tabPane">
<section class="panel numberIntelPanel">
  <div class="head numberIntelHead">
    <div>
      <div class="sectionKicker numberIntelKicker">N • NUMBER INTELLIGENCE</div>
      <h2>🔎 Hồ sơ số 01–55</h2>
      <p>Chọn một số để xem tần suất, gap, xu hướng gần đây, cặp đồng xuất hiện và mức xuất hiện của số đó trong A/B/C/L của kỳ đang chọn.</p>
    </div>
    <div class="numberIntelLegend" aria-label="Chú thích trạng thái">
      <span class="hot">Nóng gần đây</span><span class="cold">Lạnh gần đây</span><span class="overdue">Gap cao</span><span class="neutral">Trung tính</span>
    </div>
  </div>
  <div class="numberIntelNotice">Các nhãn Nóng / Lạnh / Gap cao chỉ mô tả dữ liệu đã xảy ra trước kỳ mục tiêu, không phải dự báo hay xác suất trúng kỳ tiếp theo.</div>
  <div id="numberIntelGrid" class="numberIntelGrid" aria-label="Chọn số từ 01 đến 55"></div>
  <div id="numberIntelDetail" class="numberIntelDetail"><div class="muted">Đang chuẩn bị hồ sơ số...</div></div>
</section>
</div>

`;
html = mustReplace(
  html,
  '<div id="geometryTab" class="tabPane active">',
  `${numberPane}<div id="geometryTab" class="tabPane active">`,
  'Number Intelligence pane'
);

html = html.replaceAll('RC9.1', 'RC9.2').replaceAll('v=9.1', 'v=9.2');
html = html.replace(
  '<span class="versionPill">INTERACTIVE UI • RC9.2</span>',
  '<span class="versionPill">NUMBER INTELLIGENCE • RC9.2</span>'
);

const runtimePatch = String.raw`
/* =========================
   RC9.2 — NUMBER INTELLIGENCE 01–55
   All statistics use draws strictly before targetId.
   Descriptive only; no probability claim.
   ========================= */
let rc92SelectedNumber=1;
const rc92Cache=new Map();
function rc92History(){
  return (draws||[])
    .filter(d=>Number(d?.id)<Number(targetId)&&nums(d).length===6)
    .sort((a,b)=>Number(b.id)-Number(a.id));
}
function rc92WindowCount(n,hist,limit){
  const ds=hist.slice(0,Math.min(limit,hist.length));
  let count=0;for(const d of ds)if(nums(d).includes(n))count++;
  return{n:ds.length,count,rate:ds.length?count/ds.length:0};
}
function rc92GapStats(n,hist){
  const pos=[];for(let i=0;i<hist.length;i++)if(nums(hist[i]).includes(n))pos.push(i);
  const current=pos.length?pos[0]:hist.length;
  let avg=0;
  if(pos.length>=2){let total=0;for(let i=1;i<pos.length;i++)total+=pos[i]-pos[i-1];avg=total/(pos.length-1)}
  else avg=hist.length?55/6:0;
  return{current,avg,ratio:avg>0?current/avg:0,lastPos:pos[0]??null,appearances:pos.length};
}
function rc92Status(n,hist){
  const w30=rc92WindowCount(n,hist,30),gap=rc92GapStats(n,hist);
  const p=6/55,expected=w30.n*p,sd=Math.sqrt(Math.max(.0001,w30.n*p*(1-p)));
  const z=sd?(w30.count-expected)/sd:0;
  if(gap.avg>0&&gap.current>=Math.max(12,gap.avg*1.65))return{key:'overdue',label:'GAP CAO',z};
  if(z>=1.05)return{key:'hot',label:'NÓNG GẦN ĐÂY',z};
  if(z<=-1.05)return{key:'cold',label:'LẠNH GẦN ĐÂY',z};
  return{key:'neutral',label:'TRUNG TÍNH',z};
}
function rc92Pairs(n,hist,limit=250){
  const ds=hist.slice(0,Math.min(limit,hist.length)),cnt=Array(56).fill(0);let selectedDraws=0;
  for(const d of ds){const a=nums(d);if(!a.includes(n))continue;selectedDraws++;for(const x of a)if(x!==n)cnt[x]++}
  return [...Array(55)].map((_,i)=>i+1).filter(x=>x!==n).map(x=>({n:x,count:cnt[x],pct:selectedDraws?cnt[x]/selectedDraws*100:0})).sort((a,b)=>b.count-a.count||a.n-b.n).slice(0,8);
}
function rc92PortfolioTickets(raw){
  if(!Array.isArray(raw))return[];
  return raw.map(t=>Array.isArray(t)?t:(Array.isArray(t?.a)?t.a:null)).filter(t=>Array.isArray(t)&&t.length===6);
}
function rc92Exposure(n){
  const A=rc92PortfolioTickets(geo?.tickets||[]),B=rc92PortfolioTickets(legacy||[]),C=rc92PortfolioTickets(hybrid||[]),L=rc92PortfolioTickets(learningPortfolio||[]);
  const one=(T)=>({count:T.filter(t=>t.includes(n)).length,total:T.length});
  return{A:one(A),B:one(B),C:one(C),L:one(L)};
}
function rc92NumData(n){
  const hist=rc92History(),key=String(targetId)+'|'+String((draws||[]).length)+'|'+String(n)+'|'+String(geo?.tickets?.length||0)+'|'+String(legacy?.length||0)+'|'+String(hybrid?.length||0)+'|'+String(learningPortfolio?.length||0);
  if(rc92Cache.has(key))return rc92Cache.get(key);
  const windows={};for(const w of [30,60,120,250])windows[w]=rc92WindowCount(n,hist,w);
  const gap=rc92GapStats(n,hist),status=rc92Status(n,hist),pairs=rc92Pairs(n,hist,250),exposure=rc92Exposure(n);
  const recent=hist.slice(0,30).map(d=>({id:Number(d.id),hit:nums(d).includes(n)}));
  const appearances=hist.filter(d=>nums(d).includes(n)).slice(0,8).map(d=>Number(d.id));
  const out={n,histN:hist.length,windows,gap,status,pairs,exposure,recent,appearances};rc92Cache.set(key,out);return out;
}
function rc92Pad(n){return String(n).padStart(2,'0')}
function rc92RenderGrid(){
  const grid=$("numberIntelGrid");if(!grid)return;
  const hist=rc92History();
  if(!hist.length){grid.innerHTML='<div class="muted">Chưa có lịch sử trước kỳ đang chọn.</div>';return}
  grid.innerHTML=[...Array(55)].map((_,i)=>i+1).map(n=>{
    const s=rc92Status(n,hist),w30=rc92WindowCount(n,hist,30),active=n===rc92SelectedNumber?' active':'';
    return '<button type="button" class="numberIntelBall '+s.key+active+'" data-num="'+n+'" aria-pressed="'+(n===rc92SelectedNumber?'true':'false')+'" aria-label="Xem hồ sơ số '+rc92Pad(n)+'"><b>'+rc92Pad(n)+'</b><span>'+w30.count+'/30</span></button>';
  }).join('');
  grid.querySelectorAll('[data-num]').forEach(btn=>btn.addEventListener('click',()=>{rc92SelectedNumber=Number(btn.dataset.num);rc92RenderGrid();rc92RenderDetail()}));
}
function rc92TrendText(d){
  const a=d.windows[30],b=d.windows[120];if(!a.n||!b.n)return'Chưa đủ dữ liệu';
  const delta=(a.rate-b.rate)*100;
  if(delta>=4)return'Tần suất 30 kỳ đang cao hơn nền 120 kỳ';
  if(delta<=-4)return'Tần suất 30 kỳ đang thấp hơn nền 120 kỳ';
  return'Tần suất gần đây khá gần nền 120 kỳ';
}
function rc92RenderDetail(){
  const box=$("numberIntelDetail");if(!box)return;
  const d=rc92NumData(rc92SelectedNumber),n=d.n;
  if(!d.histN){box.innerHTML='<div class="muted">Chưa có dữ liệu lịch sử.</div>';return}
  const wCards=[30,60,120,250].map(w=>{const x=d.windows[w],expected=x.n*6/55;return '<div class="numberWindowCard"><span>'+w+' kỳ</span><b>'+x.count+' lần</b><small>'+((x.rate||0)*100).toFixed(1)+'% số kỳ • kỳ vọng ngẫu nhiên '+expected.toFixed(1)+'</small></div>'}).join('');
  const pairHtml=d.pairs.map(p=>'<button type="button" class="numberPairChip" data-pair="'+p.n+'"><b>'+rc92Pad(p.n)+'</b><span>'+p.count+' lần • '+p.pct.toFixed(1)+'%</span></button>').join('')||'<span class="muted">Chưa đủ dữ liệu cặp.</span>';
  const expOne=(key,x)=>'<div class="numberExposure '+key+'"><b>'+key+'</b><span>'+(x.total?x.count+'/'+x.total:'—')+'</span><small>vé có số '+rc92Pad(n)+'</small></div>';
  const timeline=d.recent.map(x=>'<i class="'+(x.hit?'hit':'')+'" title="'+drawLabel(x.id)+(x.hit?' • có '+rc92Pad(n):'')+'"></i>').join('');
  const last=d.appearances.length?d.appearances.map(id=>'<span>'+drawLabel(id)+'</span>').join(''):'<span>Chưa ghi nhận</span>';
  box.innerHTML='<section class="numberProfile '+d.status.key+'"><div class="numberProfileHero"><div class="numberProfileBall">'+rc92Pad(n)+'</div><div><span>HỒ SƠ SỐ</span><h3>'+d.status.label+'</h3><p>'+rc92TrendText(d)+'</p></div><div class="numberGapHero"><span>Gap hiện tại</span><b>'+d.gap.current+' kỳ</b><small>Gap TB '+d.gap.avg.toFixed(1)+' • '+(d.gap.ratio||0).toFixed(2)+'× trung bình</small></div></div><div class="numberWindowGrid">'+wCards+'</div><div class="numberIntelTwoCol"><article><div class="numberSubHead"><b>Cặp đồng xuất hiện</b><span>Top 8 trong tối đa 250 kỳ</span></div><div class="numberPairGrid">'+pairHtml+'</div></article><article><div class="numberSubHead"><b>Exposure kỳ đang chọn</b><span>Số lần xuất hiện trong portfolio</span></div><div class="numberExposureGrid">'+expOne('A',d.exposure.A)+expOne('B',d.exposure.B)+expOne('C',d.exposure.C)+expOne('L',d.exposure.L)+'</div></article></div><div class="numberRecentBlock"><div class="numberSubHead"><b>30 kỳ gần nhất trước kỳ mục tiêu</b><span>Ô sáng = số '+rc92Pad(n)+' xuất hiện</span></div><div class="numberTimeline">'+timeline+'</div><div class="numberLastDraws"><small>Các lần gần nhất:</small>'+last+'</div></div><div class="numberIntelFoot">Dữ liệu chỉ lấy từ các kỳ có ID nhỏ hơn '+drawLabel(targetId)+'. Không dùng kết quả của kỳ mục tiêu để mô tả số.</div></section>';
  box.querySelectorAll('[data-pair]').forEach(btn=>btn.addEventListener('click',()=>{rc92SelectedNumber=Number(btn.dataset.pair);rc92RenderGrid();rc92RenderDetail();box.scrollIntoView({behavior:'smooth',block:'start'})}));
}
function renderNumberIntelligence(){
  try{rc92RenderGrid();rc92RenderDetail()}catch(e){console.error('RC9.2 Number Intelligence render failed',e)}
}
const rc92SetTargetBase=setTarget;
setTarget=async function(id){const r=await rc92SetTargetBase(id);renderNumberIntelligence();return r};
const rc92NumberTab=document.querySelector('[data-tab="numberIntelTab"]');
if(rc92NumberTab)rc92NumberTab.addEventListener('click',()=>queueMicrotask(renderNumberIntelligence));
window.addEventListener('load',renderNumberIntelligence,{once:true});
`;

if (!app.includes('RC9.2 — NUMBER INTELLIGENCE 01–55')) app += `\n${runtimePatch}\n`;

css += `
/* RC9.2 — NUMBER INTELLIGENCE */
.trackTabs{grid-template-columns:repeat(5,minmax(0,1fr))!important}
.tabN.active b{color:#baf4ed;border-color:rgba(105,227,233,.42);background:rgba(63,183,188,.14)}
.numberIntelPanel{border-color:rgba(105,227,233,.20)}
.numberIntelKicker{color:var(--cyan)}
.numberIntelHead{align-items:center}.numberIntelLegend{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.numberIntelLegend span{font-size:8px;font-weight:850;letter-spacing:.045em;padding:6px 8px;border-radius:999px;border:1px solid var(--line);background:rgba(7,22,35,.72)}.numberIntelLegend .hot{color:#9af1c3;border-color:rgba(113,227,173,.35)}.numberIntelLegend .cold{color:#a9d8ff;border-color:rgba(100,181,255,.35)}.numberIntelLegend .overdue{color:#ffd18a;border-color:rgba(255,201,107,.38)}.numberIntelLegend .neutral{color:var(--muted)}
.numberIntelNotice{margin:-2px 0 13px;padding:9px 11px;border-radius:10px;border:1px solid rgba(105,227,233,.14);background:rgba(13,47,55,.28);color:#91bdc1;font-size:9px;line-height:1.5}
.numberIntelGrid{display:grid;grid-template-columns:repeat(11,minmax(0,1fr));gap:7px;margin-bottom:15px}
.numberIntelBall{min-width:0!important;height:53px;padding:6px 4px!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border-radius:12px!important;background:linear-gradient(180deg,rgba(13,35,53,.96),rgba(8,25,39,.96))!important;border:1px solid var(--lineStrong)!important;box-shadow:none!important;transition:.16s ease!important}.numberIntelBall b{font-size:14px}.numberIntelBall span{font-size:8px;color:var(--muted2)}.numberIntelBall.hot{border-color:rgba(113,227,173,.28)!important}.numberIntelBall.cold{border-color:rgba(100,181,255,.24)!important}.numberIntelBall.overdue{border-color:rgba(255,201,107,.30)!important}.numberIntelBall.hot b{color:#9af1c3}.numberIntelBall.cold b{color:#aad8ff}.numberIntelBall.overdue b{color:#ffd18a}.numberIntelBall:hover{transform:translateY(-2px)!important;border-color:#87d4ff!important;box-shadow:0 8px 22px rgba(0,0,0,.22),0 0 16px rgba(87,188,238,.10)!important}.numberIntelBall.active{border-color:#79e7ea!important;background:linear-gradient(180deg,rgba(20,72,82,.98),rgba(11,43,54,.98))!important;box-shadow:0 0 0 2px rgba(105,227,233,.13),0 8px 24px rgba(0,0,0,.22)!important}.numberIntelBall.active b{color:#d4ffff}
.numberIntelDetail{scroll-margin-top:160px}.numberProfile{border:1px solid var(--line);border-radius:16px;padding:15px;background:linear-gradient(180deg,rgba(8,28,43,.84),rgba(5,20,32,.84))}.numberProfile.hot{border-top-color:rgba(113,227,173,.48)}.numberProfile.cold{border-top-color:rgba(100,181,255,.48)}.numberProfile.overdue{border-top-color:rgba(255,201,107,.52)}
.numberProfileHero{display:grid;grid-template-columns:64px 1fr auto;gap:13px;align-items:center;margin-bottom:12px}.numberProfileBall{width:62px;height:62px;border-radius:50%;display:grid;place-items:center;font-size:22px;font-weight:950;color:#062534;background:linear-gradient(180deg,#c9f8fa,#72dfe4);border:2px solid rgba(255,255,255,.65);box-shadow:0 7px 18px rgba(0,0,0,.20)}.numberProfileHero>div:nth-child(2)>span{font-size:8px;color:var(--muted2);font-weight:850;letter-spacing:.12em}.numberProfileHero h3{margin:3px 0 4px;font-size:16px}.numberProfileHero p{margin:0;color:var(--muted);font-size:10px}.numberGapHero{text-align:right;border-left:1px solid var(--line);padding-left:18px}.numberGapHero span{display:block;font-size:8px;color:var(--muted2);text-transform:uppercase;letter-spacing:.08em}.numberGapHero b{display:block;font-size:20px;margin:3px 0}.numberGapHero small{color:var(--muted);font-size:9px}
.numberWindowGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px}.numberWindowCard{border:1px solid var(--line);border-radius:12px;padding:10px;background:rgba(5,18,29,.68)}.numberWindowCard>span{display:block;font-size:8px;color:var(--muted2);text-transform:uppercase}.numberWindowCard>b{display:block;font-size:16px;margin:4px 0}.numberWindowCard small{color:var(--muted);font-size:8px;line-height:1.4}
.numberIntelTwoCol{display:grid;grid-template-columns:1.25fr .75fr;gap:9px;margin-bottom:9px}.numberIntelTwoCol>article,.numberRecentBlock{border:1px solid var(--line);border-radius:13px;padding:11px;background:rgba(5,18,29,.58)}.numberSubHead{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px}.numberSubHead b{font-size:10px}.numberSubHead span{font-size:8px;color:var(--muted2)}
.numberPairGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.numberPairChip{min-width:0!important;padding:7px!important;border-radius:9px!important;display:flex;flex-direction:column;gap:2px;align-items:flex-start;background:rgba(14,39,58,.74)!important}.numberPairChip b{font-size:12px;color:#cceaff}.numberPairChip span{font-size:7px;color:var(--muted)}
.numberExposureGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.numberExposure{border:1px solid var(--line);border-radius:9px;padding:8px;text-align:center;background:rgba(11,32,48,.65)}.numberExposure>b{display:block;width:22px;height:22px;border-radius:7px;margin:0 auto 5px;display:grid;place-items:center;background:rgba(255,255,255,.05);font-size:9px}.numberExposure>span{display:block;font-size:13px;font-weight:900}.numberExposure small{font-size:7px;color:var(--muted2)}.numberExposure.A b{color:#badeff}.numberExposure.B b{color:#ffe0a0}.numberExposure.C b{color:#d8c9ff}.numberExposure.L b{color:#a8f0cf}
.numberTimeline{display:grid;grid-template-columns:repeat(30,1fr);gap:3px}.numberTimeline i{height:17px;border-radius:4px;background:rgba(117,156,185,.12);border:1px solid rgba(117,156,185,.10)}.numberTimeline i.hit{background:linear-gradient(180deg,#8de9bc,#55c991);border-color:#a2eec9;box-shadow:0 0 9px rgba(78,201,141,.14)}.numberLastDraws{display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-top:8px}.numberLastDraws small{font-size:8px;color:var(--muted2);margin-right:2px}.numberLastDraws span{font-size:8px;padding:4px 6px;border-radius:7px;border:1px solid var(--line);color:#b8cede;background:rgba(13,35,52,.55)}.numberIntelFoot{margin-top:9px;padding-top:8px;border-top:1px solid var(--line);font-size:8px;color:var(--muted2)}
@media(max-width:1100px){.trackTabs{grid-template-columns:repeat(3,minmax(0,1fr))!important}.numberIntelGrid{grid-template-columns:repeat(8,minmax(0,1fr))}.numberIntelTwoCol{grid-template-columns:1fr}.numberPairGrid{grid-template-columns:repeat(4,1fr)}}
@media(max-width:700px){.trackTabs{grid-template-columns:repeat(2,minmax(0,1fr))!important}.numberIntelHead{display:block}.numberIntelLegend{justify-content:flex-start;margin-top:10px}.numberIntelGrid{grid-template-columns:repeat(5,minmax(0,1fr))}.numberProfileHero{grid-template-columns:54px 1fr}.numberProfileBall{width:52px;height:52px;font-size:18px}.numberGapHero{grid-column:1/-1;border-left:0;border-top:1px solid var(--line);padding:9px 0 0;text-align:left}.numberWindowGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.numberPairGrid{grid-template-columns:repeat(2,1fr)}.numberExposureGrid{grid-template-columns:repeat(2,1fr)}.numberTimeline{grid-template-columns:repeat(15,1fr)}}
`;

writeFileSync(appPath, app);
writeFileSync(htmlPath, html);
writeFileSync(cssPath, css);
console.log('RC9.2 applied — Number Intelligence 01–55 enabled');
