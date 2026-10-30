"use strict";
const assert=require("node:assert/strict");
const D=require("./domain.js");
const {create}=require("./unified-selector.js");
const selector=create(D);

function ticketAt(i){
  const set=new Set();
  for(let j=0;j<6;j++)set.add(((i*13+j*9+j*j*3)%55)+1);
  let n=1;
  while(set.size<6){set.add(((i*7+n*11)%55)+1);n++;}
  return [...set].sort((a,b)=>a-b);
}
const candidates=Array.from({length:90},(_,i)=>({
  ticket:ticketAt(i),source:i%3===0?"A":i%3===1?"B":"D",
  score:1000-i,components:{legacy:i}
}));
const out=selector.select(candidates,{count:20,maxOverlap:5});
assert.equal(out.tickets.length,20);
assert.equal(new Set(out.tickets.map(t=>t.main.join("-"))).size,20);
assert.equal(out.policy.id,"ONE_BOUNDED_FEASIBILITY_BEAM_V1");
assert.equal(out.audit.ticketCount,20);
assert.ok(out.ranked.every((x,i)=>x.rank===i+1));
assert.ok(out.ranked.every(x=>x.rankScore>=0&&x.rankScore<=1));

const merged=selector.normalizeCandidates([
 {ticket:[1,2,3,4,5,6],source:"A",score:20},
 {ticket:[1,2,3,4,5,6],source:"B",score:999}
]);
assert.equal(merged.candidates.length,1);
assert.deepEqual(merged.candidates[0].sources,["A","B"]);
assert.equal(merged.candidates[0].sourceScores.A,20);
assert.equal(merged.candidates[0].sourceScores.B,999);
assert.throws(()=>selector.select([{ticket:[1,2,3,4,5,6]}],{count:2}),/INSUFFICIENT_UNIQUE_CANDIDATES/);
assert.throws(()=>selector.select(candidates,{count:20,maxOverlap:7}),/INVALID_MAX_OVERLAP/);

// Full-portfolio geometry is treated as a hard constraint, not a soft score.
const A=require("./track-a-adapter.js");
const aPortfolio=A.generate(1418);
const constrained=selector.select(aPortfolio.tickets.map((x,i)=>({ticket:x.main,source:"A7",score:20-i})),{
  count:20,maxOverlap:1,constraints:{requireCoverage:true,minExposure:2,maxExposure:3,maxRepeatedPairs:0}
});
assert.equal(constrained.audit.coverage,55);
assert.equal(constrained.audit.minExposure,2);
assert.equal(constrained.audit.maxExposure,3);
assert.equal(constrained.audit.repeatedPairs,0);
assert.equal(constrained.audit.maxOverlap,1);
assert.equal(constrained.policy.id,"ONE_BOUNDED_FEASIBILITY_BEAM_V1");
assert.throws(()=>selector.select(candidates,{count:20,constraints:{requireCoverage:true,maxExposure:1}}),/SELECTION_CONSTRAINTS_INFEASIBLE|HARD_CONSTRAINT/);
console.log("PowerAI ONE unified selector tests: PASS");
