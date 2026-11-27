"use strict";
/* Research only: unified ONE (A7 + B1.3 -> selector, same request as the website) versus plain random 20-ticket portfolios.
   Walk-forward: each target draw sees only earlier draws. Never writes logs, locks or learning state.
   Data: WF_DATA_FILE (local jsonl) or the public feed used by the website. */
const crypto=require("node:crypto"),fs=require("node:fs");
const D=require("./domain.js"),S=require("./unified-selector.js"),P=require("./unified-portfolio-pipeline.js"),G=require("./adaptive-governor.js"),AD=require("./after-draw-evaluation.js"),R=require("./adaptive-shadow-runner.js"),C=require("./challenger-evidence-gate.js"),Runtime=require("./one-runtime.js");
const AP=require("./track-a-provider.js"),BP=require("./track-b-provider.js"),AA=require("./track-a-adapter.js"),BA=require("./track-b-adapter.js");
const SOURCE="https://raw.githubusercontent.com/vietvudanh/vietlott-data/main/data/power655.jsonl";
const int=(v,d,min,max)=>{if(v==null||String(v).trim()==="")return d;const n=Number(v);return Math.min(max,Math.max(min,Number.isInteger(n)?n:d));};
function seeded(seed){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function randomTickets(rnd,n){const out=new Set(),res=[];while(res.length<n){const a=new Set();while(a.size<6)a.add(1+Math.floor(rnd()*55));const t=[...a].sort((x,y)=>x-y),k=t.join("-");if(!out.has(k)){out.add(k);res.push(t);}}return res;}
const hits=(t,actual)=>t.filter(n=>actual.includes(n)).length;
const choose=(n,k)=>{let v=1;for(let i=1;i<=k;i++)v=v*(n-i+1)/i;return v;};
const P3=(choose(6,3)*choose(49,3)+choose(6,4)*choose(49,2)+choose(6,5)*49+1)/choose(55,6);
(async()=>{
 const raw=process.env.WF_DATA_FILE?fs.readFileSync(process.env.WF_DATA_FILE,"utf8"):await (await fetch(SOURCE,{signal:AbortSignal.timeout(30000)})).text();
 const seen=new Set(),draws=[];
 raw.split(/\r?\n/).filter(Boolean).forEach(l=>{const p=D.normalizeDraw(JSON.parse(l));if(p.ok&&!seen.has(p.draw.id)){seen.add(p.draw.id);draws.push(p.draw);}});
 draws.sort((a,b)=>a.id-b.id);
 const windowSize=int(process.env.WF_WINDOW,200,1,400),randTrials=int(process.env.WF_RANDOM_TRIALS,2000,100,20000),start=draws.length-windowSize;
 const runtime=Runtime.create({domain:D,selectorModule:S,pipelineModule:P,governor:G,afterDrawModule:AD,shadowRunnerModule:R,challengerGate:C});
 // The website engines run in the browser; these thin wrappers give the providers the same contract from the Node adapters.
 const engineA={id:"A7",generate:id=>{const r=AA.generate(id);return{tickets:r.tickets.map(x=>({main:Array.isArray(x)?x.slice():x.main.slice()})),seed:r.seed,audit:r.audit,analysis:r.analysis};}};
 const engineB={id:"B1.3",generate:(d,id,o)=>BA.generate(d,id,o),validLegacy:BA.validLegacy||(a=>Array.isArray(a)&&a.length===6)};
 AP.register(runtime,engineA);BP.register(runtime,engineB,{candidateCount:int(process.env.WF_B_CANDIDATES,3000,500,50000)});
 const one=[],rand=[],t0=Date.now();
 for(let i=start;i<draws.length;i++){
  const target=draws[i],history=draws.slice(0,i),actual=(target.main||target.result||[]).slice(0,6);
  const built=await runtime.buildPortfolio({targetDrawId:target.id,draws:history,providerIds:["A7","B1.3"],mode:"prospective",count:20,maxOverlap:4,candidateLimit:120,beamWidth:24,searchNodeBudget:200000,seed:(target.id*104729+130013)>>>0,scoreWeight:.7,diversityWeight:.3});
  if(built.portfolio.cutoffDrawId>=target.id)throw new Error("LEAK_CUTOFF_"+target.id);
  const t=built.portfolio.tickets.map(x=>x.main);if(t.length!==20)throw new Error("NOT_20_TICKETS_"+target.id);
  one.push(t.map(x=>hits(x,actual)));
  if((i-start)%10===0)console.error("progress",i-start+1,"/",windowSize,"elapsed",Math.round((Date.now()-t0)/1000)+"s");
 }
 const rnd=seeded(20261127);
 for(let i=start;i<draws.length;i++){const actual=(draws[i].main||draws[i].result||[]).slice(0,6);for(let k=0;k<randTrials;k++)rand.push(randomTickets(rnd,20).map(x=>hits(x,actual)));}
 const stat=(rows)=>{const flat=rows.flat(),n=flat.length;return{portfolios:rows.length,tickets:n,meanHitsPerTicket:flat.reduce((a,b)=>a+b,0)/n,ticketAtLeast3:flat.filter(h=>h>=3).length/n,ticketAtLeast4:flat.filter(h=>h>=4).length/n,portfolioAtLeast3:rows.filter(r=>Math.max(...r)>=3).length/rows.length,portfolioAtLeast4:rows.filter(r=>Math.max(...r)>=4).length/rows.length,meanMaxHits:rows.reduce((a,r)=>a+Math.max(...r),0)/rows.length,distribution:[0,1,2,3,4,5,6].map(h=>flat.filter(x=>x===h).length)};};
 const a=stat(one),b=stat(rand),n=a.tickets,k3=Math.round(a.ticketAtLeast3*n),pe=P3,z=(k3-n*pe)/Math.sqrt(n*pe*(1-pe));
 const pp=b.portfolioAtLeast3,zp=(a.portfolioAtLeast3-pp)/Math.sqrt(pp*(1-pp)/a.portfolios);
 // paired comparison on per-draw max hits is dominated by noise; report both z-scores against the random baseline
 const out={reportType:"POWERAI_ONE_UNIFIED_A7_B13_VS_RANDOM_WALK_FORWARD",researchOnly:true,officialLogsWritten:false,learningUpdated:false,dataset:{validDraws:draws.length,firstTarget:draws[start].id,lastTarget:draws.at(-1).id,sha256:crypto.createHash("sha256").update(raw).digest("hex")},config:{window:windowSize,randomTrialsPerDraw:randTrials,request:"same as website: providers A7+B1.3, count 20, maxOverlap 4, candidateLimit 120"},theory:{pTicketAtLeast3:P3,expectedMeanHitsPerTicket:36/55},ONE:a,randomPlain:b,zTicketAtLeast3_vs_theory:z,zPortfolioAtLeast3_vs_random:zp};
 fs.mkdirSync("artifacts",{recursive:true});fs.writeFileSync("artifacts/powerai-one-unified-walk-forward-report.json",JSON.stringify(out,null,2));
 console.log(JSON.stringify(out,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
