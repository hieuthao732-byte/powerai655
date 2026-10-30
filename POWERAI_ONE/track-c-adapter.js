/* PowerAI ONE — Track C RC6 constrained-mapping adapter.
 * Frozen legacy signal/mapping logic. Candidate output only; ONE owns final selection.
 */
(function(root){
"use strict";
const WINDOWS=[30,60,120,250];
function median(a){const x=a.slice().sort((p,q)=>p-q),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2}
function rankNorm55(values){
 const arr=[];for(let n=1;n<=55;n++)arr.push([n,Number(values[n]||0)]);
 arr.sort((a,b)=>a[1]-b[1]||a[0]-b[0]);const out=Array(56).fill(0);let i=0;
 while(i<arr.length){let j=i+1;while(j<arr.length&&Math.abs(arr[j][1]-arr[i][1])<1e-12)j++;const r=((i+j-1)/2)/(arr.length-1);for(let k=i;k<j;k++)out[arr[k][0]]=r;i=j}
 return out;
}
function seeded(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function buildMatrixModel(ds,m){
 const N=Math.max(1,ds.length),freq=m.f,pair=m.pair,alpha=1;
 const aff=Array.from({length:56},()=>Array(56).fill(0)),central=Array(56).fill(0);let maxAff=0;
 for(let i=1;i<=55;i++)for(let j=i+1;j<=55;j++){
  const cij=pair.get(i+"-"+j)||0,pji=(cij+alpha)/(freq[i]+alpha*55),pij=(cij+alpha)/(freq[j]+alpha*55);
  const expected=Math.max(.000001,(freq[i]/N)*(freq[j]/N)),observed=(cij+alpha)/(N+alpha);
  const lift=Math.min(3,observed/expected),shrink=cij/(cij+4),a=.65*((pji+pij)/2)+.35*(shrink*lift/3);
  aff[i][j]=aff[j][i]=a;maxAff=Math.max(maxAff,a);
 }
 if(maxAff<=0)maxAff=1;
 for(let i=1;i<=55;i++){const vals=[];for(let j=1;j<=55;j++)if(j!==i)vals.push(aff[i][j]/maxAff);vals.sort((a,b)=>b-a);central[i]=vals.slice(0,8).reduce((s,x)=>s+x,0)/8}
 return{aff,central,maxAff};
}
function deriveGeometrySlots(P){
 const loc=Array.from({length:56},()=>[]);P.forEach((t,ti)=>t.forEach(n=>loc[n].push(ti)));
 return Array.from({length:55},(_,i)=>({sourceNumber:i+1,tickets:loc[i+1].slice(),exp:loc[i+1].length}));
}
function slotEdgesFromSlots(slots){
 const byTicket=Array.from({length:20},()=>[]);slots.forEach((s,si)=>s.tickets.forEach(t=>byTicket[t].push(si)));
 const edges=[];for(const ids of byTicket)for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)edges.push([ids[i],ids[j]]);return edges;
}
function ticketsFromMapping(slots,mapping){
 const P=Array.from({length:20},()=>[]);slots.forEach((s,i)=>s.tickets.forEach(t=>P[t].push(mapping[i])));P.forEach(t=>t.sort((a,b)=>a-b));return P;
}
function mappingObjective(mapping,edges,aff){let s=0;for(const e of edges)s+=aff[mapping[e[0]]][mapping[e[1]]];return s}
function ticketAffinity(t,aff){let s=0;for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)s+=aff[t[i]][t[j]];return s}
function auditGeo(P){
 const exp=Array(56).fill(0),pairs=new Map();let maxOverlap=0;
 for(const t of P){for(const n of t)exp[n]++;for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){const k=t[i]<t[j]?t[i]+"-"+t[j]:t[j]+"-"+t[i];pairs.set(k,(pairs.get(k)||0)+1)}}
 for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){const set=new Set(P[i]);let ov=0;for(const n of P[j])if(set.has(n))ov++;maxOverlap=Math.max(maxOverlap,ov)}
 const e=exp.slice(1);return{exp,coverage:e.filter(x=>x>0).length,minExp:Math.min(...e),maxExp:Math.max(...e),triple:e.filter(x=>x===3).length,double:e.filter(x=>x===2).length,repeatedPairs:[...pairs.values()].filter(v=>v>1).length,maxOverlap,uniquePairs:pairs.size};
}
function buildSignals(draws,B,legacy){
 const models=[];
 for(const w of WINDOWS){const cut=draws.slice(Math.max(0,draws.length-w)),lm=legacy.buildLegacyModel(cut),mm=buildMatrixModel(cut,lm);models.push({w,lm,mm,freq:rankNorm55(lm.f),gap:rankNorm55(lm.over),heat:rankNorm55(lm.heat),matrix:rankNorm55(mm.central)})}
 const freq=Array(56).fill(0),gap=Array(56).fill(0),heat=Array(56).fill(0),matrix=Array(56).fill(0);
 for(let n=1;n<=55;n++){freq[n]=median(models.map(x=>x.freq[n]));gap[n]=median(models.map(x=>x.gap[n]));heat[n]=median(models.map(x=>x.heat[n]));matrix[n]=median(models.map(x=>x.matrix[n]))}
 const bExp=Array(56).fill(0);B.forEach(p=>(p.ticket||p.a||p.main||p).forEach(n=>bExp[n]++));const bRank=rankNorm55(bExp);
 const consensus=Array(56).fill(0),tie=Array(56).fill(0);
 for(let n=1;n<=55;n++){const v=[freq[n],gap[n],heat[n],matrix[n],bRank[n]];consensus[n]=median(v);tie[n]=v.reduce((s,x)=>s+x,0)/v.length}
 const aff=Array.from({length:56},()=>Array(56).fill(0));
 for(let i=1;i<=55;i++)for(let j=i+1;j<=55;j++){const vals=models.map(x=>x.mm.aff[i][j]/x.mm.maxAff);aff[i][j]=aff[j][i]=median(vals)}
 const central=Array(56).fill(0);
 for(let n=1;n<=55;n++){const vals=[];for(let j=1;j<=55;j++)if(j!==n)vals.push(aff[n][j]);vals.sort((a,b)=>b-a);central[n]=vals.slice(0,8).reduce((s,x)=>s+x,0)/8}
 const order=Array.from({length:55},(_,i)=>i+1).sort((a,b)=>consensus[b]-consensus[a]||tie[b]-tie[a]||central[b]-central[a]||a-b);
 return{windows:WINDOWS.slice(),freq,gap,heat,matrix,bExp,legacy:bRank,consensus,tie,aff,central,order,boosted:order.slice(0,10)};
}
function optimize(A,sig,target){
 const slots=deriveGeometrySlots(A.tickets.map(t=>t.main||t)),edges=slotEdgesFromSlots(slots),tri=[],dbl=[];
 slots.forEach((s,i)=>(s.exp===3?tri:dbl).push(i));
 if(tri.length!==10||dbl.length!==45||edges.length!==300)throw new Error("C_REQUIRES_VALID_A_GEOMETRY");
 const triple=sig.boosted.slice(),tripleSet=new Set(triple),double=Array.from({length:55},(_,i)=>i+1).filter(n=>!tripleSet.has(n));
 const baseSeed=(Number(target)*2654435761+600055)>>>0;let best=null,bestScore=-Infinity;
 for(let r=0;r<5;r++){
  const rnd=seeded((baseSeed+r*104729)>>>0),ts=triple.slice(),ds=double.slice();if(r>0){shuffle(ts,rnd);shuffle(ds,rnd)}
  const map=Array(55);tri.forEach((si,k)=>map[si]=ts[k]);dbl.forEach((si,k)=>map[si]=ds[k]);
  let score=mappingObjective(map,edges,sig.aff);
  for(let it=0;it<4500;it++){const group=rnd()<10/55?tri:dbl,ia=Math.floor(rnd()*group.length),ib=Math.floor(rnd()*group.length);if(ia===ib)continue;const a=group[ia],b=group[ib],[mapA,mapB]=[map[a],map[b]];map[a]=mapB;map[b]=mapA;const next=mappingObjective(map,edges,sig.aff);if(next>=score)score=next;else{map[a]=mapA;map[b]=mapB}}
  if(score>bestScore){bestScore=score;best=map.slice()}
 }
 const tickets=ticketsFromMapping(slots,best),audit=auditGeo(tickets);
 const valid=audit.coverage===55&&audit.minExp===2&&audit.maxExp===3&&audit.triple===10&&audit.double===45&&audit.repeatedPairs===0&&audit.maxOverlap<=1&&audit.uniquePairs===300;
 if(!valid)throw new Error("C_GEOMETRY_AUDIT_FAILED");
 const ranked=tickets.map((main,index)=>({main,score:ticketAffinity(main,sig.aff)/15*100,components:{matrix:ticketAffinity(main,sig.aff)/15*100,consensus:main.reduce((s,n)=>s+sig.consensus[n],0)/6*100},tags:["C_RC6_CONSTRAINED_MAPPING"],metadata:{sourceIndex:index}}));
 return{tickets:ranked,audit,objective:bestScore,seed:baseSeed,windows:WINDOWS.slice(),signals:{boosted:sig.boosted,consensus:sig.consensus,central:sig.central}};
}
function generate(draws,A,B,legacy,targetDrawId){
 const target=Number(targetDrawId);if(!Number.isInteger(target)||target<1)throw new Error("INVALID_TARGET_DRAW_ID");
 const history=(draws||[]).filter(d=>Number(d.id)<target);
 if(!history.length)throw new Error("NO_VALID_HISTORY_BEFORE_TARGET");
 if(!A?.tickets||A.tickets.length!==20)throw new Error("TRACK_A_GEOMETRY_REQUIRED");
 if(!Array.isArray(B)||!B.length)throw new Error("TRACK_B_SIGNAL_CANDIDATES_REQUIRED");
 const signals=buildSignals(history,B,legacy),result=optimize(A,signals,target);
 return{engineId:"C",engineVersion:"legacy-C-RC6-extracted-shadow-1",targetDrawId:target,cutoffDrawId:Number(history[history.length-1].id),candidates:result.tickets,audit:result.audit,seed:result.seed,signals:{boosted:signals.boosted,windows:signals.windows},objective:result.objective};
}
const API=Object.freeze({generate,buildSignals,optimize,auditGeo,buildMatrixModel});
root.PowerAIOneC=API;if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:this);
