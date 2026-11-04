"use strict";
const crypto=require("node:crypto");
const D=require("./domain.js"),B=require("./track-b-adapter.js"),L=require("./track-l-adapter.js");
const {createLearningReport}=require("./track-l-walk-forward.js");
const {create:makeSelector}=require("./unified-selector.js");
const {create:makeEvaluator}=require("./walk-forward-evaluator.js");
const SOURCE="https://raw.githubusercontent.com/vietvudanh/vietlott-data/main/data/power655.jsonl";
function seeded(seed){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
const selectOptions={count:20,maxOverlap:4,candidateLimit:120,beamWidth:24,searchNodeBudget:200000};
(async()=>{
 const response=await fetch(SOURCE,{signal:AbortSignal.timeout(30000),headers:{"user-agent":"PowerAI-ONE-L-walk-forward-research"}});
 if(!response.ok)throw new Error("HISTORY_FEED_HTTP_"+response.status);
 const raw=await response.text(),rows=raw.split(/\r?\n/).filter(x=>x.trim()).map((line,i)=>{try{return JSON.parse(line)}catch(e){throw new Error("INVALID_JSONL_LINE_"+(i+1))}});
 const valid=[],seen=new Set(),rejected=[];
 rows.forEach((row,index)=>{const p=D.normalizeDraw(row);if(!p.ok){rejected.push({index,id:row?.id??null,errors:p.errors});return;}if(seen.has(p.draw.id)){rejected.push({index,id:p.draw.id,errors:["DUPLICATE_DRAW_ID"]});return;}seen.add(p.draw.id);valid.push(p.draw)});
 valid.sort((a,b)=>a.id-b.id);
 const minHistory=100,windowSize=Math.min(200,Math.max(5,Number(process.env.WF_L_WINDOW)||200));
 const targetCandidates=Math.min(10000,Math.max(500,Number(process.env.WF_L_CANDIDATES)||3000));
 const calibrationWindow=Math.min(30,Math.max(5,Number(process.env.WF_L_TRAINING_WINDOW)||20));
 const calibrationCandidates=Math.min(2000,Math.max(100,Number(process.env.WF_L_CALIBRATION_CANDIDATES)||500));
 const startIndex=Math.max(minHistory,valid.length-windowSize);
 if(startIndex>=valid.length)throw new Error("INSUFFICIENT_HISTORY_FOR_REQUESTED_WINDOW");
 const selector=makeSelector(D),evaluator=makeEvaluator(D),poolByTarget=new Map(),learningByTarget=new Map(),lKeysByTarget=new Map(),overlapByTarget=new Map();
 const report=await evaluator.evaluate(valid,{
  minHistory,startIndex,
  generate:ctx=>{
   const learned=createLearningReport(ctx.draws,ctx.targetDrawId,{B,trainingWindow:calibrationWindow,calibrationCandidates});
   const seed=(ctx.targetDrawId*104729+130013)>>>0;
   const l=L.generate(ctx.draws,ctx.targetDrawId,learned.report,B,{candidateCount:targetCandidates,seed});
   const b=B.generate(ctx.draws,ctx.targetDrawId,{candidateCount:targetCandidates,seed});
   if(l.cutoffDrawId!==ctx.cutoffDrawId||b.cutoffDrawId!==ctx.cutoffDrawId)throw new Error("L_CUTOFF_MISMATCH_AT_"+ctx.targetDrawId);
   if(l.candidates.length!==targetCandidates||b.candidates.length!==targetCandidates)throw new Error("L_CANDIDATE_POOL_SIZE_MISMATCH");
   for(let i=0;i<l.candidates.length;i++)if(l.candidates[i].ticket.join(",")!==b.candidates[i].ticket.join(","))throw new Error("L_B_POOL_MISMATCH_AT_"+ctx.targetDrawId);
   poolByTarget.set(ctx.targetDrawId,b.candidates);
   learningByTarget.set(ctx.targetDrawId,{n:learned.report.n,weights:l.weights,alpha:l.alpha,mode:l.mode,calibration:learned.calibration});
   return{cutoffDrawId:ctx.cutoffDrawId,tickets:selector.select(l.candidates,selectOptions).tickets};
  },
  baselineGenerator:(ctx)=>{
   const pool=poolByTarget.get(ctx.targetDrawId);
   if(!pool)throw new Error("L_BASELINE_POOL_MISSING");
   const selectedB=selector.select(pool,selectOptions).tickets;
   const lKeys=lKeysByTarget.get(ctx.targetDrawId)||new Set(),bKeys=new Set(selectedB.map(t=>t.main.join("-")));
   const common=[...lKeys].filter(k=>bKeys.has(k)).length;
   overlapByTarget.set(ctx.targetDrawId,{commonTickets:common,unionTickets:new Set([...lKeys,...bKeys]).size,jaccard:new Set([...lKeys,...bKeys]).size?common/new Set([...lKeys,...bKeys]).size:1,identical:common===20});
   return selectedB;
  }
 });
 const output={
  reportType:"POWERAI_ONE_L_LEARNED_VS_B_BASELINE_WALK_FORWARD",researchOnly:true,officialLogsWritten:false,learningUpdated:false,
  evaluationScope:"L learned weights versus frozen B1.3 ranking on the exact same B-valid candidate pool and ONE constraints. Each target's calibration uses only earlier draws.",
  source:SOURCE,sourceQualification:"Third-party historical mirror; not an official Vietlott source and not official-verified learning logs.",
  datasetSha256:crypto.createHash("sha256").update(raw).digest("hex"),
  dataset:{validDraws:valid.length,firstDrawId:valid[0]?.id,lastDrawId:valid.at(-1)?.id,rejectedRows:rejected.length},
  config:{minHistory,requestedWindow:windowSize,actualWindow:report.summary.draws,targetCandidates,calibrationWindow,calibrationCandidates,selector:selectOptions,ticketsPerPortfolio:20},
  comparison:{L:report.summary,B:report.baselineSummary,portfolioAtLeast3Difference:report.summary.portfolioHitRates.atLeast3-report.baselineSummary.portfolioHitRates.atLeast3,portfolioAtLeast4Difference:report.summary.portfolioHitRates.atLeast4-report.baselineSummary.portfolioHitRates.atLeast4,equalTicketCount:report.baselineSummary.ticketCountPerPortfolio===20&&report.summary.tickets===report.summary.draws*20,selectionOverlap:{draws:overlapByTarget.size,meanCommonTickets:overlapByTarget.size?[...overlapByTarget.values()].reduce((s,x)=>s+x.commonTickets,0)/overlapByTarget.size:0,meanJaccard:overlapByTarget.size?[...overlapByTarget.values()].reduce((s,x)=>s+x.jaccard,0)/overlapByTarget.size:0,identicalPortfolioDraws:[...overlapByTarget.values()].filter(x=>x.identical).length,distribution:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(n=>({commonTickets:n,draws:[...overlapByTarget.values()].filter(x=>x.commonTickets===n).length}))}},
  learning:Object.fromEntries([...learningByTarget.entries()].map(([id,v])=>[id,v])),
  records:report.records.map(r=>({targetDrawId:r.targetDrawId,cutoffDrawId:r.cutoffDrawId,historyCount:r.historyCount,maxMainHits:r.maxMainHits,mainHitDistribution:r.tickets.reduce((a,t)=>{a[t.mainHits]++;return a},Array(7).fill(0)),specialHitTickets:r.specialHitTickets,baseline:r.baseline,selectionOverlap:overlapByTarget.get(r.targetDrawId)??null})),
  rejectedRows:rejected
 };
 require("node:fs").mkdirSync("artifacts",{recursive:true});
 require("node:fs").writeFileSync("artifacts/powerai-one-l-walk-forward-report.json",JSON.stringify(output,null,2));
 console.log("POWERAI_ONE_L_LEARNED_VS_B_BASELINE_WALK_FORWARD");
 console.log(JSON.stringify({config:output.config,comparison:output.comparison,dataset:output.dataset,datasetSha256:output.datasetSha256},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
