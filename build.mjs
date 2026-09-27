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
    if (!app.includes(from)) throw new Error(`RC8.8 patch failed: ${label}`);
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
  html = html.replace(/RC8\.6/g, 'RC8.8').replace(/v=8\.6/g, 'v=8.8');
  html = html.replace(
    '<title>PowerAI 6/55 – Phân tích Vietlott Power 6/55</title>',
    '<title>PowerAI 6/55 – Phân tích & thống kê Vietlott Power 6/55</title>'
  );
  html = html.replace(
    '<meta name="description" content="PowerAI 6/55 là công cụ phân tích, mô phỏng và đối chiếu Vietlott Power 6/55 với các bộ A/B/C/L, dữ liệu lịch sử và thống kê kết quả. Điểm số chỉ mang tính nghiên cứu, không phải xác suất trúng thưởng.">',
    '<meta name="description" content="PowerAI 6/55 hỗ trợ phân tích và thống kê Vietlott Power 6/55 với dữ liệu lịch sử, mô phỏng A/B/C/L, đối chiếu kết quả và chấm Jackpot 1, Jackpot 2. Điểm số chỉ phục vụ nghiên cứu, không phải xác suất trúng thưởng.">'
  );
  html = html.replace(
    '<meta property="og:title" content="PowerAI 6/55 – Phân tích Vietlott Power 6/55">',
    '<meta property="og:title" content="PowerAI 6/55 – Phân tích & thống kê Vietlott Power 6/55">'
  );
  html = html.replace(
    '<meta property="og:description" content="Công cụ phân tích, mô phỏng và đối chiếu Vietlott Power 6/55 với các bộ A/B/C/L và dữ liệu lịch sử.">',
    '<meta property="og:description" content="Phân tích, thống kê và mô phỏng Vietlott Power 6/55 với A/B/C/L, dữ liệu lịch sử và chấm Jackpot 1/2.">'
  );
  html = html.replace(
    '<meta name="twitter:title" content="PowerAI 6/55 – Phân tích Vietlott Power 6/55">',
    '<meta name="twitter:title" content="PowerAI 6/55 – Phân tích & thống kê Vietlott Power 6/55">'
  );
  html = html.replace(
    '<meta name="twitter:description" content="Công cụ phân tích, mô phỏng và đối chiếu Vietlott Power 6/55.">',
    '<meta name="twitter:description" content="Phân tích và thống kê Power 6/55, mô phỏng A/B/C/L và chấm Jackpot 1/2.">'
  );
  html = html.replace(
    '"description": "Công cụ phân tích, mô phỏng và đối chiếu Vietlott Power 6/55 với các bộ A/B/C/L và dữ liệu lịch sử.",',
    '"description": "Công cụ phân tích và thống kê Vietlott Power 6/55 với mô phỏng A/B/C/L, dữ liệu lịch sử, đối chiếu kết quả và chấm Jackpot 1/2.",'
  );
  html = html.replace('placeholder="01 13 23 25 26 28"', 'placeholder="01 13 23 25 26 28 | 35"');
  html = html.replace(
    'Khi có kết quả, hệ thống tự tính vé trúng nhiều số nhất và số vé đạt từ 2, 3, 4 số trở lên.',
    'Khi có kết quả, hệ thống chấm 6 số chính, số đặc biệt, Jackpot 1, Jackpot 2 và các mức trùng của A/B/C.'
  );

  const faqSchema = `<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"FAQPage",
  "mainEntity":[
    {"@type":"Question","name":"PowerAI 6/55 là gì?","acceptedAnswer":{"@type":"Answer","text":"PowerAI 6/55 là công cụ nghiên cứu, phân tích và thống kê Vietlott Power 6/55. Ứng dụng dùng nhiều cách mô phỏng và phân tích A/B/C/L để người dùng đối chiếu trên cùng một kỳ quay."}},
    {"@type":"Question","name":"PowerAI có dự đoán chắc chắn kết quả Power 6/55 không?","acceptedAnswer":{"@type":"Answer","text":"Không. Kết quả xổ số là ngẫu nhiên. Điểm A/B/C/L là điểm nội bộ phục vụ mô phỏng, xếp hạng và nghiên cứu dữ liệu, không phải xác suất trúng thưởng."}},
    {"@type":"Question","name":"Jackpot 2 trong Power 6/55 được chấm thế nào?","acceptedAnswer":{"@type":"Answer","text":"PowerAI tách 6 số chính và số đặc biệt. Một vé được ghi nhận Jackpot 2 khi trùng 5 trong 6 số chính và đồng thời có số đặc biệt theo dữ liệu kết quả của kỳ quay."}},
    {"@type":"Question","name":"A, B, C và L trong PowerAI khác nhau thế nào?","acceptedAnswer":{"@type":"Answer","text":"A tập trung vào cấu trúc mô phỏng; B dùng tín hiệu lịch sử; C giữ khung cấu trúc và kết hợp dữ liệu lịch sử; L là nhánh Learning thử nghiệm dựa trên các kỳ đã được khóa và đối chiếu."}}
  ]
}
</script>`;
  if (!html.includes('"@type":"FAQPage"')) html = html.replace('</head>', `${faqSchema}\n</head>`);

  const seoSection = `<section class="seoKnowledge" aria-labelledby="seoKnowledgeTitle">
  <div class="seoKnowledgeHead">
    <div class="sectionKicker">POWER 6/55 • KIẾN THỨC & THỐNG KÊ</div>
    <h2 id="seoKnowledgeTitle">Phân tích Vietlott Power 6/55 với PowerAI</h2>
    <p>PowerAI 6/55 tổng hợp dữ liệu lịch sử, mô phỏng cấu trúc vé và đối chiếu kết quả để người dùng theo dõi Power 6/55 theo cách minh bạch hơn. Công cụ không cam kết dự đoán số trúng và không coi điểm nội bộ là xác suất trúng thưởng.</p>
  </div>
  <div class="seoTopicGrid">
    <article class="seoTopicCard">
      <h3>Thống kê Power 6/55</h3>
      <p>Hệ thống theo dõi tần suất xuất hiện, khoảng cách giữa các lần xuất hiện, liên kết cặp số và nhiều cửa sổ dữ liệu lịch sử. Các chỉ số này dùng để mô tả dữ liệu đã xảy ra, không chứng minh số nào sẽ xuất hiện ở kỳ tiếp theo.</p>
    </article>
    <article class="seoTopicCard">
      <h3>Mô phỏng A / B / C / L</h3>
      <p>Bộ A tối ưu cấu trúc bằng mô phỏng; B dùng dữ liệu lịch sử; C kết hợp khung toán học với tín hiệu lịch sử; L là nhánh Learning thử nghiệm. Các bộ được tách riêng để có thể đối chiếu công bằng theo nhiều kỳ.</p>
    </article>
    <article class="seoTopicCard">
      <h3>Jackpot 1 và Jackpot 2</h3>
      <p>PowerAI đọc riêng 6 số chính và số đặc biệt. Hệ thống có thể chấm Jackpot 1, Jackpot 2 và các mức trùng khác cho các bộ đã khóa, đồng thời giữ số đặc biệt tách khỏi thống kê 6 số chính.</p>
    </article>
  </div>
  <div class="seoFaq" aria-label="Câu hỏi thường gặp về PowerAI 6/55">
    <h2>Câu hỏi thường gặp</h2>
    <details><summary>PowerAI 6/55 là gì?</summary><p>Đây là công cụ phân tích và thống kê Vietlott Power 6/55, kết hợp mô phỏng, dữ liệu lịch sử, đối chiếu A/B/C/L và theo dõi kết quả.</p></details>
    <details><summary>PowerAI có dự đoán chắc chắn số trúng không?</summary><p>Không. Xổ số là ngẫu nhiên. Điểm số của PowerAI chỉ dùng để nghiên cứu, xếp hạng và so sánh các phương pháp trên dữ liệu quan sát được.</p></details>
    <details><summary>Jackpot 2 được chấm thế nào?</summary><p>PowerAI ghi nhận Jackpot 2 khi một vé trùng 5 trong 6 số chính và đồng thời có số đặc biệt của kỳ quay. Số đặc biệt được lưu và hiển thị riêng.</p></details>
    <details><summary>Vì sao cần khóa bộ số trước kỳ quay?</summary><p>Khóa trước kỳ quay giúp phân biệt đánh giá prospective với việc dựng lại sau khi đã biết kết quả. Những kỳ replay chỉ dùng để tham khảo và không được tính như dự đoán trước kỳ.</p></details>
  </div>
</section>\n`;
  if (!html.includes('id="seoKnowledgeTitle"')) html = html.replace('<section class="footerNote">', `${seoSection}<section class="footerNote">`);
  html = html.replace(
    '<b>PowerAI 6/55</b> là công cụ nghiên cứu và phân tích Vietlott Power 6/55, gồm mô phỏng cấu trúc vé, thống kê dữ liệu lịch sử, đối chiếu A/B/C/L và theo dõi kết quả. Điểm số trong ứng dụng là điểm nội bộ phục vụ so sánh, không phải xác suất trúng thưởng.',
    '<b>PowerAI 6/55</b> là công cụ nghiên cứu, phân tích và thống kê Vietlott Power 6/55, gồm mô phỏng cấu trúc vé, dữ liệu lịch sử, đối chiếu A/B/C/L, số đặc biệt và chấm Jackpot 1/2. Điểm số trong ứng dụng là điểm nội bộ phục vụ so sánh, không phải xác suất trúng thưởng.'
  );
  writeFileSync(path, html);
}

