"use strict";
const assert=require("node:assert/strict");
const G=require("./adaptive-governor.js");
function row(id,maxHit=0,source="official",verified=true){
 const main=[1,2,3,4,5,6];
 const ticket=maxHit>=3?[1,2,3,40,41,42]:[10,11,12,13,14,15];
 return {targetDrawId:id,lockedAt:"2026-01-01T10:00:00Z",resultAvailableAt:"2026-01-01T11:00:00Z",
  portfolio:{tickets:[{main:ticket}]},result:{id,main,source,verified,date:"2026-01-01T11:00:00Z"}};
}
const ten=Array.from({length:10},(_,i)=>row(i+1));
let out=G.evaluate(ten);
assert.equal(out.currentStreak,10);
assert.equal(out.events.length,1);
assert.equal(out.events[0].action,"RUN_SHADOW_CHALLENGER");
assert.equal(out.events[0].activeModelMutation,false);
out=G.evaluate([...ten,row(11,3),...Array.from({length:10},(_,i)=>row(i+12))]);
assert.equal(out.events.length,2,"a successful 3+ draw resets the latch");
assert.equal(out.events[1].targetDrawId,21);
out=G.evaluate(Array.from({length:20},(_,i)=>row(i+1,0,"imported",false)));
assert.equal(out.events.length,0,"unverified draws must never trigger adaptation");
out=G.evaluate([row(1),{...row(2),lockedAt:"2026-01-01T12:00:00Z"}]);
assert.equal(out.acceptedDraws,1);
assert.equal(out.rejected.length,1);
assert.throws(()=>G.evaluate([], {threshold:1}),/INVALID_STREAK_THRESHOLD/);
assert.throws(()=>G.evaluate(null),/RECORDS_MUST_BE_ARRAY/);
console.log("PowerAI ONE adaptive governor tests: PASS");
