"use strict";
const assert=require("node:assert/strict");
const D=require("./domain.js");
const {create}=require("./historical-reverse-analysis.js");
const analysis=create(D);
const draws=[
  {id:1,date:"2025-01-01",main:[1,2,3,4,5,6],special:7},
  {id:2,date:"2025-01-03",main:[2,3,4,5,6,7],special:8},
  {id:3,date:"2025-01-05",main:[1,3,5,7,9,11],special:2},
  {id:4,date:"2025-01-07",main:[1,3,5,7,9,11],special:13}
];
const report=analysis.analyze([...draws,{id:4,main:[1,2,3,4,5,6],special:12}]);
assert.equal(report.reportType,"POWERAI_ONE_HISTORICAL_REVERSE_ANALYSIS");
assert.equal(report.descriptiveOnly,true);
assert.equal(report.learningUpdated,false);
assert.equal(report.data.draws,4);
assert.equal(report.data.rejectedRows,1);
assert.equal(report.mainFrequency.mean,24/55);
assert.equal(report.mainFrequency.min,0);
assert.equal(report.mainFrequency.max,4);
assert.equal(report.numbers.length,55);
assert.equal(report.numbers[0].mainCount,3);
assert.equal(report.numbers[0].specialCount,0);
assert.equal(report.numbers[1].specialCount,1);
assert.equal(report.specialFrequency.mean,4/55);
assert.equal(report.structure.meanSum,(21+27+36+36)/4);
assert.equal(report.structure.meanOdd,(1+1+6+6)/4);
assert.equal(report.structure.pairCount>0,true);
assert.equal(report.structure.meanRepeatFromPreviousDraw,2.5);
assert.equal(report.structure.topPairs[0].count>=2,true);
assert.equal(report.structure.lowHighHistogram.reduce((s,x)=>s+x.draws,0),4);
assert.equal(report.structure.parityHistogram.reduce((s,x)=>s+x.draws,0),4);
assert.throws(()=>analysis.analyze([]),/NO_VALID_DRAWS_FOR_REVERSE_ANALYSIS/);
console.log("PowerAI ONE historical reverse-analysis tests: PASS");
console.log(JSON.stringify({
  draws:report.data.draws,mainFrequency:report.mainFrequency,
  specialFrequency:report.specialFrequency,structure:report.structure
},null,2));
