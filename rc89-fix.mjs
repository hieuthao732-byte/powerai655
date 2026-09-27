import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const appPath = join('dist', 'app.js');
const cssPath = join('dist', 'style.css');
const htmlPath = join('dist', 'index.html');

let app = readFileSync(appPath, 'utf8');

// Keep the original balls() renderer untouched so main-number hits retain the existing .hit color.
if (!app.includes('function prizeBadge(ticket,actual,special)')) {
  const anchor = 'function seeded(seed)';
  if (!app.includes(anchor)) throw new Error('RC8.9.1: helper anchor not found');
  const helpers = `function currentSpecialForTarget(){
  const log=typeof getLog==='function'?getLog(targetId):null;
  const ls=validSpecial(log?.special);if(ls!==null)return ls;
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
`;
  app = app.replace(anchor, helpers + anchor);
}

// Add prize classification under every A/B/C/L ticket, WITHOUT replacing balls(...).
const ticketBalls = '    <div class="balls">${balls(p.a,actual)}</div>';
const ticketWithPrize = '    <div class="balls">${balls(p.a,actual)}</div>\n    ${prizeBadge(p.a,actual,currentSpecialForTarget())}';
if (app.includes(ticketBalls)) app = app.replaceAll(ticketBalls, ticketWithPrize);

// Add Giải Nhì + Giải Ba to the A/B/C comparison table.
const compareOld = `...(sp!==null?[["Jackpot 2 • 5 chính + số đặc biệt",log.A.jp2??0,log.B.jp2??0,log.C.jp2??0],["Giải Nhất • 5 số chính",log.A.first??0,log.B.first??0,log.C.first??0]]:[])`;
const compareNew = `...(sp!==null?[["Jackpot 2 • 5 chính + số đặc biệt",log.A.jp2??0,log.B.jp2??0,log.C.jp2??0],["Giải Nhất • 5 số chính",log.A.first??0,log.B.first??0,log.C.first??0]]:[]),
    ["Giải Nhì • 4 số chính",log.A.second??0,log.B.second??0,log.C.second??0],
    ["Giải Ba • 3 số chính",log.A.third??0,log.B.third??0,log.C.third??0]`;
if (app.includes(compareOld)) app = app.replace(compareOld, compareNew);

// Same prize rows in replay mode.
const replayOld = `...(validSpecial(special)!==null?[["Jackpot 2 • 5 chính + số đặc biệt",A.jp2??0,B.jp2??0,C.jp2??0],["Giải Nhất • 5 số chính",A.first??0,B.first??0,C.first??0]]:[]),`;
const replayNew = `...(validSpecial(special)!==null?[["Jackpot 2 • 5 chính + số đặc biệt",A.jp2??0,B.jp2??0,C.jp2??0],["Giải Nhất • 5 số chính",A.first??0,B.first??0,C.first??0]]:[]),
    ["Giải Nhì • 4 số chính",A.second??0,B.second??0,C.second??0],
    ["Giải Ba • 3 số chính",A.third??0,B.third??0,C.third??0],`;
if (app.includes(replayOld)) app = app.replace(replayOld, replayNew);

writeFileSync(appPath, app);

let css = readFileSync(cssPath, 'utf8');
if (!css.includes('RC8.9.1 FULL PRIZE BADGES')) {
  css += `
/* RC8.9.1 FULL PRIZE BADGES — original .ball.hit styling remains authoritative */
.ticketPrize{margin-top:9px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 9px;border:1px solid var(--line);border-radius:10px;background:rgba(6,19,31,.70)}
.ticketPrize b{font-size:10px;letter-spacing:.045em}.ticketPrize span{font-size:9px;color:var(--muted)}
.ticketPrize.jp1{border-color:rgba(255,201,107,.68);box-shadow:inset 0 0 24px rgba(255,201,107,.08)}.ticketPrize.jp1 b{color:var(--amber)}
.ticketPrize.jp2{border-color:rgba(169,138,255,.60);box-shadow:inset 0 0 24px rgba(169,138,255,.08)}.ticketPrize.jp2 b{color:#d8c9ff}
.ticketPrize.first b{color:var(--green)}.ticketPrize.second b{color:var(--cyan)}.ticketPrize.third b{color:var(--blue)}.ticketPrize.pending5 b{color:var(--amber)}
.ticketPrize.none{opacity:.72}
`;
  writeFileSync(cssPath, css);
}

let html = readFileSync(htmlPath, 'utf8');
html = html.replaceAll('RC8.8', 'RC8.9.1').replaceAll('v=8.8', 'v=8.9.1');
html = html.replace(
  'Khi có kết quả, hệ thống chấm 6 số chính, số đặc biệt, Jackpot 1, Jackpot 2 và các mức trùng của A/B/C.',
  'Khi có kết quả, hệ thống giữ màu số hit và phân loại Jackpot 1, Jackpot 2, Giải Nhất, Giải Nhì, Giải Ba cho từng vé.'
);
writeFileSync(htmlPath, html);

console.log('RC8.9.1 applied: hit colors preserved + full prize badges enabled');
