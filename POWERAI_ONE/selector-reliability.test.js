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

const cases=[
  {seed:11,size:160,maxOverlap:4},
  {seed:29,size:240,maxOverlap:5},
  {seed:47,size:400,maxOverlap:5},
  {seed:83,size:640,maxOverlap:5},
  {seed:101,size:800,maxOverlap:5},
  {seed:137,size:1000,maxOverlap:5},
  {seed:173,size:1200,maxOverlap:5},
  {seed:211,size:1200,maxOverlap:5},
  {seed:257,size:1200,maxOverlap:5},
  {seed:307,size:1200,maxOverlap:5}
];
const report=[];
for(let i=0;i<cases.length;i++){
  const c=cases[i],pool=makePool(c.seed,c.size);
  const options={count:20,maxOverlap:c.maxOverlap,candidateLimit:160,beamWidth:32,searchNodeBudget:150000};
  const start=process.hrtime.bigint();
  const out=selector.select(pool,options);
  const runtimeMs=Number(process.hrtime.bigint()-start)/1e6;
  assert.equal(out.tickets.length,20,"wrong ticket count at seed "+c.seed);
  assert.equal(out.audit.ticketCount,20);
  assert.ok(out.audit.maxOverlap<=c.maxOverlap,"overlap violation at seed "+c.seed);
  assert.ok(out.policy.search.expanded<=150000);
  assert.equal(new Set(out.tickets.map(t=>t.main.join("-"))).size,20);
  if(i===0||i===9){
    const repeat=selector.select(pool,options);
    assert.equal(repeat.hash,out.hash,"determinism mismatch at seed "+c.seed);
  }
  report.push({seed:c.seed,pool:c.size,maxOverlap:c.maxOverlap,runtimeMs:Number(runtimeMs.toFixed(1)),expanded:out.policy.search.expanded,coverage:out.audit.coverage,maxPairOverlap:out.audit.maxOverlap});
}
console.log("PowerAI ONE selector reliability suite: PASS");
console.log(JSON.stringify({cases:report.length,determinismChecks:2,results:report},null,2));
