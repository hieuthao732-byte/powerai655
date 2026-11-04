"use strict";
const assert=require("node:assert/strict");
const Gate=require("./challenger-evidence-gate.js");
function fixture(){
 const rows=[];
 for(let block=0;block<4;block++){
  for(let i=0;i<50;i++){
   let a=0,c=0;
   if(i<10){a=3;c=0;}       // active-only success
   else if(i<30){a=0;c=3;}  // challenger-only success
   else if(i<40){a=3;c=3;}  // both
   rows.push({targetDrawId:1000+block*50+i,source:"official",verified:true,activeMaxMainHits:a,challengerMaxMainHits:c,activeSpecialHit:false,challengerSpecialHit:false});
  }
 }
 return rows;
}
assert.ok(Math.abs(Gate.binomialUpperTail(10,8)-0.0546875)<1e-12);
assert.ok(Gate.binomialUpperTail(1000,1)>0.999999);
const good=Gate.evaluate(fixture());
assert.equal(good.decision,"RECOMMEND_HUMAN_REVIEW");
assert.equal(good.automaticPromotion,false);
assert.equal(good.activeModelMutated,false);
assert.equal(good.sampleSize,200);
assert.ok(good.exactOneSidedMcNemarP<0.05);
assert.ok(good.checks.temporalStability);
const small=Gate.evaluate(fixture().slice(0,100));
assert.equal(small.reason,"INSUFFICIENT_PAIRED_DRAWS");
const unverified=fixture();unverified[0].verified=false;
assert.throws(()=>Gate.evaluate(unverified),/UNVERIFIED_EVALUATION_ROW/);
const gap=fixture();gap[1].targetDrawId+=2;
assert.throws(()=>Gate.evaluate(gap),/NON_CONSECUTIVE_DRAWS/);
const regress=fixture().map(r=>({...r,challengerMaxMainHits:r.challengerMaxMainHits>=3?3:0,activeMaxMainHits:r.activeMaxMainHits>=3?4:0}));
const blocked=Gate.evaluate(regress);
assert.equal(blocked.decision,"KEEP_SHADOW");
assert.equal(blocked.checks.atLeast4Guard,false);
console.log("PowerAI ONE challenger evidence gate tests: PASS",JSON.stringify({p:good.exactOneSidedMcNemarP,lift:good.overall.lift3,blocks:good.stableBlocks}));
