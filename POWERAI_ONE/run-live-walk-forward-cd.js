"use strict";
const crypto=require("node:crypto");
const D=require("./domain.js"),A=require("./track-a-adapter.js"),B=require("./track-b-adapter.js"),C=require("./track-c-adapter.js");
const CoreD=require("../adaptive-d.js"),AdapterD=require("./track-d-adapter.js");
const {create:selectorFactory}=require("./unified-selector.js"),{create:evaluatorFactory}=require("./walk-forward-evaluator.js");
const SOURCE="https://raw.githubusercontent.com/vietvudanh/vietlott-data/main/data/power655.jsonl";
const int=(v,d,min,max)=>Math.min(max,Math.max(min,Number.isInteger(Number(v))?Number(v):d));
const selector=selectorFactory(D),evaluator=evaluatorFactory(D),opts={count:20,maxOverlap:4,candidateLimit:120,beamWidth:24,searchNodeBudget:200000};
function seeded(seed){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
async function history(){
 const res=await fetch(SOURCE,{signal:AbortSignal.timeout(30000)});if(!res.ok)throw Error("HISTORY_FEED_HTTP_"+res.status);
 const raw=await res.text(),seen=new Set(),rejected=[],draws=[];
 raw.split(/\r?\n/).filter(Boolean).forEach((line,index)=>{let row;try{row=JSON.parse(line)}catch{throw Error("INVALID_JSONL_LINE_"+(index+1))}const p=D.normalizeDraw(row);if(!p.ok){rejected.push({index,id:row?.id??null});return}if(seen.has(p.draw.id)){rejected.push({index,id:p.draw.id,duplicate:true});return}seen.add(p.draw.id);draws.push(p.draw)});
 draws.sort((a,b)=>a.id-b.id);return{draws,rejected,sha256:crypto.createHash("sha256").update(raw).digest("hex")};
}
async function runC(draws,windowSize,bCount){
 const cache=new Map(),minHistory=250;
 return evaluator.evaluate(draws,{minHistory,startIndex:Math.max(minHistory,draws.length-windowSize),baselineTrials:1,
  generate:ctx=>{const a=A.generate(ctx.targetDrawId),b=B.generate(ctx.draws,ctx.targetDrawId,{candidateCount:bCount,seed:(ctx.targetDrawId*104729+130013)>>>0});if(b.cutoffDrawId!==ctx.cutoffDrawId)throw Error("C_B_CUTOFF_MISMATCH");const out=C.generate(ctx.draws,a,b.candidates.slice().sort((x,y)=>y.score-x.score).slice(0,20),B,ctx.targetDrawId);if(out.cutoffDrawId!==ctx.cutoffDrawId)throw Error("C_CUTOFF_MISMATCH");cache.set(ctx.targetDrawId,a.tickets);return{cutoffDrawId:out.cutoffDrawId,tickets:out.candidates.map(x=>({main:x.main}))};},
  baselineGenerator:ctx=>cache.get(ctx.targetDrawId).map(x=>({main:x.main||x}))});
}
async function runD(draws,windowSize,count,trials){
 const pools=new Map(),minHistory=100;
 return evaluator.evaluate(draws,{minHistory,startIndex:Math.max(minHistory,draws.length-windowSize),baselineTrials:trials,
  generate:ctx=>{const out=AdapterD.generate(ctx.draws,ctx.targetDrawId,CoreD,{candidateCount:count,seed:(ctx.targetDrawId*2654435761)>>>0});if(out.cutoffDrawId!==ctx.cutoffDrawId||out.candidates.length!==count)throw Error("D_CANDIDATE_OR_CUTOFF_MISMATCH");pools.set(ctx.targetDrawId,out.candidates);return{cutoffDrawId:out.cutoffDrawId,tickets:selector.select(out.candidates,opts).tickets};},
  baselineGenerator:(ctx,trial)=>{const rnd=seeded((ctx.targetDrawId*2246822519+Math.imul(trial+1,3266489917)+0x6d2b79f5)>>>0);return selector.select(pools.get(ctx.targetDrawId).map(x=>({...x,score:rnd()})),opts).tickets;}});
}
(async()=>{
 const h=await history(),cw=int(process.env.WF_C_WINDOW,10,5,30),dw=int(process.env.WF_D_WINDOW,50,5,200),bc=int(process.env.WF_C_B_CANDIDATES,3000,500,10000),dc=int(process.env.WF_D_CANDIDATES,3200,500,10000),tr=int(process.env.WF_D_BASELINE_TRIALS,5,1,20);
 const [c,d]=await Promise.all([runC(h.draws,cw,bc),runD(h.draws,dw,dc,tr)]);
 const out={reportType:"POWERAI_ONE_C_RC6_D_ADAPTIVE_WALK_FORWARD",researchOnly:true,officialLogsWritten:false,learningUpdated:false,source:SOURCE,dataset:{validDraws:h.draws.length,firstDrawId:h.draws[0]?.id,lastDrawId:h.draws.at(-1)?.id,rejectedRows:h.rejected.length,sha256:h.sha256},
 C_RC6:{comparison:"C mapped whole portfolio versus A7's unoptimized relabeling of the same incidence geometry.",config:{window:cw,minHistory:250,bCandidateCount:bc},summary:c.summary,baselineSummary:c.baselineSummary,records:c.records.map(r=>({targetDrawId:r.targetDrawId,cutoffDrawId:r.cutoffDrawId,maxMainHits:r.maxMainHits,baseline:r.baseline}))},
 D_ADAPTIVE:{comparison:"D ranking versus random ranking over the exact same D candidate pool and ONE selector constraints.",config:{window:dw,minHistory:100,candidateCount:dc,baselineTrials:tr},summary:d.summary,baselineSummary:d.baselineSummary,records:d.records.map(r=>({targetDrawId:r.targetDrawId,cutoffDrawId:r.cutoffDrawId,maxMainHits:r.maxMainHits,baseline:r.baseline}))}};
 require("node:fs").mkdirSync("artifacts",{recursive:true});require("node:fs").writeFileSync("artifacts/powerai-one-c-d-walk-forward-report.json",JSON.stringify(out,null,2));
 console.log(JSON.stringify({dataset:out.dataset,C:{summary:c.summary,baseline:c.baselineSummary},D:{summary:d.summary,baseline:d.baselineSummary}},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
