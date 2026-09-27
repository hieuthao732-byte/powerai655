(() => {
'use strict';

const DATA_URL='https://raw.githubusercontent.com/vietvudanh/vietlott-data/master/data/power645.jsonl';
const NS='megaai645_v1_';
const TOTAL_COMBOS=8145060;
const DEFAULT_PRIZES={first:10000000,second:300000,third:30000};
const $=id=>document.getElementById(id);
let draws=[],latest=null,targetId=null,model=null,trackA=[],trackB=[],trackC=[];

function seeded(seed){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296}}
function hashText(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function pad(n){return String(n).padStart(2,'0')}
function drawLabel(id){return '#'+String(id).padStart(5,'0')}
function validNums(a){const v=(a||[]).map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=45);return v.length===6&&new Set(v).size===6?v.sort((a,b)=>a-b):[]}
function overlap(a,b){const s=new Set(a);let n=0;for(const x of b)if(s.has(x))n++;return n}
function hits(a,b){return overlap(a,b)}
function pairKey(a,b){return a<b?`${a}-${b}`:`${b}-${a}`}
function choose2Pairs(a){const out=[];for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)out.push([a[i],a[j]]);return out}
function mean(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0}
function fmtMoney(v){const n=Number(v)||0;if(Math.abs(n)>=1e9)return(n/1e9).toLocaleString('vi-VN',{maximumFractionDigits:3})+' tỷ';if(Math.abs(n)>=1e6)return(n/1e6).toLocaleString('vi-VN',{maximumFractionDigits:2})+' triệu';return Math.round(n).toLocaleString('vi-VN')+' đ'}
function fmtDate(s){if(!s)return'—';const p=String(s).split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:s}
function status(text,bad=false){const el=$('megaStatus');if(!el)return;el.innerHTML=`<i class="statusDot"></i>${text}`;if(bad)el.style.borderColor='rgba(255,120,140,.45)'}

async function loadData(){
  status('Đang tải dữ liệu...');
  const res=await fetch(DATA_URL,{cache:'no-store'});if(!res.ok)throw new Error('Không tải được feed Mega 6/45');
  const text=await res.text();
  const rows=[];
  for(const line of text.split(/\r?\n/)){
    if(!line.trim())continue;
    try{const d=JSON.parse(line);const a=validNums(d.result);const id=Number(d.id);if(a.length===6&&Number.isFinite(id))rows.push({...d,id,result:a})}catch{}
  }
  rows.sort((a,b)=>a.id-b.id);if(!rows.length)throw new Error('Feed Mega không có dữ liệu hợp lệ');
  draws=rows;latest=rows.at(-1);
  const stored=Number(localStorage.getItem(NS+'target'));
  targetId=Number.isFinite(stored)&&stored>=rows[0].id&&stored<=latest.id+1?stored:latest.id+1;
  renderTargetSelect();await rebuild();status(`Feed OK • ${draws.length.toLocaleString('vi-VN')} kỳ`);
}

function historyBefore(id){return draws.filter(d=>d.id<Number(id))}
function resultFor(id){return draws.find(d=>d.id===Number(id))||null}
function isReplay(){return !!resultFor(targetId)}

function renderTargetSelect(){
  const sel=$('megaTargetSelect');if(!sel)return;
  const recent=draws.slice(-36).reverse();
  const options=[`<option value="${latest.id+1}">${drawLabel(latest.id+1)} • kỳ tiếp theo</option>`];
  for(const d of recent)options.push(`<option value="${d.id}">${drawLabel(d.id)} • ${fmtDate(d.date)} • Replay</option>`);
  sel.innerHTML=options.join('');sel.value=String(targetId);
}

function frequency(ds,n){const f=Array(46).fill(0);for(const d of ds.slice(-n))for(const x of d.result)f[x]++;return f}
function gapStats(ds){
  const last=Array(46).fill(-1),g=Array(46).fill(ds.length);
  for(let i=0;i<ds.length;i++)for(const x of ds[i].result)last[x]=i;
  for(let n=1;n<=45;n++)g[n]=last[n]<0?ds.length:ds.length-1-last[n];
  return g;
}
function minmax(arr){const vals=arr.slice(1),lo=Math.min(...vals),hi=Math.max(...vals);return arr.map((v,i)=>i===0?0:(hi===lo?.5:(v-lo)/(hi-lo)))}

