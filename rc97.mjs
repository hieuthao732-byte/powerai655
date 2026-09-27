import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const appPath=join('dist','app.js');
const htmlPath=join('dist','index.html');
const cssPath=join('dist','style.css');
let app=readFileSync(appPath,'utf8');
let html=readFileSync(htmlPath,'utf8');
let css=readFileSync(cssPath,'utf8');

html=html.replaceAll('RC9.6','RC9.7').replaceAll('v=9.6','v=9.7');

const runtime=String.raw`
/* =========================
   RC9.7 — PERFORMANCE CENTER A/B/C/L
   Uses official feed logs only. Manual/replay are excluded.
   ========================= */
let rc97PerfTrack='overview';
function rc97Logs(){
  try{return (typeof allLogs==='function'?allLogs():[]).filter(x=>x&&x.source==='feed').sort((a,b)=>Number(a.targetId)-Number(b.targetId))}catch(e){return[]}
}
function rc97Stat(key,logs){
  const rows=logs.map(l=>({id:Number(l.targetId),s:l?.[key]})).filter(x=>x.s&&Number.isFinite(Number(x.s.best)));
  const n=rows.length,sum=f=>rows.reduce((a,x)=>a+(Number(f(x.s))||0),0);
  const prizes={jp1:sum(s=>s.jp1),jp2:sum(s=>s.jp2),first:sum(s=>s.first),second:sum(s=>s.second),third:sum(s=>s.third)};
  return{key,n,rows,avgBest:n?sum(s=>s.best)/n:0,avgTotal:n?sum(s=>s.total)/n:0,ge3:rows.filter(x=>Number(x.s.best)>=3).length,ge4:rows.filter(x=>Number(x.s.best)>=4).length,ge5:rows.filter(x=>Number(x.s.best)>=5).length,maxBest:n?Math.max(...rows.map(x=>Number(x.s.best)||0)):0,prizes};
}
function rc97Pct(a,n){return n?(a/n*100).toFixed(1)+'%':'—'}
function rc97PrizeChips(p){
  const defs=[['jp1','JP1'],['jp2','JP2'],['first','Nhất'],['second','Nhì'],['third','Ba']];
  const a=defs.filter(([k])=>Number(p[k])>0).map(([k,l])=>'<span class="rc97Prize '+k+'"><b>'+p[k]+'</b> '+l+'</span>');
  return a.length?a.join(''):'<span class="rc97None">Chưa ghi nhận giải</span>';
}
function rc97TrackName(k){return({A:'A • Toán + kiểm chứng',B:'B • Lịch sử',C:'C • Kết hợp',L:'L • Learning'})[k]||k}
function rc97Overview(logs){
  const stats=['A','B','C','L'].map(k=>rc97Stat(k,logs));
  const cards=stats.map(s=>'<article class="rc97TrackCard track'+s.key+'"><div class="rc97TrackHead"><b>'+s.key+'</b><span>'+rc97TrackName(s.key).split('•')[1].trim()+'</span><em>'+s.n+' kỳ</em></div><div class="rc97Kpis"><div><span>Best-hit TB</span><b>'+s.avgBest.toFixed(2)+'</b></div><div><span>Best ≥3</span><b>'+rc97Pct(s.ge3,s.n)+'</b></div><div><span>Best ≥4</span><b>'+rc97Pct(s.ge4,s.n)+'</b></div><div><span>Best ≥5</span><b>'+rc97Pct(s.ge5,s.n)+'</b></div></div><div class="rc97PrizeRow">'+rc97PrizeChips(s.prizes)+'</div></article>').join('');
  const recent=logs.slice(-12).reverse();
  const table=recent.length?'<div class="rc97Recent"><div class="rc97RecentHead"><b>12 kỳ official gần nhất đã lưu</b><span>Best hit của từng track</span></div><div class="rc97Table"><div class="rc97TR head"><span>Kỳ</span><b>A</b><b>B</b><b>C</b><b>L</b></div>'+recent.map(l=>'<div class="rc97TR"><span>'+drawLabel(l.targetId)+'</span>'+['A','B','C','L'].map(k=>'<b class="t'+k+'">'+(l[k]?String(l[k].best)+'/6':'—')+'</b>').join('')+'</div>').join('')+'</div></div>':'<div class="notice">Chưa có log kết quả chính thức đã khóa để tổng hợp.</div>';
  return '<div class="rc97SummaryNote">Chỉ dùng log <b>feed chính thức</b> đã lưu. Kết quả nhập tay và replay không được tính vào Performance Center.</div><div class="rc97TrackGrid">'+cards+'</div>'+table;
}
function rc97TrackDetail(key,logs){
  const s=rc97Stat(key,logs),recent=s.rows.slice(-20).reverse();
  const desc={A:'A được tạo bằng mô phỏng/toán học; Historical Validation bên dưới dùng lịch sử để kiểm chứng, không đổi hạng A.',B:'B dùng dữ liệu lịch sử trước kỳ mục tiêu. Bảng này chỉ tổng hợp kết quả official của các bộ B đã khóa.',C:'C kết hợp tín hiệu lịch sử với khung cấu trúc. Bảng này tổng hợp các kỳ C đã khóa và có feed chính thức.',L:'L chỉ xuất hiện ở những kỳ Learning đã được tạo và khóa. Kỳ không có L hợp lệ sẽ không được tính.'}[key];
  const prizeTotal=Object.values(s.prizes).reduce((a,b)=>a+(Number(b)||0),0);
  const rows=recent.length?recent.map(x=>'<div class="rc97TrackRow"><span>'+drawLabel(x.id)+'</span><b>Best '+x.s.best+'/6</b><small>Tổng hit '+(x.s.total??0)+'</small><small>≥3: '+(x.s.g3??0)+' vé</small><div>'+rc97PrizeChips(x.s)+'</div></div>').join(''):'<div class="notice">Chưa có log official cho track '+key+'.</div>';
  return '<div class="rc97TrackIntro"><div><span>'+key+' • PERFORMANCE</span><h3>'+rc97TrackName(key)+'</h3><p>'+desc+'</p></div><em>'+s.n+' KỲ OFFICIAL</em></div><div class="rc97MetricGrid"><div><span>Best-hit trung bình</span><b>'+s.avgBest.toFixed(3)+'</b></div><div><span>Best cao nhất đã ghi nhận</span><b>'+s.maxBest+'/6</b></div><div><span>Kỳ Best ≥3</span><b>'+s.ge3+' <small>('+rc97Pct(s.ge3,s.n)+')</small></b></div><div><span>Kỳ Best ≥4</span><b>'+s.ge4+' <small>('+rc97Pct(s.ge4,s.n)+')</small></b></div><div><span>Kỳ Best ≥5</span><b>'+s.ge5+' <small>('+rc97Pct(s.ge5,s.n)+')</small></b></div><div><span>Lượt vé có giải</span><b>'+prizeTotal+'</b></div></div><div class="rc97PrizeBox"><b>Phân bố giải đã ghi nhận</b><div>'+rc97PrizeChips(s.prizes)+'</div></div><div class="rc97TrackRows"><div class="rc97RecentHead"><b>Tối đa 20 kỳ gần nhất</b><span>official feed • đã lưu</span></div>'+rows+'</div>';
}
function rc97SetTab(tab){
  if(!['overview','A','B','C','L'].includes(tab))tab='overview';rc97PerfTrack=tab;
  document.querySelectorAll('.rc97PerfTab').forEach(b=>{const on=b.dataset.perfTab===tab;b.classList.toggle('active',on);b.setAttribute('aria-selected',on?'true':'false')});
  document.querySelectorAll('.rc97PerfPane').forEach(p=>p.hidden=p.dataset.perfPane!==tab);
  const logs=rc97Logs();
  const ov=document.querySelector('[data-perf-pane="overview"] .rc97Dynamic');if(ov&&tab==='overview')ov.innerHTML=rc97Overview(logs);
  if(tab!=='overview'){
    const d=document.querySelector('[data-perf-pane="'+tab+'"] .rc97Dynamic');if(d)d.innerHTML=rc97TrackDetail(tab,logs);
    if(tab==='A'&&typeof renderAHistoricalValidation==='function')queueMicrotask(renderAHistoricalValidation);
  }
  try{localStorage.setItem('powerai_rc97_perf_tab',tab)}catch(e){}
}
function rc97BuildPerformance(){
  const perf=document.querySelector('[data-main-pane="performance"]');if(!perf||perf.querySelector('.rc97PerformanceCenter'))return;
  const oldPanel=perf.querySelector('.rc93PerformancePanel');
  const aHistory=document.getElementById('aHistoryValidation');
  const insights=document.getElementById('insightsPanel');
  const center=document.createElement('section');center.className='rc97PerformanceCenter';
  center.innerHTML='<div class="rc97PerfHead"><div><span>PERFORMANCE CENTER</span><h2>📈 Hiệu suất A / B / C / L</h2><p>Tách riêng từng track và một trang Tổng quan để nhìn cùng một hệ chỉ số. Không dùng bảng này để biến kết quả quá khứ thành xác suất kỳ tiếp theo.</p></div></div><nav class="rc97PerfTabs" aria-label="Chọn track hiệu suất"><button class="rc97PerfTab active" data-perf-tab="overview">Tổng quan</button><button class="rc97PerfTab" data-perf-tab="A">A</button><button class="rc97PerfTab" data-perf-tab="B">B</button><button class="rc97PerfTab" data-perf-tab="C">C</button><button class="rc97PerfTab" data-perf-tab="L">L</button></nav><div class="rc97PerfPane" data-perf-pane="overview"><div class="rc97Dynamic"></div><div class="rc97LegacyInsights"></div></div><div class="rc97PerfPane" data-perf-pane="A" hidden><div class="rc97Dynamic"></div><div class="rc97AValidation"></div></div><div class="rc97PerfPane" data-perf-pane="B" hidden><div class="rc97Dynamic"></div></div><div class="rc97PerfPane" data-perf-pane="C" hidden><div class="rc97Dynamic"></div></div><div class="rc97PerfPane" data-perf-pane="L" hidden><div class="rc97Dynamic"></div></div>';
  if(oldPanel)oldPanel.parentNode.insertBefore(center,oldPanel);else perf.appendChild(center);
  if(insights)center.querySelector('.rc97LegacyInsights').appendChild(insights);
  if(aHistory)center.querySelector('.rc97AValidation').appendChild(aHistory);
  if(oldPanel&&oldPanel.children.length===0)oldPanel.remove();
  center.querySelectorAll('[data-perf-tab]').forEach(b=>b.addEventListener('click',()=>rc97SetTab(b.dataset.perfTab)));
  let saved='overview';try{saved=localStorage.getItem('powerai_rc97_perf_tab')||'overview'}catch(e){}rc97SetTab(saved);
}
rc97BuildPerformance();
try{const base=rc93ActivateMain;rc93ActivateMain=function(view,opts={}){const r=base(view,opts);if(view==='performance'){rc97BuildPerformance();queueMicrotask(()=>rc97SetTab(rc97PerfTrack))}return r}}catch(e){}
try{const baseSet=setTarget;setTarget=async function(id){const r=await baseSet(id);if(document.querySelector('.rc97PerformanceCenter'))queueMicrotask(()=>rc97SetTab(rc97PerfTrack));return r}}catch(e){}
window.addEventListener('load',()=>{rc97BuildPerformance();rc97SetTab(rc97PerfTrack)},{once:true});
`;
if(!app.includes('RC9.7 — PERFORMANCE CENTER A/B/C/L'))app+='\n'+runtime+'\n';

