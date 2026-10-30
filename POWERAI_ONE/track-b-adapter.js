/* PowerAI ONE — Track B frozen analytics candidate engine. */
(function(root){
"use strict";
function seeded(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
function nums(d){return (d?.result||[]).map(Number).filter(n=>n>=1&&n<=55).slice(0,6).sort((a,b)=>a-b)}
function pairScore(a,m){let s=0;for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)s+=m.pair.get(a[i]+"-"+a[j])||0;return s}
function buildLegacyModel(ds){
  const f=Array(56).fill(0),pos=Array.from({length:56},()=>[]),pair=new Map();
  ds.forEach((d,i)=>{const a=nums(d);a.forEach(n=>{f[n]++;pos[n].push(i)});for(let x=0;x<6;x++)for(let y=x+1;y<6;y++){const k=a[x]+"-"+a[y];pair.set(k,(pair.get(k)||0)+1)}});
  const over=Array(56).fill(0);
  for(let n=1;n<=55;n++){const p=pos[n];if(p.length>=2){let s=0;for(let i=1;i<p.length;i++)s+=p[i]-p[i-1];const avg=s/(p.length-1),last=ds.length-1-p.at(-1);over[n]=avg?last/avg:0}}
  const mf=Math.max(...f),mo=Math.max(...over),heat=Array(56).fill(0);
  for(let n=1;n<=55;n++)heat[n]=.6*(f[n]/Math.max(1,mf))+.4*(mo?over[n]/mo:0);
  const m={f,over,heat,pair,maxPair:1};
  let mx=0;ds.forEach(d=>mx=Math.max(mx,pairScore(nums(d),m)));m.maxPair=mx||1;return m;
}
function validLegacy(a){const o=a.filter(n=>n%2).length,sm=a.filter(n=>n<=27).length,t=a.reduce((x,y)=>x+y,0);let c=0;for(let i=0;i<5;i++)if(a[i+1]-a[i]===1)c++;return[2,3,4].includes(o)&&[2,3,4].includes(sm)&&t>=90&&t<=210&&c<=2}
function legacyComponents(a,m){
  const heat=a.reduce((s,n)=>s+m.heat[n],0)/6*100,pair=pairScore(a,m)/m.maxPair*100,o=a.filter(n=>n%2).length,odd=o===3?100:[2,4].includes(o)?80:50,sm=a.filter(n=>n<=27).length,small=sm===3?100:[2,4].includes(sm)?80:50,t=a.reduce((x,y)=>x+y,0),sum=t>=120&&t<=200?100:t>=100&&t<=220?80:40;
  return{heat,pair,odd,small,sum,score:.4*heat+.3*pair+.1*odd+.1*small+.1*sum};
}
function randomValidPool(n,seed){
  const rnd=seeded(seed),out=[],seen=new Set();
  while(out.length<n){const s=new Set();while(s.size<6)s.add(1+Math.floor(rnd()*55));const a=[...s].sort((x,y)=>x-y),k=a.join(",");if(seen.has(k)||!validLegacy(a))continue;seen.add(k);out.push({a})}
  return out;
}

function generate(draws,targetDrawId,{candidateCount=50000,seed=null}={}){
 const target=Number(targetDrawId);
 if(!Number.isInteger(target)||target<1)throw new Error("INVALID_TARGET_DRAW_ID");
 const legacyDraws=(draws||[]).filter(d=>Number(d.id)<target).map(d=>({id:d.id,result:d.main}));
 const model=buildLegacyModel(legacyDraws);
 const actualSeed=seed==null?((target*104729+130013)>>>0):seed;
 const pool=randomValidPool(candidateCount,actualSeed);
 const candidates=pool.map((p,index)=>{const components=legacyComponents(p.a,model);return {ticket:p.a,score:components.score,source:"B",components,metadata:{candidateIndex:index}}});
 return {engineId:"B",engineVersion:"legacy-B1.3-extracted-1",targetDrawId:target,cutoffDrawId:legacyDraws.length?Number(legacyDraws[legacyDraws.length-1].id):null,candidates,seed:actualSeed,candidateCount:candidates.length};
}
const API=Object.freeze({generate,buildLegacyModel,validLegacy,legacyComponents,randomValidPool});
root.PowerAIOneB=API;
if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:this);
