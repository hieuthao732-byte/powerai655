import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

globalThis.window=globalThis;
globalThis.addEventListener=()=>{};
globalThis.document={getElementById:()=>null,createElement:()=>({}),querySelector:()=>null};
const store=new Map();
globalThis.localStorage={
  getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)),
  removeItem:k=>store.delete(k),
  key:i=>[...store.keys()][i]??null,
  get length(){return store.size}
};

vm.runInThisContext(fs.readFileSync('adaptive-d.js','utf8'),{filename:'adaptive-d.js'});
vm.runInThisContext(fs.readFileSync('adaptive-d-cycle.js','utf8'),{filename:'adaptive-d-cycle.js'});

const D=globalThis.PowerAIAdaptiveD,C=globalThis.PowerAIAdaptiveCycle;
assert.ok(D&&C,'cycle/core globals missing');

const preserved=D.newResearchState({engineId:'D-X',horizons:[24,48],lastWeightUpdateTarget:123,lineage:[{from:'A',to:'B'}],quarantine:{D1:{untilTarget:130}}});
assert.deepEqual(preserved.horizons,[24,48]);
assert.equal(preserved.lastWeightUpdateTarget,123);
assert.equal(preserved.lineage.length,1);
assert.equal(preserved.quarantine.D1.untilTarget,130);

const candidates=C._test.candidateTemplates('STAGNANT',1500);
assert.equal(candidates.length,2);
assert.notEqual(candidates[0].fingerprint,candidates[1].fingerprint);
assert.ok(candidates.every(x=>x.minOfficial===6&&x.status==='SHADOW'));

const strong=Array.from({length:6},(_,i)=>({
  targetId:1600+i,
  champion:{best:2,total:28,g3:0,g4:0},
  challenger:{best:4,total:48,g3:4,g4:1},
  challengerNull:{bestMean:2.4,totalMean:32},
  auditOk:true,
  confidence:{confidence:'NORMAL'}
}));
const good=C._test.robustDecision(strong);
assert.equal(good.promote,true);
assert.equal(good.robust,true);
assert.ok(good.looPositive>=4);

const weak=Array.from({length:6},(_,i)=>({
  targetId:1700+i,
  champion:{best:3,total:40,g3:2,g4:0},
  challenger:{best:2,total:26,g3:0,g4:0},
  challengerNull:{bestMean:2.3,totalMean:31},
  auditOk:true,
  confidence:{confidence:'NORMAL'}
}));
const bad=C._test.robustDecision(weak);
assert.equal(bad.robust,false);

const warmLogs=Array.from({length:5},(_,i)=>({source:'feed',targetId:1800+i,D:{best:2+(i%2),null:{bestMean:2.2}}}));
const warm=C._test.rollingScorecard(warmLogs,{challengers:[]},[]);
assert.equal(warm.sample,5);
assert.equal(warm.status,'WARMUP');

const noEdgeLogs=Array.from({length:12},(_,i)=>({source:'feed',targetId:1900+i,D:{best:2,null:{bestMean:2.1}}}));
const noEdge=C._test.rollingScorecard(noEdgeLogs,{challengers:[]},[]);
assert.equal(noEdge.status,'NO EDGE DETECTED');
assert.equal(noEdge.best4,0);

const shadowState={challengers:[{id:'CH-X',engineId:'D-AR2-X',status:'SHADOW',minOfficial:6}]};
const shadowRows=Array.from({length:3},(_,i)=>({source:'feed',targetId:2000+i,challengerId:'CH-X'}));
const shadowCard=C._test.rollingScorecard(noEdgeLogs,shadowState,shadowRows);
assert.equal(shadowCard.status,'CHALLENGER TEST');
assert.equal(shadowCard.progress[0].done,3);

const P=[[1,2,3,4,5,6],[7,8,9,10,11,12]],Q=[[1,2,3,20,21,22],[30,31,32,33,34,35]];
assert.ok(C._test.portfolioSimilarity(P,Q)>0);

console.log('Adaptive Track D cycle unit tests passed.');
