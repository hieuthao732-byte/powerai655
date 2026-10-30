"use strict";
const assert=require("node:assert/strict");
const D=require("../adaptive-d.js");
const A=require("./track-d-adapter.js");
const draws=[];
for(let id=1;id<=100;id++){const s=new Set();let k=0;while(s.size<6)s.add(((id*23+(++k)*5+k*k*7)%55)+1);draws.push({id,main:[...s].sort((a,b)=>a-b),special:null})}
assert.equal(typeof D.generateCandidates,"function");
const one=A.generate(draws,101,D,{candidateCount:500,seed:54321});
const two=A.generate(draws,101,D,{candidateCount:500,seed:54321});
assert.equal(one.candidates.length,500);
assert.equal(one.cutoffDrawId,100);
assert.equal(one.modelHash,two.modelHash);
assert.deepEqual(one.candidates,two.candidates);
assert.ok(one.candidates.every(x=>x.ticket.length===6&&Number.isFinite(x.score)));
assert.equal(one.confidence.confidence==="NORMAL"||one.confidence.confidence==="LOW_CONFIDENCE",true);
assert.throws(()=>A.generate(draws.slice(0,5),6,D),/ít nhất 12 kỳ/);
console.log("PowerAI ONE Track D candidate adapter tests: PASS");
