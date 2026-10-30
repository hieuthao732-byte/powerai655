"use strict";
const assert=require("node:assert/strict");
const A=require("./track-a-adapter.js");
const B=require("./track-b-adapter.js");
const C=require("./track-c-adapter.js");
const draws=[];
for(let id=1;id<=260;id++){
 const set=new Set();let k=0;while(set.size<6)set.add(((id*17+(++k)*13+k*k*3)%55)+1);
 draws.push({id,main:[...set].sort((x,y)=>x-y),special:null});
}
const a=A.generate(261);
const b=B.generate(draws,261,{candidateCount:800,seed:7123});
const support=b.candidates.slice().sort((x,y)=>y.score-x.score).slice(0,20);
const out=C.generate(draws,a,support,B,261);
assert.equal(out.candidates.length,20);
assert.equal(out.audit.coverage,55);
assert.equal(out.audit.double,45);
assert.equal(out.audit.triple,10);
assert.equal(out.audit.repeatedPairs,0);
assert.equal(out.audit.maxOverlap,1);
assert.equal(out.audit.uniquePairs,300);
assert.ok(out.candidates.every(x=>x.main.length===6&&x.main.every((n,i)=>n>=1&&n<=55&&(i===0||x.main[i-1]<n))));
assert.equal(out.cutoffDrawId,260);
console.log("PowerAI ONE Track C constrained adapter tests: PASS");
