"use strict";
const assert=require("node:assert/strict");
const D=require("./domain.js");
const S=require("./unified-selector.js").create(D);
const P=require("./unified-portfolio-pipeline.js").create(D,S);
function t(i){const a=new Set();for(let j=0;j<6;j++)a.add(((i*13+j*9+j*j*3)%55)+1);let n=1;while(a.size<6)a.add(((i*7+n++*11)%55)+1);return [...a].sort((x,y)=>x-y);}
P.registerProvider({id:"A",propose:()=>Array.from({length:35},(_,i)=>({ticket:t(i),score:35-i}))});
P.registerProvider({id:"D",status:"shadow",propose:()=>Array.from({length:35},(_,i)=>({ticket:t(i+35),score:35-i}))});
(async()=>{
 const draws=[{id:1,result:[1,2,3,4,5,6,7]},{id:2,result:[2,3,4,5,6,7,8]},{id:3,result:[3,4,5,6,7,8,9]}];
 const out=await P.build({targetDrawId:3,draws,providerIds:["A"],count:10});
 assert.equal(out.portfolio.engineId,"POWERAI_ONE");
 assert.equal(out.portfolio.cutoffDrawId,2);
 assert.equal(out.portfolio.tickets.length,10);
 assert.deepEqual(out.portfolio.provenance.providerIds,["A"]);
 await assert.rejects(()=>P.build({targetDrawId:3,draws,providerIds:["D"]}),/SHADOW_PROVIDER_MODE_REQUIRED/);
 const shadow=await P.build({targetDrawId:3,draws,providerIds:["A","D"],mode:"shadow",count:10});
 assert.deepEqual(shadow.portfolio.provenance.providerIds,["A","D"]);
 assert.equal(shadow.portfolio.selectionPolicy.id,"ONE_BOUNDED_FEASIBILITY_BEAM_V1");
 console.log("PowerAI ONE pipeline tests: PASS");
})().catch(e=>{console.error(e);process.exitCode=1});
