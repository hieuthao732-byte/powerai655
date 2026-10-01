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
      const html=s.recent.length?s.recent.slice().reverse().map(r=>{
        const nb=Number(r.D?.null?.bestMean),delta=Number.isFinite(nb)?Number(r.D.best)-nb:null,label=typeof drawLabel==='function'?drawLabel(r.targetId):`#${String(r.targetId).padStart(5,'0')}`;
        return `<div class="dHistoryRow dEvidenceRow"><span>${esc(label)}</span><b>Trùng cao nhất ${Number(r.D.best)}/6</b><small>Ngẫu nhiên TB ${Number.isFinite(nb)?fmt(nb):'—'}</small><small>${delta===null?'Chưa có so sánh':`Chênh ${delta>=0?'+':''}${fmt(delta,3)}`}</small><small>${delta===null?'—':delta>0?'Cao hơn mốc':'Không cao hơn mốc'}</small></div>`;
      }).join(''):'<div class="notice">Chưa có kỳ D chính thức. Sau khi một bộ D được khóa trước kỳ quay và có kết quả chính thức, kỳ đó sẽ tự xuất hiện ở đây.</div>';
      if(box.innerHTML!==html)box.innerHTML=html;
    }
  }

  let timer=null;
  function schedule(ms=100){clearTimeout(timer);timer=setTimeout(renderEvidence,ms)}

  root.PowerAIAdaptiveEvidence={VERSION,evidenceSummary,ensureCompactUI,renderEvidence,_test:{evidenceSummary}};

  if(typeof document!=='undefined'){
    root.addEventListener('load',()=>{schedule(250);setTimeout(()=>schedule(0),1400);setInterval(()=>schedule(0),4000)},{once:true});
    root.addEventListener('powerai-auth-changed',()=>schedule(250));
    document.getElementById('refreshBtn')?.addEventListener('click',()=>schedule(1800));
    setTimeout(()=>schedule(0),450);
  }
})(typeof window!=='undefined'?window:globalThis);