function buildModel(ds){
  const f30=frequency(ds,30),f120=frequency(ds,120),gap=gapStats(ds);
  const n30=minmax(f30),n120=minmax(f120),ngap=minmax(gap.map((x,i)=>i===0?0:Math.min(x,40)));
  const raw=Array(46).fill(0);for(let n=1;n<=45;n++)raw[n]=.42*n30[n]+.30*n120[n]+.28*ngap[n];
  const numScore=minmax(raw);
  const pair=new Map();
  for(const d of ds.slice(-120))for(const [a,b] of choose2Pairs(d.result)){const k=pairKey(a,b);pair.set(k,(pair.get(k)||0)+1)}
  const pairMax=Math.max(1,...pair.values());
  return{f30,f120,gap,numScore,pair,pairMax,cutoff:ds.at(-1)?.id||null,n:ds.length};
}

function balancedPortfolio(id,tripleNums){
  const desired=Array(46).fill(2);for(const n of tripleNums)desired[n]=3;
  let best=null,bestCost=Infinity;
  for(let attempt=0;attempt<90;attempt++){
    const rnd=seeded(hashText(`mega-balanced-${id}-${attempt}-${[...tripleNums].join(',')}`));
    const tickets=Array.from({length:20},()=>[]),pairCount=new Map();let failed=false;
    const nums=[...Array(45)].map((_,i)=>i+1).sort((a,b)=>desired[b]-desired[a]||(rnd()-.5));
    for(const n of nums){
      const used=new Set();
      for(let rep=0;rep<desired[n];rep++){
        const cand=[];
        for(let t=0;t<20;t++){
          if(used.has(t)||tickets[t].length>=6)continue;
          let pairPenalty=0;for(const m of tickets[t])pairPenalty+=pairCount.get(pairKey(n,m))||0;
          const sizePenalty=tickets[t].length*100;
          const overlapPenalty=tickets[t].reduce((s,m)=>s+(desired[m]===3?0.2:0),0);
          cand.push({t,cost:sizePenalty+pairPenalty*24+overlapPenalty+rnd()*4});
        }
        if(!cand.length){failed=true;break}
        cand.sort((a,b)=>a.cost-b.cost);const pick=cand[0].t;used.add(pick);
        for(const m of tickets[pick]){const k=pairKey(n,m);pairCount.set(k,(pairCount.get(k)||0)+1)}
        tickets[pick].push(n);
      }
      if(failed)break;
    }
    if(failed||tickets.some(t=>t.length!==6))continue;
    tickets.forEach(t=>t.sort((a,b)=>a-b));
    let repeatedPairs=0,maxPairUse=0;for(const c of pairCount.values()){if(c>1)repeatedPairs+=c-1;maxPairUse=Math.max(maxPairUse,c)}
    let maxOv=0;for(let i=0;i<20;i++)for(let j=i+1;j<20;j++)maxOv=Math.max(maxOv,overlap(tickets[i],tickets[j]));
    const cost=repeatedPairs*100+maxPairUse*30+maxOv*8;
    if(cost<bestCost){bestCost=cost;best={tickets,repeatedPairs,maxPairUse,maxOv,desired};if(repeatedPairs===0&&maxOv<=2)break}
  }
  if(!best)throw new Error('Không dựng được portfolio cân bằng Mega');
  return best;
}

