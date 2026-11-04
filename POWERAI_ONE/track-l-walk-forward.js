"use strict";
/* Track L research-only prequential calibration. No official logs or persistent learning. */
const B_DEFAULT=require("./track-b-adapter.js");
const L=require("./track-l-adapter.js");
function corr(xs,ys){
 if(xs.length<3||ys.length!==xs.length)return 0;
 const mx=xs.reduce((a,b)=>a+b,0)/xs.length,my=ys.reduce((a,b)=>a+b,0)/ys.length;
 let n=0,dx=0,dy=0;for(let i=0;i<xs.length;i++){const a=xs[i]-mx,b=ys[i]-my;n+=a*b;dx+=a*a;dy+=b*b}
 return dx&&dy?n/Math.sqrt(dx*dy):0;
}
function createLearningReport(draws,targetDrawId,options={}){
 const B=options.B||B_DEFAULT,target=Number(targetDrawId),windowSize=Number(options.trainingWindow??20),poolSize=Number(options.calibrationCandidates??500),minHistory=Number(options.calibrationMinHistory??50);
 if(!Number.isInteger(target)||!Number.isInteger(windowSize)||windowSize<1||!Number.isInteger(poolSize)||poolSize<100)throw new Error("INVALID_L_CALIBRATION_OPTIONS");
 const prior=(draws||[]).filter(d=>Number(d.id)<target).slice().sort((a,b)=>Number(a.id)-Number(b.id));
 const events=prior.slice(-windowSize),keys=["Heat","Pair","OddEven","SmallBig","Sum"],observations=Object.fromEntries(keys.map(k=>[k,[]]));
 const used=[];
 for(const event of events){
  const id=Number(event.id),history=prior.filter(d=>Number(d.id)<id);
  if(history.length<minHistory)continue;
  const model=B.buildLegacyModel(history.map(d=>({id:d.id,result:d.main})));
  const pool=B.randomValidPool(poolSize,(id*104729+991)>>>0);
  const xs=Object.fromEntries(keys.map(k=>[k,[]])),ys=[];
  for(const p of pool){
   const c=B.legacyComponents(p.a,model);
   xs.Heat.push(c.heat);xs.Pair.push(c.pair);xs.OddEven.push(c.odd);xs.SmallBig.push(c.small);xs.Sum.push(c.sum);
   ys.push(p.a.reduce((n,x)=>n+(event.main||[]).includes(x),0));
  }
  keys.forEach(k=>observations[k].push(corr(xs[k],ys)));
  used.push({targetDrawId:id,cutoffDrawId:Number(history.at(-1).id),candidateCount:pool.length});
 }
 const signals=keys.map(name=>{
  const values=observations[name],strength=values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
  return{name,strength,stability:values.length?values.filter(x=>x>0).length/values.length:0,observations:values.length};
 });
 const report={n:used.length,signals,source:"feed",sourceDescription:"In-memory retrospective calibration from the third-party historical mirror; not official-verified logs.",researchOnly:true,officialLogsWritten:false,learningUpdated:false};
 return{report,calibration:{targetDrawId:target,cutoffDrawId:prior.length?Number(prior.at(-1).id):null,events:used,trainingWindow:windowSize,candidateCount:poolSize}};
}
module.exports={createLearningReport,corr};