/* PowerAI Track D v1.3 — multi-window confidence evidence + experiment registry.
   Research display only. This layer never changes ticket generation, weights, locks,
   drift triggers, champion/challenger decisions, or official scoring.
*/
(function(root){
  'use strict';

  const VERSION='D-CONFIDENCE-1.3.0';
  const TARGET_WINDOW=24;
  const mean=a=>a.length?a.reduce((s,x)=>s+Number(x||0),0)/a.length:0;
  const std=a=>{if(a.length<2)return 0;const m=mean(a);return Math.sqrt(mean(a.map(x=>(Number(x)-m)**2)))};
  const fmt=(x,d=3)=>Number.isFinite(Number(x))?Number(x).toFixed(d):'—';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const setText=(id,value)=>{if(typeof document==='undefined')return;const n=document.getElementById(id),v=String(value??'');if(n&&n.textContent!==v)n.textContent=v};

  function officialRows(input){
    return (Array.isArray(input)?input:[]).filter(r=>r?.source==='feed'&&r?.D&&Number.isFinite(Number(r.D.best))).sort((a,b)=>Number(a.targetId)-Number(b.targetId));
  }

  function comparedRows(input){
    return officialRows(input).map(r=>{
      const nb=Number(r.D?.null?.bestMean),best=Number(r.D.best);
      return Number.isFinite(nb)?{targetId:Number(r.targetId),best,nullBest:nb,delta:best-nb,row:r}:null;
    }).filter(Boolean);
  }

  function confidenceSummary(input){
    const official=officialRows(input),compared=comparedRows(input).slice(-TARGET_WINDOW),deltas=compared.map(x=>x.delta),n=deltas.length;
    const avg=n?mean(deltas):null,se=n>1?std(deltas)/Math.sqrt(n):null,half=Number.isFinite(se)?1.96*se:null;
    const ciLow=Number.isFinite(half)?avg-half:null,ciHigh=Number.isFinite(half)?avg+half:null;
    const windows={};
    for(const k of [6,12,24])windows[k]=n>=k?mean(deltas.slice(-k)):null;
    const available=[6,12,24].map(k=>windows[k]).filter(Number.isFinite);
    const sign=x=>!Number.isFinite(x)||Math.abs(x)<=.05?0:x>0?1:-1;
    const signs=available.map(sign).filter(x=>x!==0);
    const agreement=available.length<2?'CHƯA ĐỦ CỬA SỔ':signs.length<2?'CHƯA RÕ':signs.every(x=>x===signs[0])?'ĐỒNG THUẬN':'CHƯA ĐỒNG THUẬN';
    const allPositive=available.length>=2&&available.every(x=>Number(x)>.05),allNegative=available.length>=2&&available.every(x=>Number(x)<-.05);
    let level='ĐANG TÍCH LŨY',action=`Cần thêm ${Math.max(0,6-n)} kỳ có so sánh ngẫu nhiên để bắt đầu đọc tín hiệu.`;
    if(n>=6&&n<12){level='BẰNG CHỨNG SỚM';action=`Cần thêm ${12-n} kỳ để có cửa sổ 12 kỳ.`}
    else if(n>=12&&agreement==='CHƯA ĐỒNG THUẬN'){level='KẾT QUẢ CHƯA ỔN ĐỊNH';action='Các cửa sổ gần và dài chưa cùng hướng; tiếp tục giữ nguyên mô hình và thu thập thêm kỳ.'}
    else if(n>=24&&Number.isFinite(ciLow)&&ciLow>0&&allPositive){level='TÍN HIỆU DƯƠNG ỔN ĐỊNH HƠN';action='Nhiều cửa sổ cùng dương và biên bất định của chênh trung bình đã nằm trên 0; vẫn tiếp tục kiểm chứng bằng kỳ mới.'}
    else if(n>=24&&Number.isFinite(ciHigh)&&ciHigh<0&&allNegative){level='TÍN HIỆU ÂM ỔN ĐỊNH HƠN';action='Nhiều cửa sổ cùng âm và biên bất định của chênh trung bình đã nằm dưới 0; cần xem lại phiên bản D nhưng không tự đổi chỉ vì chỉ số này.'}
    else if(n>=12&&Number.isFinite(avg)&&Math.abs(avg)<=.05){level='CHƯA THẤY KHÁC BIỆT RÕ';action=n<TARGET_WINDOW?`Cần thêm ${TARGET_WINDOW-n} kỳ để đủ cửa sổ 24 kỳ.`:'Tiếp tục theo dõi; chênh trung bình hiện gần mốc ngẫu nhiên.'}
    else if(n>=12&&Number.isFinite(ciLow)&&Number.isFinite(ciHigh)&&ciLow<=0&&ciHigh>=0){level=avg>=0?'CÓ TÍN HIỆU DƯƠNG, CẦN THÊM KỲ':'CÓ TÍN HIỆU ÂM, CẦN THÊM KỲ';action=n<TARGET_WINDOW?`Cần thêm ${TARGET_WINDOW-n} kỳ để đủ cửa sổ 24 kỳ; biên bất định hiện vẫn đi qua 0.`:'Biên bất định hiện vẫn đi qua 0 nên chưa coi là ổn định.'}
    else if(n>=12){level=avg>0?'CÓ TÍN HIỆU DƯƠNG, CẦN THÊM KỲ':'CÓ TÍN HIỆU ÂM, CẦN THÊM KỲ';action=n<TARGET_WINDOW?`Cần thêm ${TARGET_WINDOW-n} kỳ để đủ cửa sổ 24 kỳ.`:'Tiếp tục kiểm chứng bằng các kỳ mới.'}
    return{version:VERSION,official:official.length,compared:n,target:TARGET_WINDOW,meanDelta:Number.isFinite(avg)?+avg.toFixed(4):null,se:Number.isFinite(se)?+se.toFixed(4):null,ciLow:Number.isFinite(ciLow)?+ciLow.toFixed(4):null,ciHigh:Number.isFinite(ciHigh)?+ciHigh.toFixed(4):null,windows:Object.fromEntries(Object.entries(windows).map(([k,v])=>[k,Number.isFinite(v)?+v.toFixed(4):null])),agreement,level,action};
  }

  function registryKey(x,prefix='exp'){
    if(x?.fingerprint)return`fp:${x.fingerprint}`;
    if(x?.id)return`id:${x.id}`;
    return`${prefix}:${x?.engineId||x?.to||'D'}:${Number(x?.targetId||x?.startTarget||0)}`;
  }

  function deriveExperiments(state={}){
    const map=new Map(),put=(key,data)=>{const prev=map.get(key)||{};map.set(key,{...prev,...data,key})};
    for(const h of Array.isArray(state.hypotheses)?state.hypotheses:[]){
      const key=registryKey(h,'hyp');put(key,{engineId:h.engineId||h.id||'—',fingerprint:h.fingerprint||'',status:h.status||'CANDIDATE',createdAt:h.createdAt||'',targetId:Number(h.targetId||h.startTarget||0),problem:h.problem||'',change:h.change||'',minOfficial:Number(h.minOfficial||0),source:'HYPOTHESIS'});
    }
    for(const c of Array.isArray(state.challengers)?state.challengers:[]){
      const key=registryKey(c,'challenger');put(key,{engineId:c.engineId||c.id||'—',fingerprint:c.fingerprint||'',status:c.status||'SHADOW',targetId:Number(c.startTarget||0),change:c.change||'',minOfficial:Number(c.minOfficial||0),source:'CHALLENGER'});
    }
    for(const m of Array.isArray(state.memory)?state.memory:[]){
      const key=registryKey(m,'memory');put(key,{engineId:m.engineId||'—',fingerprint:m.fingerprint||'',status:m.status||'MEMORY',targetId:Number(m.targetId||0),at:m.at||'',delta:Number.isFinite(Number(m.delta))?Number(m.delta):null,by:m.by||'',source:'MEMORY'});
    }
    for(const l of Array.isArray(state.lineage)?state.lineage:[]){
      const key=registryKey(l,'lineage');put(key,{engineId:l.to||'—',fromEngine:l.from||'',fingerprint:l.fingerprint||'',status:'PROMOTED',targetId:Number(l.targetId||0),at:l.at||'',change:l.mutation||'',source:'LINEAGE'});
    }
    const currentKey=`active:${state.engineId||'D-AR1'}:${Number(state.lastChangeTarget||0)}`;
    put(currentKey,{engineId:state.engineId||'D-AR1',status:'ACTIVE',targetId:Number(state.lastChangeTarget||0),weights:state.weights||null,horizons:state.horizons||null,source:'CURRENT'});
    return[...map.values()].sort((a,b)=>Number(b.targetId||0)-Number(a.targetId||0)||String(b.at||b.createdAt||'').localeCompare(String(a.at||a.createdAt||'')));
  }

  const statusVi=s=>({ACTIVE:'ĐANG DÙNG',SHADOW:'ĐANG THỬ',CANDIDATE:'ỨNG VIÊN',PROMOTED:'ĐÃ NÂNG LÊN',REJECTED:'ĐÃ LOẠI',SUPERSEDED:'ĐÃ THAY',COOLDOWN:'ĐANG THEO DÕI',MEMORY:'ĐÃ GHI NHẬN'}[String(s||'').toUpperCase()]||String(s||'—'));

  function ensureV13UI(){
    if(typeof document==='undefined')return false;
    const pane=document.getElementById('adaptiveDTab'),hero=pane?.querySelector('.dHero');if(!pane||!hero)return false;
    if(!document.getElementById('dConfidenceMini')){
      const mini=document.createElement('div');mini.id='dConfidenceMini';mini.className='dConfidenceMini';mini.textContent='D v1.3 • bằng chứng: đang tích lũy';
      const evidenceMini=document.getElementById('dEvidenceMini');evidenceMini?.insertAdjacentElement('afterend',mini)||hero.appendChild(mini);
    }
    let conf=document.getElementById('dConfidencePanel');
    if(!conf){
      conf=document.createElement('section');conf.id='dConfidencePanel';conf.className='panel dAdvancedPanel dConfidencePanel';conf.innerHTML=`
        <div class="head"><div><div class="sectionKicker dText">D v1.3 • ĐỘ TIN CẬY NHIỀU KỲ</div><h2>🧭 Mức bằng chứng hiện tại</h2><p>Đọc chênh lệch của D so với bộ ngẫu nhiên tương đương qua nhiều cửa sổ. Đây là bằng chứng quan sát, không phải xác suất trúng.</p></div></div>
        <div class="dStatusGrid dConfidenceGrid">
          <div class="dStat"><span>Kỳ có so sánh</span><b id="dConfSample">0/24</b><small id="dConfOfficial">0 kỳ chính thức</small></div>
          <div class="dStat"><span>Chênh trung bình</span><b id="dConfMean">—</b><small>D trừ mốc ngẫu nhiên</small></div>
          <div class="dStat"><span>Biên bất định 95%</span><b id="dConfCI">—</b><small>của chênh trung bình</small></div>
          <div class="dStat"><span>Đồng thuận 6 / 12 / 24</span><b id="dConfAgreement">—</b><small id="dConfWindows">—</small></div>
        </div>
        <div id="dConfState" class="notice">Đang tích lũy dữ liệu.</div>`;
      const anchor=document.getElementById('dEvidencePanel')||document.getElementById('dAdvancedToggleWrap')||hero;anchor.insertAdjacentElement('afterend',conf);
    }
    let reg=document.getElementById('dExperimentPanel');
    if(!reg){
      reg=document.createElement('section');reg.id='dExperimentPanel';reg.className='panel dAdvancedPanel dExperimentPanel';reg.innerHTML=`
        <div class="head"><div><div class="sectionKicker dText">D v1.3 • NHẬT KÝ PHIÊN BẢN</div><h2>🗂 Phiên bản đã dùng và đã thử</h2><p>Gom lịch sử phiên bản đang dùng, bản thử, bản đã nâng lên hoặc đã loại từ state nghiên cứu của D.</p></div></div>
        <div class="dStatusGrid dRegistryStats"><div class="dStat"><span>Phiên bản đang dùng</span><b id="dRegistryCurrent">—</b><small id="dRegistryCurrentNote">—</small></div><div class="dStat"><span>Tổng mục đã ghi</span><b id="dRegistryCount">0</b><small>phiên bản + thử nghiệm</small></div><div class="dStat"><span>Đã nâng lên</span><b id="dRegistryPromoted">0</b><small>qua vòng kiểm tra</small></div><div class="dStat"><span>Đã loại</span><b id="dRegistryRejected">0</b><small>không qua kiểm tra</small></div></div>
        <div id="dRegistryRows" class="dHistory"></div>`;
      conf.insertAdjacentElement('afterend',reg);
    }
    return true;
  }

  function renderV13(){
    if(typeof document==='undefined'||!ensureV13UI())return;
    const logs=root.PowerAIAdaptiveDApp?.getLogs?.()||[],state=root.PowerAIAdaptiveDApp?.getState?.()||{},c=confidenceSummary(logs),registry=deriveExperiments(state);
    setText('dConfidenceMini',`D v1.3 • Bằng chứng: ${c.level} • ${c.compared}/${c.target} kỳ`);
    setText('dConfSample',`${c.compared}/${c.target}`);setText('dConfOfficial',`${c.official} kỳ D chính thức`);
    setText('dConfMean',c.meanDelta===null?'—':`${c.meanDelta>=0?'+':''}${fmt(c.meanDelta)}`);
    setText('dConfCI',c.ciLow===null?'—':`[${c.ciLow>=0?'+':''}${fmt(c.ciLow)}, ${c.ciHigh>=0?'+':''}${fmt(c.ciHigh)}]`);
    setText('dConfAgreement',c.agreement);
    setText('dConfWindows',[6,12,24].map(k=>`${k}: ${c.windows[k]===null?'—':`${c.windows[k]>=0?'+':''}${fmt(c.windows[k])}`}`).join(' • '));
    setText('dConfState',`${c.level}. ${c.action} Chỉ số này không phải xác suất trúng.`);
    setText('dRegistryCurrent',state.engineId||'D-AR1');setText('dRegistryCurrentNote',`bắt đầu từ mốc #${String(Number(state.lastChangeTarget||0)).padStart(5,'0')}`);
    setText('dRegistryCount',String(registry.length));setText('dRegistryPromoted',String(registry.filter(x=>x.status==='PROMOTED').length));setText('dRegistryRejected',String(registry.filter(x=>x.status==='REJECTED').length));
    const box=document.getElementById('dRegistryRows');if(box){
      const rows=registry.slice(0,14),html=rows.length?rows.map(x=>{
        const target=Number(x.targetId)>0?`#${String(Number(x.targetId)).padStart(5,'0')}`:'—',detail=x.change||x.problem||x.by||x.fromEngine||'Không có ghi chú thêm';
        return `<div class="dHistoryRow dRegistryRow"><span>${esc(x.engineId)}</span><b>${esc(statusVi(x.status))}</b><small>${esc(target)}</small><small>${esc(detail)}</small></div>`;
      }).join(''):'<div class="notice">Chưa có thử nghiệm nào ngoài phiên bản D hiện tại.</div>';
      if(box.innerHTML!==html)box.innerHTML=html;
    }
  }

  let timer=null;
  function schedule(ms=120){clearTimeout(timer);timer=setTimeout(renderV13,ms)}
  root.PowerAIAdaptiveConfidence={VERSION,confidenceSummary,deriveExperiments,renderV13,_test:{confidenceSummary,deriveExperiments}};

  if(typeof document!=='undefined'){
    root.addEventListener('load',()=>{schedule(350);setTimeout(()=>schedule(0),1600);setInterval(()=>schedule(0),5000)},{once:true});
    root.addEventListener('powerai-auth-changed',()=>schedule(250));
    document.getElementById('refreshBtn')?.addEventListener('click',()=>schedule(1800));
    setTimeout(()=>schedule(0),650);
  }
})(typeof window!=='undefined'?window:globalThis);
