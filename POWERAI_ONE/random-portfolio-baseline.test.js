"use strict";
const assert=require("node:assert/strict");
const D=require("./domain.js");
const B=require("./random-portfolio-baseline.js");
for(const target of [1300,1410,1418,1419,1420]){
 const a=B.generate(target),b=B.generate(target);
 assert.deepEqual(a.tickets,b.tickets,"baseline must be deterministic for a target");
 assert.equal(a.tickets.length,20);
 assert.ok(a.tickets.every(t=>D.normalizeTicket(t).ok));
 assert.equal(a.audit.coverage,55);
 assert.equal(a.audit.minExposure,2);
 assert.equal(a.audit.maxExposure,3);
 assert.equal(a.audit.repeatedPairs,0);
 assert.ok(a.audit.maxOverlap<=1);
 assert.equal(a.audit.uniquePairs,300);
}
console.log("PowerAI ONE constrained random baseline tests: PASS");