function structureScore(a){
  const odd=a.filter(n=>n%2).length,small=a.filter(n=>n<=22).length,sum=a.reduce((x,y)=>x+y,0);
  return .4*(1-Math.min(1,Math.abs(odd-3)/3))+.3*(1-Math.min(1,Math.abs(small-3)/3))+.3*(1-Math.min(1,Math.abs(sum-138)/95));
}
function ticketHistoryScore(a,m){
  const ns=mean(a.map(n=>m.numScore[n]));let ps=0;for(const [x,y] of choose2Pairs(a))ps+=(m.pair.get(pairKey(x,y))||0)/m.pairMax;ps/=15;
  return .58*ns+.22*ps+.20*structureScore(a);
}
function weightedPick(rnd,m){
  const pool=[...Array(45)].map((_,i)=>i+1),out=[];
  while(out.length<6){
    const weights=pool.map(n=>.3+Math.pow(m.numScore[n],1.35)*1.7),total=weights.reduce((a,b)=>a+b,0);let z=rnd()*total,idx=0;
    for(;idx<pool.length-1;idx++){z-=weights[idx];if(z<=0)break}
    out.push(pool[idx]);pool.splice(idx,1);
  }
  return out.sort((a,b)=>a-b);
}
function buildHistoricalPortfolio(id,m){
  const rnd=seeded(hashText('mega-B-'+id)),map=new Map();
  for(let i=0;i<18000;i++){const a=weightedPick(rnd,m),k=a.join('-');if(!map.has(k))map.set(k,{a,raw:ticketHistoryScore(a,m)})}
  const rows=[...map.values()].sort((a,b)=>b.raw-a.raw);const hi=rows[0]?.raw||1,lo=rows[Math.min(rows.length-1,5000)]?.raw||0;
  rows.forEach(r=>r.score=hi===lo?50:100*(r.raw-lo)/(hi-lo));
  const selected=[],exp=Array(46).fill(0);
  for(const r of rows){
    if(selected.length>=20)break;
    const maxOv=selected.length?Math.max(...selected.map(x=>overlap(x.a,r.a))):0;
    if(maxOv>3)continue;
    if(r.a.some(n=>exp[n]>=5))continue;
    selected.push(r);r.a.forEach(n=>exp[n]++);
  }
  if(selected.length<20)for(const r of rows){if(selected.length>=20)break;if(selected.includes(r))continue;selected.push(r)}
  return selected.slice(0,20);
}

function buildTracks(){
  const ds=historyBefore(targetId);model=buildModel(ds);
  const nums=[...Array(45)].map((_,i)=>i+1);
  const rnd=seeded(hashText('mega-A-triples-'+targetId));
  const shuffled=nums.slice().sort(()=>rnd()-.5),aTriple=new Set(shuffled.slice(0,30));
  const A=balancedPortfolio(targetId,aTriple);trackA=A.tickets.map((a,i)=>({a,score:null,rank:i+1}));trackA.audit=A;
  trackB=buildHistoricalPortfolio(targetId,model).map((x,i)=>({...x,rank:i+1}));
  const cTriple=new Set(nums.slice().sort((a,b)=>model.numScore[b]-model.numScore[a]||a-b).slice(0,30));
  const C=balancedPortfolio(targetId,cTriple);trackC=C.tickets.map(a=>({a,raw:ticketHistoryScore(a,model)}));trackC.sort((a,b)=>b.raw-a.raw);const cHi=trackC[0]?.raw||1,cLo=trackC.at(-1)?.raw||0;trackC.forEach((x,i)=>{x.rank=i+1;x.score=cHi===cLo?50:100*(x.raw-cLo)/(cHi-cLo)});trackC.audit=C;
}

