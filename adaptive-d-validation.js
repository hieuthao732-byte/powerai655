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
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
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

/* PowerAI Track D v1.2 — compact ticket-first UI + multi-draw evidence ledger.
   This layer is presentation/research only: it does not alter D generation, locks,
   official scoring, champion weights, drift decisions, or challenger promotion.
*/
(function(root){
  'use strict';

  const VERSION='D-EVIDENCE-1.2.0';
  const WINDOW=12;
  const mean=a=>a.length?a.reduce((s,x)=>s+Number(x||0),0)/a.length:0;
  const fmt=(x,d=2)=>Number.isFinite(Number(x))?Number(x).toFixed(d):'—';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const setText=(id,value)=>{if(typeof document==='undefined')return;const n=document.getElementById(id),v=String(value??'');if(n&&n.textContent!==v)n.textContent=v};

  function cleanLogs(input){
    return (Array.isArray(input)?input:[]).filter(r=>r?.source==='feed'&&r?.D&&Number.isFinite(Number(r.D.best))).sort((a,b)=>Number(a.targetId)-Number(b.targetId));
  }

  function evidenceSummary(input,state={}){
    const all=cleanLogs(input),recent=all.slice(-WINDOW),n=recent.length,total=all.length;
    const avgBest=n?mean(recent.map(r=>Number(r.D.best))):0;
    const compared=recent.map(r=>({row:r,delta:Number(r.D.best)-Number(r.D?.null?.bestMean)})).filter(x=>Number.isFinite(x.delta));
    const nullDelta=compared.length?mean(compared.map(x=>x.delta)):null;
    const above=compared.filter(x=>x.delta>0).length;
    const best3=recent.filter(r=>Number(r.D.best)>=3).length,best4=recent.filter(r=>Number(r.D.best)>=4).length;
    let trend='CHƯA ĐỦ DỮ LIỆU',trendDelta=null;
    if(compared.length>=12){
      const last12=compared.slice(-12),before=mean(last12.slice(0,6).map(x=>x.delta)),after=mean(last12.slice(6).map(x=>x.delta));trendDelta=after-before;
      trend=trendDelta>.08?'ĐANG TĂNG':trendDelta<-.08?'ĐANG GIẢM':'ĐANG ỔN ĐỊNH';
    }
    let status='ĐANG TÍCH LŨY DỮ LIỆU';
    if(n>=WINDOW&&compared.length<8)status='CHƯA ĐỦ DỮ LIỆU SO SÁNH';
    else if(n>=WINDOW&&Number.isFinite(nullDelta)&&nullDelta>.05)status='CAO HƠN MỐC NGẪU NHIÊN';
    else if(n>=WINDOW&&Number.isFinite(nullDelta)&&nullDelta<-.05)status='THẤP HƠN MỐC NGẪU NHIÊN';
    else if(n>=WINDOW)status='CHƯA THẤY KHÁC BIỆT RÕ';
    const active=(state?.challengers||[]).filter(c=>c?.status==='SHADOW');
    let action=n<WINDOW?`Cần thêm ${WINDOW-n} kỳ chính thức để đủ cửa sổ ${WINDOW} kỳ.`:'Tiếp tục giữ phiên bản hiện tại và thu thập thêm kỳ mới.';
    if(active.length)action=`Đang thử ${active.length} phiên bản mới song song; chưa thay phiên bản đang dùng cho đến khi đủ kiểm tra.`;
    return{version:VERSION,total,sample:n,window:WINDOW,avgBest:+avgBest.toFixed(3),best3,best4,compared:compared.length,above,nullDelta:Number.isFinite(nullDelta)?+nullDelta.toFixed(3):null,trend,trendDelta:Number.isFinite(trendDelta)?+trendDelta.toFixed(3):null,status,action,activeChallengers:active.length,recent};
  }

  function compactOpen(){try{return localStorage.getItem('powerai_d_v12_analysis_open')==='1'}catch{return false}}
  function saveCompactOpen(on){try{localStorage.setItem('powerai_d_v12_analysis_open',on?'1':'0')}catch{}}

  function ensureCompactUI(){
    if(typeof document==='undefined')return false;
    const pane=document.getElementById('adaptiveDTab');if(!pane)return false;
    const hero=pane.querySelector('.dHero'),tickets=pane.querySelector('.dTicketsPanel');if(!hero||!tickets)return false;
    pane.classList.add('dCompactV12');

    if(hero.nextElementSibling!==tickets)hero.insertAdjacentElement('afterend',tickets);

    if(!document.getElementById('dEvidenceMini')){
      const mini=document.createElement('div');mini.id='dEvidenceMini';mini.className='dEvidenceMini';mini.textContent='D v1.2 • đang chờ dữ liệu chính thức';
      hero.appendChild(mini);
    }

    let toggleWrap=document.getElementById('dAdvancedToggleWrap');
    if(!toggleWrap){
      toggleWrap=document.createElement('div');toggleWrap.id='dAdvancedToggleWrap';toggleWrap.className='dAdvancedToggleWrap';
      toggleWrap.innerHTML='<button id="dAdvancedToggle" type="button" class="ghostBtn">Xem phân tích chi tiết</button><small>20 vé luôn hiển thị; phân tích, kiểm tra và lịch sử được thu gọn để đỡ rối.</small>';
      const btn=toggleWrap.querySelector('#dAdvancedToggle');
      btn?.addEventListener('click',()=>{
        const on=!pane.classList.contains('dShowAdvanced');pane.classList.toggle('dShowAdvanced',on);saveCompactOpen(on);btn.textContent=on?'Ẩn phân tích chi tiết':'Xem phân tích chi tiết';
      });
    }
    if(tickets.nextElementSibling!==toggleWrap)tickets.insertAdjacentElement('afterend',toggleWrap);

    let evidence=document.getElementById('dEvidencePanel');
    if(!evidence){
      evidence=document.createElement('section');evidence.id='dEvidencePanel';evidence.className='panel dEvidencePanel';evidence.innerHTML=`
        <div class="head"><div><div class="sectionKicker dText">D v1.2 • SỔ BẰNG CHỨNG</div><h2>📒 Theo dõi D qua nhiều kỳ</h2><p>Chỉ dùng các kỳ đã khóa trước kết quả chính thức. Một vài kỳ riêng lẻ không đủ để kết luận D tốt hơn ngẫu nhiên.</p></div></div>
        <div class="dStatusGrid dEvidenceGrid">
          <div class="dStat"><span>Dữ liệu</span><b id="dEvidenceSample">0/12</b><small id="dEvidenceTotal">0 kỳ chính thức</small></div>
          <div class="dStat"><span>Trùng cao nhất TB</span><b id="dEvidenceAvgBest">—</b><small id="dEvidenceHigh">≥3: 0 • ≥4: 0</small></div>
          <div class="dStat"><span>So với ngẫu nhiên</span><b id="dEvidenceNull">—</b><small id="dEvidenceAbove">0/0 kỳ cao hơn</small></div>
          <div class="dStat"><span>Xu hướng gần đây</span><b id="dEvidenceTrend">—</b><small id="dEvidenceTrendDelta">so 6 kỳ trước / 6 kỳ sau</small></div>
        </div>
        <div id="dEvidenceStatus" class="notice">Đang chờ dữ liệu chính thức.</div>
        <div id="dEvidenceRows" class="dHistory"></div>`;
    }
    if(toggleWrap.nextElementSibling!==evidence)toggleWrap.insertAdjacentElement('afterend',evidence);

    pane.querySelectorAll(':scope > section.panel').forEach(p=>{
      if(p!==hero&&p!==tickets)p.classList.add('dAdvancedPanel');
    });

    const on=compactOpen();pane.classList.toggle('dShowAdvanced',on);
    const btn=document.getElementById('dAdvancedToggle');if(btn)btn.textContent=on?'Ẩn phân tích chi tiết':'Xem phân tích chi tiết';
    return true;
  }

  function renderEvidence(){
    if(typeof document==='undefined')return;
    if(!ensureCompactUI())return;
    const logs=root.PowerAIAdaptiveDApp?.getLogs?.()||[],state=root.PowerAIAdaptiveDApp?.getState?.()||{},s=evidenceSummary(logs,state);
    setText('dEvidenceMini',`D v1.2 • ${s.status} • ${s.sample}/${s.window} kỳ`);
    setText('dEvidenceSample',`${s.sample}/${s.window}`);setText('dEvidenceTotal',`${s.total} kỳ chính thức đã chấm`);
    setText('dEvidenceAvgBest',s.sample?`${fmt(s.avgBest)}/6`:'—');setText('dEvidenceHigh',`≥3: ${s.best3} • ≥4: ${s.best4}`);
    setText('dEvidenceNull',s.nullDelta===null?'—':`${s.nullDelta>=0?'+':''}${fmt(s.nullDelta,3)}`);setText('dEvidenceAbove',`${s.above}/${s.compared} kỳ cao hơn mốc ngẫu nhiên`);
    setText('dEvidenceTrend',s.trend);setText('dEvidenceTrendDelta',s.trendDelta===null?'cần đủ 12 kỳ có so sánh ngẫu nhiên':`chênh ${s.trendDelta>=0?'+':''}${fmt(s.trendDelta,3)}`);
    setText('dEvidenceStatus',`${s.status}. ${s.action}`);
    const box=document.getElementById('dEvidenceRows');if(box){
      box.innerHTML=s.recent.length?s.recent.slice().reverse().map(r=>{
        const nb=Number(r.D?.null?.bestMean),delta=Number.isFinite(nb)?Number(r.D.best)-nb:null,label=typeof drawLabel==='function'?drawLabel(r.targetId):`#${String(r.targetId).padStart(5,'0')}`;
        return `<div class="dHistoryRow dEvidenceRow"><span>${esc(label)}</span><b>Trùng cao nhất ${Number(r.D.best)}/6</b><small>Ngẫu nhiên TB ${Number.isFinite(nb)?fmt(nb):'—'}</small><small>${delta===null?'Chưa có so sánh':`Chênh ${delta>=0?'+':''}${fmt(delta,3)}`}</small><small>${delta===null?'—':delta>0?'Cao hơn mốc':'Không cao hơn mốc'}</small></div>`;
      }).join(''):'<div class="notice">Chưa có kỳ D chính thức. Sau khi một bộ D được khóa trước kỳ quay và có kết quả chính thức, kỳ đó sẽ tự xuất hiện ở đây.</div>';
    }
  }

  let timer=null;
  function schedule(ms=100){clearTimeout(timer);timer=setTimeout(renderEvidence,ms)}

  root.PowerAIAdaptiveEvidence={VERSION,evidenceSummary,ensureCompactUI,renderEvidence,_test:{evidenceSummary}};

  if(typeof document!=='undefined'){
    const observer=new MutationObserver(()=>schedule(80));observer.observe(document.body,{subtree:true,childList:true});
    root.addEventListener('load',()=>{schedule(250);setTimeout(()=>schedule(0),1400);setInterval(()=>schedule(0),5000)},{once:true});
    root.addEventListener('powerai-auth-changed',()=>schedule(250));
    document.getElementById('refreshBtn')?.addEventListener('click',()=>schedule(1800));
    setTimeout(()=>schedule(0),450);
  }
})(typeof window!=='undefined'?window:globalThis);
