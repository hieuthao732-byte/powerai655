"use strict";
const assert=require("node:assert/strict");
const B=require("./track-b-adapter.js");
const {createLearningReport}=require("./track-l-walk-forward.js");
const rows=[];
for(let id=1;id<=30;id++){
 const s=new Set();let j=0;while(s.size<6)s.add(((id*7+(++j)*13)%55)+1);
 rows.push({id,main:[...s].sort((a,b)=>a-b),special:null});
}
const opts={trainingWindow:5,calibrationCandidates:100,calibrationMinHistory:8};
const a=createLearningReport(rows,31,{...opts,B});
assert.equal(a.calibration.targetDrawId,31);
assert.equal(a.calibration.cutoffDrawId,30);
assert.equal(a.report.n,5);
assert.equal(a.report.signals.length,5);
assert.ok(a.calibration.events.every(e=>e.cutoffDrawId<e.targetDrawId&&e.targetDrawId<31));
assert.equal(a.report.researchOnly,true);
assert.equal(a.report.officialLogsWritten,false);
const future=[...rows,{id:31,main:[1,2,3,4,5,6],special:null},{id:32,main:[7,8,9,10,11,12],special:null}];
const b=createLearningReport(future,31,{...opts,B});
assert.deepEqual(a.report,b.report);
assert.deepEqual(a.calibration,b.calibration);
assert.throws(()=>createLearningReport(rows,31,{trainingWindow:0,calibrationCandidates:100,B}),/INVALID_L_CALIBRATION_OPTIONS/);
console.log("PowerAI ONE Track L prequential calibration tests: PASS");
