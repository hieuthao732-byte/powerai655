"use strict";
const assert=require("node:assert/strict");
const D=require("./domain.js");
const {create}=require("./unified-selector.js");
const selector=create(D);

// Small-pool exact oracle: enumerate every combination and apply the same
// published hard constraints through the independent domain audit function.
function exactFeasible(tickets,count,opts){
  const c=opts.constraints||{};
  let visited=0,solution=null;
  function walk(start,chosen){
    if(solution)return;
    if(chosen.length===count){
      visited++;
      const audit=D.auditPortfolio(chosen);
      const maxExposure=c.maxExposure==null?Infinity:c.maxExposure;
      const ok=(!c.requireCoverage||audit.coverage===55) &&
        audit.minExposure>=(c.minExposure||0) &&
        audit.maxExposure<=maxExposure &&
        audit.repeatedPairs<=(c.maxRepeatedPairs==null?Infinity:c.maxRepeatedPairs) &&
        audit.maxOverlap<=opts.maxOverlap;
      if(ok)solution={audit,tickets:chosen};
      return;
    }
    for(let i=start;i<=tickets.length-(count-chosen.length);i++){
      walk(i+1,chosen.concat(tickets[i]));
      if(solution)return;
    }
  }
  walk(0,[]);
  return {feasible:!!solution,visited,solution};
}

function makePool(seed,size){
  let state=seed>>>0;
  const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
  const seen=new Set(),out=[];
  while(out.length<size){
    const set=new Set();
    while(set.size<6)set.add((rand()%55)+1);
    const main=[...set].sort((a,b)=>a-b),key=main.join("-");
    if(seen.has(key))continue;
    seen.add(key);
    out.push({ticket:main,source:["A","B","C","L","D"][out.length%5],score:rand()%10000});
  }
  return out;
}

const cases=[
  {seed:17,size:12,count:3,maxOverlap:2,constraints:{maxExposure:2,minExposure:1,maxRepeatedPairs:4}},
  {seed:29,size:14,count:3,maxOverlap:3,constraints:{maxExposure:3,minExposure:1,maxRepeatedPairs:8}},
  {seed:41,size:15,count:4,maxOverlap:4,constraints:{maxExposure:4,minExposure:1,maxRepeatedPairs:12}},
  {seed:73,size:16,count:3,maxOverlap:1,constraints:{maxExposure:2,minExposure:1,maxRepeatedPairs:2}},
  {seed:101,size:14,count:3,maxOverlap:2,constraints:{maxExposure:2,minExposure:0,maxRepeatedPairs:0}}
];

let falseNegatives=0,checked=0,totalOracleCombinations=0;
const timings=[];
for(const testCase of cases){
  const pool=makePool(testCase.seed,testCase.size);
  const exact=exactFeasible(pool.map(x=>x.ticket),testCase.count,testCase);
  totalOracleCombinations+=exact.visited;
  const start=process.hrtime.bigint();
  let actual=null,error=null;
  try{
    actual=selector.select(pool,{
      count:testCase.count,maxOverlap:testCase.maxOverlap,
      candidateLimit:testCase.size,beamWidth:256,searchNodeBudget:2000000,
      constraints:testCase.constraints
    });
  }catch(e){error=e.message;}
  timings.push(Number(process.hrtime.bigint()-start)/1e6);
  checked++;
  const found=!!actual;
  if(exact.feasible!==found){
    falseNegatives++;
    console.error("ORACLE_MISMATCH",{
      seed:testCase.seed,expected:exact.feasible,actual:found,error
    });
  }
  if(found){
    const audit=actual.audit,c=testCase.constraints;
    assert.ok(!c.requireCoverage||audit.coverage===55);
    assert.ok(audit.minExposure>=(c.minExposure||0));
    assert.ok(audit.maxExposure<=(c.maxExposure??Infinity));
    assert.ok(audit.repeatedPairs<=(c.maxRepeatedPairs??Infinity));
    assert.ok(audit.maxOverlap<=testCase.maxOverlap);
  }
}
assert.equal(falseNegatives,0,"bounded selector must match exact feasibility on small unpruned pools");

// Measure deliberate beam-width pressure separately. This is a diagnostic,
// not a correctness gate: bounded search is allowed to report budget/infeasible.
const stressPool=makePool(20261104,72);
const stressStart=process.hrtime.bigint();
let stressResult=null,stressError=null;
try{
  stressResult=selector.select(stressPool,{
    count:8,maxOverlap:3,candidateLimit:72,beamWidth:24,searchNodeBudget:250000,
    constraints:{maxExposure:3,minExposure:1,maxRepeatedPairs:40}
  });
}catch(e){stressError=e.message;}
const stressMs=Number(process.hrtime.bigint()-stressStart)/1e6;
if(stressResult){
  assert.equal(stressResult.tickets.length,8);
  assert.ok(stressResult.audit.maxOverlap<=3);
  assert.ok(stressResult.audit.maxExposure<=3);
}
console.log("PowerAI ONE exact-oracle tests: PASS");
console.log(JSON.stringify({
  oracleCases:checked,oracleCombinations:totalOracleCombinations,
  feasibilityMismatches:falseNegatives,
  smallPoolRuntimeMs:timings.map(x=>Number(x.toFixed(2))),
  stress:{pool:72,count:8,beamWidth:24,nodeBudget:250000,
    runtimeMs:Number(stressMs.toFixed(2)),result:stressResult?"feasible":stressError,
    expanded:stressResult?.policy.search.expanded??null}
},null,2));