css+=`
/* RC9.7 — PERFORMANCE CENTER */
.rc97PerformanceCenter{margin:0 0 14px}.rc97PerfHead{padding:15px 16px;border:1px solid rgba(105,227,233,.18);border-radius:15px 15px 0 0;background:linear-gradient(180deg,rgba(11,36,52,.88),rgba(7,24,38,.78))}.rc97PerfHead>div>span{font-size:9px;font-weight:900;letter-spacing:.13em;color:var(--cyan)}.rc97PerfHead h2{margin:4px 0 5px;font-size:19px}.rc97PerfHead p{margin:0;color:var(--muted);font-size:10px;line-height:1.55}
.rc97PerfTabs{display:grid;grid-template-columns:1.35fr repeat(4,1fr);gap:6px;padding:8px;border:1px solid rgba(105,227,233,.16);border-top:0;background:rgba(5,18,29,.82)}.rc97PerfTab{min-height:42px;border-color:rgba(105,190,230,.20)!important;background:rgba(10,30,47,.74)!important}.rc97PerfTab.active{border-color:rgba(105,227,233,.68)!important;background:rgba(25,71,91,.92)!important;box-shadow:0 0 0 2px rgba(105,227,233,.08)!important;color:#dffcff}
.rc97PerfPane{padding:14px;border:1px solid rgba(105,227,233,.14);border-top:0;border-radius:0 0 15px 15px;background:rgba(5,17,28,.50)}.rc97PerfPane[hidden]{display:none!important}.rc97SummaryNote{padding:9px 11px;margin-bottom:10px;border:1px solid var(--line);border-radius:10px;color:var(--muted);font-size:9px;background:rgba(7,24,38,.65)}
.rc97TrackGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.rc97TrackCard{border:1px solid var(--line);border-radius:13px;padding:11px;background:rgba(7,24,38,.78)}.rc97TrackCard.trackA{border-top-color:rgba(100,181,255,.58)}.rc97TrackCard.trackB{border-top-color:rgba(255,201,107,.58)}.rc97TrackCard.trackC{border-top-color:rgba(169,138,255,.60)}.rc97TrackCard.trackL{border-top-color:rgba(113,227,173,.58)}.rc97TrackHead{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:7px}.rc97TrackHead>b{width:28px;height:28px;display:grid;place-items:center;border-radius:8px;background:rgba(255,255,255,.05)}.rc97TrackHead span{font-size:10px;font-weight:800}.rc97TrackHead em{font-style:normal;font-size:8px;color:var(--muted2)}
.rc97Kpis{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0}.rc97Kpis>div,.rc97MetricGrid>div{padding:8px;border:1px solid var(--line);border-radius:9px;background:rgba(3,14,23,.42)}.rc97Kpis span,.rc97MetricGrid span{display:block;font-size:8px;color:var(--muted2)}.rc97Kpis b{display:block;margin-top:3px;font-size:13px}.rc97PrizeRow,.rc97PrizeBox>div{display:flex;gap:5px;flex-wrap:wrap}.rc97Prize{font-size:8px;padding:4px 6px;border:1px solid var(--line);border-radius:7px;color:#cfe0ec}.rc97Prize.jp1{color:#ffe2a6;border-color:rgba(255,201,107,.42)}.rc97Prize.jp2{color:#ddceff;border-color:rgba(169,138,255,.42)}.rc97Prize.first{color:#a8f0cf;border-color:rgba(113,227,173,.35)}.rc97Prize.second{color:#b3f3f5;border-color:rgba(105,227,233,.34)}.rc97Prize.third{color:#b9ddff;border-color:rgba(100,181,255,.34)}.rc97None{font-size:8px;color:var(--muted2)}
.rc97Recent{margin-top:12px}.rc97RecentHead{display:flex;justify-content:space-between;align-items:center;margin:0 0 7px}.rc97RecentHead b{font-size:10px}.rc97RecentHead span{font-size:8px;color:var(--muted2)}.rc97Table{border:1px solid var(--line);border-radius:11px;overflow:hidden}.rc97TR{display:grid;grid-template-columns:1.3fr repeat(4,1fr);gap:1px;border-top:1px solid var(--line)}.rc97TR:first-child{border-top:0}.rc97TR>*{padding:7px 9px;font-size:9px}.rc97TR>span{color:var(--muted)}.rc97TR>b{text-align:center}.rc97TR.head{background:rgba(15,42,63,.74)}.rc97TR .tA{color:#b9ddff}.rc97TR .tB{color:#ffe0a0}.rc97TR .tC{color:#dacfff}.rc97TR .tL{color:#a8f0cf}
.rc97TrackIntro{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:10px}.rc97TrackIntro span{font-size:8px;font-weight:900;letter-spacing:.11em;color:#86caf8}.rc97TrackIntro h3{margin:3px 0 4px;font-size:16px}.rc97TrackIntro p{margin:0;color:var(--muted);font-size:9px;line-height:1.5;max-width:850px}.rc97TrackIntro em{font-style:normal;font-size:8px;font-weight:900;padding:6px 8px;border:1px solid var(--line);border-radius:999px;color:var(--muted)}.rc97MetricGrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px}.rc97MetricGrid b{display:block;margin-top:4px;font-size:15px}.rc97MetricGrid small{font-size:8px;color:var(--muted2)}.rc97PrizeBox{margin:10px 0;padding:10px;border:1px solid var(--line);border-radius:11px;background:rgba(6,20,32,.62)}.rc97PrizeBox>b{display:block;font-size:9px;margin-bottom:7px}.rc97TrackRows{margin-top:10px}.rc97TrackRow{display:grid;grid-template-columns:1fr .8fr .9fr .9fr 2fr;align-items:center;gap:8px;padding:8px 9px;border-top:1px solid var(--line);font-size:9px}.rc97TrackRow>span{color:var(--muted)}.rc97TrackRow>small{color:var(--muted2)}.rc97AValidation{margin-top:12px}.rc97LegacyInsights{margin-top:12px}
@media(max-width:1100px){.rc97TrackGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.rc97MetricGrid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:700px){.rc97PerfTabs{grid-template-columns:repeat(5,1fr)}.rc97PerfTab{padding:8px 5px;font-size:9px}.rc97TrackGrid{grid-template-columns:1fr}.rc97MetricGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.rc97TrackRow{grid-template-columns:1fr 1fr}.rc97TrackRow>div{grid-column:1/-1}.rc97TR{grid-template-columns:1.2fr repeat(4,.8fr)}.rc97TR>*{padding:6px 4px;font-size:8px}}
`;
writeFileSync(appPath,app);writeFileSync(htmlPath,html);writeFileSync(cssPath,css);
console.log('RC9.7 applied — A/B/C/L Performance Center enabled');
