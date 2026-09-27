import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const appPath = join('dist', 'app.js');
const htmlPath = join('dist', 'index.html');
const cssPath = join('dist', 'style.css');

let app = readFileSync(appPath, 'utf8');

function replaceOnce(from, to, label) {
  if (!app.includes(from)) throw new Error(`RC8.9.3 patch failed: ${label}`);
  app = app.replace(from, to);
}

if (!app.includes('function prizeInfo(ticket,actual,special)')) {
  replaceOnce(
    'function seeded(seed){',
    `function currentSpecialForTarget(){
  const log=typeof getLog==='function'?getLog(targetId):null;
  const fromLog=validSpecial(log?.special);
  if(fromLog!==null)return fromLog;
  const d=(draws||[]).find(x=>Number(x.id)===Number(targetId));
  return d?specialNum(d):null;
}
function prizeInfo(ticket,actual,special){
  const r=scorePrizeTicket(ticket,actual,special);
  if(r.jp1)return{key:'jp1',label:'JACKPOT 1',detail:'Hit 6/6 số chính'};
  if(r.jp2)return{key:'jp2',label:'JACKPOT 2',detail:'Hit 5/6 chính + số đặc biệt'};
  if(r.first)return{key:'first',label:'GIẢI NHẤT',detail:'Hit 5/6 số chính'};
  if(r.second)return{key:'second',label:'GIẢI NHÌ',detail:'Hit 4/6 số chính'};
  if(r.third)return{key:'third',label:'GIẢI BA',detail:'Hit 3/6 số chính'};
  if(r.mainHits===5&&validSpecial(special)===null)return{key:'pending5',label:'5/6 SỐ CHÍNH',detail:'Chờ số đặc biệt để phân loại'};
  return{key:'none',label:'CHƯA TRÚNG GIẢI',detail:'Hit '+r.mainHits+'/6 số chính'};
}
function prizeBadge(ticket,actual,special){
  if(!actual||!actual.length)return '';
  const p=prizeInfo(ticket,actual,special);
  return '<div class="ticketPrize '+p.key+'"><b>'+p.label+'</b><span>'+p.detail+'</span></div>';
}
function prizeSummaryScore(log,key,score){
  if(score&&Number.isFinite(score.third)&&Number.isFinite(score.second))return score;
  const actual=Array.isArray(log?.actual)?log.actual:[],sp=validSpecial(log?.special);
  if(actual.length!==6)return score||{};
  if(key==='L'){
    const LL=typeof getLearningLock==='function'?getLearningLock(log.targetId):null;
    const T=LL?.tickets?.map(x=>x.a||x)||[];
    return T.length?scoreTrack(T,actual,sp):(score||{});
  }
  const L=typeof getLock==='function'?getLock(log.targetId):null;
  const T=key==='A'?L?.A?.tickets:key==='B'?L?.B?.tickets:L?.C?.tickets;
  return T?.length?scoreTrack(T,actual,sp):(score||{});
}
function renderPrizeSummary(log){
  const box=$("scoreboard");if(!box)return;
  if(!log||!Array.isArray(log.actual)||log.actual.length!==6){box.innerHTML='';return}
  const defs=[['A','Mô phỏng',log.A],['B','Lịch sử',log.B],['C','Kết hợp',log.C]];
  if(log.L)defs.push(['L','Learning',log.L]);
  const rows=defs.map(([key,name,raw])=>[key,name,prizeSummaryScore(log,key,raw)]);
  const chip=(cls,label,n)=>Number(n)>0?'<span class="prizeSumChip '+cls+'"><b>'+n+'</b> '+label+'</span>':'';
  box.innerHTML='<section class="prizeSummary"><div class="prizeSummaryHead"><div><span>TỔNG KẾT GIẢI THƯỞNG</span><b>'+drawLabel(log.targetId)+'</b></div><small>Mỗi ô là số vé đạt đúng hạng giải trong bộ 20 vé.</small></div><div class="prizeSummaryGrid">'+rows.map(([key,name,s])=>{
    const chips=[chip('jp1','Jackpot 1',s.jp1),chip('jp2','Jackpot 2',s.jp2),chip('first','Giải Nhất',s.first),chip('second','Giải Nhì',s.second),chip('third','Giải Ba',s.third)].filter(Boolean);
    const total=['jp1','jp2','first','second','third'].reduce((a,k)=>a+(Number(s[k])||0),0);
    return '<article class="prizeSummaryCard track'+key+'"><div class="prizeSummaryTitle"><b>'+key+'</b><span>'+name+'</span><strong>'+total+' vé có giải</strong></div><div class="prizeSummaryChips">'+(chips.length?chips.join(''):'<span class="prizeSumNone">Chưa có vé đạt giải</span>')+'</div><div class="prizeSummaryBest">Best hit <b>'+(s.best??0)+'/6</b> • Tổng hit <b>'+(s.total??0)+'</b></div></article>';
  }).join('')+'</div></section>';
}
function seeded(seed){`,
    'prize + summary helpers'
  );
}

