"use strict";
const assert=require("node:assert/strict");
const D=require("./domain.js");
const {create}=require("./unified-selector.js");
const selector=create(D);

function makePool(seed,size){
  let state=seed>>>0;
  const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
  const seen=new Set(),out=[];
  while(out.length<size){
    const values=new Set();
    while(values.size<6)values.add((rand()%55)+1);
    const main=[...values].sort((a,b)=>a-b),key=main.join("-");
    if(seen.has(key))continue;
    seen.add(key);
    out.push({ticket:main,source:["A","B","C","L","D"][out.length%5],score:rand()%100000});
  }
  return out;
}

const sizes=[160,400,800,1200];
const results=[];
for(let i=0;i<sizes.length;i++){
  const size=sizes[i],pool=makePool(20261104+i,size);
  const started=process.hrtime.bigint();
  let result=null,error=null;
  try{
    result=selector.select(pool,{
      count:20,maxOverlap:5,candidateLimit:160,beamWidth:32,
      searchNodeBudget:150000
    });
  }catch(e){error=e.message;}
  const runtimeMs=Number(process.hrtime.bigint()-started)/1e6;
  if(result){
    assert.equal(result.tickets.length,20);
    assert.equal(result.audit.ticketCount,20);
    assert.ok(result.audit.maxOverlap<=5);
    assert.ok(result.policy.search.expanded<=150001);
  }else{
    assert.ok(error==="SELECTION_SEARCH_BUDGET_EXHAUSTED" ||
      error==="SELECTION_CONSTRAINTS_INFEASIBLE",
      "unexpected benchmark failure: "+error);
  }
  results.push({
    pool:size,runtimeMs:Number(runtimeMs.toFixed(2)),
    outcome:result?"selected":error,
    expanded:result?.policy.search.expanded??null,
    candidateLimit:160,beamWidth:32,nodeBudget:150000
  });
}
console.log("PowerAI ONE selector scaling benchmark: PASS");
console.log(JSON.stringify({node:process.version,results},null,2));
