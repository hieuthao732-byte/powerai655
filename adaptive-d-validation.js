/* PowerAI Track D — retrospective validation lab
   Strict walk-forward research only. Results from this file never update official D logs,
   champion weights, challenger promotion, or prospective performance.
*/
(function(root){
  'use strict';

  const D=root.PowerAIAdaptiveD;
  if(!D){console.error('Track D validation: core missing');return}

  const VERSION='D-VALID-0.1.0';
  const mean=a=>a.length?a.reduce((s,x)=>s+Number(x||0),0)/a.length:0;
  const std=a=>{if(a.length<2)return 0;const m=mean(a);return Math.sqrt(mean(a.map(x=>(Number(x)-m)**2)))};
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const drawNums=d=>(d?.result||d?.actual||[]).map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=55).slice(0,6).sort((a,b)=>a-b);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt=(x,d=3)=>Number.isFinite(Number(x))?Number(x).toFixed(d):'—';
  const yieldFrame=()=>new Promise(r=>setTimeout(r,0));

  function normalCdf(x){
    const z=Math.abs(Number(x)||0)/Math.sqrt(2),t=1/(1+.3275911*z),a1=.254829592,a2=-.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429;
    const erf=1-(((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t)*Math.exp(-z*z);
    return .5*(1+(x<0?-erf:erf));
  }

  function pairedEvidence(deltas,{priorSd=.45}={}){
    const a=(deltas||[]).map(Number).filter(Number.isFinite);
    if(a.length<2)return{n:a.length,mean:mean(a),posteriorMean:0,posteriorSd:priorSd,probPositive:.5};
    const m=mean(a),s=Math.max(.08,std(a)),se2=(s*s)/a.length,priorVar=priorSd*priorSd,postVar=1/(1/priorVar+1/se2),postMean=postVar*(m/se2),postSd=Math.sqrt(postVar);
    return{n:a.length,mean:m,posteriorMean:postMean,posteriorSd:postSd,probPositive:clamp(normalCdf(postMean/postSd),0,1)};
  }

  function changePoint(deltas,{minRows=12}={}){
    const a=(deltas||[]).map(Number).filter(Number.isFinite);
    if(a.length<minRows)return{state:'WARMUP',n:a.length,shift:false,effect:0,delta:0};
    const half=Math.floor(a.length/2),left=a.slice(0,half),right=a.slice(half),delta=mean(right)-mean(left),scale=Math.max(.15,std(a)),effect=delta/scale,shift=Math.abs(effect)>=1&&Math.abs(delta)>=.15;
    return{state:shift?'SHIFT FLAG':'STABLE',n:a.length,shift,effect,delta,leftMean:mean(left),rightMean:mean(right)};
  }

  function canonicalDraws(draws){
    return (draws||[]).map(d=>({id:Number(d?.id),result:drawNums(d)})).filter(d=>Number.isFinite(d.id)&&d.result.length===6).sort((a,b)=>a.id-b.id);
  }

  function championConfig(state={}){
    return{kind:'CHAMPION',engineId:state.engineId||'D-AR1',horizons:Array.isArray(state.horizons)&&state.horizons.length?state.horizons:[...D.DEFAULT_HORIZONS],weights:D.normalizeWeights(state.weights||D.DEFAULT_WEIGHTS)};
  }

  function fallbackCandidates(startTarget=0){
    return[
      {kind:'RESIDUAL_GRAPH',engineId:'D-AR2-R',horizons:[24,48,96,192],weights:{D1:.32,D2:.18,D3:.18,D4:.32},startTarget},
      {kind:'CONTEXT_STABLE',engineId:'D-AR2-C',horizons:[45,90,180,250],weights:{D1:.20,D2:.25,D3:.35,D4:.20},startTarget}
    ];
  }

  function configSet(state={},startTarget=0){
    const champ=championConfig(state),cycle=root.PowerAIAdaptiveCycle;
    let challengers=[];
    try{challengers=cycle?.candidateTemplates?cycle.candidateTemplates('STAGNANT',startTarget):fallbackCandidates(startTarget)}catch{challengers=fallbackCandidates(startTarget)}
    return[champ,...challengers.slice(0,2).map(c=>({kind:c.kind||'CHALLENGER',engineId:c.engineId,horizons:c.horizons,weights:D.normalizeWeights(c.weights||D.DEFAULT_WEIGHTS)}))];
  }

  function evaluateOne(draws,targetId,config,{candidates=850,nullTrials=60}={}){
    const all=canonicalDraws(draws),actual=all.find(d=>d.id===Number(targetId))?.result||[];
    if(actual.length!==6)throw new Error('Target chưa có 6 số chính.');
    const model=D.buildModel(all,Number(targetId),config),seed=((Math.imul(Number(targetId),2654435761)^parseInt(model.modelHash,16))>>>0),portfolio=D.buildPortfolio(model,{count:20,candidates,seed}),score=D.scorePortfolio(portfolio.tickets,actual),nul=D.matchedNullBenchmark(portfolio.tickets,actual,{trials:nullTrials,seed:(Math.imul(Number(targetId),104729)^parseInt(model.modelHash,16))>>>0});
    return{targetId:Number(targetId),cutoffId:model.cutoffId,engineId:model.engineId,modelHash:model.modelHash,portfolioHash:portfolio.hash,best:score.best,total:score.total,g3:score.g3,g4:score.g4,nullBest:nul.bestMean,nullTotal:nul.totalMean,pBest:nul.pBest,pTotal:nul.pTotal,deltaBest:score.best-nul.bestMean,deltaTotal:score.total-nul.totalMean,audit:portfolio.audit};
  }

  function summarize(rows){
    const a=(rows||[]).filter(Boolean),n=a.length;
    return{n,avgBest:mean(a.map(x=>x.best)),avgTotal:mean(a.map(x=>x.total)),ge3:a.filter(x=>x.best>=3).length,ge4:a.filter(x=>x.best>=4).length,nullBest:mean(a.map(x=>x.nullBest)),nullTotal:mean(a.map(x=>x.nullTotal)),deltaBest:mean(a.map(x=>x.deltaBest)),deltaTotal:mean(a.map(x=>x.deltaTotal)),aboveNull:a.filter(x=>x.deltaBest>0).length,avgPBest:mean(a.map(x=>x.pBest)),changePoint:changePoint(a.map(x=>x.deltaBest))};
  }

  function compare(championRows,candidateRows){
    const cm=new Map((championRows||[]).map(x=>[Number(x.targetId),x])),paired=(candidateRows||[]).filter(x=>cm.has(Number(x.targetId))).map(x=>({targetId:x.targetId,best:Number(x.best)-Number(cm.get(Number(x.targetId)).best),total:Number(x.total)-Number(cm.get(Number(x.targetId)).total),nullDelta:Number(x.deltaBest)-Number(cm.get(Number(x.targetId)).deltaBest)}));
    return{n:paired.length,best:pairedEvidence(paired.map(x=>x.best)),total:pairedEvidence(paired.map(x=>x.total/20)),nullDelta:pairedEvidence(paired.map(x=>x.nullDelta)),rows:paired};
  }

  async function walkForward(draws,config,{lookback=24,candidates=850,nullTrials=60,onProgress=null}={}){
    const all=canonicalDraws(draws),eligible=all.filter((d,i)=>i>=Math.max(30,Math.min(...(config.horizons||D.DEFAULT_HORIZONS),30))).slice(-Math.max(1,Number(lookback)||24)),rows=[];
    for(let i=0;i<eligible.length;i++){
      rows.push(evaluateOne(all,eligible[i].id,config,{candidates,nullTrials}));
      if(onProgress)onProgress({done:i+1,total:eligible.length,targetId:eligible[i].id});
      if((i+1)%2===0)await yieldFrame();
    }
    return{config,rows,summary:summarize(rows)};
  }

  async function runLab(draws,state={},opts={}){
    const all=canonicalDraws(draws);if(all.length<40)throw new Error('Chưa đủ lịch sử cho Validation Lab.');
    const configs=configSet(state,all.at(-1).id+1),results=[];
    const total=configs.length*Math.min(Number(opts.lookback)||24,Math.max(0,all.length-30));let done=0;
    for(const c of configs){
      const r=await walkForward(all,c,{...opts,onProgress:p=>{done++;opts.onProgress?.({done,total,engineId:c.engineId,targetId:p.targetId})}});results.push(r);
    }
    const champ=results[0],comparisons=results.slice(1).map(r=>({engineId:r.config.engineId,kind:r.config.kind,...compare(champ.rows,r.rows)}));
    return{version:VERSION,generatedAt:new Date().toISOString(),lookback:champ.rows.length,results,comparisons,note:'RETROSPECTIVE_ONLY'};
  }

  function currentNovelty(id){
    try{
      const lock=root.PowerAIAdaptiveDApp?.getLock?.(Number(id));if(!lock?.tickets?.length)return null;
      const refs=[];
      if(typeof getLock==='function'){
        const L=getLock(Number(id));for(const k of ['A','B','C']){const p=L?.[k]?.tickets;if(Array.isArray(p)&&p.length)refs.push({key:k,tickets:p})}
      }
      if(typeof getLearningLock==='function'){
        const L=getLearningLock(Number(id)),p=L?.tickets?.map(x=>x?.a||x);if(Array.isArray(p)&&p.length)refs.push({key:'L',tickets:p})
      }
      const sim=root.PowerAIAdaptiveCycle?.portfolioSimilarity;if(!sim||!refs.length)return{novelty:null,refs:[]};
      const vals=refs.map(r=>({key:r.key,similarity:sim(lock.tickets,r.tickets)})),avg=mean(vals.map(x=>x.similarity));return{novelty:1-avg,refs:vals};
    }catch{return null}
  }

  function ensureUI(){
    if(typeof document==='undefined'||document.getElementById('dValidationPanel'))return;
    const pane=document.getElementById('adaptiveDTab');if(!pane)return;
    const panel=document.createElement('section');panel.id='dValidationPanel';panel.className='panel dValidationPanel';panel.innerHTML=`
      <div class="head"><div><div class="sectionKicker dText">VALIDATION LAB</div><h2>🧪 Walk-forward & Counterfactual</h2><p>Retrospective riêng để kiểm tra D. Không ghi vào official log, không tự promote challenger.</p></div><div class="actions"><select id="dValidationLookback"><option value="12">12 kỳ</option><option value="24" selected>24 kỳ</option><option value="36">36 kỳ</option></select><button id="dValidationRunBtn">Chạy validation</button></div></div>
      <div class="dStatusGrid"><div class="dStat"><span>Trạng thái</span><b id="dValidationState">CHƯA CHẠY</b><small id="dValidationProgress">retrospective only</small></div><div class="dStat"><span>Champion Δ null</span><b id="dValidationNull">—</b><small>best-hit so matched random</small></div><div class="dStat"><span>Change-point</span><b id="dValidationShift">—</b><small id="dValidationShiftNote">—</small></div><div class="dStat"><span>Novelty hiện tại</span><b id="dValidationNovelty">—</b><small>so A/B/C/L nếu có lock</small></div></div>
      <div id="dValidationResults" class="dHistory"><div class="notice">Bấm “Chạy validation” để replay walk-forward nhiều kỳ. Kết quả này không được tính là dự đoán prospective.</div></div>`;
    const anchor=document.getElementById('dCyclePanel')||pane.querySelector('.dHero');anchor?.insertAdjacentElement('afterend',panel);
    document.getElementById('dValidationRunBtn')?.addEventListener('click',runUI);
    renderNovelty();
  }

  function renderNovelty(){
    if(typeof document==='undefined')return;const box=document.getElementById('dValidationNovelty');if(!box)return;
    const n=currentNovelty(typeof targetId!=='undefined'?targetId:0);box.textContent=n&&Number.isFinite(n.novelty)?`${(n.novelty*100).toFixed(1)}%`:'—';
  }

  function resultCard(r,cmp=null){
    const s=r.summary,ev=cmp?.best?.probPositive;
    return`<div class="dHistoryRow"><span>${esc(r.config.engineId)}</span><b>Best TB ${fmt(s.avgBest,2)}/6</b><small>Δ null ${s.deltaBest>=0?'+':''}${fmt(s.deltaBest)}</small><small>≥3: ${s.ge3}/${s.n}</small><small>≥4: ${s.ge4}/${s.n}</small>${cmp?`<small>Evidence > Champion: ${fmt((ev||0)*100,1)}%</small>`:'<small>Champion hiện tại</small>'}</div>`;
  }

  async function runUI(){
    const btn=document.getElementById('dValidationRunBtn'),stateEl=document.getElementById('dValidationState'),prog=document.getElementById('dValidationProgress'),box=document.getElementById('dValidationResults');if(!btn||!box)return;
    btn.disabled=true;stateEl.textContent='ĐANG CHẠY';box.innerHTML='<div class="notice">Đang replay walk-forward...</div>';
    try{
      const lookback=Number(document.getElementById('dValidationLookback')?.value)||24,state=root.PowerAIAdaptiveDApp?.getState?.()||{},lab=await runLab(typeof draws!=='undefined'?draws:[],state,{lookback,candidates:700,nullTrials:50,onProgress:p=>{prog.textContent=`${p.done}/${p.total} • ${p.engineId} • #${String(p.targetId).padStart(5,'0')}`}}),champ=lab.results[0],cp=champ.summary.changePoint;
      stateEl.textContent='XONG';prog.textContent=`${lab.lookback} kỳ × ${lab.results.length} cấu hình • không ghi official`;
      document.getElementById('dValidationNull').textContent=`${champ.summary.deltaBest>=0?'+':''}${fmt(champ.summary.deltaBest)}`;
      document.getElementById('dValidationShift').textContent=cp.state;document.getElementById('dValidationShiftNote').textContent=`effect ${fmt(cp.effect)} • Δ ${fmt(cp.delta)}`;
      box.innerHTML=lab.results.map((r,i)=>resultCard(r,i?lab.comparisons[i-1]:null)).join('')+'<div class="notice"><b>Không tự promote:</b> Validation Lab chỉ dùng để kiểm tra kiến trúc. Quyết định D thật vẫn cần prospective lock + feed official.</div>';
      renderNovelty();
    }catch(e){console.error(e);stateEl.textContent='LỖI';prog.textContent=e.message;box.innerHTML=`<div class="notice">${esc(e.message)}</div>`}finally{btn.disabled=false}
  }

  const API={VERSION,normalCdf,pairedEvidence,changePoint,canonicalDraws,championConfig,configSet,evaluateOne,summarize,compare,walkForward,runLab,currentNovelty};
  root.PowerAIAdaptiveValidation=API;

  if(typeof document!=='undefined'){
    root.addEventListener('load',()=>{ensureUI();setTimeout(()=>{ensureUI();renderNovelty()},1200)},{once:true});
    setTimeout(()=>ensureUI(),300);
  }
})(typeof window!=='undefined'?window:globalThis);
