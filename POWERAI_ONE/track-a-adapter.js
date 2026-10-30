/* PowerAI ONE — Track A compatibility extraction.
 * Exact legacy A7 algorithm block extracted from app.js. Keep frozen until parity is proven.
 * This adapter is pure with respect to application state: target ID in, candidate portfolio out.
 */
(function(root){
"use strict";
function seeded(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function edgeKey(a,b){return a<b?`${a}-${b}`:`${b}-${a}`}
function overlap(a,b){const s=new Set(a);let n=0;for(const x of b)if(s.has(x))n++;return n}
function hits(a,b){const s=new Set(b);let n=0;for(const x of a)if(s.has(x))n++;return n}
function balls(a,actual=[]){const s=new Set(actual);return a.map(n=>`<span class="ball ${s.has(n)?'hit':''}">${String(n).padStart(2,"0")}</span>`).join("")}
function simpleHash(P){let h=2166136261>>>0,s=P.map(t=>t.join("-")).join("|");for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return("00000000"+(h>>>0).toString(16)).slice(-8).toUpperCase()}

/* TRACK A — RC7.0 SIMULATION-OPTIMIZED GEOMETRY
   No historical lottery data is used. A searches many valid incidence shapes,
   evaluates them on common uniform synthetic outcomes, and selects a robust shape.
   Hard geometry invariants stay compatible with Track C.
*/
function generateIncidenceShape(target,salt=0){
  const baseSeed=(Number(target)*7919+550055+Math.imul(salt+1,2246822519))>>>0;
  for(let restart=0;restart<220;restart++){
    const rnd=seeded((baseSeed+Math.imul(restart+1,104729))>>>0),used=new Set(),triCnt=Array(20).fill(0),triangles=[];
    let fail=false;
    for(let q=0;q<10;q++){
      const feasible=[];
      for(let a=0;a<18;a++)for(let b=a+1;b<19;b++)for(let c=b+1;c<20;c++){
        if(triCnt[a]>=3||triCnt[b]>=3||triCnt[c]>=3)continue;
        if(used.has(edgeKey(a,b))||used.has(edgeKey(a,c))||used.has(edgeKey(b,c)))continue;
        const next=triCnt.slice();next[a]++;next[b]++;next[c]++;
        let variance=0,maxv=0;for(const x of next){variance+=(x-1.5)*(x-1.5);maxv=Math.max(maxv,x)}
        feasible.push({tri:[a,b,c],score:variance+maxv*.12+rnd()*.08});
      }
      if(!feasible.length){fail=true;break}
      feasible.sort((x,y)=>x.score-y.score);
      const pick=feasible[Math.floor(rnd()*Math.min(24,feasible.length))].tri;
      triangles.push(pick);pick.forEach(t=>triCnt[t]++);
      used.add(edgeKey(pick[0],pick[1]));used.add(edgeKey(pick[0],pick[2]));used.add(edgeKey(pick[1],pick[2]));
    }
    if(fail)continue;
    const rem=triCnt.map(x=>6-x),edges=[];
    for(let step=0;step<45;step++){
      const active=[...Array(20).keys()].filter(i=>rem[i]>0);if(!active.length)break;
      const mx=Math.max(...active.map(i=>rem[i])),us=active.filter(i=>rem[i]===mx),u=us[Math.floor(rnd()*us.length)];
      let vs=active.filter(v=>v!==u&&rem[v]>0&&!used.has(edgeKey(u,v)));if(!vs.length){fail=true;break}
      const vmax=Math.max(...vs.map(v=>rem[v]));vs=vs.filter(v=>rem[v]>=vmax-1);const v=vs[Math.floor(rnd()*vs.length)];
      used.add(edgeKey(u,v));edges.push([u,v]);rem[u]--;rem[v]--;
    }
    if(fail||edges.length!==45||rem.some(x=>x!==0))continue;

    // Canonical labels during structural search: 1..10 are triple-exposure slots, 11..55 double.
    const P=Array.from({length:20},()=>[]);
    triangles.forEach((tri,i)=>tri.forEach(t=>P[t].push(i+1)));
    edges.forEach((e,i)=>e.forEach(t=>P[t].push(i+11)));
    P.forEach(t=>t.sort((a,b)=>a-b));
    const a=auditGeo(P);
    if(a.coverage===55&&a.repeatedPairs===0&&a.maxOverlap<=1&&a.minExp===2&&a.maxExp===3)
      return{tickets:P,shapeSeed:baseSeed,audit:a};
  }
  throw new Error("Không dựng được cấu trúc A hợp lệ.");
}
function relabelIncidenceShape(P,target,shapeSeed){
  const rnd=seeded((Number(target)*2654435761+(shapeSeed||0)+700701)>>>0);
  const labels=shuffle([...Array(55)].map((_,i)=>i+1),rnd),map=Array(56).fill(0);
  for(let i=1;i<=55;i++)map[i]=labels[i-1];
  return P.map(t=>t.map(n=>map[n]).sort((a,b)=>a-b));
}
function pop32(x){x=x>>>0;x=x-((x>>>1)&0x55555555);x=(x&0x33333333)+((x>>>2)&0x33333333);return((((x+(x>>>4))&0x0F0F0F0F)*0x01010101)>>>24)}
function mask6(a){let lo=0,hi=0;for(const n of a){if(n<=32)lo=(lo|(1<<(n-1)))>>>0;else hi=(hi|(1<<(n-33)))>>>0}return[lo,hi]}
function uniformOutcomeMasks(seed,count){
  const rnd=seeded(seed),out=[];
  for(let k=0;k<count;k++){
    const s=new Set();while(s.size<6)s.add(1+Math.floor(rnd()*55));
    out.push(mask6([...s]));
  }
  return out;
}
function geometryStructureStats(P){
  const a=auditGeo(P),exp=a.exp,triLoad=[],degree=[],adj=Array.from({length:20},()=>Array(20).fill(false));
  for(let i=0;i<P.length;i++){
    triLoad.push(P[i].filter(n=>exp[n]===3).length);
    let d=0;for(let j=0;j<P.length;j++)if(i!==j&&overlap(P[i],P[j])>0){d++;adj[i][j]=true}degree.push(d);
  }
  const mean=x=>x.reduce((s,v)=>s+v,0)/x.length,sd=x=>{const m=mean(x);return Math.sqrt(mean(x.map(v=>(v-m)*(v-m))))};
  let graphTriangles=0;for(let i=0;i<18;i++)for(let j=i+1;j<19;j++)for(let k=j+1;k<20;k++)if(adj[i][j]&&adj[i][k]&&adj[j][k])graphTriangles++;
  return{triLoad,degree,triLoadSd:sd(triLoad),degreeSd:sd(degree),graphTriangles};
}
function simulateGeometry(P,samples,detail=false){
  const tm=P.map(mask6),hist=Array(7).fill(0),n=samples.length;
  const td=detail?P.map(()=>({topCredit:0,uniqueBest:0,ge3:0,marginal:0})):null;
  const hs=Array(P.length).fill(0);
  for(const sm of samples){
    let best=-1,second=-1,ties=0;
    for(let i=0;i<tm.length;i++){
      const h=pop32((tm[i][0]&sm[0])>>>0)+pop32((tm[i][1]&sm[1])>>>0);hs[i]=h;
      if(h>best){second=best;best=h;ties=1}else if(h===best){ties++}else if(h>second)second=h;
    }
    hist[best]++;
    if(detail){
      for(let i=0;i<hs.length;i++){
        if(hs[i]>=3)td[i].ge3++;
        if(hs[i]===best)td[i].topCredit+=1/ties;
      }
      if(ties===1){const u=hs.indexOf(best);td[u].uniqueBest++;td[u].marginal+=Math.max(0,best-second)}
    }
  }
  const ge=k=>hist.slice(k).reduce((s,x)=>s+x,0)/n*100;
  const avgBest=hist.reduce((s,c,i)=>s+c*i,0)/n;
  return{n,hist,p2:ge(2),p3:ge(3),p4:ge(4),avgBest,ticket:td};
}
function geometryObjective(sim,st){
  // P(Best>=3) is the primary target. Secondary terms stabilize mean coverage and structure.
  return sim.p3+2.6*sim.avgBest+.04*sim.p2+.08*sim.p4-.035*st.degreeSd-.055*st.triLoadSd;
}
function buildIncidence(target){
  const N_CAND=72,N_PROBE=4200,N_STABILITY=4200,N_FINAL=10000,N_DISPLAY=8000;
  const probe=uniformOutcomeMasks((Number(target)*69069+701001)>>>0,N_PROBE);
  const stability=uniformOutcomeMasks((Number(target)*1103515245+702002)>>>0,N_STABILITY);
  const candidates=[],seen=new Set();
  for(let salt=0;salt<180&&candidates.length<N_CAND;salt++){
    const c=generateIncidenceShape(target,salt),sig=simpleHash(c.tickets);if(seen.has(sig))continue;seen.add(sig);
    const st=geometryStructureStats(c.tickets),s1=simulateGeometry(c.tickets,probe),s2=simulateGeometry(c.tickets,stability),o1=geometryObjective(s1,st),o2=geometryObjective(s2,st);
    candidates.push({...c,structure:st,probe:s1,stability:s2,o1,o2,robust:.65*Math.min(o1,o2)+.35*((o1+o2)/2)});
  }
  if(!candidates.length)throw new Error("A Simulation Optimizer không tạo được candidate.");
  const baseline=candidates[0],eligible=candidates.filter(c=>c.o1>=baseline.o1-.01&&c.o2>=baseline.o2-.01);
  const shortlist=(eligible.length?eligible:candidates).slice().sort((a,b)=>b.robust-a.robust).slice(0,8);
  const finalBank=uniformOutcomeMasks((Number(target)*1664525+703003)>>>0,N_FINAL);
  for(const c of shortlist){c.final=simulateGeometry(c.tickets,finalBank);c.finalObjective=geometryObjective(c.final,c.structure)}
  const baseFinal=simulateGeometry(baseline.tickets,finalBank),baseFinalObjective=geometryObjective(baseFinal,baseline.structure);
  let chosen=shortlist.slice().sort((a,b)=>b.finalObjective-a.finalObjective)[0]||baseline;
  if(chosen.finalObjective<baseFinalObjective)chosen=baseline;

  const relabeled=relabelIncidenceShape(chosen.tickets,target,chosen.shapeSeed),audit=auditGeo(relabeled),structure=geometryStructureStats(relabeled);
  const displayBank=uniformOutcomeMasks((Number(target)*22695477+704004)>>>0,N_DISPLAY);
  const display=simulateGeometry(relabeled,displayBank,true);
  const baselineRelabeled=relabelIncidenceShape(baseline.tickets,target,baseline.shapeSeed),baselineDisplay=simulateGeometry(baselineRelabeled,displayBank,false);
  return{
    tickets:relabeled,seed:chosen.shapeSeed,audit,engine:"A7 Simulation Optimizer",
    analysis:{candidateCount:candidates.length,probeN:N_PROBE,stabilityN:N_STABILITY,finalN:N_FINAL,displayN:N_DISPLAY,display,baselineDisplay,structure,selectedHash:simpleHash(chosen.tickets),baselineHash:simpleHash(baseline.tickets),improved:simpleHash(chosen.tickets)!==simpleHash(baseline.tickets),optimizerGain:Math.max(0,chosen.finalObjective-baseFinalObjective),finalists:shortlist.length}
  };
}

function auditGeo(P){
  const exp=Array(56).fill(0),pairs=new Map();let maxOverlap=0;
  for(const t of P){for(const n of t)exp[n]++;for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){const k=edgeKey(t[i],t[j]);pairs.set(k,(pairs.get(k)||0)+1)}}
  for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++)maxOverlap=Math.max(maxOverlap,overlap(P[i],P[j]));
  const e=exp.slice(1);return{exp,coverage:e.filter(x=>x>0).length,minExp:Math.min(...e),maxExp:Math.max(...e),triple:e.filter(x=>x===3).length,double:e.filter(x=>x===2).length,repeatedPairs:[...pairs.values()].filter(v=>v>1).length,maxOverlap,uniquePairs:pairs.size};
}


function generate(targetDrawId){
  const target=Number(targetDrawId);
  if(!Number.isInteger(target)||target<1)throw new Error("INVALID_TARGET_DRAW_ID");
  const result=buildIncidence(target);
  return {
    engineId:"A7",
    engineVersion:"legacy-A7-extracted-1",
    targetDrawId:target,
    tickets:result.tickets.map(main=>({main:main.slice()})),
    seed:result.seed,
    audit:result.audit,
    analysis:result.analysis
  };
}
const API=Object.freeze({generate,auditGeo,geometryStructureStats,buildIncidence});
root.PowerAIOneA=API;
if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:this);
