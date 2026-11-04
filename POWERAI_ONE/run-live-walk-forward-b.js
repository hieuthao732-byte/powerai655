"use strict";
const crypto=require("node:crypto");
const D=require("./domain.js");
const B=require("./track-b-adapter.js");
const {create:makeSelector}=require("./unified-selector.js");
const {create:makeEvaluator}=require("./walk-forward-evaluator.js");
const SOURCE="https://raw.githubusercontent.com/vietvudanh/vietlott-data/main/data/power655.jsonl";
const asInt=x=>Number.isInteger(Number(x))?Number(x):null;
function seeded(seed){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
const selectOptions={count:20,maxOverlap:4,candidateLimit:120,beamWidth:24,searchNodeBudget:200000};
(async()=>{
 const response=await fetch(SOURCE,{signal:AbortSignal.timeout(30000),headers:{"user-agent":"PowerAI-ONE-B-walk-forward-research"}});
 if(!response.ok)throw new Error("HISTORY_FEED_HTTP_"+response.status);
 const raw=await response.text(),rows=raw.split(/\r?\n/).filter(x=>x.trim()).map((line,i)=>{try{return JSON.parse(line);}catch(e){throw new Error("INVALID_JSONL_LINE_"+(i+1));}});
 const valid=[],seen=new Set(),rejected=[];
 rows.forEach((row,index)=>{const p=D.normalizeDraw(row);if(!p.ok){rejected.push({index,id:row?.id??null,errors:p.errors});return;}if(seen.has(p.draw.id)){rejected.push({index,id:p.draw.id,errors:["DUPLICATE_DRAW_ID"]});return;}seen.add(p.draw.id);valid.push(p.draw);});
 valid.sort((a,b)=>a.id-b.id);
 const minHistory=Math.max(100,asInt(process.env.WF_MIN_HISTORY)||100);
 const windowSize=Math.min(200,Math.max(5,asInt(process.env.WF_WINDOW)||100));
 const candidateCount=Math.min(20000,Math.max(500,asInt(process.env.WF_B_CANDIDATES)||3000));
 const baselineTrials=Math.min(20,Math.max(1,asInt(process.env.WF_BASELINE_TRIALS)||5));
 const startIndex=Math.max(minHistory,valid.length-windowSize);
 if(startIndex>=valid.length)throw new Error("INSUFFICIENT_HISTORY_FOR_REQUESTED_WINDOW");
 const selector=makeSelector(D),evaluator=makeEvaluator(D),poolByTarget=new Map();
 const report=await evaluator.evaluate(valid,{
  minHistory,startIndex,baselineTrials,
  generate:ctx=>{
   const seed=(ctx.targetDrawId*104729+130013)>>>0;
   const generated=B.generate(ctx.draws,ctx.targetDrawId,{candidateCount,seed});
   if(generated.cutoffDrawId!==ctx.cutoffDrawId)throw new Error("B_CUTOFF_MISMATCH_AT_"+ctx.targetDrawId);
   if(generated.candidates.length!==candidateCount||!generated.candidates.every(c=>B.validLegacy(c.ticket)))
    throw new Error("B_CANDIDATE_POOL_INVALID_AT_"+ctx.targetDrawId);
   poolByTarget.set(ctx.targetDrawId,generated.candidates);
   const selected=selector.select(generated.candidates,selectOptions);
   return{cutoffDrawId:ctx.cutoffDrawId,tickets:selected.tickets};
  },
  baselineGenerator:(ctx,trial)=>{
   const pool=poolByTarget.get(ctx.targetDrawId);
   if(!pool)throw new Error("B_BASELINE_POOL_MISSING_AT_"+ctx.targetDrawId);
   const random=seeded((ctx.targetDrawId*2246822519+Math.imul(trial+1,3266489917)+0x7f4a7c15)>>>0);
   const randomized=pool.map(candidate=>({...candidate,score:random()}));
   return selector.select(randomized,selectOptions).tickets;
  }
 });
 const output={
  reportType:"POWERAI_ONE_B1_3_VS_RANDOM_RANK_WALK_FORWARD",
  researchOnly:true,officialLogsWritten:false,learningUpdated:false,
  evaluationScope:"B ranking signal versus random ranking over the exact same randomly generated B-valid candidate pool; this does not test candidate-pool coverage beyond that pool.",
  source:SOURCE,datasetSha256:crypto.createHash("sha256").update(raw).digest("hex"),
  dataset:{validDraws:valid.length,firstDrawId:valid[0]?.id,lastDrawId:valid.at(-1)?.id,rejectedRows:rejected.length},
  config:{minHistory,requestedWindow:windowSize,actualWindow:report.summary.draws,candidateCount,baselineTrialsPerDraw:baselineTrials,selector:selectOptions,firstTargetDrawId:report.targetRange.first,lastTargetDrawId:report.targetRange.last,ticketsPerPortfolio:20},
  comparison:{
   B1_3:report.summary,
   randomRank:report.baselineSummary,
   portfolioAtLeast3Difference:report.summary.portfolioHitRates.atLeast3-report.baselineSummary.portfolioHitRates.atLeast3,
   portfolioAtLeast4Difference:report.summary.portfolioHitRates.atLeast4-report.baselineSummary.portfolioHitRates.atLeast4,
   equalTicketCount:report.baselineSummary.ticketCountPerPortfolio===20&&report.summary.tickets===report.summary.draws*20
  },
  records:report.records.map(r=>({targetDrawId:r.targetDrawId,cutoffDrawId:r.cutoffDrawId,historyCount:r.historyCount,maxMainHits:r.maxMainHits,mainHitDistribution:r.tickets.reduce((a,t)=>{a[t.mainHits]++;return a;},Array(7).fill(0)),specialHitTickets:r.specialHitTickets,baseline:r.baseline})),
  rejectedRows:rejected
 };
 require("node:fs").mkdirSync("artifacts",{recursive:true});
 require("node:fs").writeFileSync("artifacts/powerai-one-b-walk-forward-report.json",JSON.stringify(output,null,2));
 console.log("POWERAI_ONE_B1_3_VS_RANDOM_RANK_WALK_FORWARD");
 console.log(JSON.stringify({config:output.config,comparison:output.comparison,dataset:output.dataset,datasetSha256:output.datasetSha256},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
