"use strict";
const assert=require("node:assert/strict");
const D=require("./domain.js");
const {create}=require("./walk-forward-evaluator.js");
const evaluator=create(D);
const draws=[
  {id:1,main:[1,2,3,4,5,6],special:7},
  {id:2,main:[2,3,4,5,6,7],special:1},
  {id:3,main:[3,4,5,6,7,8],special:2},
  {id:4,main:[4,5,6,7,8,9],special:3},
  {id:5,main:[5,6,7,8,9,10],special:4},
  {id:6,main:[6,7,8,9,10,11],special:5},
  {id:7,main:[7,8,9,10,11,12],special:6}
];
(async()=>{
  const calls=[];
  const report=await evaluator.evaluate([...draws,{id:7,main:[1,2,3,4,5,6],special:8},{id:8,main:[1,2,3,4,5,55],special:12}],{
    minHistory:2,
    generate:ctx=>{
      calls.push({target:ctx.targetDrawId,ids:ctx.draws.map(d=>d.id)});
      assert.ok(ctx.draws.every(d=>d.id<ctx.targetDrawId),"future draw leaked into generation context");
      const last=ctx.draws[ctx.draws.length-1];
      return {cutoffDrawId:ctx.cutoffDrawId,tickets:[{main:last.main}]};
    },
    baselineGenerator:()=>[{main:[1,2,3,4,5,6]}]
  });
  assert.equal(report.reportType,"POWERAI_ONE_WALK_FORWARD_RESEARCH");
  assert.equal(report.researchOnly,true);
  assert.equal(report.officialLogsWritten,false);
  assert.equal(report.learningUpdated,false);
  assert.equal(report.summary.draws,6);
  assert.equal(report.history.rejectedDraws,1,"duplicate draw should be rejected");
  assert.equal(report.records[0].targetDrawId,3);
  assert.equal(report.records[0].cutoffDrawId,2);
  assert.equal(report.records[0].historyCount,2);
  assert.equal(report.records.at(-1).targetDrawId,8);
  assert.equal(report.records.length,calls.length);
  assert.ok(report.summary.mainHitDistribution.reduce((s,x)=>s+x.tickets,0)===6);
  assert.ok(report.baselineSummary);
  assert.equal(report.baselineSummary.draws,6);
  await assert.rejects(()=>evaluator.evaluate(draws,{minHistory:2,generate:()=>({cutoffDrawId:99,tickets:[draws[0].main]})}),/FUTURE_LEAKAGE_GENERATOR_CUTOFF/);
  await assert.rejects(()=>evaluator.evaluate(draws,{minHistory:2,generate:()=>[]}),/WALK_FORWARD_GENERATOR_RETURNED_NO_TICKETS/);
  await assert.rejects(()=>evaluator.evaluate(draws,{minHistory:0,generate:()=>[]}),/INVALID_MIN_HISTORY/);
  console.log("PowerAI ONE walk-forward evaluator tests: PASS");
  console.log(JSON.stringify({
    evaluatedDraws:report.summary.draws,
    mainHitDistribution:report.summary.mainHitDistribution,
    portfolioHitRates:report.summary.portfolioHitRates,
    baselinePortfoliosAtLeast3:report.baselineSummary.portfoliosAtLeast3,
    rejectedRows:report.history.rejectedDraws
  },null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
