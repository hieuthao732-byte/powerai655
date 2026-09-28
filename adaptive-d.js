/* PowerAI Track D — Adaptive Research Engine core
   Research-only. Scores are internal rankings, not winning probabilities.
   This file is deliberately pure/deterministic so every model can be replayed
   from target + cutoff + engine version + seed + state snapshot.
*/
(function(root){
  'use strict';

  const VERSION='D-0.1.0';
  const N=55, PICK=6;
  const DEFAULT_HORIZONS=[30,60,120,250];
  const DEFAULT_WEIGHTS={D1:.25,D2:.25,D3:.25,D4:.25};

  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
  const median=a=>{if(!a.length)return 0;const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2};
  const std=a=>{if(a.length<2)return 0;const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)*(x-m))))};
  const seeded=seed=>{let x=seed>>>0;return()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296}};
  const edgeKey=(a,b)=>a<b?`${a}-${b}`:`${b}-${a}`;
  const overlap=(a,b)=>{const s=new Set(a);let n=0;for(const x of b)if(s.has(x))n++;return n};
  const hits=(a,b)=>{const s=new Set(b);let n=0;for(const x of a)if(s.has(x))n++;return n};
  const validNums=d=>(d?.result||d?.actual||[]).map(Number).filter(x=>Number.isInteger(x)&&x>=1&&x<=N).slice(0,PICK).sort((a,b)=>a-b);
  const hashText=s=>{let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return('00000000'+(h>>>0).toString(16)).slice(-8).toUpperCase()};
  const hashPortfolio=P=>hashText(P.map(t=>t.join('-')).join('|'));

  function normalizeHistory(draws,targetId){
    return (draws||[])
      .map(d=>({id:Number(d?.id),result:validNums(d)}))
      .filter(d=>Number.isFinite(d.id)&&d.result.length===PICK&&d.id<Number(targetId))
      .sort((a,b)=>a.id-b.id);
  }

  function rank01(values){
    const pairs=[];for(let i=1;i<=N;i++)pairs.push([i,Number(values[i])||0]);
    pairs.sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
    const out=Array(N+1).fill(0);
    if(pairs.length===1){out[pairs[0][0]]=.5;return out}
    pairs.forEach((p,i)=>out[p[0]]=i/(pairs.length-1));
    return out;
  }

  function drawShape(nums){
    const a=[...nums].sort((x,y)=>x-y),sum=a.reduce((s,x)=>s+x,0),odd=a.filter(x=>x%2).length,low=a.filter(x=>x<=27).length;
    let consecutive=0;for(let i=1;i<a.length;i++)if(a[i]===a[i-1]+1)consecutive++;
    return{sum,odd,low,spread:a.at(-1)-a[0],consecutive};
  }
  function shapeDistance(a,b){
    return Math.abs(a.sum-b.sum)/70 + Math.abs(a.odd-b.odd)/3 + Math.abs(a.low-b.low)/3 + Math.abs(a.spread-b.spread)/30 + Math.abs(a.consecutive-b.consecutive)/2;
  }

  function frequencyExpert(hist){
    const c=Array(N+1).fill(0);for(const d of hist)for(const n of d.result)c[n]++;
    const r=rank01(c);return{node:r,raw:c};
  }

  function residualPairExpert(hist){
    const n=Math.max(1,hist.length),freq=Array(N+1).fill(0),pair=Array.from({length:N+1},()=>Array(N+1).fill(0));
    for(const d of hist){
      for(const x of d.result)freq[x]++;
      for(let i=0;i<PICK;i++)for(let j=i+1;j<PICK;j++){const a=d.result[i],b=d.result[j];pair[a][b]++;pair[b][a]++}
    }
    const residual=Array.from({length:N+1},()=>Array(N+1).fill(0)),nodeRaw=Array(N+1).fill(0);
    for(let i=1;i<=N;i++)for(let j=i+1;j<=N;j++){
      const expected=n*(freq[i]/n)*(freq[j]/n),obs=pair[i][j];
      const z=(obs-expected)/Math.sqrt(expected+1.5),shrink=n/(n+35),v=z*shrink;
      residual[i][j]=residual[j][i]=v;nodeRaw[i]+=v;nodeRaw[j]+=v;
    }
    return{node:rank01(nodeRaw),raw:nodeRaw,matrix:residual};
  }

  function gapBucket(g){return g<=2?0:g<=6?1:g<=12?2:3}
  function gapTransitionExpert(hist){
    const prior=PICK/N,hit=Array.from({length:4},()=>Array(N+1).fill(0)),seen=Array.from({length:4},()=>Array(N+1).fill(0)),gaps=Array(N+1).fill(20);
    for(const d of hist){
      const set=new Set(d.result);
      for(let num=1;num<=N;num++){
        const b=gapBucket(gaps[num]);seen[b][num]++;if(set.has(num))hit[b][num]++;
      }
      for(let num=1;num<=N;num++)gaps[num]=set.has(num)?0:gaps[num]+1;
    }
    const raw=Array(N+1).fill(0);
    for(let num=1;num<=N;num++){
      const b=gapBucket(gaps[num]),h=hit[b][num],s=seen[b][num];
      const post=(h+prior*10)/(s+10);
      raw[num]=(post-prior)/Math.sqrt(prior*(1-prior)+1e-9);
    }
    return{node:rank01(raw),raw,currentBucket:gaps.map(g=>gapBucket(g))};
  }

  function shapeConditionalExpert(hist){
    const raw=Array(N+1).fill(0),mass=Array(N+1).fill(0);
    if(hist.length<4)return frequencyExpert(hist);
    const anchor=drawShape(hist.at(-1).result);
    for(let k=1;k<hist.length;k++){
      const prev=drawShape(hist[k-1].result),w=Math.exp(-shapeDistance(anchor,prev));
      for(let n=1;n<=N;n++)mass[n]+=w;
      for(const n of hist[k].result)raw[n]+=w;
    }
    for(let n=1;n<=N;n++)raw[n]=raw[n]/Math.max(1e-9,mass[n]);
    return{node:rank01(raw),raw,anchor};
  }

  function powerVector(matrix,seed=1,iters=24){
    const rnd=seeded(seed),v=Array(N+1).fill(0);for(let i=1;i<=N;i++)v[i]=.5+rnd();
    for(let t=0;t<iters;t++){
      const u=Array(N+1).fill(0);let norm=0;
      for(let i=1;i<=N;i++){let s=0;for(let j=1;j<=N;j++)s+=Math.max(0,matrix[i][j]||0)*v[j];u[i]=s;norm+=s*s}
      norm=Math.sqrt(norm)||1;for(let i=1;i<=N;i++)v[i]=u[i]/norm;
    }
    return v;
  }
  function spectralResidualExpert(hist,seed=1){
    const r=residualPairExpert(hist),v=powerVector(r.matrix,seed),raw=Array(N+1).fill(0);
    for(let i=1;i<=N;i++)raw[i]=v[i];
    return{node:rank01(raw),raw,vector:v,matrix:r.matrix};
  }

  function aggregateAcrossHorizons(hist,horizons,targetId){
    const names=['D1','D2','D3','D4'],per=Object.fromEntries(names.map(k=>[k,[]])),pairMats=[];
    for(const h of horizons){
      const w=hist.slice(-Math.min(h,hist.length));if(w.length<8)continue;
      const e={D1:residualPairExpert(w),D2:gapTransitionExpert(w),D3:shapeConditionalExpert(w),D4:spectralResidualExpert(w,(Number(targetId)*7919+h)>>>0)};
      names.forEach(k=>per[k].push({h,node:e[k].node,raw:e[k].raw}));
      pairMats.push({h,matrix:e.D1.matrix});
    }
    if(!per.D1.length){
      const w=hist.slice();const e={D1:residualPairExpert(w),D2:gapTransitionExpert(w),D3:shapeConditionalExpert(w),D4:spectralResidualExpert(w,Number(targetId)||1)};
      names.forEach(k=>per[k].push({h:w.length,node:e[k].node,raw:e[k].raw}));pairMats.push({h:w.length,matrix:e.D1.matrix});
    }
    const expert={},stability=Array(N+1).fill(0);
    for(const k of names){
      const agg=Array(N+1).fill(0);for(let n=1;n<=N;n++)agg[n]=mean(per[k].map(x=>x.node[n]));expert[k]=agg;
    }
    for(let n=1;n<=N;n++){
      const ranks=[];for(const k of names)for(const x of per[k])ranks.push(x.node[n]);stability[n]=clamp(1-std(ranks)*2.2,0,1);
    }
    const pair=Array.from({length:N+1},()=>Array(N+1).fill(0));
    for(let i=1;i<=N;i++)for(let j=1;j<=N;j++)pair[i][j]=median(pairMats.map(x=>x.matrix[i][j]||0));
    return{expert,stability,pair,windows:per};
  }

  function normalizeWeights(input=DEFAULT_WEIGHTS,min=.12,max=.55){
    const keys=['D1','D2','D3','D4'],raw={};let s=0;
    for(const k of keys){raw[k]=clamp(Number(input?.[k])||0,min,max);s+=raw[k]}
    for(const k of keys)raw[k]/=s;
    // one more bounded normalization pass
    let free=keys.filter(k=>raw[k]>min&&raw[k]<max),fixed=keys.filter(k=>!free.includes(k));
    const fixedSum=fixed.reduce((a,k)=>a+clamp(raw[k],min,max),0),freeRaw=free.reduce((a,k)=>a+raw[k],0),room=1-fixedSum;
    for(const k of fixed)raw[k]=clamp(raw[k],min,max);
    if(free.length&&freeRaw>0)for(const k of free)raw[k]=clamp(raw[k]/freeRaw*room,min,max);
    s=keys.reduce((a,k)=>a+raw[k],0);for(const k of keys)raw[k]/=s;
    return raw;
  }

  function updateWeights(weights,rewards,{eta=.08,min=.12,max=.55}={}){
    const w=normalizeWeights(weights,min,max),next={};let z=0;
    for(const k of ['D1','D2','D3','D4']){next[k]=w[k]*Math.exp(eta*clamp(Number(rewards?.[k])||0,-2,2));z+=next[k]}
    for(const k of Object.keys(next))next[k]/=z||1;
    return normalizeWeights(next,min,max);
  }

  function buildModel(draws,targetId,state={}){
    const hist=normalizeHistory(draws,targetId);if(hist.length<12)throw new Error('Track D cần ít nhất 12 kỳ lịch sử trước target.');
    const horizons=(state.horizons||DEFAULT_HORIZONS).filter(x=>Number(x)>0),a=aggregateAcrossHorizons(hist,horizons,targetId),weights=normalizeWeights(state.weights||DEFAULT_WEIGHTS);
    const node=Array(N+1).fill(0),contrib=Array.from({length:N+1},()=>({}));
    for(let n=1;n<=N;n++){
      let s=0;for(const k of ['D1','D2','D3','D4']){const v=a.expert[k][n];contrib[n][k]=v;s+=weights[k]*v}
      const stabilityFactor=.72+.28*a.stability[n];node[n]=s*stabilityFactor;contrib[n].stability=a.stability[n];
    }
    const cutoff=hist.at(-1).id,engineId=state.engineId||'D-AR1',modelHash=hashText(JSON.stringify({engineId,targetId:Number(targetId),cutoff,weights,node:node.slice(1).map(x=>+x.toFixed(6))}));
    return{version:VERSION,engineId,targetId:Number(targetId),cutoffId:cutoff,horizons,weights,nodeScores:node,pairMatrix:a.pair,expertScores:a.expert,stability:a.stability,contributions:contrib,modelHash,historyCount:hist.length};
  }

  function weightedTicket(model,rnd){
    const chosen=[];while(chosen.length<PICK){
      let total=0,weights=[];
      for(let n=1;n<=N;n++)if(!chosen.includes(n)){
        const base=.12+Math.pow(clamp(model.nodeScores[n],0,1),1.7),pairBoost=chosen.length?mean(chosen.map(x=>Math.max(-1,Math.min(1,model.pairMatrix[n][x]||0))))*.06:0,w=Math.max(.01,base+pairBoost);weights.push([n,w]);total+=w;
      }
      let r=rnd()*total,pick=weights.at(-1)[0];for(const [n,w] of weights){r-=w;if(r<=0){pick=n;break}}
      chosen.push(pick);
    }
    return chosen.sort((a,b)=>a-b);
  }

  function ticketShapePenalty(t){
    const s=drawShape(t);let p=0;
    if(s.odd<2||s.odd>4)p+=.18;if(s.low<2||s.low>4)p+=.18;if(s.sum<105||s.sum>225)p+=.12;if(s.spread<22)p+=.08;if(s.consecutive>2)p+=.10;return p;
  }
  function baseTicketScore(t,model){
    const node=mean(t.map(n=>model.nodeScores[n]||0));let pair=0,c=0;
    for(let i=0;i<PICK;i++)for(let j=i+1;j<PICK;j++){pair+=clamp(model.pairMatrix[t[i]][t[j]]||0,-2,2);c++}
    return node+.045*(pair/Math.max(1,c))-ticketShapePenalty(t);
  }

  function buildPortfolio(model,{count=20,candidates=3200,seed=null,maxExposure=4}={}){
    const rnd=seeded(seed==null?((model.targetId*2654435761)>>>0):seed),map=new Map();
    for(let i=0;i<candidates;i++){const t=weightedTicket(model,rnd),k=t.join('-');if(!map.has(k))map.set(k,{a:t,base:baseTicketScore(t,model)})}
    const pool=[...map.values()].sort((a,b)=>b.base-a.base),selected=[],exp=Array(N+1).fill(0),pairs=new Map(),covered=new Set();
    while(selected.length<count&&pool.length){
      let bestI=-1,best=-Infinity;
      const scan=Math.min(pool.length,900);
      for(let i=0;i<scan;i++){
        const c=pool[i],ov=selected.map(x=>overlap(c.a,x.a)),mx=ov.length?Math.max(...ov):0;if(mx>=4)continue;
        const overExp=c.a.filter(n=>exp[n]>=maxExposure).length;if(overExp)continue;
        let pairReuse=0;for(let x=0;x<PICK;x++)for(let y=x+1;y<PICK;y++)pairReuse+=pairs.get(edgeKey(c.a[x],c.a[y]))||0;
        const newCov=c.a.filter(n=>!covered.has(n)).length,score=c.base+.035*newCov-.055*pairReuse-.075*ov.reduce((s,x)=>s+x*x,0);
        if(score>best){best=score;bestI=i}
      }
      if(bestI<0){maxExposure++;if(maxExposure>6)break;continue}
      const pick=pool.splice(bestI,1)[0];selected.push(pick);for(const n of pick.a){exp[n]++;covered.add(n)}for(let x=0;x<PICK;x++)for(let y=x+1;y<PICK;y++){const k=edgeKey(pick.a[x],pick.a[y]);pairs.set(k,(pairs.get(k)||0)+1)}
    }
    const tickets=selected.map(x=>x.a),audit=auditPortfolio(tickets);
    return{tickets,ranked:selected.map((x,i)=>({rank:i+1,a:x.a,score:x.base})),audit,hash:hashPortfolio(tickets),seed:seed==null?((model.targetId*2654435761)>>>0):seed,engineId:model.engineId,modelHash:model.modelHash};
  }

  function auditPortfolio(P){
    const exp=Array(N+1).fill(0),pairs=new Map();let maxOverlap=0;
    for(let i=0;i<P.length;i++){for(const n of P[i])exp[n]++;for(let a=0;a<PICK;a++)for(let b=a+1;b<PICK;b++){const k=edgeKey(P[i][a],P[i][b]);pairs.set(k,(pairs.get(k)||0)+1)}for(let j=0;j<i;j++)maxOverlap=Math.max(maxOverlap,overlap(P[i],P[j]))}
    const used=exp.slice(1).filter(Boolean),slots=P.length*PICK,entropy=used.length?(-used.reduce((s,x)=>{const p=x/slots;return s+p*Math.log(p)},0)/Math.log(N)):0;
    return{tickets:P.length,coverage:used.length,minExposure:used.length?Math.min(...used):0,maxExposure:used.length?Math.max(...used):0,repeatedPairs:[...pairs.values()].filter(x=>x>1).length,maxOverlap,entropy:+entropy.toFixed(4)};
  }

  function scorePortfolio(P,actual){
    const a=(actual||[]).map(Number).filter(x=>x>=1&&x<=N).slice(0,PICK),hs=P.map(t=>hits(t,a)),best=hs.length?Math.max(...hs):0;
    return{best,total:hs.reduce((s,x)=>s+x,0),g3:hs.filter(x=>x>=3).length,g4:hs.filter(x=>x>=4).length,g5:hs.filter(x=>x>=5).length,g6:hs.filter(x=>x>=6).length,hits:hs};
  }

  function relabelPortfolio(P,rnd){const perm=[...Array(N)].map((_,i)=>i+1);for(let i=N-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[perm[i],perm[j]]=[perm[j],perm[i]]}const m=Array(N+1);for(let i=1;i<=N;i++)m[i]=perm[i-1];return P.map(t=>t.map(n=>m[n]).sort((a,b)=>a-b))}
  function matchedNullBenchmark(P,actual,{trials=400,seed=99173}={}){
    const obs=scorePortfolio(P,actual),rnd=seeded(seed),best=[],total=[];
    for(let i=0;i<trials;i++){const s=scorePortfolio(relabelPortfolio(P,rnd),actual);best.push(s.best);total.push(s.total)}
    const geBest=best.filter(x=>x>=obs.best).length,geTotal=total.filter(x=>x>=obs.total).length;
    return{observed:obs,trials,bestMean:mean(best),totalMean:mean(total),pBest:(geBest+1)/(trials+1),pTotal:(geTotal+1)/(trials+1)};
  }

  function officialDLogs(logs){return (logs||[]).filter(x=>x&&x.source==='feed'&&x.D&&Number.isFinite(Number(x.D.best))).sort((a,b)=>Number(a.targetId)-Number(b.targetId))}
  function evaluateDrift(logs,{window=12,cooldown=8,lastChangeTarget=0}={}){
    const rows=officialDLogs(logs),recent=rows.slice(-window),lastId=rows.length?Number(rows.at(-1).targetId):0;
    if(recent.length<window)return{trigger:false,state:'WARMUP',reason:`${recent.length}/${window} kỳ official`,sample:recent.length};
    if(lastChangeTarget&&lastId-lastChangeTarget<cooldown)return{trigger:false,state:'COOLDOWN',reason:`${lastId-lastChangeTarget}/${cooldown} kỳ từ lần đổi engine`,sample:recent.length};
    const avgBest=mean(recent.map(x=>Number(x.D.best)||0)),high=recent.filter(x=>Number(x.D.best)>=4).length;
    const nullBest=mean(recent.map(x=>Number(x.D?.null?.bestMean)).filter(Number.isFinite));
    const prev=rows.slice(-(window*2),-window),prevAvg=prev.length===window?mean(prev.map(x=>Number(x.D.best)||0)):null;
    const belowNull=Number.isFinite(nullBest)?avgBest<=nullBest+.05:false,stagnant=prevAvg==null?true:avgBest<=prevAvg+.05,noHigh=high===0;
    const trigger=belowNull&&stagnant&&noHigh;
    return{trigger,state:trigger?'CHALLENGER_TEST':'STABLE',reason:trigger?'Rolling performance không vượt matched-null và không cải thiện.':'Chưa đủ bằng chứng để đổi architecture.',sample:recent.length,avgBest,nullBest:Number.isFinite(nullBest)?nullBest:null,prevAvg,high};
  }

  function composite(rows,key){
    const a=rows.map(x=>x?.[key]).filter(s=>s&&Number.isFinite(Number(s.best)));if(!a.length)return{n:0,score:0};
    const avgBest=mean(a.map(s=>Number(s.best)||0))/6,g3=a.filter(s=>Number(s.best)>=3).length/a.length,g4=a.filter(s=>Number(s.best)>=4).length/a.length,total=mean(a.map(s=>Number(s.total)||0))/(20*6);
    return{n:a.length,avgBest,g3,g4,total,score:.45*avgBest+.25*g3+.20*g4+.10*total};
  }
  function promotionDecision(shadowRows,{minRows=6,margin=.025}={}){
    const champ=composite(shadowRows,'champion'),chall=composite(shadowRows,'challenger');
    if(champ.n<minRows||chall.n<minRows)return{promote:false,state:'SHADOW',reason:`Cần tối thiểu ${minRows} kỳ shadow.`,champion:champ,challenger:chall};
    const delta=chall.score-champ.score,promote=delta>=margin;
    return{promote,state:promote?'PROMOTE':'REJECT',reason:promote?`Challenger vượt composite margin ${(delta*100).toFixed(2)} điểm %.`:`Challenger chưa vượt margin ${(margin*100).toFixed(1)} điểm %.`,delta,champion:champ,challenger:chall};
  }

  function disagreement(model){
    const d=[];for(let n=1;n<=N;n++)d.push(std(['D1','D2','D3','D4'].map(k=>model.expertScores[k][n])));return mean(d)
  }
  function confidenceGate(model,{threshold=.32}={}){const x=disagreement(model);return{confidence:x<=threshold?'NORMAL':'LOW_CONFIDENCE',disagreement:x,threshold}}

  function newResearchState(previous={}){
    return{schema:1,engineId:previous.engineId||'D-AR1',weights:normalizeWeights(previous.weights||DEFAULT_WEIGHTS),lastChangeTarget:Number(previous.lastChangeTarget)||0,status:previous.status||'STABLE',challengers:Array.isArray(previous.challengers)?previous.challengers.slice(0,2):[],memory:Array.isArray(previous.memory)?previous.memory:[],hypotheses:Array.isArray(previous.hypotheses)?previous.hypotheses:[]};
  }
  function registerHypothesis(state,h){
    const s=newResearchState(state),id=h?.id||`H-${Date.now()}`;s.hypotheses.push({id,createdAt:new Date().toISOString(),problem:String(h?.problem||''),change:String(h?.change||''),successMetric:String(h?.successMetric||'composite'),minOfficial:Number(h?.minOfficial)||6,status:'SHADOW'});return s;
  }
  function retireEngine(state,entry){const s=newResearchState(state);s.memory.push({...entry,status:'RETIRED',retiredAt:new Date().toISOString()});return s}

  const API={VERSION,N,PICK,DEFAULT_HORIZONS,DEFAULT_WEIGHTS,normalizeHistory,drawShape,shapeDistance,frequencyExpert,residualPairExpert,gapTransitionExpert,shapeConditionalExpert,spectralResidualExpert,normalizeWeights,updateWeights,buildModel,buildPortfolio,auditPortfolio,scorePortfolio,matchedNullBenchmark,evaluateDrift,promotionDecision,confidenceGate,newResearchState,registerHypothesis,retireEngine,hashPortfolio};
  root.PowerAIAdaptiveD=API;
})(typeof window!=='undefined'?window:globalThis);
