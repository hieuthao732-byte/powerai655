import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const appPath = join('dist', 'app.js');
const htmlPath = join('dist', 'index.html');
const cssPath = join('dist', 'style.css');

let app = readFileSync(appPath, 'utf8');

function replaceOnce(from, to, label) {
  if (!app.includes(from)) throw new Error(`RC8.9.2 patch failed: ${label}`);
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
function seeded(seed){`,
    'prize helpers'
  );
}

// Preserve the original balls() renderer so .ball.hit keeps the existing green highlight.
const oldTicketBalls = '<div class="balls">${balls(p.a,actual)}</div>';
const newTicketBalls = '<div class="balls">${balls(p.a,actual)}</div>\n    ${prizeBadge(p.a,actual,currentSpecialForTarget())}';
const count = app.split(oldTicketBalls).length - 1;
if (count < 4) throw new Error(`RC8.9.2 expected at least 4 ticket renderers, found ${count}`);
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

// RC8.9.2: when reopening a draw that already has a saved log, repaint every ticket
// with the saved official/manual result. Previously only the compare panel was repainted,
// so the ticket grids were rendered with actual=[] and all balls stayed white.
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
html = html.replaceAll('RC8.8', 'RC8.9.2').replaceAll('v=8.8', 'v=8.9.2');
html = html.replace(
  'Khi có kết quả, hệ thống chấm 6 số chính, số đặc biệt, Jackpot 1, Jackpot 2 và các mức trùng của A/B/C.',
  'Khi có kết quả, hệ thống giữ màu số hit và phân loại Jackpot 1, Jackpot 2, Giải Nhất, Giải Nhì, Giải Ba cho từng bộ vé.'
);
writeFileSync(htmlPath, html);

let css = readFileSync(cssPath, 'utf8');
css += `
/* RC8.9.2 FULL PRIZE BOARD — original hit colors preserved */
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
`;
writeFileSync(cssPath, css);

console.log('RC8.9.2 applied — saved-result ticket grids repaint with hit colors');
