"use strict";
const assert=require("node:assert/strict");
const D=require("./domain.js");
const {create}=require("./portfolio-service.js");

(async()=>{
  const service=create(D);
  service.register({
    id:"MOCK",version:"test-1",expectedTicketCount:2,
    generate:({draws,targetDrawId})=>{
      assert.ok(draws.every(d=>d.id<targetDrawId));
      return {tickets:[[1,2,3,4,5,6],[7,8,9,10,11,12]]};
    }
  });
  const result=await service.generate("MOCK",{
    targetDrawId:3,mode:"prospective",
    draws:[
      {id:1,result:[1,2,3,4,5,6,7]},
      {id:2,result:[2,3,4,5,6,7,8]},
      {id:3,result:[3,4,5,6,7,8,9]}
    ]
  });
  assert.equal(result.portfolio.engineId,"MOCK");
  assert.equal(result.portfolio.cutoffDrawId,2);
  assert.equal(result.portfolio.provenance.mode,"prospective");
  assert.deepEqual(result.portfolio.provenance.sourceDrawIds,[1,2]);
  assert.equal(result.history.rejected,1);
  await assert.rejects(()=>service.generate("MISSING",{targetDrawId:3,draws:[]}),/UNKNOWN_ENGINE/);
  service.register({id:"SHADOW",status:"shadow",expectedTicketCount:1,generate:()=>({tickets:[[1,2,3,4,5,6]]})});
  await assert.rejects(()=>service.generate("SHADOW",{targetDrawId:3,draws:[{id:1,result:[1,2,3,4,5,6]}],mode:"prospective"}),/SHADOW_ENGINE_MODE_REQUIRED/);
  await assert.rejects(()=>service.generate("MOCK",{targetDrawId:3,draws:[{id:1,result:[1,2,3,4,5,6]}],mode:"shadow"}),/EXPLICIT_SHADOW_OPT_IN_REQUIRED/);
  console.log("PowerAI ONE portfolio service tests: PASS");
})().catch(e=>{console.error(e);process.exitCode=1});
