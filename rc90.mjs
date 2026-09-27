import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const appPath = join('dist', 'app.js');
const htmlPath = join('dist', 'index.html');
const cssPath = join('dist', 'style.css');

let app = readFileSync(appPath, 'utf8');
let html = readFileSync(htmlPath, 'utf8');
let css = readFileSync(cssPath, 'utf8');

function mustReplace(src, from, to, label) {
  if (!src.includes(from)) throw new Error(`RC9.0 patch failed: ${label}`);
  return src.replace(from, to);
}

// Insert the historical-validation panel into Track A without changing A's portfolio-generation logic.
html = mustReplace(
  html,
  '  <div id="geoAudit" class="metrics"></div>\n  <div class="rankInfo">',
  `  <div id="geoAudit" class="metrics"></div>
  <section id="aHistoryValidation" class="aHistoryValidation">
    <div class="aHistHead">
      <div>
        <div class="sectionKicker trackAText">A • HISTORICAL VALIDATION</div>
        <h3>📚 Kiểm chứng dàn A trên dữ liệu lịch sử</h3>
        <p>Dàn A vẫn được tạo hoàn toàn bằng toán học và mô phỏng. Phần này chỉ lấy dàn A hiện tại đem đối chiếu với các kỳ đã xảy ra trước kỳ đang chọn để xem hành vi thực tế của cấu trúc.</p>
      </div>
      <span class="aHistBadge">KHÔNG ẢNH HƯỞNG HẠNG A</span>
    </div>
    <div id="aHistWindows" class="aHistWindows"><div class="muted">Đang tính kiểm chứng lịch sử...</div></div>
    <div id="aHistVsSim" class="aHistVsSim"></div>
    <div id="aHistPrizes" class="aHistPrizes"></div>
    <div class="aHistMethod"><b>Cách đọc:</b> đây là kiểm tra dàn A hiện tại trên lịch sử trước kỳ mục tiêu, không phải backtest walk-forward và không phải xác suất kỳ tiếp theo. Lịch sử không được dùng để sửa số, đổi hạng hay tối ưu A.</div>
  </section>
  <div class="rankInfo">`,
  'A historical validation panel'
);

// Make the A tab and description explain the split between generation and validation.
html = html.replace(
  '<button class="tab tabA active" data-tab="geometryTab"><b>A</b><span>Mô phỏng</span><small id="tabSubA">Tối ưu 20 vé cho kỳ đang chọn</small></button>',
  '<button class="tab tabA active" data-tab="geometryTab"><b>A</b><span>Toán + kiểm chứng</span><small id="tabSubA">Tạo bằng mô phỏng • kiểm chứng bằng lịch sử</small></button>'
);
html = html.replace(
  '<div class="sectionKicker trackAText">A • SIMULATION OPTIMIZER</div><h2>🧪 Bộ A — Tối ưu cấu trúc bằng mô phỏng</h2>',
  '<div class="sectionKicker trackAText">A • SIMULATION + HISTORICAL VALIDATION</div><h2>🧪 Bộ A — Toán học + kiểm chứng lịch sử</h2>'
);
html = html.replace(
  '<p>Không dùng lịch sử xổ số. A sinh nhiều dàn 20 vé hợp lệ, thử trên các kết quả ngẫu nhiên đồng nhất rồi chọn cấu trúc ổn định hơn cho Best ≥3 và Best-hit trung bình.</p>',
  '<p>A không dùng lịch sử để chọn số: hệ thống sinh nhiều dàn 20 vé hợp lệ, thử trên kết quả ngẫu nhiên đồng nhất rồi chọn cấu trúc theo mô phỏng. Sau khi dàn A đã được tạo xong, RC9.0 mới dùng lịch sử để kiểm chứng và giải thích hành vi của dàn đó.</p>'
);
html = html.replace(
  '<b>Điểm A — đóng góp mô phỏng:</b> xếp hạng vé theo mức đóng góp của từng vé vào kết quả tốt nhất của cả dàn trên mẫu kết quả ngẫu nhiên độc lập.\n    <span>Điểm này đo vai trò trong portfolio, không phải xác suất vé sẽ trúng ở kỳ tới.</span>',
  '<b>Điểm A — đóng góp mô phỏng:</b> hạng A vẫn chỉ dựa trên vai trò của từng vé trong portfolio mô phỏng.\n    <span>Các chỉ số lịch sử RC9.0 chỉ để kiểm chứng và giải thích, không làm thay đổi điểm hay thứ hạng A.</span>'
);
html = html.replaceAll('RC8.9.3', 'RC9.0').replaceAll('v=8.9.3', 'v=9.0');

