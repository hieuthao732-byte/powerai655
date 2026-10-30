"use strict";
const assert=require("node:assert/strict");
const L=require("./track-l-adapter.js"),B=require("./track-b-adapter.js");
const draws=[];
for(let id=1;id<=80;id++){const s=new Set();let k=0;while(s.size<6)s.add(((id*19+(++k)*7+k*k)%55)+1);draws.push({id,main:[...s].sort((a,b)=>a-b),special:null})}
const report={n:20,signals:[{name:"Heat",strength:.4,stability:.8},{name:"Pair",strength:.2,stability:.7},{name:"OddEven",strength:-.1,stability:.3},{name:"SmallBig",strength:0,stability:.5},{name:"Sum",strength:.1,stability:.6}]};
const weights=L.learnedPortfolioWeights(report);
assert.ok(Math.abs(Object.values(weights.weights).reduce((a,b)=>a+b,0)-1)<1e-10);
assert.equal(weights.mode,"VALIDATION CANDIDATE");
const out=L.generate(draws,81,report,B,{candidateCount:500,seed:12345});
assert.equal(out.candidates.length,500);
assert.equal(out.cutoffDrawId,80);
assert.ok(out.candidates.every(x=>x.ticket.length===6&&Number.isFinite(x.score)));
assert.deepEqual(L.verifiedLogs([{source:"manual",targetId:1,actual:[1,2,3,4,5,6]},{source:"feed",targetId:2,actual:[1,2,3,4,5,6]}]).map(x=>x.targetId),[2]);
assert.equal(L.maturity(4).pct,16);
assert.equal(L.maturity(20).pct,100);
console.log("PowerAI ONE Track L learned candidate tests: PASS");
