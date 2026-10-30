"use strict";
const assert=require("node:assert/strict");
const D=require("./domain.js");
const S=require("./unified-selector.js").create(D);
const P=require("./unified-portfolio-pipeline.js").create(D,S);
const L=require("./track-l-adapter.js"),B=require("./track-b-adapter.js");
const Provider=require("./track-l-provider.js");
Provider.register(P,L,B,{candidateCount:500});
const draws=[];
for(let id=1;id<=80;id++){const s=new Set();let k=0;while(s.size<6)s.add(((id*19+(++k)*7+k*k)%55)+1);draws.push({id,main:[...s].sort((a,b)=>a-b),special:null})}
const report={n:20,signals:[{name:"Heat",strength:.4,stability:.8},{name:"Pair",strength:.2,stability:.7},{name:"OddEven",strength:-.1,stability:.3},{name:"SmallBig",strength:0,stability:.5},{name:"Sum",strength:.1,stability:.6}]};
(async()=>{
 await assert.rejects(()=>P.build({targetDrawId:81,draws,providerIds:["L_LEARNING"],count:20}),/SHADOW_PROVIDER_MODE_REQUIRED/);
 const out=await P.build({targetDrawId:81,draws,providerIds:["L_LEARNING"],mode:"shadow",count:20,seed:12345,learningReport:report});
 assert.equal(out.portfolio.tickets.length,20);
 assert.equal(out.portfolio.provenance.providerIds[0],"L_LEARNING");
 assert.equal(out.portfolio.provenance.providerStats[0].generated,500);
 assert.equal(out.portfolio.selectionPolicy.id,"ONE_UNIFIED_GREEDY_V1");
 console.log("PowerAI ONE Track L → unified pipeline tests: PASS");
})().catch(e=>{console.error(e);process.exitCode=1});
