import { mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const files = [
  'index.html',
  'app.js',
  'auth.js',
  'style.css',
  'favicon.svg',
  'google933e1c79e6843890.html',
  'robots.txt',
  'site.webmanifest',
  'sitemap.xml'
];

mkdirSync('dist', { recursive: true });

for (const file of files) {
  if (!existsSync(file)) throw new Error(`Missing required static file: ${file}`);
  copyFileSync(file, join('dist', file));
}

function patchApp() {
  const path = join('dist', 'app.js');
  let app = readFileSync(path, 'utf8');
  const mustReplace = (from, to, label) => {
    if (!app.includes(from)) throw new Error(`RC8.7 patch failed: ${label}`);
    app = app.replace(from, to);
  };

  mustReplace(
    'function nums(d){return (d?.result||[]).map(Number).filter(n=>n>=1&&n<=55).slice(0,6).sort((a,b)=>a-b)}',
    `function nums(d){return (d?.result||[]).map(Number).filter(n=>n>=1&&n<=55).slice(0,6).sort((a,b)=>a-b)}\nfunction specialNum(d){\n  const a=(d?.result||[]).map(Number).filter(n=>n>=1&&n<=55);\n  return a.length>=7?a[6]:null;\n}\nfunction validSpecial(s){const n=Number(s);return Number.isInteger(n)&&n>=1&&n<=55?n:null}\nfunction scorePrizeTicket(ticket,actual,special){\n  const mainHits=hits(ticket,actual),sp=validSpecial(special),specialHit=sp!==null&&ticket.includes(sp);\n  return{mainHits,specialHit,jp1:mainHits===6,jp2:sp!==null&&mainHits===5&&specialHit,first:sp!==null&&mainHits===5&&!specialHit,second:mainHits===4,third:mainHits===3};\n}`,
    'special number helpers'
  );

  mustReplace(
    `function scoreTrack(P,actual){\n  const hs=P.map(t=>hits(t,actual)),best=Math.max(...hs),bestIdx=hs.indexOf(best);\n  return{best,bestIdx,total:hs.reduce((a,b)=>a+b,0),g2:hs.filter(x=>x>=2).length,g3:hs.filter(x=>x>=3).length,g4:hs.filter(x=>x>=4).length,hs};\n}`,
    `function scoreTrack(P,actual,special=null){\n  const hs=P.map(t=>hits(t,actual)),best=Math.max(...hs),bestIdx=hs.indexOf(best),sp=validSpecial(special),prize=P.map(t=>scorePrizeTicket(t,actual,sp));\n  return{\n    best,bestIdx,total:hs.reduce((a,b)=>a+b,0),g2:hs.filter(x=>x>=2).length,g3:hs.filter(x=>x>=3).length,g4:hs.filter(x=>x>=4).length,hs,\n    special:sp,jp1:prize.filter(x=>x.jp1).length,jp2:sp===null?null:prize.filter(x=>x.jp2).length,first:sp===null?null:prize.filter(x=>x.first).length,\n    second:prize.filter(x=>x.second).length,third:prize.filter(x=>x.third).length,\n    jp1Idxs:prize.map((x,i)=>x.jp1?i:-1).filter(i=>i>=0),jp2Idxs:prize.map((x,i)=>x.jp2?i:-1).filter(i=>i>=0),prize\n  };\n}`,
    'scoreTrack jackpot prizes'
  );

  mustReplace('function saveResult(actual,source){', 'function saveResult(actual,source,special=null){', 'saveResult signature');
  mustReplace(
    `  const A=scoreTrack(L.A.tickets,actual),B=scoreTrack(L.B.tickets,actual),C=scoreTrack(L.C.tickets,actual),\n    LL=getLearningLock(targetId),LS=LL?.tickets?.length===20?scoreTrack(LL.tickets.map(x=>x.a||x),actual):null,\n    obj={targetId:Number(targetId),source,actual,checkedAt:new Date().toISOString(),lockedAt:L.lockedAt,A,B,C,hashA:L.A.hash,hashB:L.B.hash,hashC:L.C.hash};`,
    `  const sp=validSpecial(special),A=scoreTrack(L.A.tickets,actual,sp),B=scoreTrack(L.B.tickets,actual,sp),C=scoreTrack(L.C.tickets,actual,sp),\n    LL=getLearningLock(targetId),LS=LL?.tickets?.length===20?scoreTrack(LL.tickets.map(x=>x.a||x),actual,sp):null,\n    obj={targetId:Number(targetId),source,actual,special:sp,checkedAt:new Date().toISOString(),lockedAt:L.lockedAt,A,B,C,hashA:L.A.hash,hashB:L.B.hash,hashC:L.C.hash};`,
    'saveResult prize scoring'
  );

  mustReplace(
    `function parseManual(s){\n  const a=(s.match(/\\d+/g)||[]).map(Number);if(a.length!==6||new Set(a).size!==6||a.some(n=>n<1||n>55))throw new Error("Nhập đúng 6 số khác nhau từ 1–55.");return a.sort((x,y)=>x-y);\n}`,
    `function parseManual(s){\n  const a=(s.match(/\\d+/g)||[]).map(Number);\n  if(a.length!==6&&a.length!==7)throw new Error("Nhập 6 số chính; có thể thêm số đặc biệt thứ 7.");\n  const main=a.slice(0,6),sp=a.length===7?a[6]:null;\n  if(new Set(main).size!==6||main.some(n=>n<1||n>55))throw new Error("6 số chính phải khác nhau và nằm trong 1–55.");\n  if(sp!==null&&(sp<1||sp>55||main.includes(sp)))throw new Error("Số đặc biệt phải nằm trong 1–55 và khác 6 số chính.");\n  return main.sort((x,y)=>x-y);\n}\nfunction parseManualSpecial(s){const a=(s.match(/\\d+/g)||[]).map(Number);return a.length===7?validSpecial(a[6]):null}`,
    'manual result parser'
  );

  mustReplace(
    '    saveResult(parseManual($("manualResult").value),"manual");\n    showToast("Đã lưu TẠM kết quả nhập tay. Kết quả này không được Learning dùng và chưa được coi là chính thức.","warn");',
    '    const raw=$("manualResult").value,sp=parseManualSpecial(raw);saveResult(parseManual(raw),"manual",sp);\n    showToast(sp!==null?`Đã lưu TẠM 6 số chính + số đặc biệt ${String(sp).padStart(2,"0")}. Chưa dùng cho Learning cho tới khi feed xác nhận.`:"Đã lưu TẠM 6 số chính. Chưa có số đặc biệt nên chưa thể chấm Jackpot 2.","warn");',
    'manual result save'
  );

  mustReplace(
    '  const actual=nums(d),prev=getLog(targetId);',
    '  const actual=nums(d),special=specialNum(d),prev=getLog(targetId);',
    'official special extraction'
  );
  mustReplace(
    '  if(prev?.source==="feed"&&prev.actual.join(",")===actual.join(","))return;',
    '  if(prev?.source==="feed"&&prev.actual.join(",")===actual.join(",")&&Number(prev.special||0)===Number(special||0))return;',
    'official special equality'
  );
  app = app.replaceAll('saveResult(actual,"feed");', 'saveResult(actual,"feed",special);');

  mustReplace(
    `  const L=getLock(log.targetId),M=[\n    ["Vé trúng nhiều số nhất",log.A.best,log.B.best,log.C.best],\n    ["Tổng số trùng trên 20 vé",log.A.total,log.B.total,log.C.total],\n    ["Số vé trúng ≥2 số",log.A.g2,log.B.g2,log.C.g2],\n    ["Số vé trúng ≥3 số",log.A.g3,log.B.g3,log.C.g3],\n    ["Số vé trúng ≥4 số",log.A.g4,log.B.g4,log.C.g4]\n  ];`,
    `  const L=getLock(log.targetId),sp=validSpecial(log.special),prizeRows=[\n    ["Jackpot 1 • 6 số chính",log.A.jp1??0,log.B.jp1??0,log.C.jp1??0],\n    ...(sp!==null?[["Jackpot 2 • 5 chính + số đặc biệt",log.A.jp2??0,log.B.jp2??0,log.C.jp2??0],["Giải Nhất • 5 số chính",log.A.first??0,log.B.first??0,log.C.first??0]]:[])\n  ],M=[\n    ...prizeRows,\n    ["Vé trúng nhiều số nhất",log.A.best,log.B.best,log.C.best],\n    ["Tổng số trùng trên 20 vé",log.A.total,log.B.total,log.C.total],\n    ["Số vé trúng ≥2 số",log.A.g2,log.B.g2,log.C.g2],\n    ["Số vé trúng ≥3 số",log.A.g3,log.B.g3,log.C.g3],\n    ["Số vé trúng ≥4 số",log.A.g4,log.B.g4,log.C.g4]\n  ];`,
    'comparison jackpot metrics'
  );

  mustReplace(
    '    Kết quả #${log.targetId}: <b>${log.actual.map(n=>String(n).padStart(2,"0")).join(" ")}</b>',
    '    Kết quả #${log.targetId}: <b>${log.actual.map(n=>String(n).padStart(2,"0")).join(" ")}</b> ${sp!==null?`<span class="jp2Special"><span>Số đặc biệt</span><b>${String(sp).padStart(2,"0")}</b></span>`:`<span class="jp2Pending">• Chưa có số đặc biệt</span>`}',
    'comparison special display'
  );

  mustReplace(
    '  const actual=nums(d),AT=geo.tickets,BT=legacy.map(x=>x.a),CT=hybrid.map(x=>x.a),A=scoreTrack(AT,actual),B=scoreTrack(BT,actual),C=scoreTrack(CT,actual),M=[',
    '  const actual=nums(d),special=specialNum(d),AT=geo.tickets,BT=legacy.map(x=>x.a),CT=hybrid.map(x=>x.a),A=scoreTrack(AT,actual,special),B=scoreTrack(BT,actual,special),C=scoreTrack(CT,actual,special),M=[\n    ["Jackpot 1 • 6 số chính",A.jp1??0,B.jp1??0,C.jp1??0],\n    ...(validSpecial(special)!==null?[["Jackpot 2 • 5 chính + số đặc biệt",A.jp2??0,B.jp2??0,C.jp2??0],["Giải Nhất • 5 số chính",A.first??0,B.first??0,C.first??0]]:[]),',
    'replay jackpot scoring'
  );
  mustReplace(
    '      <b>XEM LẠI ${drawLabel(targetId)}</b> • Kết quả chính thức: <b>${actual.map(n=>String(n).padStart(2,"0")).join(" ")}</b>',
    '      <b>XEM LẠI ${drawLabel(targetId)}</b> • Kết quả chính thức: <b>${actual.map(n=>String(n).padStart(2,"0")).join(" ")}</b> ${validSpecial(special)!==null?`<span class="jp2Special"><span>Số đặc biệt</span><b>${String(special).padStart(2,"0")}</b></span>`:""}',
    'replay special display'
  );

  writeFileSync(path, app);
}

function patchHtml() {
  const path = join('dist', 'index.html');
  let html = readFileSync(path, 'utf8');
  html = html.replace(/RC8\.6/g, 'RC8.7').replace(/v=8\.6/g, 'v=8.7');
  html = html.replace('placeholder="01 13 23 25 26 28"', 'placeholder="01 13 23 25 26 28 | 35"');
  html = html.replace(
    'Khi có kết quả, hệ thống tự tính vé trúng nhiều số nhất và số vé đạt từ 2, 3, 4 số trở lên.',
    'Khi có kết quả, hệ thống chấm 6 số chính, số đặc biệt, Jackpot 1, Jackpot 2 và các mức trùng của A/B/C.'
  );
  writeFileSync(path, html);
}

function patchStyle() {
  const path = join('dist', 'style.css');
  let css = readFileSync(path, 'utf8');
  css += `\n/* RC8.7 Jackpot 2 */\n.jp2Special{display:inline-flex;align-items:center;gap:7px;margin-left:10px;padding:5px 9px;border:1px solid rgba(255,201,107,.45);border-radius:999px;background:rgba(255,201,107,.10);vertical-align:middle}.jp2Special span{font-size:11px;opacity:.78;text-transform:uppercase;letter-spacing:.04em}.jp2Special b{display:inline-grid;place-items:center;min-width:30px;height:30px;padding:0 7px;border-radius:50%;background:#ffc96b;color:#17120a;font-weight:900}.jp2Pending{margin-left:8px;font-size:12px;opacity:.7}.compareMetric span{line-height:1.25}\n`;
  writeFileSync(path, css);
}

patchApp();
patchHtml();
patchStyle();

console.log(`Built ${files.length} static files into dist/ • RC8.7 Jackpot 2 enabled`);
