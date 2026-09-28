/* PowerAI Track D — adaptive cycle / shadow challenger automation
   Feed-only lifecycle: drift -> challenger shadow -> stress gate -> promote/reject.
   Manual results and replay never enter research decisions.
*/
(function(root){
  'use strict';

  const D=root.PowerAIAdaptiveD;
  if(!D){console.error('Track D cycle: core missing');return}

  const VERSION='D-CYCLE-0.3.0';
  const STATE_KEY='powerai_rc6_d_state';
  const LOG_KEY='powerai_rc6_d_logs';
  const SHADOW_KEY='powerai_rc6_d_shadow_logs';
  const META_KEY='powerai_rc6_d_cycle_meta';
  const LOCK_PREFIX='powerai_rc6_d_lock_';
  const EXPERTS=['D1','D2','D3','D4'];

  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const mean=a=>a.length?a.reduce((s,x)=>s+Number(x||0),0)/a.length:0;
  const el=id=>document.getElementById(id);
  const readJSON=(key,fallback)=>{try{const x=JSON.parse(localStorage.getItem(key)||'null');return x??fallback}catch{return fallback}};
  const writeJSON=(key,val)=>{localStorage.setItem(key,JSON.stringify(val));try{typeof cloudSyncSoon==='function'&&cloudSyncSoon()}catch{}};
  const simpleHash=s=>{let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return('00000000'+(h>>>0).toString(16)).slice(-8).toUpperCase()};
  const overlap=(a,b)=>{const s=new Set(a);let n=0;for(const x of b)if(s.has(x))n++;return n};
  const officialLogs=()=>{const x=readJSON(LOG_KEY,[]);return Array.isArray(x)?x.filter(r=>r?.source==='feed'&&r?.D&&Number.isFinite(Number(r.D.best))).sort((a,b)=>Number(a.targetId)-Number(b.targetId)):[]};
  const shadowLogs=()=>{const x=readJSON(SHADOW_KEY,[]);return Array.isArray(x)?x.filter(r=>r?.source==='feed'&&r?.challengerId).sort((a,b)=>Number(a.targetId)-Number(b.targetId)):[]};
  const cycleMeta=()=>{const x=readJSON(META_KEY,{});return x&&typeof x==='object'?x:{}};
  const dLockKey=id=>LOCK_PREFIX+Number(id);
  const getDLock=id=>readJSON(dLockKey(id),null);

  // Preserve Phase-3 state fields while remaining compatible with the Phase-1 core.
  const baseNewResearchState=D.newResearchState.bind(D);
  D.newResearchState=function(previous={}){
    const s=baseNewResearchState(previous);
    s.horizons=Array.isArray(previous.horizons)&&previous.horizons.length?previous.horizons.map(Number).filter(x=>x>0):[...D.DEFAULT_HORIZONS];
    s.lastWeightUpdateTarget=Number(previous.lastWeightUpdateTarget)||0;
    s.lineage=Array.isArray(previous.lineage)?previous.lineage.slice(-40):[];
    s.quarantine=previous.quarantine&&typeof previous.quarantine==='object'?{...previous.quarantine}:{};
    s.lastDecision=previous.lastDecision&&typeof previous.lastDecision==='object'?{...previous.lastDecision}:null;
    return s;
  };

  const researchState=()=>D.newResearchState(readJSON(STATE_KEY,{}));
  const saveResearchState=s=>writeJSON(STATE_KEY,D.newResearchState(s));

  function officialDraw(id){
    try{return (draws||[]).find(d=>Number(d.id)===Number(id))||null}catch{return null}
  }
  function actualNums(draw){
    try{return typeof nums==='function'?nums(draw):(draw?.result||[]).map(Number).filter(n=>n>=1&&n<=55).slice(0,6).sort((a,b)=>a-b)}catch{return []}
  }
  function currentTarget(){try{return Number(targetId)||0}catch{return 0}}

  function configFingerprint(c){
    const weights={};for(const k of EXPERTS)weights[k]=+(Number(c?.weights?.[k])||0).toFixed(4);
    const horizons=(c?.horizons||[]).map(Number);
    return simpleHash(JSON.stringify({weights,horizons,kind:String(c?.kind||'')}));
  }

  function candidateTemplates(problem='STAGNANT',startTarget=0){
    const templates=problem==='EXPERT_DISAGREEMENT'?
      [
        {kind:'STABILITY',engineId:'D-AR2-S',horizons:[45,90,180,250],weights:{D1:.20,D2:.25,D3:.35,D4:.20},change:'Ổn định hóa context và giảm spectral/pair concentration'},
        {kind:'BALANCED',engineId:'D-AR2-B',horizons:[36,72,144,250],weights:{D1:.25,D2:.25,D3:.25,D4:.25},change:'Đổi horizon, giữ ensemble cân bằng'}
      ]:
      [
        {kind:'RESIDUAL_GRAPH',engineId:'D-AR2-R',horizons:[24,48,96,192],weights:{D1:.32,D2:.18,D3:.18,D4:.32},change:'Tăng residual pair + spectral graph, rút ngắn horizon'},
        {kind:'CONTEXT_STABLE',engineId:'D-AR2-C',horizons:[45,90,180,250],weights:{D1:.20,D2:.25,D3:.35,D4:.20},change:'Tăng shape/gap và horizon dài hơn'}
      ];
    return templates.map((x,i)=>{
      const c={...x,startTarget:Number(startTarget),minOfficial:6,status:'SHADOW'};
      c.fingerprint=configFingerprint(c);c.id=`CH-${Number(startTarget)}-${i+1}-${c.fingerprint.slice(0,4)}`;
      return c;
    });
  }

  function recentRejected(state,fingerprint,lastId,cooldown=24){
    return (state.memory||[]).some(m=>m?.fingerprint===fingerprint&&m?.status==='REJECTED'&&Number(lastId)-Number(m.targetId||0)<cooldown);
  }

  function diagnose(logs,state){
    const drift=D.evaluateDrift(logs,{lastChangeTarget:Number(state.lastChangeTarget)||0});
    if(!drift.trigger)return{problem:'NONE',drift};
    const recent=logs.slice(-12),dis=recent.map(r=>Number(r?.confidence?.disagreement||r?.D?.confidence?.disagreement)).filter(Number.isFinite);
    if(dis.length&&mean(dis)>.32)return{problem:'EXPERT_DISAGREEMENT',drift};
    const deltas=recent.map(r=>Number(r?.D?.best)-Number(r?.D?.null?.bestMean)).filter(Number.isFinite);
    if(deltas.length&&mean(deltas)<=0)return{problem:'NULL_UNDERPERFORM',drift};
    return{problem:'STAGNANT',drift};
  }

  function maybeOpenTournament(){
    const logs=officialLogs(),state=researchState();
    if((state.challengers||[]).some(c=>c?.status==='SHADOW'))return false;
    const dx=diagnose(logs,state);if(!dx.drift.trigger)return false;
    const lastId=logs.length?Number(logs.at(-1).targetId):0;
    const candidates=candidateTemplates(dx.problem,lastId+1).filter(c=>!recentRejected(state,c.fingerprint,lastId)).slice(0,2);
    if(!candidates.length){
      state.status='COOLDOWN';state.lastChangeTarget=lastId;state.lastDecision={targetId:lastId,type:'NO_CANDIDATE',reason:'Các mutation gần nhất đang trong negative-memory cooldown.'};saveResearchState(state);return false;
    }
    state.challengers=candidates;
    state.status='CHALLENGER_TEST';
    for(const c of candidates){
      state.hypotheses=(state.hypotheses||[]).filter(h=>h.id!==c.id);
      state.hypotheses.push({id:c.id,createdAt:new Date().toISOString(),problem:dx.problem,change:c.change,successMetric:'promotion composite + stress gate',minOfficial:6,status:'SHADOW',fingerprint:c.fingerprint});
    }
    state.lastDecision={targetId:lastId,type:'OPEN_TOURNAMENT',reason:dx.drift.reason};
    saveResearchState(state);return true;
  }

  function normalizePortfolio(x){
    if(!x)return null;const t=Array.isArray(x.tickets)?x.tickets.map(v=>Array.isArray(v)?v:(v?.a||[])).filter(a=>a.length===6):[];return t.length? t:null;
  }

  function referencePortfolios(id,championTickets=[]){
    const out=[];if(championTickets?.length)out.push(championTickets);
    try{
      if(typeof getLock==='function'){
        const L=getLock(Number(id));for(const k of ['A','B','C']){const p=normalizePortfolio(L?.[k]);if(p)out.push(p)}
      }
    }catch{}
    try{if(typeof getLearningLock==='function'){const p=normalizePortfolio(getLearningLock(Number(id)));if(p)out.push(p)}}catch{}
    return out;
  }

  function portfolioSimilarity(P,Q){
    if(!P?.length||!Q?.length)return 0;
    return mean(P.map(t=>Math.max(...Q.map(q=>overlap(t,q)))/6));
  }

  function chooseShadowPortfolio(model,refs,seedBase){
    let best=null,bestObj=Infinity;
    for(let i=0;i<4;i++){
      const seed=(Number(seedBase)+Math.imul(i+1,104729))>>>0;
      const p=D.buildPortfolio(model,{count:20,candidates:3200,seed});
      if(!p?.tickets?.length||p.tickets.length!==20)continue;
      const sim=refs.length?mean(refs.map(q=>portfolioSimilarity(p.tickets,q))):0;
      const a=p.audit||D.auditPortfolio(p.tickets);
      const obj=sim+.012*(a.repeatedPairs||0)+.04*Math.max(0,(a.maxOverlap||0)-3)-.08*(a.entropy||0);
      if(obj<bestObj){bestObj=obj;best={...p,orthogonality:+sim.toFixed(4)}}
    }
    return best;
  }

  function augmentLockWithShadows(id=currentTarget()){
    id=Number(id);if(!id||officialDraw(id))return false;
    const state=researchState(),active=(state.challengers||[]).filter(c=>c?.status==='SHADOW');if(!active.length)return false;
    const lock=getDLock(id);if(!lock||!Array.isArray(lock.tickets)||lock.tickets.length!==20)return false;
    const existing=new Map((lock.shadow||[]).map(s=>[s.challengerId,s]));let changed=false;
    for(const c of active){
      if(existing.has(c.id))continue;
      try{
        const model=D.buildModel(draws,id,{engineId:c.engineId,weights:c.weights,horizons:c.horizons});
        const refs=referencePortfolios(id,lock.tickets),seed=(Math.imul(id,2654435761)^parseInt(c.fingerprint,16))>>>0;
        const p=chooseShadowPortfolio(model,refs,seed);if(!p?.tickets?.length)continue;
        const conf=D.confidenceGate(model);
        existing.set(c.id,{challengerId:c.id,engineId:c.engineId,fingerprint:c.fingerprint,hypothesisId:c.id,horizons:c.horizons,weights:c.weights,cutoffId:model.cutoffId,modelHash:model.modelHash,portfolioHash:p.hash,seed:p.seed,audit:p.audit,orthogonality:p.orthogonality,confidence:conf,shadowLockedAt:new Date().toISOString(),tickets:p.tickets});changed=true;
      }catch(e){console.error('Track D shadow build failed',c.id,e)}
    }
    if(changed){lock.shadow=[...existing.values()];lock.shadowCycleVersion=VERSION;writeJSON(dLockKey(id),lock)}
    return changed;
  }

  function allDLocks(){
    const out=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(LOCK_PREFIX)){const x=readJSON(k,null);if(x)out.push(x)}}return out.sort((a,b)=>Number(a.targetId)-Number(b.targetId));
  }

  function scoreShadows(){
    const rows=shadowLogs(),seen=new Set(rows.map(r=>`${Number(r.targetId)}:${r.challengerId}`));let changed=false;
    for(const lock of allDLocks()){
      const id=Number(lock.targetId),draw=officialDraw(id),actual=actualNums(draw);if(!draw||actual.length!==6||!Array.isArray(lock.shadow))continue;
      const champion=D.scorePortfolio(lock.tickets,actual);
      for(const sh of lock.shadow){
        const key=`${id}:${sh.challengerId}`;if(seen.has(key)||!Array.isArray(sh.tickets)||sh.tickets.length!==20)continue;
        const challenger=D.scorePortfolio(sh.tickets,actual),nul=D.matchedNullBenchmark(sh.tickets,actual,{trials:160,seed:(Math.imul(id,104729)^parseInt(sh.fingerprint||'1',16))>>>0});
        const audit=sh.audit||D.auditPortfolio(sh.tickets);
        rows.push({targetId:id,source:'feed',challengerId:sh.challengerId,engineId:sh.engineId,fingerprint:sh.fingerprint,hypothesisId:sh.hypothesisId,champion,challenger,challengerNull:{bestMean:nul.bestMean,totalMean:nul.totalMean,pBest:nul.pBest,pTotal:nul.pTotal},auditOk:audit.tickets===20&&audit.maxOverlap<=4&&audit.maxExposure<=6,orthogonality:sh.orthogonality,confidence:sh.confidence,scoredAt:new Date().toISOString()});seen.add(key);changed=true;
      }
    }
    if(changed){rows.sort((a,b)=>Number(a.targetId)-Number(b.targetId));writeJSON(SHADOW_KEY,rows.slice(-600))}
    return changed;
  }

  function expertRewards(lock,actual){
    try{
      const model=D.buildModel(draws,Number(lock.targetId),{engineId:lock.engineId,weights:lock.weights,horizons:lock.horizons});
      const rewards={};
      for(const k of EXPERTS){const hitMean=mean(actual.map(n=>model.expertScores[k][n]));rewards[k]=clamp((hitMean-.5)*4,-2,2)}
      return rewards;
    }catch{return null}
  }

  function updateChampionWeights(){
    const logs=officialLogs(),state=researchState(),meta=cycleMeta();let changed=false;
    meta.rewardHistory=Array.isArray(meta.rewardHistory)?meta.rewardHistory:[];
    for(const row of logs){
      const id=Number(row.targetId);if(id<=Number(state.lastWeightUpdateTarget||0))continue;
      const lock=getDLock(id),actual=Array.isArray(row.actual)?row.actual:actualNums(officialDraw(id));
      if(lock&&lock.engineId===state.engineId&&actual.length===6){
        const rewards=expertRewards(lock,actual);
        if(rewards){state.weights=D.updateWeights(state.weights,rewards,{eta:.05,min:.12,max:.55});meta.rewardHistory.push({targetId:id,engineId:state.engineId,rewards});changed=true}
      }
      state.lastWeightUpdateTarget=id;
    }
    meta.rewardHistory=meta.rewardHistory.slice(-40);

    // Quarantine only after repeated negative contribution; never zero an expert.
    const lastId=logs.length?Number(logs.at(-1).targetId):0;
    for(const k of EXPERTS){
      const active=state.quarantine?.[k];
      if(active&&lastId>=Number(active.untilTarget||0)){delete state.quarantine[k];changed=true;continue}
      const recent=meta.rewardHistory.filter(x=>x.engineId===state.engineId).slice(-8).map(x=>Number(x.rewards?.[k])).filter(Number.isFinite);
      if(!active&&recent.length>=8&&mean(recent)<-.22){state.quarantine[k]={sinceTarget:lastId,untilTarget:lastId+6,reason:'8-update reward mean below -0.22'};state.weights[k]=.12;state.weights=D.normalizeWeights(state.weights,.12,.55);changed=true}
      if(state.quarantine?.[k]){state.weights[k]=.12;state.weights=D.normalizeWeights(state.weights,.12,.55)}
    }
    if(changed||logs.some(r=>Number(r.targetId)>Number(readJSON(STATE_KEY,{lastWeightUpdateTarget:0}).lastWeightUpdateTarget||0))){saveResearchState(state);writeJSON(META_KEY,meta)}
    return changed;
  }

  function robustDecision(rows){
    const ordered=[...rows].sort((a,b)=>Number(a.targetId)-Number(b.targetId));
    const full=D.promotionDecision(ordered,{minRows:6,margin:.025});
    if(full.state==='SHADOW')return{...full,robust:false,looPositive:0,looTotal:0,trimmedDelta:null};
    const loo=[];
    for(let i=0;i<ordered.length;i++){
      const x=ordered.filter((_,j)=>j!==i),d=D.promotionDecision(x,{minRows:Math.max(4,x.length),margin:0});if(Number.isFinite(d.delta))loo.push(d.delta)
    }
    const impacts=ordered.map((r,i)=>({i,v:Math.abs((Number(r.challenger?.best||0)-Number(r.champion?.best||0))/6+(Number(r.challenger?.total||0)-Number(r.champion?.total||0))/120)})).sort((a,b)=>b.v-a.v);
    const trim=impacts.length>4?ordered.filter((_,i)=>i!==impacts[0].i):ordered;
    const td=D.promotionDecision(trim,{minRows:Math.max(4,trim.length),margin:0});
    const looPositive=loo.filter(x=>x>=0).length,required=Math.ceil(loo.length*.67),auditOk=ordered.every(r=>r.auditOk!==false),lowConf=ordered.filter(r=>r?.confidence?.confidence==='LOW_CONFIDENCE').length;
    const nullDelta=mean(ordered.map(r=>Number(r.challenger?.best)-Number(r.challengerNull?.bestMean)).filter(Number.isFinite));
    const robust=!!full.promote&&looPositive>=required&&Number(td.delta)>=0&&auditOk&&lowConf<=Math.floor(ordered.length/3)&&(!Number.isFinite(nullDelta)||nullDelta>=-.05);
    return{...full,robust,looPositive,looTotal:loo.length,trimmedDelta:Number.isFinite(td.delta)?td.delta:null,nullDelta:Number.isFinite(nullDelta)?nullDelta:null,auditOk,lowConfidenceRows:lowConf};
  }

  function setHypothesisStatus(state,id,status,note=''){
    state.hypotheses=(state.hypotheses||[]).map(h=>h.id===id?{...h,status,closedAt:new Date().toISOString(),note}:h);return state;
  }

  function resolveTournament(){
    const state=researchState(),active=(state.challengers||[]).filter(c=>c?.status==='SHADOW');if(!active.length)return false;
    const rows=shadowLogs(),evaluated=active.map(c=>({c,rows:rows.filter(r=>r.challengerId===c.id),decision:null}));
    for(const x of evaluated)x.decision=robustDecision(x.rows);
    if(evaluated.some(x=>x.rows.length<Number(x.c.minOfficial||6)))return false;
    const winners=evaluated.filter(x=>x.decision.robust).sort((a,b)=>Number(b.decision.delta)-Number(a.decision.delta));
    const lastId=Math.max(...evaluated.flatMap(x=>x.rows.map(r=>Number(r.targetId)||0)),0),now=new Date().toISOString();
    if(winners.length){
      const win=winners[0];state.memory.push({engineId:state.engineId,status:'SUPERSEDED',targetId:lastId,at:now,by:win.c.engineId});
      state.memory.push({engineId:win.c.engineId,fingerprint:win.c.fingerprint,status:'PROMOTED',targetId:lastId,at:now,delta:win.decision.delta,stress:{looPositive:win.decision.looPositive,looTotal:win.decision.looTotal,trimmedDelta:win.decision.trimmedDelta}});
      state.lineage.push({from:state.engineId,to:win.c.engineId,targetId:lastId,at:now,mutation:win.c.kind,fingerprint:win.c.fingerprint});
      state.engineId=win.c.engineId;state.weights=D.normalizeWeights(win.c.weights,.12,.55);state.horizons=[...win.c.horizons];state.lastChangeTarget=lastId;state.status='COOLDOWN';
      for(const x of evaluated)setHypothesisStatus(state,x.c.id,x.c.id===win.c.id?'PROMOTED':'REJECTED',x.c.id===win.c.id?'Won tournament':'Lost tournament');
      state.lastDecision={targetId:lastId,type:'PROMOTE',engineId:win.c.engineId,delta:win.decision.delta};state.challengers=[];saveResearchState(state);return true;
    }
    for(const x of evaluated){state.memory.push({engineId:x.c.engineId,fingerprint:x.c.fingerprint,status:'REJECTED',targetId:lastId,at:now,delta:x.decision.delta,stress:{looPositive:x.decision.looPositive,looTotal:x.decision.looTotal,trimmedDelta:x.decision.trimmedDelta}});setHypothesisStatus(state,x.c.id,'REJECTED','Did not pass promotion + stress gate')}
    state.lastChangeTarget=lastId;state.status='COOLDOWN';state.lastDecision={targetId:lastId,type:'REJECT',reason:'Không challenger nào qua promotion + stress gate.'};state.challengers=[];state.memory=state.memory.slice(-80);saveResearchState(state);return true;
  }

  function baselineStatus(){
    const logs=officialLogs().slice(-12);if(logs.length<12)return{label:'WARMUP',note:`${logs.length}/12 kỳ official`};
    const d=logs.map(r=>Number(r.D.best)-Number(r.D?.null?.bestMean)).filter(Number.isFinite),delta=mean(d);
    return delta<=.05?{label:'NO EDGE DETECTED',note:`Δ best/null ${delta.toFixed(3)}`}:{label:'ABOVE NULL WINDOW',note:`Δ best/null +${delta.toFixed(3)}`};
  }

  function ensureCycleUI(){
    const pane=el('adaptiveDTab');if(!pane||el('dCyclePanel'))return false;
    const panel=document.createElement('section');panel.id='dCyclePanel';panel.className='panel dCyclePanel';panel.innerHTML=`<div class="head"><div><div class="sectionKicker dText">ADAPTIVE CYCLE</div><h2>⚙️ Champion / Challenger</h2></div></div><div class="dStatusGrid"><div class="dStat"><span>Champion</span><b id="dCycleChampion">—</b><small id="dCycleWeights">—</small></div><div class="dStat"><span>Baseline</span><b id="dCycleBaseline">—</b><small id="dCycleBaselineNote">—</small></div><div class="dStat"><span>Challenger</span><b id="dCycleChallengeCount">0</b><small id="dCycleProgress">—</small></div><div class="dStat"><span>Memory</span><b id="dCycleMemory">0</b><small id="dCycleDecision">—</small></div></div><div id="dCycleRows" class="dCycleRows"></div>`;
    const hero=pane.querySelector('.dHero');hero?.insertAdjacentElement('afterend',panel);return true;
  }

  function renderCycleUI(){
    if(!ensureCycleUI()){}const state=researchState(),base=baselineStatus(),rows=shadowLogs();
    if(!el('dCycleChampion'))return;
    el('dCycleChampion').textContent=state.engineId;el('dCycleWeights').textContent=EXPERTS.map(k=>`${k} ${Math.round((state.weights[k]||0)*100)}%`).join(' • ');
    el('dCycleBaseline').textContent=base.label;el('dCycleBaselineNote').textContent=base.note;
    const active=(state.challengers||[]).filter(c=>c?.status==='SHADOW');el('dCycleChallengeCount').textContent=String(active.length);
    el('dCycleProgress').textContent=active.length?active.map(c=>`${c.engineId} ${rows.filter(r=>r.challengerId===c.id).length}/${c.minOfficial||6}`).join(' • '):'Không có shadow test';
    el('dCycleMemory').textContent=String((state.memory||[]).length);el('dCycleDecision').textContent=state.lastDecision?`${state.lastDecision.type} @ #${String(state.lastDecision.targetId||0).padStart(5,'0')}`:'Chưa có quyết định';
    const box=el('dCycleRows');if(box)box.innerHTML=active.length?active.map(c=>{const n=rows.filter(r=>r.challengerId===c.id).length;return `<div class="dHistoryRow"><span>${c.engineId}</span><b>${n}/${c.minOfficial||6} kỳ shadow</b><small>${c.kind}</small><small>${c.change}</small></div>`}).join(''):'<div class="notice">Challenger chỉ mở khi rolling official kích hoạt drift detector.</div>';
  }

  let busy=false,timer=null;
  function syncCycle(){
    if(busy)return;busy=true;
    try{
      updateChampionWeights();scoreShadows();resolveTournament();maybeOpenTournament();augmentLockWithShadows();renderCycleUI();
    }catch(e){console.error('Track D adaptive cycle failed',e)}finally{busy=false}
  }
  function schedule(ms=120){clearTimeout(timer);timer=setTimeout(syncCycle,ms)}

  function attachHooks(){
    ensureCycleUI();renderCycleUI();
    const lock=el('dLockBtn');if(lock&&!lock.dataset.dCycleHook){lock.dataset.dCycleHook='1';lock.addEventListener('click',()=>schedule(220))}
    const select=el('targetSelect');if(select&&!select.dataset.dCycleHook){select.dataset.dCycleHook='1';select.addEventListener('change',()=>schedule(350))}
    const refresh=el('refreshBtn');if(refresh&&!refresh.dataset.dCycleHook){refresh.dataset.dCycleHook='1';refresh.addEventListener('click',()=>schedule(1900))}
  }

  root.PowerAIAdaptiveCycle={VERSION,configFingerprint,candidateTemplates,diagnose,portfolioSimilarity,robustDecision,syncCycle,augmentLockWithShadows,scoreShadows,baselineStatus,_test:{candidateTemplates,configFingerprint,robustDecision,portfolioSimilarity}};
  root.addEventListener('powerai-auth-changed',()=>schedule(300));
  root.addEventListener('load',()=>{attachHooks();schedule(450);setInterval(()=>{attachHooks();schedule(0)},5000)},{once:true});
})(typeof window!=='undefined'?window:globalThis);
