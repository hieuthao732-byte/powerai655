"use strict";
const crypto=require("node:crypto");
const D=require("./domain.js");
const A=require("./track-a-adapter.js");
const B=require("./random-portfolio-baseline.js");
const {create}=require("./walk-forward-evaluator.js");
const SOURCE="https://raw.githubusercontent.com/vietvudanh/vietlott-data/main/data/power655.jsonl";
const asInt=x=>Number.isInteger(Number(x))?Number(x):null;
(async()=>{
 const response=await fetch(SOURCE,{signal:AbortSignal.timeout(30000),headers:{"user-agent":"PowerAI-ONE-walk-forward-research"}});
 if(!response.ok)throw new Error("HISTORY_FEED_HTTP_"+response.status);
 const raw=await response.text(),rows=raw.split(/\r?\n/).filter(x=>x.trim()).map((line,i)=>{try{return JSON.parse(line);}catch(e){throw new Error("INVALID_JSONL_LINE_"+(i+1));}});
 const valid=[],seen=new Set(),rejected=[];
 rows.forEach((row,index)=>{const p=D.normalizeDraw(row);if(!p.ok){rejected.push({index,id:row?.id??null,errors:p.errors});return;}if(seen.has(p.draw.id)){rejected.push({index,id:p.draw.id,errors:["DUPLICATE_DRAW_ID"]});return;}seen.add(p.draw.id);valid.push(p.draw);});
 valid.sort((a,b)=>a.id-b.id);
 const minHistory=Math.max(100,asInt(process.env.WF_MIN_HISTORY)||100);
 const windowSize=Math.min(200,Math.max(5,asInt(process.env.WF_WINDOW)||30));
 const startIndex=Math.max(minHistory,valid.length-windowSize);
 if(startIndex>=valid.length)throw new Error("INSUFFICIENT_HISTORY_FOR_REQUESTED_WINDOW");
 const evaluator=create(D);
 const report=await evaluator.evaluate(valid,{
  minHistory,startIndex,
  generate:ctx=>{
   const result=A.generate(ctx.targetDrawId);
   if(result.audit.coverage!==55||result.audit.minExp!==2||result.audit.maxExp!==3||result.audit.repeatedPairs!==0||result.audit.maxOverlap>1)
    throw new Error("A7_GEOMETRY_AUDIT_FAILED_AT_"+ctx.targetDrawId);
   return{cutoffDrawId:ctx.cutoffDrawId,tickets:result.tickets};
  },
  baselineGenerator:ctx=>{
   const result=B.generate(ctx.targetDrawId,0);
   if(result.audit.coverage!==55||result.audit.minExposure!==2||result.audit.maxExposure!==3||result.audit.repeatedPairs!==0||result.audit.maxOverlap>1)
    throw new Error("RANDOM_BASELINE_GEOMETRY_AUDIT_FAILED_AT_"+ctx.targetDrawId);
   return result.tickets;
  }
 });
 const baseTickets=report.records.reduce((n,r)=>n+r.baseline.ticketCount,0);
 const baseDistribution=Array.from({length:7},(_,hits)=>({hits,tickets:report.records.reduce((n,r)=>n+r.baseline.ticketHitDistribution?.[hits]||n,0)}));
 const output={
  reportType:"POWERAI_ONE_A7_VS_CONSTRAINED_RANDOM_WALK_FORWARD",
  researchOnly:true,officialLogsWritten:false,learningUpdated:false,
  source:SOURCE,datasetSha256:crypto.createHash("sha256").update(raw).digest("hex"),
  dataset:{validDraws:valid.length,firstDrawId:valid[0]?.id,lastDrawId:valid.at(-1)?.id,rejectedRows:rejected.length},
  config:{minHistory,requestedWindow:windowSize,actualWindow:report.summary.draws,firstTargetDrawId:report.targetRange.first,lastTargetDrawId:report.targetRange.last,ticketsPerPortfolio:20},
  comparison:{
   A7:report.summary,
   constrainedRandom:report.baselineSummary,
   portfolioAtLeast3Difference:report.summary.portfolioHitRates.atLeast3-(report.baselineSummary.portfolioHitRates?.atLeast3??report.baselineSummary.portfoliosAtLeast3/report.baselineSummary.draws),
   portfolioAtLeast4Difference:report.summary.portfolioHitRates.atLeast4-(report.baselineSummary.portfolioHitRates?.atLeast4??report.baselineSummary.portfoliosAtLeast4/report.baselineSummary.draws),
   equalTicketCount:baseTickets===report.summary.tickets
  },
  records:report.records.map(r=>({targetDrawId:r.targetDrawId,cutoffDrawId:r.cutoffDrawId,historyCount:r.historyCount,maxMainHits:r.maxMainHits,mainHitDistribution:r.tickets.reduce((a,t)=>{a[t.mainHits]++;return a;},Array(7).fill(0)),specialHitTickets:r.specialHitTickets,baseline:r.baseline})),
  rejectedRows:rejected
 };
 require("node:fs").mkdirSync("artifacts",{recursive:true});
 require("node:fs").writeFileSync("artifacts/powerai-one-walk-forward-report.json",JSON.stringify(output,null,2));
 console.log("POWERAI_ONE_A7_VS_CONSTRAINED_RANDOM_WALK_FORWARD");
 console.log(JSON.stringify({config:output.config,comparison:output.comparison,dataset:output.dataset,datasetSha256:output.datasetSha256},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