// Preserve the original balls() renderer so .ball.hit keeps the existing green highlight.
const oldTicketBalls = '<div class="balls">${balls(p.a,actual)}</div>';
const newTicketBalls = '<div class="balls">${balls(p.a,actual)}</div>\n    ${prizeBadge(p.a,actual,currentSpecialForTarget())}';
const count = app.split(oldTicketBalls).length - 1;
if (count < 4) throw new Error(`RC8.9.3 expected at least 4 ticket renderers, found ${count}`);
app = app.split(oldTicketBalls).join(newTicketBalls);

const compareBase = `...(sp!==null?[["Jackpot 2 • 5 chính + số đặc biệt",log.A.jp2??0,log.B.jp2??0,log.C.jp2??0],["Giải Nhất • 5 số chính",log.A.first??0,log.B.first??0,log.C.first??0]]:[])`;
const compareFull = `...(sp!==null?[["Jackpot 2 • 5 chính + số đặc biệt",log.A.jp2??0,log.B.jp2??0,log.C.jp2??0],["Giải Nhất • 5 số chính",log.A.first??0,log.B.first??0,log.C.first??0]]:[]),
    ["Giải Nhì • 4 số chính",log.A.second??0,log.B.second??0,log.C.second??0],
    ["Giải Ba • 3 số chính",log.A.third??0,log.B.third??0,log.C.third??0]`;
replaceOnce(compareBase, compareFull, 'compare full prize rows');

const replayBase = `...(validSpecial(special)!==null?[["Jackpot 2 • 5 chính + số đặc biệt",A.jp2??0,B.jp2??0,C.jp2??0],["Giải Nhất • 5 số chính",A.first??0,B.first??0,C.first??0]]:[]),`;
const replayFull = `...(validSpecial(special)!==null?[["Jackpot 2 • 5 chính + số đặc biệt",A.jp2??0,B.jp2??0,C.jp2??0],["Giải Nhất • 5 số chính",A.first??0,B.first??0,C.first??0]]:[]),
    ["Giải Nhì • 4 số chính",A.second??0,B.second??0,C.second??0],
    ["Giải Ba • 3 số chính",A.third??0,B.third??0,C.third??0],`;
replaceOnce(replayBase, replayFull, 'replay full prize rows');

// Clear summary whenever there is no result for the selected draw.
replaceOnce(
  `if(!log){$("compareBox").innerHTML='<span class="muted">Chưa có kết quả kỳ đang chọn.</span>';return}`,
  `if(!log){$("compareBox").innerHTML='<span class="muted">Chưa có kết quả kỳ đang chọn.</span>';if($("scoreboard"))$("scoreboard").innerHTML='';return}`,
  'clear empty prize summary'
);

// Normal locked/saved result: draw the per-track prize summary under A/B/C comparison.
replaceOnce(
  `  const cb=$("compareBox");\n  if(cb){cb.classList.remove("resultFlash");void cb.offsetWidth;cb.classList.add("resultFlash")}`,
  `  renderPrizeSummary(log);\n  const cb=$("compareBox");\n  if(cb){cb.classList.remove("resultFlash");void cb.offsetWidth;cb.classList.add("resultFlash")}`,
  'logged prize summary render'
);

// Replay result: A/B/C are computed locally, so build an ephemeral summary object.
replaceOnce(
  `  renderGeo(actual);renderLegacyTickets(actual);renderHybrid(actual);`,
  `  renderPrizeSummary({targetId:Number(targetId),actual,special,A,B,C});\n  renderGeo(actual);renderLegacyTickets(actual);renderHybrid(actual);`,
  'replay prize summary render'
);

// RC8.9.2 behavior retained: reopening a saved draw must repaint every ticket with result colors.
const loggedRenderBase = '  if(lg)renderCompare(lg);else if(isReplayTarget(targetId))renderReplayCompare();else renderCompare(null);';
const loggedRenderFix = `  if(lg){
    renderCompare(lg);
    const actual=Array.isArray(lg.actual)?lg.actual:[];
    renderGeo(actual);
    renderLegacyTickets(actual);
    renderHybrid(actual);
    if(lg.L||getLearningLock(targetId))renderLearningPortfolio(actual);
  }else if(isReplayTarget(targetId))renderReplayCompare();else renderCompare(null);`;
replaceOnce(loggedRenderBase, loggedRenderFix, 'logged draw ticket repaint');

writeFileSync(appPath, app);

