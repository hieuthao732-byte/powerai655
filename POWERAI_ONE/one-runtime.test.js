"use strict";
const assert=require("node:assert/strict");
const D=require("./domain.js");
const S=require("./unified-selector.js");
const P=require("./unified-portfolio-pipeline.js");
const G=require("./adaptive-governor.js");
const A=require("./after-draw-evaluation.js");
const R=require("./adaptive-shadow-runner.js");
const C=require("./challenger-evidence-gate.js");
const Runtime=require("./one-runtime.js");
const runtime=Runtime.create({domain:D,selectorModule:S,pipelineModule:P,governor:G,afterDrawModule:A,shadowRunnerModule:R,challengerGate:C});
function ticket(i){return {main:[i+1,i+8,i+15,i+22,i+29,i+36].map(n=>((n-1)%55)+1)};}
runtime.registerProvider({id:"A7",version:"test",propose:()=>Array.from({length:60},(_,i)=>({ticket:ticket(i),score:60-i}))});
(async()=>{
 const draws=Array.from({length:35},(_,i)=>({id:i+1,date:new Date(Date.UTC(2026,0,i+2,12)).toISOString(),source:"official",verified:true,main:[1,2,3,4,5,6],special:7}));
 const built=await runtime.buildPortfolio({targetDrawId:35,draws,providerIds:["A7"],count:10});
 assert.equal(built.portfolio.engineId,"POWERAI_ONE");
 assert.equal(built.portfolio.tickets.length,10);
 assert.deepEqual(runtime.listProviders().map(p=>p.id),["A7"]);
 const after=runtime.evaluateAfterDraw({portfolio:{targetDrawId:35,generatedAt:"2026-01-01T00:00:00Z",tickets:[{main:[1,2,3,4,5,6]}]},draw:draws[34],priorRecords:[]});
 assert.equal(after.maxMainHits,6);
 assert.equal(after.automaticPromotion,false);
 assert.equal(runtime.policy.singleFinalSelector,true);
 assert.equal(runtime.policy.productionMutation,false);
 assert.throws(()=>Runtime.create({domain:{}}),/PowerAIDomain is required/);
 console.log("PowerAI ONE unified runtime tests: PASS");
})().catch(e=>{console.error(e);process.exitCode=1;});
