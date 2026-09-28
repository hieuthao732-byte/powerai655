/* PowerAI Track D — app integration
   Uses only prospective locks + official feed for D performance logs.
   Replay/manual results never train or create official D logs.
*/
(function(){
  'use strict';

  const D=window.PowerAIAdaptiveD;
  if(!D){console.error('Track D core missing');return}

  const INTEGRITY_VERSION='D-INTEGRITY-1';
  const GENERATOR_CONFIG={count:20,candidates:3600,maxExposure:4};

  function verifyLockIntegrity(lock){
    const checks={ticketShape:false,portfolioHash:false,audit:false,cutoff:false,modelHash:false,rebuild:false};
    try{
      const target=Number(lock?.targetId),tickets=Array.isArray(lock?.tickets)?lock.tickets:[];
      checks.ticketShape=Number.isFinite(target)&&tickets.length===20&&tickets.every(t=>Array.isArray(t)&&t.length===6&&new Set(t).size===6&&t.every(n=>Number.isInteger(Number(n))&&Number(n)>=1&&Number(n)<=D.N));
      if(!checks.ticketShape)throw new Error('ticket-shape');
      checks.portfolioHash=typeof lock?.portfolioHash==='string'&&D.hashPortfolio(tickets)===lock.portfolioHash;
      const audit=D.auditPortfolio(tickets),saved=lock?.audit;
      checks.audit=!saved||['tickets','coverage','minExposure','maxExposure','repeatedPairs','maxOverlap','entropy'].every(k=>Number(saved[k])===Number(audit[k]));
      const model=D.buildModel(draws,target,{engineId:lock.engineId,weights:lock.weights,horizons:lock.horizons});
      checks.cutoff=Number(model.cutoffId)===Number(lock.cutoffId)&&Number(model.cutoffId)<target;
      checks.modelHash=String(model.modelHash)===String(lock.modelHash);
      const g={...GENERATOR_CONFIG,...(lock.generator||{})},seed=Number(lock.seed);
      if(Number.isFinite(seed)){
        const rebuilt=D.buildPortfolio(model,{count:Number(g.count)||20,candidates:Number(g.candidates)||3600,maxExposure:Number(g.maxExposure)||4,seed});
        checks.rebuild=rebuilt.tickets.length===20&&rebuilt.hash===lock.portfolioHash;
      }
      const failed=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k),ok=failed.length===0;
      return{version:INTEGRITY_VERSION,ok,status:ok?'VERIFIED':'INVALID',checkedAt:new Date().toISOString(),checks,reason:ok?'Snapshot dựng lại khớp hoàn toàn.':'Sai kiểm tra: '+failed.join(', ')};
    }catch(e){
      return{version:INTEGRITY_VERSION,ok:false,status:'INVALID',checkedAt:new Date().toISOString(),checks,reason:'Không dựng lại được snapshot: '+String(e?.message||e)};
    }
  }

  const LOCK_PREFIX='powerai_rc6_d_lock_';
  const LOG_KEY='powerai_rc6_d_logs';
  const STATE_KEY='powerai_rc6_d_state';
  let currentModel=null,currentPortfolio=null,refreshTimer=null,perfPatched=false;

  const el=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt=x=>Number.isFinite(Number(x))?Number(x).toFixed(3):'—';
  function dStateLabel(x){return ({STABLE:'ỔN ĐỊNH',WARMUP:'ĐANG TÍCH LŨY DỮ LIỆU',DRIFT:'HIỆU SUẤT ĐANG YẾU',COOLDOWN:'ĐANG CHỜ THÊM KỲ',CHALLENGER_TEST:'ĐANG THỬ CÁCH MỚI'})[String(x)]||String(x||'—')}
  function dConfidenceLabel(x){return ({HIGH:'TÍN HIỆU KHÁ ĐỒNG THUẬN',MEDIUM:'TÍN HIỆU TẠM ỔN',LOW:'TÍN HIỆU CHƯA RÕ',LOW_CONFIDENCE:'TÍN HIỆU CHƯA RÕ'})[String(x)]||String(x||'—')}
  function dIntegrityLabel(x){return ({VERIFIED:'HỢP LỆ',INVALID:'KHÔNG HỢP LỆ',CANDIDATE:'CHƯA KHÓA','CHỜ KIỂM TRA':'CHỜ KIỂM TRA'})[String(x)]||String(x||'—')}
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
    btn.className='tab trackDTabBtn';btn.dataset.tab='adaptiveDTab';btn.type='button';btn.textContent='D • Tự điều chỉnh';
    btn.onclick=()=>{try{activateTrack('adaptiveDTab')}catch{};scheduleRefresh(0)};
    tabs.appendChild(btn);

    const pane=document.createElement('div');
    pane.id='adaptiveDTab';pane.className='tabPane adaptiveDPane';
    pane.innerHTML=`
      <section class="panel dHero">
        <div class="head">
          <div><div class="sectionKicker dText">D • TỰ KIỂM TRA & TỰ ĐIỀU CHỈNH</div><h2>🧬 Bộ D — Tự kiểm tra và đổi cách chọn khi cần</h2><p>D dùng 4 cách phân tích cùng lúc, tạo riêng 20 vé và chỉ tính thành tích khi bộ đã khóa trước kết quả chính thức.</p></div>
          <div class="actions"><button id="dRebuildBtn">Tạo lại D</button><button id="dCopyBtn" disabled>Sao chép 20 vé D</button><button id="dLockBtn" class="primary" disabled>🔒 Khóa bộ D</button></div>
        </div>
        <div id="dContext" class="trackContext"></div>
        <div class="dStatusGrid">
          <div class="dStat"><span>Phiên bản D</span><b id="dEngine">—</b><small id="dModelHash">—</small><small id="dIntegrity">Kiểm tra dữ liệu —</small></div>
          <div class="dStat"><span>Trạng thái</span><b id="dState">—</b><small id="dStateNote">—</small></div>
          <div class="dStat"><span>Độ đồng thuận</span><b id="dConfidence">—</b><small id="dDisagreement">—</small></div>
          <div class="dStat"><span>Số kỳ đã kiểm chứng</span><b id="dOfficialCount">0</b><small>đã khóa trước kỳ + kết quả chính thức</small></div>
        </div>
      </section>

      <section class="panel">
        <div class="head"><div><div class="sectionKicker dText">4 CÁCH PHÂN TÍCH CỦA D</div><h2>🧠 4 cách phân tích đang phối hợp</h2></div></div>
        <div id="dWeights" class="dExpertGrid"></div>
        <div class="analyticsGrid">
          <div class="analyticsCard"><h3>🎯 Tín hiệu tổng hợp</h3><div id="dTopSignals" class="chips"></div></div>
          <div class="analyticsCard"><h3>🛡 Độ ổn định</h3><div id="dStableSignals" class="chips"></div></div>
          <div class="analyticsCard"><h3>📐 Kiểm tra độ phân tán</h3><div id="dAudit" class="dAudit"></div></div>
          <div class="analyticsCard"><h3>🧪 So với bộ ngẫu nhiên</h3><div id="dNullStatus" class="dAudit"></div></div>
        </div>
      </section>

      <section class="panel dTicketsPanel">
        <div class="head"><div><div class="sectionKicker dText">20 VÉ D</div><h2>🎟 Bộ 20 vé D</h2><p id="dPortfolioNote">Đang tạo bộ D...</p></div></div>
        <div id="dTickets" class="ticketGrid"></div>
      </section>

      <section class="panel">
        <div class="head"><div><div class="sectionKicker">KẾT QUẢ D</div><h2>📈 Lịch sử kiểm chứng</h2><p>Chỉ tính những bộ D đã khóa trước kỳ quay và sau đó có kết quả chính thức.</p></div></div>
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
    if(!p?.tickets?.length){box.innerHTML='<div class="notice">Chưa tạo được 20 vé D.</div>';return}
    const actual=actualForTarget(targetId),sp=specialForTarget(targetId);
    box.innerHTML=p.tickets.map((a,i)=>`<div class="ticket dTicket"><div class="ticketTop"><b>VÉ D${String(i+1).padStart(2,'0')}</b><span>${p.locked?'ĐÃ KHÓA':'CHƯA KHÓA'}</span></div><div class="balls">${typeof ballsPrize==='function'?ballsPrize(a,actual,sp):a.map(n=>`<span class="ball">${String(n).padStart(2,'0')}</span>`).join('')}</div>${actual.length&&typeof prizeBadge==='function'?prizeBadge(a,actual,sp):''}</div>`).join('');
  }

  function renderModel(){
    if(!currentModel||!currentPortfolio)return;
    const logs=dLogs(),drift=D.evaluateDrift(logs,{lastChangeTarget:dState().lastChangeTarget}),conf=D.confidenceGate(currentModel),lock=getDLock(targetId),known=hasAnyKnownResult(targetId);
    const display=currentDisplayPortfolio(),audit=display?.audit||currentPortfolio.audit;
    el('dEngine').textContent=currentModel.engineId;
    el('dModelHash').textContent='mã '+currentModel.modelHash+' • dữ liệu đến #'+String(currentModel.cutoffId).padStart(5,'0');
    const integrity=lock?.integrity;
    el('dIntegrity').textContent='Kiểm tra dữ liệu '+dIntegrityLabel(integrity?.status|| (lock?'CHỜ KIỂM TRA':'CANDIDATE'));
    el('dState').textContent=dStateLabel(drift.state);
    el('dStateNote').textContent=drift.reason;
    el('dConfidence').textContent=dConfidenceLabel(conf.confidence);
    el('dDisagreement').textContent='Mức bất đồng '+fmt(conf.disagreement);
    el('dOfficialCount').textContent=String(logs.length);
    el('dContext').innerHTML=`<div class="targetMain">D • ${drawLabel(targetId)}</div><div class="targetDesc">D chỉ dùng dữ liệu trước ${drawLabel(targetId)}. Dữ liệu dùng đến <b>#${String(currentModel.cutoffId).padStart(5,'0')}</b>.</div><span class="targetState ${lock?'locked':'ready'}">${lock?'ĐÃ KHÓA':known?'XEM LẠI':'CHƯA KHÓA'}</span>`;
    el('dWeights').innerHTML=['D1','D2','D3','D4'].map(k=>`<div class="dExpert"><span>${k}</span><b>${(currentModel.weights[k]*100).toFixed(1)}%</b><small>${({D1:'Liên kết cặp số',D2:'Nhịp xuất hiện',D3:'Mẫu kỳ quay',D4:'Mạng liên kết số'})[k]}</small></div>`).join('');
    const ranked=[...Array(D.N)].map((_,i)=>i+1).sort((a,b)=>currentModel.nodeScores[b]-currentModel.nodeScores[a]||a-b);
    const stable=[...ranked].sort((a,b)=>currentModel.stability[b]-currentModel.stability[a]||a-b);
    el('dTopSignals').innerHTML=topChips(ranked,n=>currentModel.nodeScores[n]);
    el('dStableSignals').innerHTML=topChips(stable,n=>currentModel.stability[n]);
    el('dAudit').innerHTML=`<span>Số được phủ <b>${audit.coverage}/55</b></span><span>Số lần xuất hiện <b>${audit.minExposure}–${audit.maxExposure}</b></span><span>Cặp bị lặp <b>${audit.repeatedPairs}</b></span><span>Trùng tối đa giữa 2 vé <b>${audit.maxOverlap}</b></span><span>Độ phân tán <b>${audit.entropy}</b></span>`;
    const last=logs.at(-1);el('dNullStatus').innerHTML=last?.D?.null?`<span>Kỳ gần nhất <b>${drawLabel(last.targetId)}</b></span><span>Cao nhất D <b>${last.D.best}/6</b></span><span>Ngẫu nhiên trung bình <b>${fmt(last.D.null.bestMean)}</b></span><span>Tỷ lệ ngẫu nhiên đạt bằng/tốt hơn <b>${fmt(last.D.null.pBest)}</b></span>`:'<span>Chưa có kỳ D chính thức để so sánh.</span>';
    el('dPortfolioNote').textContent=lock?'Bộ 20 vé đã khóa • mã '+(lock.portfolioHash||'—'):'Bộ 20 vé chưa khóa • mã '+currentPortfolio.hash;
    el('dCopyBtn').disabled=!display?.tickets?.length;
    el('dLockBtn').disabled=!!lock||known||!loggedIn()||!currentPortfolio?.tickets?.length;
    el('dLockBtn').textContent=lock?'✓ D đã khóa':known?'Xem lại • không khóa':'🔒 Khóa bộ D';
    renderTickets();renderHistory();
  }

  function renderHistory(){
    const box=el('dHistory');if(!box)return;const rows=dLogs().slice(-12).reverse();
    if(!rows.length){box.innerHTML='<div class="notice">Chưa có kỳ D nào được kiểm chứng chính thức.</div>';return}
    box.innerHTML=rows.map(x=>`<div class="dHistoryRow"><span>${drawLabel(x.targetId)}</span><b>Cao nhất ${x.D.best}/6</b><small>Tổng hit ${x.D.total??0}</small><small>≥3: ${x.D.g3??0}</small><small>Ngẫu nhiên TB ${fmt(x.D?.null?.bestMean)}</small><div>${dPrizeChips(x.D)}</div></div>`).join('');
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
      const conf=D.confidenceGate(currentModel),obj={version:D.VERSION,targetId:Number(targetId),cutoffId:currentModel.cutoffId,lockedAt:new Date().toISOString(),engineId:currentModel.engineId,weights:currentModel.weights,horizons:currentModel.horizons,modelHash:currentModel.modelHash,portfolioHash:currentPortfolio.hash,seed:currentPortfolio.seed,generator:{...GENERATOR_CONFIG},audit:currentPortfolio.audit,confidence:conf,tickets:currentPortfolio.tickets};
      const integrity=verifyLockIntegrity(obj);
      if(!integrity.ok)return showToast?.('D không khóa vì snapshot không dựng lại khớp: '+integrity.reason,'bad');
      obj.integrity=integrity;writeJSON(dLockKey(targetId),obj);showToast?.(`Đã khóa bộ D cho ${drawLabel(targetId)} • kiểm tra dữ liệu hợp lệ.`, 'good');renderModel();
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
      const integrity=verifyLockIntegrity(lock);
      if(!integrity.ok){
        if(lock.integrity?.status!==integrity.status||lock.integrity?.reason!==integrity.reason)writeJSON(dLockKey(id),{...lock,integrity});
        console.error('Track D snapshot integrity failed',id,integrity);continue;
      }
      if(lock.integrity?.version!==INTEGRITY_VERSION||lock.integrity?.status!=='VERIFIED')writeJSON(dLockKey(id),{...lock,integrity});
      const actual=nums(draw),sp=specialNum(draw);if(actual.length!==6)continue;
      const s=typeof scoreTrack==='function'?scoreTrack(lock.tickets,actual,sp):D.scorePortfolio(lock.tickets,actual);
      const nul=D.matchedNullBenchmark(lock.tickets,actual,{trials:400,seed:((id*104729)+99173)>>>0});
      const row={targetId:id,source:'feed',actual,special:sp,cutoffId:lock.cutoffId,engineId:lock.engineId,modelHash:lock.modelHash,portfolioHash:lock.portfolioHash,integrity:{version:integrity.version,status:integrity.status,checks:integrity.checks},lockedAt:lock.lockedAt,scoredAt:new Date().toISOString(),D:{...s,null:{trials:nul.trials,bestMean:nul.bestMean,totalMean:nul.totalMean,pBest:nul.pBest,pTotal:nul.pTotal}}};
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
        const baseName=rc97TrackName;rc97TrackName=function(k){return k==='D'?'D • Tự điều chỉnh':baseName(k)};
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
          const card=`<article class="rc97TrackCard trackD"><div class="rc97TrackHead"><b>D</b><span>Tự điều chỉnh</span><em>${s.n} kỳ</em></div><div class="rc97Kpis"><div><span>Trùng cao nhất TB</span><b>${s.avgBest.toFixed(2)}</b></div><div><span>Kỳ có vé ≥3</span><b>${rc97Pct(s.ge3,s.n)}</b></div><div><span>Kỳ có vé ≥4</span><b>${rc97Pct(s.ge4,s.n)}</b></div><div><span>Kỳ có vé ≥5</span><b>${rc97Pct(s.ge5,s.n)}</b></div></div><div class="rc97PrizeRow">${rc97PrizeChips(s.prizes)}</div></article>`;
          return base+`<section class="dPerfAddon"><div class="rc97RecentHead"><b>Bộ D</b><span>đã khóa trước kỳ</span></div><div class="rc97TrackGrid">${card}</div></section>`;
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
          if(pane)pane.innerHTML=`<div class="rc97TrackIntro"><div><span>D • KẾT QUẢ</span><h3>D • Tự điều chỉnh</h3><p>Chỉ tính các bộ D đã khóa trước kỳ quay và sau đó có kết quả chính thức.</p></div><em>${s.n} KỲ ĐÃ KIỂM CHỨNG</em></div><div class="rc97MetricGrid"><div><span>Trùng cao nhất trung bình</span><b>${s.avgBest.toFixed(3)}</b></div><div><span>Mức trùng cao nhất</span><b>${s.maxBest}/6</b></div><div><span>Kỳ có vé trùng ≥3</span><b>${s.ge3} <small>(${rc97Pct(s.ge3,s.n)})</small></b></div><div><span>Kỳ có vé trùng ≥4</span><b>${s.ge4} <small>(${rc97Pct(s.ge4,s.n)})</small></b></div></div><div class="rc97TrackRows">${recent.length?recent.map(x=>`<div class="rc97TrackRow"><span>${drawLabel(x.id)}</span><b>Cao nhất ${x.s.best}/6</b><small>Tổng số trùng ${x.s.total??0}</small><small>≥3: ${x.s.g3??0}</small><div>${rc97PrizeChips(x.s)}</div></div>`).join(''):'<div class="notice">Chưa có kỳ D nào được kiểm chứng chính thức.</div>'}</div>`;
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

  window.PowerAIAdaptiveDApp={refresh:refreshD,getLogs:dLogs,getLock:getDLock,getState:dState,saveState:saveDState,verifyLockIntegrity};
})();