function prize(a,actual){const h=hits(a,actual);return{hits:h,jackpot:h===6,first:h===5,second:h===4,third:h===3}}
function prizeLabel(p){if(p.jackpot)return'JACKPOT';if(p.first)return'GIẢI NHẤT';if(p.second)return'GIẢI NHÌ';if(p.third)return'GIẢI BA';return''}
function balls(a,actual=[]){const s=new Set(actual);return a.map(n=>`<span class="ball ${s.has(n)?'hit':''}">${pad(n)}</span>`).join('')}
function renderTickets(id,rows){
  const el=$(id);if(!el)return;const actual=resultFor(targetId)?.result||[];
  el.innerHTML=rows.map((r,i)=>{const p=actual.length?prize(r.a,actual):null;return`<article class="ticket"><div class="ticketTop"><b>${id.includes('A')?'A':id.includes('B')?'B':'C'}${String(i+1).padStart(2,'0')}</b><span class="megaRank">#${r.rank||i+1}</span></div><div class="balls">${balls(r.a,actual)}</div>${r.score==null?'':`<div class="megaScore">Điểm nội bộ <b>${Math.max(0,Math.min(100,r.score)).toFixed(1)}</b>/100</div>`}${p&&prizeLabel(p)?`<div class="megaScore"><b>${prizeLabel(p)}</b> • ${p.hits}/6</div>`:p?`<div class="megaScore">Hit ${p.hits}/6</div>`:''}</article>`}).join('');
}
function trackPrizeStats(rows,actual){const s={jackpot:0,first:0,second:0,third:0,best:0,total:0};for(const r of rows){const p=prize(r.a,actual);s.best=Math.max(s.best,p.hits);s.total+=p.hits;for(const k of ['jackpot','first','second','third'])if(p[k])s[k]++}return s}

function renderCore(){
  $('megaLatestId').textContent=drawLabel(latest.id);$('megaLatestDate').textContent=fmtDate(latest.date);$('megaTargetId').textContent=drawLabel(targetId);
  const replay=resultFor(targetId);$('megaTargetMode').textContent=replay?'Replay • kết quả đã biết':'Prospective • chưa có kết quả';$('megaCutoffId').textContent=model.cutoff?drawLabel(model.cutoff):'—';
  const a=trackA.audit;$('megaAAudit').innerHTML=[['Coverage','45/45'],['Exposure','2–3'],['Pair lặp',a.repeatedPairs],['Max overlap',a.maxOv]].map(([x,y])=>`<div class="metric"><span>${x}</span><b>${y}</b></div>`).join('');
  $('megaBMeta').innerHTML=`<div class="megaMetaChips"><span>${model.n.toLocaleString('vi-VN')} kỳ trước target</span><span>Freq 30/120</span><span>Gap</span><span>Pair 120</span><span>Anti-leak id &lt; target</span></div>`;
  $('megaCMeta').innerHTML=`<div class="megaMetaChips"><span>30 số signal cao ×3</span><span>15 số còn lại ×2</span><span>Exposure tổng = 120</span><span>Không có bóng đặc biệt</span></div>`;
  renderTickets('megaATickets',trackA);renderTickets('megaBTickets',trackB);renderTickets('megaCTickets',trackC);renderResult();renderIntel();
}
function renderResult(){
  const d=resultFor(targetId),box=$('megaOfficialResult'),sum=$('megaPrizeSummary');
  if(!d){$('megaResultTitle').textContent=`${drawLabel(targetId)} • chưa có kết quả`;box.innerHTML='<span class="megaResultLabel">Prospective</span><span class="muted">Các bộ số đang được tạo chỉ từ dữ liệu trước kỳ mục tiêu.</span>';sum.innerHTML='';return}
  $('megaResultTitle').textContent=`${drawLabel(targetId)} • ${fmtDate(d.date)}`;box.innerHTML=`<span class="megaResultLabel">KẾT QUẢ</span><div class="balls bigBalls">${balls(d.result,[])}</div>`;
  const defs=[['A','Cấu trúc',trackA],['B','Lịch sử',trackB],['C','Kết hợp',trackC]];
  sum.innerHTML=defs.map(([k,name,rows])=>{const s=trackPrizeStats(rows,d.result);return`<div class="megaPrizeCard"><strong>${k} • ${name}</strong><span>Best hit: <b>${s.best}/6</b> • Tổng hit: <b>${s.total}</b></span><span>Jackpot ${s.jackpot} • Nhất ${s.first} • Nhì ${s.second} • Ba ${s.third}</span></div>`}).join('');
}