function patchStyle() {
  const path = join('dist', 'style.css');
  let css = readFileSync(path, 'utf8');
  css += `\n/* RC8.8 Jackpot 2 + SEO content */\n.jp2Special{display:inline-flex;align-items:center;gap:7px;margin-left:10px;padding:5px 9px;border:1px solid rgba(255,201,107,.45);border-radius:999px;background:rgba(255,201,107,.10);vertical-align:middle}.jp2Special span{font-size:11px;opacity:.78;text-transform:uppercase;letter-spacing:.04em}.jp2Special b{display:inline-grid;place-items:center;min-width:30px;height:30px;padding:0 7px;border-radius:50%;background:#ffc96b;color:#17120a;font-weight:900}.jp2Pending{margin-left:8px;font-size:12px;opacity:.7}.compareMetric span{line-height:1.25}.seoKnowledge{margin:26px 0 14px;padding:26px;border:1px solid rgba(130,170,220,.16);border-radius:22px;background:linear-gradient(180deg,rgba(15,29,49,.72),rgba(9,18,32,.76))}.seoKnowledgeHead{max-width:900px}.seoKnowledgeHead h2,.seoFaq h2{margin:7px 0 10px}.seoKnowledgeHead p,.seoTopicCard p,.seoFaq p{line-height:1.7;color:var(--muted,#9fb0c6)}.seoTopicGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:20px}.seoTopicCard{padding:18px;border:1px solid rgba(130,170,220,.14);border-radius:16px;background:rgba(8,18,31,.62)}.seoTopicCard h3{margin:0 0 8px;font-size:16px}.seoFaq{margin-top:22px;padding-top:18px;border-top:1px solid rgba(130,170,220,.13)}.seoFaq details{border-bottom:1px solid rgba(130,170,220,.12);padding:12px 0}.seoFaq summary{cursor:pointer;font-weight:750;line-height:1.4}.seoFaq details p{margin:9px 0 2px}.seoFooter{line-height:1.65}@media(max-width:820px){.seoKnowledge{padding:19px}.seoTopicGrid{grid-template-columns:1fr}.jp2Special{margin:7px 0 0 0}}\n`;
  writeFileSync(path, css);
}

patchApp();
patchHtml();
patchStyle();

console.log(`Built ${files.length} static files into dist/ • RC8.8 SEO content + Jackpot 2 enabled`);
