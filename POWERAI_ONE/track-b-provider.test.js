"use strict";
const assert=require("node:assert/strict");
const D=require("./domain.js");
const S=require("./unified-selector.js").create(D);
const P=require("./unified-portfolio-pipeline.js").create(D,S);
const B=require("./track-b-adapter.js");
const Provider=require("./track-b-provider.js");
Provider.register(P,B,{candidateCount:500});
const draws=[];
for(let id=1;id<=30;id++){
 const nums=[],seen=new Set();
 let n=1;
 while(seen.size<6){seen.add(((id*7+n++*11)%55)+1);}
 draws.push({id,main:[...seen].sort((a,b)=>a-b),special:null});
}
(async()=>{
 const result=B.generate(draws,31,{candidateCount:500,seed:12345});
 assert.equal(result.candidates.length,500);
 assert.ok(result.candidates.every(x=>B.validLegacy(x.ticket)));
 assert.ok(result.candidates.every(x=>Number.isFinite(x.score)));
 const out=await P.build({targetDrawId:31,draws,providerIds:["B1.3"],count:20,seed:12345});
 assert.equal(out.portfolio.tickets.length,20);
 assert.equal(out.portfolio.provenance.providerIds[0],"B1.3");
 assert.equal(out.portfolio.selectionPolicy.id,"ONE_UNIFIED_GREEDY_V1");
 assert.ok(out.portfolio.audit.maxOverlap<=4);
 console.log("PowerAI ONE Track B → unified pipeline tests: PASS");
})().catch(e=>{console.error(e);process.exitCode=1});
