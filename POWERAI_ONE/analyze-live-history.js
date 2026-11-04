"use strict";
const crypto=require("node:crypto");
const D=require("./domain.js");
const {create}=require("./historical-reverse-analysis.js");
const SOURCE="https://raw.githubusercontent.com/vietvudanh/vietlott-data/main/data/power655.jsonl";

(async()=>{
  const response=await fetch(SOURCE,{signal:AbortSignal.timeout(30000),headers:{"user-agent":"PowerAI-ONE-history-audit"}});
  if(!response.ok)throw new Error("HISTORY_FEED_HTTP_"+response.status);
  const raw=await response.text();
  const rows=raw.split(/\r?\n/).filter(line=>line.trim()).map((line,index)=>{
    try{return JSON.parse(line);}catch(e){throw new Error("INVALID_JSONL_LINE_"+(index+1));}
  });
  const report=create(D).analyze(rows);
  const mainTop=[...report.numbers].sort((a,b)=>b.mainCount-a.mainCount||a.number-b.number).slice(0,10);
  const mainBottom=[...report.numbers].sort((a,b)=>a.mainCount-b.mainCount||a.number-b.number).slice(0,10);
  const specialTop=[...report.numbers].sort((a,b)=>b.specialCount-a.specialCount||a.number-b.number).slice(0,10);
  const specialBottom=[...report.numbers].sort((a,b)=>a.specialCount-b.specialCount||a.number-b.number).slice(0,10);
  const ids=report.numbers.length?rows.map(r=>Number(r.id)).filter(Number.isInteger).sort((a,b)=>a-b):[];
  const gaps=[];
  for(let i=1;i<ids.length;i++)if(ids[i]!==ids[i-1]+1)gaps.push({after:ids[i-1],before:ids[i]});
  const output={
    source:SOURCE,
    datasetSha256:crypto.createHash("sha256").update(raw).digest("hex"),
    data:report.data,
    mainFrequency:report.mainFrequency,
    specialFrequency:report.specialFrequency,
    structure:report.structure,
    mainTop,mainBottom,specialTop,specialBottom,
    drawIdGaps:gaps
  };
  console.log("POWERAI_ONE_LIVE_HISTORY_ANALYSIS");
  console.log(JSON.stringify(output,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
