/* PowerAI Track D — app integration
   Uses only prospective locks + official feed for D performance logs.
   Replay/manual results never train or create official D logs.
*/
(function(){
  'use strict';

  const D=window.PowerAIAdaptiveD;
  if(!D){console.error('Track D core missing');return}

  const LOCK_PREFIX='powerai_rc6_d_lock_';
  const LOG_KEY='powerai_rc6_d_logs';
  const STATE_KEY='powerai_rc6_d_state';
  let currentModel=null,currentPortfolio=null,refreshTimer=null,perfPatched=false;

  const el=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt=x=>Number.isFinite(Number(x))?Number(x).toFixed(3):'—';
  const dLockKey=id=>LOCK_PREFIX+Number(id);

  function readJSON(key,fallback){try{const x=JSON.parse(localStorage.getItem(key)||'null');return x??fallback}catch{return fallback}}
  function writeJSON(key,val){localStorage.setItem(key,JSON.stringify(val));try{cloudSyncSoon()}catch{}}
  function dState(){return D.newResearchState(readJSON(STATE_KEY,{}))}
  function saveDState(s){writeJSON(STATE_KEY,D.newResearchState(s))}
  function dLogs(){const x=readJSON(LOG_KEY,[]);return Array.isArray(x)?x.filter(Boolean).sort((a,b)=>Number(a.targetId)-Number(b.targetId)):[]}
  function saveDLogs(rows){writeJSON(LOG_KEY,rows.slice(-300))}
  function getDLock(id){return readJSON(dLockKey(id),null)}
  function allDLocks(){const out=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(LOCK_PREFIX)){const x=readJSON(k,null);if(x)out.push(x)}}return out.sort((a,b)=>Number(a.targetId)-Number(b.targetId))}
  function officialDraw(id){try{return (draws||[]).find(x=>Number(x.id)===Number(id))||null}catch{return null}}
  function actualForTarget(id){const d=officialDraw(id);return d?nums(d):[]}
  function specialForTarget(id){const d=officialDraw(id);return d?specialNum(d):null}
  function hasAnyKnownResult(id){
    if(officialDraw(id))return true;
    try{const l=getLog(Number(id));return Array.isArray(l?.actual)&&l.actual.length===6}catch{return false}
  }
  function loggedIn(){return !document.body.classList.contains('guestMode')}

  function ensureUI(){
    if(el('adaptiveDTab'))return;
    const choose=document.querySelector('[data-main-pane="choose"]');
    const tabs=choose?.querySelector('.trackTabs')||document.querySelector('.trackTabs');
    if(!choose||!tabs)return;

    const btn=document.createElement('button');
    btn.className='tab trackDTabBtn';btn.dataset.tab='adaptiveDTab';btn.type='button';btn.textContent='D • Adaptive';
    btn.onclick=()=>{try{activateTrack('adaptiveDTab')}catch{};scheduleRefresh(0)};
    tabs.appendChild(btn);

    const pane=document.createElement('div');
    pane.id='adaptiveDTab';pane.className='tabPane adaptiveDPane';
    pane.innerHTML=`
      <section class="panel dHero">
        <div class="head">
          <div><div class="sectionKicker dText">D • ADAPTIVE RESEARCH ENGINE</div><h2>🧬 Bộ D — Engine thích nghi</h2><p>D1–D4 chạy đa cửa sổ, tạo riêng 20 vé D và chỉ ghi nhận hiệu suất khi bộ đã khóa trước kết quả chính thức.</p></div>
          <div class="actions"><button id="dRebuildBtn">Tạo lại D</button><button id="dCopyBtn" disabled>Sao chép 20 vé D</button><button id="dLockBtn" class="primary" disabled>🔒 Khóa bộ D</button></div>
        </div>
        <div id="dContext" class="trackContext"></div>
        <div class="dStatusGrid">
          <div class="dStat"><span>Engine</span><b id="dEngine">—</b><small id="dModelHash">—</small></div>
          <div class="dStat"><span>Trạng thái</span><b id="dState">—</b><small id="dStateNote">—</small></div>
          <div class="dStat"><span>Confidence</span><b id="dConfidence">—</b><small id="dDisagreement">—</small></div>
          <div class="dStat"><span>Official log</span><b id="dOfficialCount">0</b><small>prospective + feed</small></div>
        </div>
      </section>

      <section class="panel">
        <div class="head"><div><div class="sectionKicker dText">D1 / D2 / D3 / D4</div><h2>🧠 Expert & đa cửa sổ</h2></div></div>
        <div id="dWeights" class="dExpertGrid"></div>
        <div class="analyticsGrid">
          <div class="analyticsCard"><h3>🎯 Tín hiệu tổng hợp</h3><div id="dTopSignals" class="chips"></div></div>
          <div class="analyticsCard"><h3>🛡 Độ ổn định</h3><div id="dStableSignals" class="chips"></div></div>
          <div class="analyticsCard"><h3>📐 Portfolio audit</h3><div id="dAudit" class="dAudit"></div></div>
          <div class="analyticsCard"><h3>🧪 Matched-null</h3><div id="dNullStatus" class="dAudit"></div></div>
        </div>
      </section>

      <section class="panel dTicketsPanel">
        <div class="head"><div><div class="sectionKicker dText">20 VÉ D</div><h2>🎟 Portfolio D</h2><p id="dPortfolioNote">Đang dựng model...</p></div></div>
        <div id="dTickets" class="ticketGrid"></div>
      </section>

      <section class="panel">
        <div class="head"><div><div class="sectionKicker">D PERFORMANCE</div><h2>📈 Official history</h2><p>Chỉ các bộ D đã khóa trước kỳ quay và được feed chính thức xác nhận.</p></div></div>
        <div id="dHistory" class="dHistory"></div>
      </section>`;
    choose.appendChild(pane);

    el('dRebuildBtn').onclick=()=>refreshD({force:true});
    el('dCopyBtn').onclick=copyD;
    el('dLockBtn').onclick=lockD;
    ensurePerformanceD();
  }

  function topChips(arr,valueFn,labelFn,count=12){
    return arr.slice(0,count).map(n=>`<span class="chip"><b>${String(n).padStart(2,'0')}</b><small>${esc(labelFn?labelFn(n):valueFn(n).toFixed(3))}</small></span>`).join('');
  }

  function currentDisplayPortfolio(){
    const lock=getDLock(targetId);
    if(lock?.tickets?.length===20)return{tickets:lock.tickets,ranked:lock.tickets.map((a,i)=>({rank:i+1,a,score:null})),audit:lock.audit||D.auditPortfolio(lock.tickets),hash:lock.portfolioHash||D.hashPortfolio(lock.tickets),locked:true,lock};
    return currentPortfolio?{...currentPortfolio,locked:false}:null;
  }

  function renderTickets(){
    const box=el('dTickets'),p=currentDisplayPortfolio();if(!box)return;
    if(!p?.tickets?.length){box.innerHTML='<div class="notice">Chưa dựng được portfolio D.</div>';return}
    const actual=actualForTarget(targetId),sp=specialForTarget(targetId);
    box.innerHTML=p.tickets.map((a,i)=>`<div class="ticket dTicket"><div class="ticketTop"><b>VÉ D${String(i+1).padStart(2,'0')}</b><span>${p.locked?'ĐÃ KHÓA':'candidate'}</span></div><div class="balls">${typeof ballsPrize==='function'?ballsPrize(a,actual,sp):a.map(n=>`<span class="ball">${String(n).padStart(2,'0')}</span>`).join('')}</div>${actual.length&&typeof prizeBadge==='function'?prizeBadge(a,actual,sp):''}</div>`).join('');
  }

  function renderModel(){
    if(!currentModel||!currentPortfolio)return;
    const logs=dLogs(),drift=D.evaluateDrift(logs,{lastChangeTarget:dState().lastChangeTarget}),conf=D.confidenceGate(currentModel),lock=getDLock(targetId),known=hasAnyKnownResult(targetId);
    const display=currentDisplayPortfolio(),audit=display?.audit||currentPortfolio.audit;
    el('dEngine').textContent=currentModel.engineId;
    el('dModelHash').textContent='model '+currentModel.modelHash+' • cutoff #'+String(currentModel.cutoffId).padStart(5,'0');
    el('dState').textContent=drift.state;
    el('dStateNote').textContent=drift.reason;
    el('dConfidence').textContent=conf.confidence;
    el('dDisagreement').textContent='disagreement '+fmt(conf.disagreement);
    el('dOfficialCount').textContent=String(logs.length);
    el('dContext').innerHTML=`<div class="targetMain">D • ${drawLabel(targetId)}</div><div class="targetDesc">D chỉ dùng dữ liệu trước ${drawLabel(targetId)}. Cutoff <b>#${String(currentModel.cutoffId).padStart(5,'0')}</b>.</div><span class="targetState ${lock?'locked':'ready'}">${lock?'ĐÃ KHÓA':known?'REPLAY':'CHƯA KHÓA'}</span>`;
    el('dWeights').innerHTML=['D1','D2','D3','D4'].map(k=>`<div class="dExpert"><span>${k}</span><b>${(currentModel.weights[k]*100).toFixed(1)}%</b><small>${({D1:'Residual Pair',D2:'Gap Transition',D3:'Shape Conditional',D4:'Spectral Graph'})[k]}</small></div>`).join('');
    const ranked=[...Array(D.N)].map((_,i)=>i+1).sort((a,b)=>currentModel.nodeScores[b]-currentModel.nodeScores[a]||a-b);
    const stable=[...ranked].sort((a,b)=>currentModel.stability[b]-currentModel.stability[a]||a-b);
    el('dTopSignals').innerHTML=topChips(ranked,n=>currentModel.nodeScores[n]);
    el('dStableSignals').innerHTML=topChips(stable,n=>currentModel.stability[n]);
    el('dAudit').innerHTML=`<span>Coverage <b>${audit.coverage}/55</b></span><span>Exposure <b>${audit.minExposure}–${audit.maxExposure}</b></span><span>Pair lặp <b>${audit.repeatedPairs}</b></span><span>Max overlap <b>${audit.maxOverlap}</b></span><span>Entropy <b>${audit.entropy}</b></span>`;
    const last=logs.at(-1);el('dNullStatus').innerHTML=last?.D?.null?`<span>Kỳ gần nhất <b>${drawLabel(last.targetId)}</b></span><span>Best D <b>${last.D.best}/6</b></span><span>Null mean <b>${fmt(last.D.null.bestMean)}</b></span><span>p(best) <b>${fmt(last.D.null.pBest)}</b></span>`:'<span>Chưa có kỳ D official để benchmark.</span>';
    el('dPortfolioNote').textContent=lock?'Portfolio đã khóa; hash '+(lock.portfolioHash||'—'):'Candidate deterministic • hash '+currentPortfolio.hash;
    el('dCopyBtn').disabled=!display?.tickets?.length;
    el('dLockBtn').disabled=!!lock||known||!loggedIn()||!currentPortfolio?.tickets?.length;
    el('dLockBtn').textContent=lock?'✓ D đã khóa':known?'Replay • không khóa':'🔒 Khóa bộ D';
    renderTickets();renderHistory();
  }

  function renderHistory(){
    const box=el('dHistory');if(!box)return;const rows=dLogs().slice(-12).reverse();
    if(!rows.length){box.innerHTML='<div class="notice">Chưa có log D official.</div>';return}
    box.innerHTML=rows.map(x=>`<div class="dHistoryRow"><span>${drawLabel(x.targetId)}</span><b>Best ${x.D.best}/6</b><small>Tổng hit ${x.D.total??0}</small><small>≥3: ${x.D.g3??0}</small><small>Null ${fmt(x.D?.null?.bestMean)}</small><div>${dPrizeChips(x.D)}</div></div>`).join('');
  }

  function dPrizeChips(s={}){
    const defs=[['jp1','JP1'],['jp2','JP2'],['first','Nhất'],['second','Nhì'],['third','Ba']];
    const a=defs.filter(([k])=>Number(s[k])>0).map(([k,l])=>`<span class="dPrize ${k}"><b>${s[k]}</b> ${l}</span>`);return a.length?a.join(''):'<span class="muted">—</span>';
  }

  function buildCurrent(){
    if(!Number.isFinite(Number(targetId))||!(draws||[]).length)return false;
    const state=dState();currentModel=D.buildModel(draws,Number(targetId),state);currentPortfolio=D.buildPortfolio(currentModel,{count:20,candidates:3600});return true;
  }

  function lockD(){
    try{
      if(!loggedIn())return showToast?.('Đăng nhập để khóa bộ D.','bad');
      if(hasAnyKnownResult(targetId))return showToast?.('Kỳ này đã có kết quả nên D chỉ ở chế độ Replay.','bad');
      if(getDLock(targetId))return;
      if(!currentModel||!currentPortfolio)buildCurrent();
      const conf=D.confidenceGate(currentModel),obj={version:D.VERSION,targetId:Number(targetId),cutoffId:currentModel.cutoffId,lockedAt:new Date().toISOString(),engineId:currentModel.engineId,weights:currentModel.weights,horizons:currentModel.horizons,modelHash:currentModel.modelHash,portfolioHash:currentPortfolio.hash,seed:currentPortfolio.seed,audit:currentPortfolio.audit,confidence:conf,tickets:currentPortfolio.tickets};
      writeJSON(dLockKey(targetId),obj);showToast?.(`Đã khóa bộ D cho ${drawLabel(targetId)}.`, 'good');renderModel();
    }catch(e){console.error(e);showToast?.('Không khóa được D: '+e.message,'bad')}
  }

  async function copyD(){
    const p=currentDisplayPortfolio();if(!p?.tickets?.length)return;
    const text=p.tickets.map((a,i)=>`D${String(i+1).padStart(2,'0')}: ${a.map(n=>String(n).padStart(2,'0')).join(' ')}`).join('\n');
    try{await navigator.clipboard.writeText(text);showToast?.('Đã sao chép 20 vé D.','good')}catch{showToast?.('Không sao chép được bộ D.','bad')}
  }

  function checkOfficialD(){
    const logs=dLogs(),byId=new Map(logs.map(x=>[Number(x.targetId),x]));let changed=false;
    for(const lock of allDLocks()){
      const id=Number(lock.targetId),draw=officialDraw(id);if(!draw||byId.has(id)||!Array.isArray(lock.tickets)||lock.tickets.length!==20)continue;
      const actual=nums(draw),sp=specialNum(draw);if(actual.length!==6)continue;
      const s=typeof scoreTrack==='function'?scoreTrack(lock.tickets,actual,sp):D.scorePortfolio(lock.tickets,actual);
      const nul=D.matchedNullBenchmark(lock.tickets,actual,{trials:400,seed:((id*104729)+99173)>>>0});
      const row={targetId:id,source:'feed',actual,special:sp,cutoffId:lock.cutoffId,engineId:lock.engineId,modelHash:lock.modelHash,portfolioHash:lock.portfolioHash,lockedAt:lock.lockedAt,scoredAt:new Date().toISOString(),D:{...s,null:{trials:nul.trials,bestMean:nul.bestMean,totalMean:nul.totalMean,pBest:nul.pBest,pTotal:nul.pTotal}}};
      logs.push(row);byId.set(id,row);changed=true;
    }
    if(changed){logs.sort((a,b)=>Number(a.targetId)-Number(b.targetId));saveDLogs(logs)}
    return changed;
  }

  function refreshD({force=false}={}){
    ensureUI();if(!el('adaptiveDTab'))return;
    try{
      const changed=checkOfficialD();buildCurrent();renderModel();if(changed||force)refreshPerformanceD();
    }catch(e){console.error('Track D refresh failed',e);if(el('dPortfolioNote'))el('dPortfolioNote').textContent='D chưa sẵn sàng: '+e.message}
  }
  function scheduleRefresh(ms=80){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refreshD(),ms)}

  function mergeDLogs(baseRows){
    const map=new Map((baseRows||[]).map(x=>[Number(x.targetId),{...x}]));
    for(const d of dLogs()){const id=Number(d.targetId),x=map.get(id)||{targetId:id,source:'feed'};x.D=d.D;x.dEngineId=d.engineId;x.dModelHash=d.modelHash;map.set(id,x)}
    return [...map.values()].sort((a,b)=>Number(a.targetId)-Number(b.targetId));
  }

  function ensurePerformanceD(){
    if(perfPatched)return;perfPatched=true;
    try{
      if(typeof rc97Logs==='function'){
        const baseLogs=rc97Logs;rc97Logs=function(){return mergeDLogs(baseLogs())};
      }
      if(typeof rc97ScoreForLog==='function'){
        const baseScore=rc97ScoreForLog;rc97ScoreForLog=function(log,key){return key==='D'?log?.D:baseScore(log,key)};
      }
      if(typeof rc97TrackName==='function'){
        const baseName=rc97TrackName;rc97TrackName=function(k){return k==='D'?'D • Adaptive':baseName(k)};
      }
      if(typeof rc97HighPrizeStats==='function'){
        rc97HighPrizeStats=function(logs){
          const stats=['A','B','C','L','D'].map(k=>{const s=rc97Stat(k,logs),highDraws=s.rows.filter(x=>Number(x.s.best)>=4).length,eliteDraws=s.rows.filter(x=>Number(x.s.best)>=5).length;return{...s,highDraws,eliteDraws,highRate:s.n?highDraws/s.n:0}});
          const max=Math.max(0,...stats.map(s=>s.highDraws)),leaders=max>0?stats.filter(s=>s.highDraws===max).map(s=>s.key):[];return{stats,max,leaders};
        };
      }
      if(typeof rc97Overview==='function'){
        const baseOverview=rc97Overview;rc97Overview=function(logs){
          const base=baseOverview(logs),s=rc97Stat('D',logs);
          const card=`<article class="rc97TrackCard trackD"><div class="rc97TrackHead"><b>D</b><span>Adaptive</span><em>${s.n} kỳ</em></div><div class="rc97Kpis"><div><span>Best-hit TB</span><b>${s.avgBest.toFixed(2)}</b></div><div><span>Best ≥3</span><b>${rc97Pct(s.ge3,s.n)}</b></div><div><span>Best ≥4</span><b>${rc97Pct(s.ge4,s.n)}</b></div><div><span>Best ≥5</span><b>${rc97Pct(s.ge5,s.n)}</b></div></div><div class="rc97PrizeRow">${rc97PrizeChips(s.prizes)}</div></article>`;
          return base+`<section class="dPerfAddon"><div class="rc97RecentHead"><b>Track D</b><span>prospective official</span></div><div class="rc97TrackGrid">${card}</div></section>`;
        };
      }
      const center=document.querySelector('.rc97PerformanceCenter');
      if(center&&!center.querySelector('[data-perf-tab="D"]')){
        const nav=center.querySelector('.rc97PerfTabs'),btn=document.createElement('button');btn.className='rc97PerfTab';btn.dataset.perfTab='D';btn.textContent='D';nav?.appendChild(btn);
        const pane=document.createElement('div');pane.className='rc97PerfPane';pane.dataset.perfPane='D';pane.hidden=true;pane.innerHTML='<div class="rc97Dynamic"></div>';center.appendChild(pane);
        btn.addEventListener('click',()=>rc97SetTab('D'));
      }
      if(typeof rc97SetTab==='function'){
        const baseSet=rc97SetTab;rc97SetTab=function(tab){
          if(tab!=='D')return baseSet(tab);
          rc97PerfTrack='D';document.querySelectorAll('.rc97PerfTab').forEach(b=>{const on=b.dataset.perfTab==='D';b.classList.toggle('active',on);b.setAttribute('aria-selected',on?'true':'false')});document.querySelectorAll('.rc97PerfPane').forEach(p=>p.hidden=p.dataset.perfPane!=='D');
          const logs=rc97Logs(),s=rc97Stat('D',logs),recent=s.rows.slice(-20).reverse(),pane=document.querySelector('[data-perf-pane="D"] .rc97Dynamic');
          if(pane)pane.innerHTML=`<div class="rc97TrackIntro"><div><span>D • PERFORMANCE</span><h3>D • Adaptive</h3><p>Chỉ tổng hợp portfolio D đã khóa trước kết quả và được feed chính thức xác nhận.</p></div><em>${s.n} KỲ OFFICIAL</em></div><div class="rc97MetricGrid"><div><span>Best-hit trung bình</span><b>${s.avgBest.toFixed(3)}</b></div><div><span>Best cao nhất</span><b>${s.maxBest}/6</b></div><div><span>Kỳ Best ≥3</span><b>${s.ge3} <small>(${rc97Pct(s.ge3,s.n)})</small></b></div><div><span>Kỳ Best ≥4</span><b>${s.ge4} <small>(${rc97Pct(s.ge4,s.n)})</small></b></div></div><div class="rc97TrackRows">${recent.length?recent.map(x=>`<div class="rc97TrackRow"><span>${drawLabel(x.id)}</span><b>Best ${x.s.best}/6</b><small>Tổng hit ${x.s.total??0}</small><small>≥3: ${x.s.g3??0}</small><div>${rc97PrizeChips(x.s)}</div></div>`).join(''):'<div class="notice">Chưa có log official cho D.</div>'}</div>`;
          try{localStorage.setItem('powerai_rc97_perf_tab','D')}catch{}
        };
      }
      const head=document.querySelector('.rc97PerfHead h2');if(head)head.textContent='📈 Hiệu suất A / B / C / L / D';
    }catch(e){console.error('Track D performance integration failed',e)}
  }

  function refreshPerformanceD(){
    ensurePerformanceD();try{if(typeof rc97SetTab==='function'&&typeof rc97PerfTrack!=='undefined')rc97SetTab(rc97PerfTrack)}catch(e){console.error(e)}
  }

  // Follow target changes without modifying A/B/C/L engines.
  try{
    const baseSetTargetD=setTarget;
    setTarget=async function(id){const r=await baseSetTargetD(id);scheduleRefresh(20);return r};
  }catch(e){console.error('Track D target hook failed',e)}

  window.addEventListener('powerai-auth-changed',()=>scheduleRefresh(120));
  document.getElementById('refreshBtn')?.addEventListener('click',()=>scheduleRefresh(1500));
  window.addEventListener('load',()=>{ensureUI();scheduleRefresh(100);setTimeout(()=>scheduleRefresh(1800),1800)},{once:true});
  ensureUI();scheduleRefresh(250);

  window.PowerAIAdaptiveDApp={refresh:refreshD,getLogs:dLogs,getLock:getDLock,getState:dState,saveState:saveDState};
})();
