"use strict";
const assert=require("node:assert/strict");
const Domain=require("./domain.js");
const S=require("./unified-selector.js").create(Domain);
const P=require("./unified-portfolio-pipeline.js").create(Domain,S);
const D=require("../adaptive-d.js");
const A=require("./track-d-adapter.js"),Provider=require("./track-d-provider.js");
Provider.register(P,A,D,{candidateCount:500});
const draws=[];
for(let id=1;id<=100;id++){const s=new Set();let k=0;while(s.size<6)s.add(((id*23+(++k)*5+k*k*7)%55)+1);draws.push({id,main:[...s].sort((a,b)=>a-b),special:null})}
(async()=>{
 await assert.rejects(()=>P.build({targetDrawId:101,draws,providerIds:["D_ADAPTIVE"]}),/SHADOW_PROVIDER_MODE_REQUIRED/);
 const out=await P.build({targetDrawId:101,draws,providerIds:["D_ADAPTIVE"],mode:"shadow",count:20,seed:54321});
 assert.equal(out.portfolio.tickets.length,20);
 assert.equal(out.portfolio.provenance.providerIds[0],"D_ADAPTIVE");
 assert.equal(out.portfolio.provenance.providerStats[0].generated,500);
 assert.equal(out.portfolio.selectionPolicy.id,"ONE_UNIFIED_GREEDY_V1");
 console.log("PowerAI ONE Track D → unified pipeline tests: PASS");
})().catch(e=>{console.error(e);process.exitCode=1});
