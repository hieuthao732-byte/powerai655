"use strict";
const assert=require("node:assert/strict");
const D=require("./domain.js"),G=require("./adaptive-governor.js"),E=require("./after-draw-evaluation.js").create(D,G);
const baseDate=id=>new Date(Date.UTC(2026,0,id+2,12)).toISOString();
function draw(id,main=[1,2,3,4,5,6]){return {id,date:baseDate(id),source:"official",verified:true,main,special:7};}
function portfolio(id,tickets,generatedAt="2026-01-01T10:00:00Z"){return {targetDrawId:id,generatedAt,tickets:tickets.map(main=>({main})),portfolioHash:"TESTHASH"};}
const prior=[];
for(let id=1;id<=9;id++){
 const d=draw(id),p=portfolio(id,[[10,11,12,13,14,15]]);
 const r=E.evaluate({portfolio:p,draw:d,priorRecords:prior,threshold:10});
 prior.push(r.record);
 assert.equal(r.governor.events.length,0);
}
const tenth=E.evaluate({portfolio:portfolio(10,[[10,11,12,13,14,15]]),draw:draw(10),priorRecords:prior,threshold:10});
assert.equal(tenth.maxMainHits,0);
assert.equal(tenth.governor.events.length,1);
assert.equal(tenth.governor.events[0].targetDrawId,10);
assert.equal(tenth.activeModelMutated,false);
assert.equal(tenth.statePersisted,false);
assert.equal(tenth.automaticPromotion,false);
const success=E.evaluate({portfolio:portfolio(11,[[1,2,3,4,5,6]]),draw:draw(11),priorRecords:[...prior,tenth.record],threshold:10});
assert.equal(success.maxMainHits,6);
assert.equal(success.governor.currentStreak,0);
assert.equal(success.specialHitTickets,0);
assert.throws(()=>E.evaluate({portfolio:portfolio(12,[[1,2,3,4,5,6]]),draw:{...draw(12),verified:false},priorRecords:[]}),/UNVERIFIED_OFFICIAL_DRAW_REQUIRED/);
assert.throws(()=>E.evaluate({portfolio:portfolio(12,[[1,2,3,4,5,6]],"2026-02-01T00:00:00Z"),draw:draw(12),priorRecords:[]}),/PORTFOLIO_NOT_LOCKED_BEFORE_RESULT/);
assert.throws(()=>E.evaluate({portfolio:portfolio(12,[[1,2,3,4,5,6]]),draw:draw(13),priorRecords:[]}),/PORTFOLIO_TARGET_DRAW_MISMATCH/);
console.log("PowerAI ONE after-draw evaluation tests: PASS");
