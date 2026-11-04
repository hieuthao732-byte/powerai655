"use strict";
const assert=require("node:assert/strict");
const D=require("./domain.js"),A=require("./track-a-adapter.js"),B=require("./track-b-adapter.js"),C=require("./track-c-adapter.js");
const CoreD=require("../adaptive-d.js"),AdapterD=require("./track-d-adapter.js");
const {create:selectorFactory}=require("./unified-selector.js"),{create:evaluatorFactory}=require("./walk-forward-evaluator.js");
const draws=[];
for(let id=1;id<=270;id++){const s=new Set();let k=0;while(s.size<6)s.add(((id*17+(++k)*13+k*k*3)%55)+1);draws.push({id,main:[...s].sort((a,b)=>a-b),special:null});}
const selector=selectorFactory(D),evaluator=evaluatorFactory(D),opts={count:20,maxOverlap:4,candidateLimit:120,beamWidth:24,searchNodeBudget:200000};
(async()=>{
 const cache=new Map();
 const c=await evaluator.evaluate(draws,{minHistory:250,startIndex:269,baselineTrials:1,
  generate:ctx=>{const a=A.generate(ctx.targetDrawId),b=B.generate(ctx.draws,ctx.targetDrawId,{candidateCount:800,seed:7123}),out=C.generate(ctx.draws,a,b.candidates.slice().sort((x,y)=>y.score-x.score).slice(0,20),B,ctx.targetDrawId);cache.set(ctx.targetDrawId,a.tickets);return{cutoffDrawId:out.cutoffDrawId,tickets:out.candidates.map(x=>({main:x.main}))};},
  baselineGenerator:ctx=>cache.get(ctx.targetDrawId).map(x=>({main:x.main||x}))});
 assert.equal(c.summary.draws,1);assert.equal(c.summary.tickets,20);assert.equal(c.baselineSummary.tickets,20);
 const d=await evaluator.evaluate(draws,{minHistory:250,startIndex:269,baselineTrials:2,
  generate:ctx=>{const out=AdapterD.generate(ctx.draws,ctx.targetDrawId,CoreD,{candidateCount:500,seed:456});return{cutoffDrawId:out.cutoffDrawId,tickets:selector.select(out.candidates,opts).tickets};},
  baselineGenerator:(ctx,trial)=>{const out=AdapterD.generate(ctx.draws,ctx.targetDrawId,CoreD,{candidateCount:500,seed:456});let x=trial+17;const rnd=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};return selector.select(out.candidates.map(z=>({...z,score:rnd()})),opts).tickets;}});
 assert.equal(d.summary.draws,1);assert.equal(d.summary.tickets,20);assert.equal(d.baselineSummary.trials,2);assert.equal(d.baselineSummary.tickets,40);
 console.log("PowerAI ONE C/D walk-forward integration tests: PASS");
})().catch(e=>{console.error(e);process.exitCode=1;});
