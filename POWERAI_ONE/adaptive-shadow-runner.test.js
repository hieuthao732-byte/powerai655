"use strict";
const assert=require("node:assert/strict");
const D=require("./domain.js"),G=require("./adaptive-governor.js"),R=require("./adaptive-shadow-runner.js").create(D,G);
const draws=Array.from({length:16},(_,i)=>({id:i+1,date:new Date(Date.UTC(2026,0,i+2,12)).toISOString(),source:"official",verified:true,main:[1,2,3,4,5,6],special:7}));
(async()=>{
 let activeCalls=0,challengerCalls=0;
 const report=await R.run(draws,{minHistory:2,threshold:3,
  generateActive:ctx=>{activeCalls++;return {generatedAt:"2026-01-01T10:00:00Z",cutoffDrawId:ctx.cutoffDrawId,tickets:[{main:[10,11,12,13,14,15]}]};},
  generateChallenger:ctx=>{challengerCalls++;return {generatedAt:"2026-01-01T10:00:00Z",cutoffDrawId:ctx.cutoffDrawId,tickets:[{main:[1,2,3,20,21,22]}]};}
 });
 assert.equal(report.reportType,"POWERAI_ONE_ADAPTIVE_SHADOW_REPLAY");
 assert.equal(report.activeModelMutated,false);
 assert.equal(report.automaticPromotion,false);
 assert.equal(report.triggerEvents.length,1);
 assert.equal(report.triggerEvents[0].targetDrawId,5);
 assert.equal(report.challengerEvaluatedDraws,draws.length-5);
 assert.equal(challengerCalls,draws.length-5);
 assert.equal(activeCalls,draws.length-2);
 assert.equal(report.pairedComparison.challengerSuccesses,draws.length-5);
 assert.equal(report.pairedComparison.activeSuccesses,0);
 const firstChallenger=report.records.find(r=>r.challenger)?.challenger;
 assert.equal(firstChallenger.targetDrawId,6);
 assert.equal(firstChallenger.source,"official");
 assert.equal(firstChallenger.verified,true);
 assert.equal(firstChallenger.challengerSpecialHit,false);
 await assert.rejects(()=>R.run(draws,{minHistory:0,generateActive:()=>[],generateChallenger:()=>[]}),/INVALID_MIN_HISTORY/);
 await assert.rejects(()=>R.run(draws,{minHistory:2,generateActive:()=>[],generateChallenger:()=>[]}),/NO_TICKETS/);
 console.log("PowerAI ONE adaptive shadow runner tests: PASS");
})().catch(e=>{console.error(e);process.exitCode=1;});