const runtimePatch = String.raw`
/* =========================
   RC9.0 — TRACK A HISTORICAL VALIDATION
   A generation remains history-blind. Historical data is descriptive only.
   ========================= */
const rc90AHistCache=new Map();
function rc90HistoryBeforeTarget(){
  return (draws||[])
    .filter(d=>Number(d?.id)<Number(targetId)&&nums(d).length===6)
    .sort((a,b)=>Number(b.id)-Number(a.id));
}
function rc90EvalWindow(hist,limit){
  const ds=hist.slice(0,Math.min(limit,hist.length));
  if(!geo?.tickets?.length||!ds.length)return{n:0,avgBest:0,p3:0,p4:0,p5:0,jp1:0,jp2:0,first:0,second:0,third:0,prizeTickets:0};
  let bestSum=0,g3=0,g4=0,g5=0,jp1=0,jp2=0,first=0,second=0,third=0;
  for(const d of ds){
    const s=scoreTrack(geo.tickets,nums(d),specialNum(d));
    bestSum+=s.best||0;if((s.best||0)>=3)g3++;if((s.best||0)>=4)g4++;if((s.best||0)>=5)g5++;
    jp1+=Number(s.jp1)||0;jp2+=Number(s.jp2)||0;first+=Number(s.first)||0;second+=Number(s.second)||0;third+=Number(s.third)||0;
  }
  const n=ds.length;
  return{n,avgBest:bestSum/n,p3:g3/n*100,p4:g4/n*100,p5:g5/n*100,jp1,jp2,first,second,third,prizeTickets:jp1+jp2+first+second+third};
}
function rc90TicketStats(ticket,hist){
  const ds=hist.slice(0,Math.min(120,hist.length));
  if(!ds.length)return{n:0,avg:0,ge3:0,max:0,gap:0,pairs:0};
  let total=0,ge3=0,max=0,pairs=0;
  for(const d of ds){const h=hits(ticket,nums(d));total+=h;if(h>=3)ge3++;if(h>max)max=h;pairs+=h*(h-1)/2}
  let gapTotal=0;
  for(const n of ticket){
    const idx=ds.findIndex(d=>nums(d).includes(n));
    gapTotal+=idx<0?ds.length:idx;
  }
  return{n:ds.length,avg:total/ds.length,ge3,max,gap:gapTotal/ticket.length,pairs};
}
function rc90HistoricalData(){
  if(!geo?.tickets?.length)return null;
  const key=String(targetId)+'-'+simpleHash(geo.tickets)+'-'+String((draws||[]).length);
  if(rc90AHistCache.has(key))return rc90AHistCache.get(key);
  const hist=rc90HistoryBeforeTarget();
  const out={hist,windows:{}};
  for(const w of [30,60,120,250])out.windows[w]=rc90EvalWindow(hist,w);
  rc90AHistCache.set(key,out);return out;
}
function rc90FmtPct(v){return Number.isFinite(v)?v.toFixed(1)+'%':'—'}
function renderAHistoricalValidation(){
  const box=$("aHistWindows"),vs=$("aHistVsSim"),pr=$("aHistPrizes");
  if(!box||!vs||!pr||!geo?.tickets?.length)return;
  const data=rc90HistoricalData();
  if(!data||!data.hist.length){box.innerHTML='<div class="muted">Chưa có đủ lịch sử trước kỳ đang chọn.</div>';vs.innerHTML='';pr.innerHTML='';return}
  box.innerHTML=[30,60,120,250].map(w=>{
    const s=data.windows[w];
    return '<article class="aHistWindow"><div class="aHistWindowTop"><span>'+w+' kỳ</span><b>'+s.n+' kỳ dùng được</b></div><div class="aHistMetric"><span>Best-hit TB</span><strong>'+s.avgBest.toFixed(3)+'</strong></div><div class="aHistMini"><span>Best ≥3 <b>'+rc90FmtPct(s.p3)+'</b></span><span>Best ≥4 <b>'+rc90FmtPct(s.p4)+'</b></span><span>Best ≥5 <b>'+rc90FmtPct(s.p5)+'</b></span></div><small>'+s.prizeTickets+' lượt vé đạt từ Giải Ba trở lên</small></article>';
  }).join('');
  const base=data.windows[120].n?data.windows[120]:data.windows[60].n?data.windows[60]:data.windows[30];
  const an=typeof ensureGeoAnalysis==='function'?ensureGeoAnalysis():null,sim=an?.display||null;
  if(sim){
    const d3=base.p3-(Number(sim.p3)||0),d4=base.p4-(Number(sim.p4)||0),da=base.avgBest-(Number(sim.avgBest)||0);
    const sign=v=>v>0?'+':'';
    vs.innerHTML='<div class="aHistVsTitle"><b>Lịch sử thực tế vs mô phỏng ngẫu nhiên</b><span>cửa sổ '+base.n+' kỳ gần nhất trước kỳ mục tiêu</span></div><div class="aHistCompareGrid"><div><span>Best-hit TB</span><b>'+base.avgBest.toFixed(3)+'</b><small>Mô phỏng '+Number(sim.avgBest||0).toFixed(3)+' • Δ '+sign(da)+da.toFixed(3)+'</small></div><div><span>Best ≥3</span><b>'+rc90FmtPct(base.p3)+'</b><small>Mô phỏng '+rc90FmtPct(Number(sim.p3)||0)+' • Δ '+sign(d3)+d3.toFixed(1)+' điểm %</small></div><div><span>Best ≥4</span><b>'+rc90FmtPct(base.p4)+'</b><small>Mô phỏng '+rc90FmtPct(Number(sim.p4)||0)+' • Δ '+sign(d4)+d4.toFixed(1)+' điểm %</small></div></div>';
  }else vs.innerHTML='';
  const s=data.windows[120].n?data.windows[120]:base;
  const chip=(cls,label,n)=>Number(n)>0?'<span class="aHistPrizeChip '+cls+'"><b>'+n+'</b> '+label+'</span>':'';
  const chips=[chip('jp1','Jackpot 1',s.jp1),chip('jp2','Jackpot 2',s.jp2),chip('first','Giải Nhất',s.first),chip('second','Giải Nhì',s.second),chip('third','Giải Ba',s.third)].filter(Boolean);
  pr.innerHTML='<div class="aHistPrizeTitle"><b>Phân bố giải trong '+s.n+' kỳ</b><span>Tổng trên 20 vé A của mỗi kỳ lịch sử</span></div><div class="aHistPrizeChips">'+(chips.length?chips.join(''):'<span class="muted">Không có lượt vé đạt giải trong cửa sổ này.</span>')+'</div>';
}
function enhanceATicketHistory(){
  const grid=$("geoTickets");if(!grid||!geo?.tickets?.length)return;
  const data=rc90HistoricalData();if(!data?.hist?.length)return;
  const rows=typeof rankGeoRows==='function'?rankGeoRows():[];
  [...grid.children].forEach((card,i)=>{
    const p=rows[i];if(!p?.a)return;
    card.querySelectorAll('.aTicketHistory').forEach(x=>x.remove());
    const s=rc90TicketStats(p.a,data.hist),div=document.createElement('div');
    div.className='aTicketHistory';
    div.innerHTML='<span>120 kỳ: hit TB <b>'+s.avg.toFixed(2)+'</b></span><span>≥3: <b>'+s.ge3+'</b></span><span>Max: <b>'+s.max+'/6</b></span><span>Gap TB: <b>'+s.gap.toFixed(1)+'</b></span><small>Lịch sử chỉ để kiểm chứng • không ảnh hưởng hạng #'+p.rank+'</small>';
    card.appendChild(div);
  });
}
const rc90RenderGeoBase=renderGeo;
renderGeo=function(actual=[]){
  rc90RenderGeoBase(actual);
  try{renderAHistoricalValidation();enhanceATicketHistory()}catch(e){console.error('RC9 A validation render failed',e)}
};
`;