let html = readFileSync(htmlPath, 'utf8');
html = html.replaceAll('RC8.8', 'RC8.9.3').replaceAll('v=8.8', 'v=8.9.3');
html = html.replace(
  'Khi có kết quả, hệ thống chấm 6 số chính, số đặc biệt, Jackpot 1, Jackpot 2 và các mức trùng của A/B/C.',
  'Khi có kết quả, hệ thống giữ màu số hit, phân loại từng giải và hiển thị bảng tổng kết giải thưởng của A/B/C/L.'
);
writeFileSync(htmlPath, html);

let css = readFileSync(cssPath, 'utf8');
css += `
/* RC8.9.3 FULL PRIZE BOARD + DRAW SUMMARY */
.ticketPrize{margin-top:9px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 9px;border:1px solid var(--line);border-radius:10px;background:rgba(6,19,31,.7)}
.ticketPrize b{font-size:10px;letter-spacing:.045em}.ticketPrize span{font-size:9px;color:var(--muted)}
.ticketPrize.jp1{border-color:rgba(255,201,107,.68);box-shadow:inset 0 0 24px rgba(255,201,107,.08)}
.ticketPrize.jp1 b{color:var(--amber)}
.ticketPrize.jp2{border-color:rgba(169,138,255,.60);box-shadow:inset 0 0 24px rgba(169,138,255,.08)}
.ticketPrize.jp2 b{color:#d8c9ff}
.ticketPrize.first b{color:var(--green)}
.ticketPrize.second b{color:var(--cyan)}
.ticketPrize.third b{color:var(--blue)}
.ticketPrize.pending5 b{color:var(--amber)}
.ticketPrize.none{opacity:.72}
.scoreboard:empty{display:none}.scoreboard{margin-top:12px}
.prizeSummary{border:1px solid rgba(104,181,239,.18);border-radius:15px;padding:14px;background:rgba(5,17,28,.58)}
.prizeSummaryHead{display:flex;justify-content:space-between;gap:12px;align-items:end;margin-bottom:10px}.prizeSummaryHead div{display:flex;gap:9px;align-items:baseline}.prizeSummaryHead span{font-size:9px;color:var(--muted2);font-weight:850;letter-spacing:.11em}.prizeSummaryHead b{font-size:14px}.prizeSummaryHead small{font-size:9px;color:var(--muted2)}
.prizeSummaryGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.prizeSummaryGrid:has(.trackL){grid-template-columns:repeat(4,minmax(0,1fr))}
.prizeSummaryCard{border:1px solid var(--line);border-radius:12px;padding:11px;background:rgba(7,22,35,.78)}.prizeSummaryCard.trackA{border-top-color:rgba(100,181,255,.55)}.prizeSummaryCard.trackB{border-top-color:rgba(255,201,107,.55)}.prizeSummaryCard.trackC{border-top-color:rgba(169,138,255,.58)}.prizeSummaryCard.trackL{border-top-color:rgba(113,227,173,.55)}
.prizeSummaryTitle{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:7px}.prizeSummaryTitle>b{width:27px;height:27px;display:grid;place-items:center;border-radius:8px;background:rgba(255,255,255,.05);font-size:11px}.prizeSummaryTitle span{font-size:10px;font-weight:800;color:#dce9f3}.prizeSummaryTitle strong{font-size:9px;color:var(--muted)}
.prizeSummaryChips{display:flex;flex-wrap:wrap;gap:5px;margin:10px 0 8px}.prizeSumChip{font-size:9px;padding:5px 7px;border-radius:8px;border:1px solid var(--line);background:rgba(255,255,255,.025);color:#c9d8e4}.prizeSumChip b{font-size:11px}.prizeSumChip.jp1{border-color:rgba(255,201,107,.45);color:#ffe1a4}.prizeSumChip.jp2{border-color:rgba(169,138,255,.45);color:#dacfff}.prizeSumChip.first{border-color:rgba(113,227,173,.38);color:#a8f0cf}.prizeSumChip.second{border-color:rgba(105,227,233,.35);color:#adf1f4}.prizeSumChip.third{border-color:rgba(100,181,255,.35);color:#b9ddff}.prizeSumNone{font-size:9px;color:var(--muted2);padding:5px 0}.prizeSummaryBest{font-size:9px;color:var(--muted2);border-top:1px solid var(--line);padding-top:7px}.prizeSummaryBest b{color:#dfeaf2}
@media(max-width:1050px){.prizeSummaryGrid,.prizeSummaryGrid:has(.trackL){grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.prizeSummaryGrid,.prizeSummaryGrid:has(.trackL){grid-template-columns:1fr}.prizeSummaryHead{display:block}.prizeSummaryHead small{display:block;margin-top:5px}.prizeSummaryTitle{grid-template-columns:28px 1fr}.prizeSummaryTitle strong{grid-column:2}}
`;
writeFileSync(cssPath, css);

console.log('RC8.9.3 applied — per-draw prize summary board enabled');
