import assert from 'node:assert/strict';

await import('../adaptive-d.js');
await import('../adaptive-d-validation.js');

const D=globalThis.PowerAIAdaptiveD;
const V=globalThis.PowerAIAdaptiveValidation;
const C=globalThis.PowerAIAdaptiveConfidence;
assert.ok(D&&V,'Track D validation API missing');
assert.ok(C,'Track D v1.3 confidence API missing');

function rng(seed){let x=seed>>>0;return()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296}}
function syntheticDraws(n=96){
  const r=rng(64555),out=[];
  for(let id=1;id<=n;id++){
    const s=new Set();while(s.size<6)s.add(1+Math.floor(r()*55));
    out.push({id:String(id).padStart(5,'0'),result:[...s].sort((a,b)=>a-b)});
  }
  return out;
}

const draws=syntheticDraws();
const state={engineId:'D-AR1',weights:{D1:.25,D2:.25,D3:.25,D4:.25},horizons:[30,60,90]};
const config=V.championConfig(state);

const a=V.evaluateOne(draws,80,config,{candidates:220,nullTrials:16});
const b=V.evaluateOne(draws,80,config,{candidates:220,nullTrials:16});
assert.equal(a.cutoffId,79,'walk-forward cutoff must be strictly before target');
assert.equal(a.portfolioHash,b.portfolioHash,'validation must be deterministic');
assert.equal(a.best,b.best,'deterministic score changed');
assert.equal(a.nullBest,b.nullBest,'deterministic null benchmark changed');

const futureChanged=structuredClone(draws);
futureChanged.find(x=>Number(x.id)===90).result=[1,2,3,4,5,6];
const c=V.evaluateOne(futureChanged,80,config,{candidates:220,nullTrials:16});
assert.equal(c.modelHash,a.modelHash,'future draw leaked into model');
assert.equal(c.portfolioHash,a.portfolioHash,'future draw leaked into portfolio');
assert.equal(c.best,a.best,'future draw changed historical target score');

const ev=V.pairedEvidence([.2,.1,-.1,.3,.2,.1]);
assert.ok(ev.probPositive>=0&&ev.probPositive<=1,'paired evidence out of range');
assert.ok(ev.probPositive>.5,'positive paired deltas should yield positive evidence');
assert.equal(V.changePoint([0,0,0]).state,'WARMUP');
const cp=V.changePoint([0,0,0,0,0,0,.5,.5,.5,.5,.5,.5]);
assert.equal(cp.shift,true,'change-point detector should flag a large half-window shift');

const lab=await V.runLab(draws,state,{lookback:4,candidates:180,nullTrials:12});
assert.equal(lab.note,'RETROSPECTIVE_ONLY');
assert.equal(lab.results.length,3,'lab should compare champion + two controlled challengers');
assert.equal(lab.results[0].rows.length,4,'lookback size mismatch');
assert.equal(lab.comparisons.length,2,'challenger comparison count mismatch');
for(const r of lab.results){
  for(const row of r.rows)assert.ok(row.cutoffId<row.targetId,'validation leakage: cutoff >= target');
  assert.equal(r.summary.n,4);
}

function confidenceLogs(deltas,{source='feed'}={}){
  return deltas.map((delta,i)=>({source,targetId:i+1,D:{best:3,null:{bestMean:3-Number(delta)}}}));
}
const positive=C.confidenceSummary(confidenceLogs(Array.from({length:24},(_,i)=>.28+(i%3)*.02)));
assert.equal(positive.compared,24,'confidence engine should use the 24 most recent matched official rows');
assert.equal(positive.agreement,'ĐỒNG THUẬN','positive 6/12/24 windows should agree');
assert.equal(positive.level,'TÍN HIỆU DƯƠNG ỔN ĐỊNH HƠN','stable positive evidence state mismatch');
assert.ok(positive.ciLow>0,'stable positive confidence interval should stay above zero');

const mixed=C.confidenceSummary(confidenceLogs([...Array(12).fill(.3),...Array(12).fill(-.3)]));
assert.equal(mixed.level,'KẾT QUẢ CHƯA ỔN ĐỊNH','opposing recent/long windows should be marked unstable');
const ignored=C.confidenceSummary([...confidenceLogs(Array(8).fill(.2)),...confidenceLogs(Array(8).fill(.9),{source:'manual'})]);
assert.equal(ignored.compared,8,'manual rows must not enter confidence evidence');

const registry=C.deriveExperiments({
  engineId:'D-AR2-R',lastChangeTarget:120,
  hypotheses:[{id:'CH-100-1',engineId:'D-AR2-R',fingerprint:'AAAA',status:'PROMOTED',change:'test change'}],
  memory:[{engineId:'D-AR2-B',fingerprint:'BBBB',status:'REJECTED',targetId:118,delta:-.1}],
  lineage:[{from:'D-AR1',to:'D-AR2-R',fingerprint:'AAAA',status:'PROMOTED',targetId:120,mutation:'RESIDUAL_GRAPH'}],
  challengers:[]
});
assert.ok(registry.some(x=>x.status==='ACTIVE'&&x.engineId==='D-AR2-R'),'registry must include current active engine');
assert.ok(registry.some(x=>x.status==='PROMOTED'&&x.engineId==='D-AR2-R'),'registry must include promoted lineage');
assert.ok(registry.some(x=>x.status==='REJECTED'&&x.engineId==='D-AR2-B'),'registry must include rejected experiments');

console.log('Track D validation unit tests passed.');