app = mustReplace(
  app,
  'initCloudAuth().catch(e=>console.error("Auth bootstrap failed",e));\nload();',
  `${runtimePatch}\ninitCloudAuth().catch(e=>console.error("Auth bootstrap failed",e));\nload();`,
  'runtime historical validation bootstrap'
);

css += `
/* RC9.0 — A HISTORICAL VALIDATION */
.aHistoryValidation{margin:14px 0 15px;padding:15px;border:1px solid rgba(100,181,255,.22);border-radius:15px;background:linear-gradient(180deg,rgba(10,31,49,.82),rgba(6,22,35,.72))}
.aHistHead{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:12px}.aHistHead h3{margin:4px 0 5px;font-size:16px}.aHistHead p{margin:0;max-width:900px;color:var(--muted);font-size:11px;line-height:1.55}.aHistBadge{white-space:nowrap;font-size:9px;font-weight:850;letter-spacing:.08em;padding:7px 9px;border-radius:999px;border:1px solid rgba(100,181,255,.27);color:#a9d8ff;background:rgba(58,138,201,.10)}
.aHistWindows{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.aHistWindow{border:1px solid var(--line);border-radius:12px;padding:11px;background:rgba(5,19,31,.68)}.aHistWindowTop{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.aHistWindowTop span{font-size:11px;font-weight:900;color:#bfe2ff}.aHistWindowTop b{font-size:8px;color:var(--muted2);font-weight:700}.aHistMetric{display:flex;justify-content:space-between;align-items:baseline}.aHistMetric span{font-size:9px;color:var(--muted)}.aHistMetric strong{font-size:20px}.aHistMini{display:flex;gap:7px;flex-wrap:wrap;margin:7px 0}.aHistMini span{font-size:8px;color:var(--muted2);padding:4px 6px;border:1px solid var(--line);border-radius:7px}.aHistMini b{color:#dcecf8}.aHistWindow small{font-size:8px;color:var(--muted2)}
.aHistVsSim{margin-top:9px;border:1px solid var(--line);border-radius:12px;padding:11px;background:rgba(6,19,31,.55)}.aHistVsTitle{display:flex;justify-content:space-between;gap:10px;align-items:baseline;margin-bottom:9px}.aHistVsTitle b{font-size:11px}.aHistVsTitle span{font-size:8px;color:var(--muted2)}.aHistCompareGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.aHistCompareGrid>div{padding:9px;border-radius:10px;background:rgba(255,255,255,.025);border:1px solid rgba(135,185,224,.10)}.aHistCompareGrid span{display:block;font-size:8px;color:var(--muted2);text-transform:uppercase;letter-spacing:.07em}.aHistCompareGrid b{display:block;font-size:17px;margin:3px 0}.aHistCompareGrid small{font-size:8px;color:var(--muted)}
.aHistPrizes{margin-top:9px;border:1px solid var(--line);border-radius:12px;padding:11px;background:rgba(6,19,31,.52)}.aHistPrizeTitle{display:flex;justify-content:space-between;gap:10px;align-items:baseline}.aHistPrizeTitle b{font-size:11px}.aHistPrizeTitle span{font-size:8px;color:var(--muted2)}.aHistPrizeChips{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.aHistPrizeChip{font-size:9px;padding:5px 7px;border-radius:8px;border:1px solid var(--line);color:#cbdbe8}.aHistPrizeChip.jp1{border-color:rgba(255,201,107,.45);color:#ffe0a0}.aHistPrizeChip.jp2{border-color:rgba(169,138,255,.45);color:#ddd1ff}.aHistPrizeChip.first{border-color:rgba(113,227,173,.35);color:#a8f0cf}.aHistPrizeChip.second{border-color:rgba(105,227,233,.35);color:#aeeff2}.aHistPrizeChip.third{border-color:rgba(100,181,255,.35);color:#b9dcff}.aHistMethod{margin-top:9px;padding-top:9px;border-top:1px solid var(--line);font-size:9px;color:var(--muted2);line-height:1.5}.aHistMethod b{color:#bdd9ee}
.aTicketHistory{margin-top:8px;padding-top:8px;border-top:1px dashed rgba(135,185,224,.17);display:flex;gap:5px;flex-wrap:wrap}.aTicketHistory span{font-size:8px;color:var(--muted);padding:3px 5px;border-radius:6px;background:rgba(255,255,255,.025)}.aTicketHistory b{color:#dcebf7}.aTicketHistory small{flex-basis:100%;font-size:7px;color:var(--muted2);margin-top:1px}
@media(max-width:1050px){.aHistWindows{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.aHistHead{display:block}.aHistBadge{display:inline-block;margin-top:8px}.aHistWindows,.aHistCompareGrid{grid-template-columns:1fr}.aHistVsTitle,.aHistPrizeTitle{display:block}.aHistVsTitle span,.aHistPrizeTitle span{display:block;margin-top:3px}}
`;

writeFileSync(appPath, app);
writeFileSync(htmlPath, html);
writeFileSync(cssPath, css);
console.log('RC9.0 applied — Track A historical validation enabled without changing A generation');
