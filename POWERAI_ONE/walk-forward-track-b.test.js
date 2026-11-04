"use strict";
const assert=require("node:assert/strict");
const D=require("./domain.js");
const B=require("./track-b-adapter.js");
const {create:makeSelector}=require("./unified-selector.js");
const {create:makeEvaluator}=require("./walk-forward-evaluator.js");
const selector=makeSelector(D),evaluator=makeEvaluator(D);
const draws=[];
for(let id=1;id<=24;id++){
 const nums=new Set();let n=0;
 while(nums.size<6)nums.add(((id*7+(++n)*13)%55)+1);
 draws.push({id,main:[...nums].sort((a,b)=>a-b),special:null});
}
function seeded(seed){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
const options={count:20,maxOverlap:4,candidateLimit:80,beamWidth:16,searchNodeBudget:150000};
(async()=>{
 const pools=new Map(),report=await evaluator.evaluate(draws,{
  minHistory:12,startIndex:12,baselineTrials:2,
  generate:ctx=>{
   assert.ok(ctx.draws.every(d=>d.id<ctx.targetDrawId));
   const result=B.generate(ctx.draws,ctx.targetDrawId,{candidateCount:300,seed:ctx.targetDrawId*104729+130013});
   assert.equal(result.cutoffDrawId,ctx.cutoffDrawId);
   assert.equal(result.candidates.length,300);
   pools.set(ctx.targetDrawId,result.candidates);
   return{cutoffDrawId:ctx.cutoffDrawId,tickets:selector.select(result.candidates,options).tickets};
  },
  baselineGenerator:(ctx,trial)=>{
   const random=seeded(ctx.targetDrawId*1009+trial+7);
   const pool=pools.get(ctx.targetDrawId).map(c=>({...c,score:random()}));
   return selector.select(pool,options).tickets;
  }
 });
 assert.equal(report.summary.draws,12);
 assert.equal(report.summary.tickets,240);
 assert.equal(report.baselineSummary.trials,24);
 assert.equal(report.baselineSummary.tickets,480);
 assert.equal(report.baselineSummary.ticketCountPerPortfolio,20);
 assert.ok(report.records.every(r=>r.cutoffDrawId<r.targetDrawId));
 assert.equal(report.researchOnly,true);
 console.log("PowerAI ONE B1.3 walk-forward integration tests: PASS");
 console.log(JSON.stringify({draws:report.summary.draws,B1_3:report.summary.portfolioHitRates,randomRank:report.baselineSummary.portfolioHitRates},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