function renderIntel(){
  const nums=[...Array(45)].map((_,i)=>i+1),hot=nums.slice().sort((a,b)=>model.f30[b]-model.f30[a]||a-b).slice(0,10),over=nums.slice().sort((a,b)=>model.gap[b]-model.gap[a]||a-b).slice(0,10);
  $('megaHotNums').textContent=hot.map(pad).join(' • ');$('megaOverdueNums').textContent=over.map(pad).join(' • ');
  $('megaNumberGrid').innerHTML=nums.map(n=>`<button class="megaNumBtn" data-num="${n}"><b>${pad(n)}</b><small>F30 ${model.f30[n]} • G ${model.gap[n]}</small></button>`).join('');
  document.querySelectorAll('.megaNumBtn').forEach(b=>b.onclick=()=>showNum(Number(b.dataset.num),b));
}
function showNum(n,btn){document.querySelectorAll('.megaNumBtn').forEach(x=>x.classList.remove('active'));btn.classList.add('active');const rank=[...Array(45)].map((_,i)=>i+1).sort((a,b)=>model.numScore[b]-model.numScore[a]).indexOf(n)+1;$('megaNumberDetail').innerHTML=`<b>Số ${pad(n)}</b> • Frequency 30 kỳ: <b>${model.f30[n]}</b> • Frequency 120 kỳ: <b>${model.f120[n]}</b> • Gap hiện tại: <b>${model.gap[n]}</b> kỳ • Signal B: <b>${(model.numScore[n]*100).toFixed(1)}/100</b> • hạng mô tả <b>${rank}/45</b>. Signal này không phải xác suất xuất hiện ở kỳ tiếp theo.`}

function renderEconomics(){
  const jackpot=Math.max(0,Number($('megaJackpotInput').value)||0)*1e9,price=Math.max(1,Number($('megaTicketPrice').value)||10000),others=Math.max(0,Math.floor(Number($('megaOtherWinners').value)||0));
  const cost=TOTAL_COMBOS*price,lower=234*DEFAULT_PRIZES.first+11115*DEFAULT_PRIZES.second+182780*DEFAULT_PRIZES.third,share=jackpot/(others+1),gross=share+lower,net=gross-cost,breakEven=(Math.max(0,cost-lower))*(others+1);
  const cards=[['Chi phí phủ 100%',fmtMoney(cost),''],['Giải phụ cố định',fmtMoney(lower),''],['Jackpot phần của bạn',fmtMoney(share),''],['Chênh lệch trước thuế',fmtMoney(net),net>=0?'good':'bad'],['Hòa vốn Jackpot',fmtMoney(breakEven),''],['Tổng tổ hợp',TOTAL_COMBOS.toLocaleString('vi-VN'),''],['5/6 chắc chắn','234 vé',''],['4/6 + 3/6','11.115 + 182.780 vé','']];
  $('megaEconomicsCards').innerHTML=cards.map(([a,b,c])=>`<div class="megaEconCard ${c}"><span>${a}</span><b>${b}</b></div>`).join('');
}

async function rebuild(){
  localStorage.setItem(NS+'target',String(targetId));
  buildTracks();renderCore();renderEconomics();
}

function wire(){
  $('megaTargetSelect').onchange=async e=>{targetId=Number(e.target.value);await rebuild()};
  $('megaReloadBtn').onclick=()=>loadData().catch(e=>{console.error(e);status('Lỗi dữ liệu',true)});
  document.querySelectorAll('.megaNavBtn').forEach(b=>b.onclick=()=>{document.querySelectorAll('.megaNavBtn').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.megaView').forEach(x=>x.classList.toggle('active',x.dataset.pane===b.dataset.view))});
  document.querySelectorAll('.megaTrackBtn').forEach(b=>b.onclick=()=>{document.querySelectorAll('.megaTrackBtn').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.megaTrackPane').forEach(x=>x.classList.toggle('active',x.dataset.trackPane===b.dataset.track))});
  for(const id of ['megaJackpotInput','megaTicketPrice','megaOtherWinners'])$(id).addEventListener('input',renderEconomics);
}

wire();loadData().catch(e=>{console.error(e);status('Lỗi dữ liệu',true);$('megaResultTitle').textContent=e.message});
})();
