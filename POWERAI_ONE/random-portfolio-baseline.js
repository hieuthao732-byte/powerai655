/* Random constrained portfolio baseline for PowerAI ONE walk-forward research.
 * Produces a uniformly relabelled feasible incidence design; no draw history is read.
 */
(function(root){
"use strict";
function rng(seed){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function edgeKey(a,b){return a<b?a+"-"+b:b+"-"+a;}
function overlap(a,b){const s=new Set(a);return b.reduce((n,x)=>n+(s.has(x)?1:0),0);}
function audit(tickets){
 const exp=Array(56).fill(0),pairs=new Map();let maxOverlap=0;
 for(let i=0;i<tickets.length;i++){
  const t=tickets[i];t.forEach(n=>exp[n]++);
  for(let a=0;a<6;a++)for(let b=a+1;b<6;b++){const k=edgeKey(t[a],t[b]);pairs.set(k,(pairs.get(k)||0)+1);}
  for(let j=0;j<i;j++)maxOverlap=Math.max(maxOverlap,overlap(t,tickets[j]));
 }
 const used=exp.slice(1);
 return{ticketCount:tickets.length,coverage:used.filter(Boolean).length,minExposure:Math.min(...used),maxExposure:Math.max(...used),repeatedPairs:[...pairs.values()].filter(v=>v>1).length,maxOverlap,uniquePairs:pairs.size};
}
function generate(targetDrawId,seedOffset=0){
 const target=Number(targetDrawId);
 if(!Number.isInteger(target)||target<1)throw new Error("INVALID_TARGET_DRAW_ID");
 const baseSeed=(Math.imul(target,2246822519)+Math.imul(seedOffset+1,3266489917)+0x51ed270b)>>>0;
 for(let restart=0;restart<1200;restart++){
  const r=rng((baseSeed+Math.imul(restart+1,2654435761))>>>0);
  const triCount=Array(20).fill(0),used=new Set(),triangles=[];let failed=false;
  for(let q=0;q<10;q++){
   const feasible=[];
   for(let a=0;a<18;a++)for(let b=a+1;b<19;b++)for(let c=b+1;c<20;c++){
    if(triCount[a]>=3||triCount[b]>=3||triCount[c]>=3)continue;
    if(used.has(edgeKey(a,b))||used.has(edgeKey(a,c))||used.has(edgeKey(b,c)))continue;
    feasible.push([a,b,c]);
   }
   if(!feasible.length){failed=true;break;}
   const tri=feasible[Math.floor(r()*feasible.length)];
   triangles.push(tri);tri.forEach(v=>triCount[v]++);
   used.add(edgeKey(tri[0],tri[1]));used.add(edgeKey(tri[0],tri[2]));used.add(edgeKey(tri[1],tri[2]));
  }
  if(failed)continue;
  const rem=triCount.map(v=>6-v),edges=[];
  for(let step=0;step<45;step++){
   const active=Array.from({length:20},(_,i)=>i).filter(i=>rem[i]>0);
   if(!active.length)break;
   const max=Math.max(...active.map(i=>rem[i]));
   const us=active.filter(i=>rem[i]===max),u=us[Math.floor(r()*us.length)];
   let vs=active.filter(v=>v!==u&&!used.has(edgeKey(u,v)));
   if(!vs.length){failed=true;break;}
   const vmax=Math.max(...vs.map(v=>rem[v]));
   vs=vs.filter(v=>rem[v]>=vmax-1);
   const v=vs[Math.floor(r()*vs.length)];
   used.add(edgeKey(u,v));edges.push([u,v]);rem[u]--;rem[v]--;
  }
  if(failed||edges.length!==45||rem.some(v=>v!==0))continue;
  const slots=Array.from({length:20},()=>[]);
  triangles.forEach((tri,i)=>tri.forEach(v=>slots[v].push(i+1)));
  edges.forEach((edge,i)=>edge.forEach(v=>slots[v].push(i+11)));
  if(slots.some(t=>t.length!==6))continue;
  const labels=shuffle(Array.from({length:55},(_,i)=>i+1),r);
  const tickets=slots.map(t=>t.map(n=>labels[n-1]).sort((a,b)=>a-b));
  const a=audit(tickets);
  if(a.coverage===55&&a.minExposure===2&&a.maxExposure===3&&a.repeatedPairs===0&&a.maxOverlap<=1)
   return{tickets:tickets.map(main=>({main})),seed:baseSeed,restarts:restart+1,audit:a};
 }
 throw new Error("RANDOM_BASELINE_CONSTRUCTION_FAILED");
}
const API=Object.freeze({generate,audit});
root.PowerAIOneRandomBaseline=API;
if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:this);
