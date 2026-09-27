import assert from 'node:assert/strict';
await import('../adaptive-d.js');
const D=globalThis.PowerAIAdaptiveD;
assert.ok(D,'PowerAIAdaptiveD missing');
assert.equal(D.VERSION,'D-0.1.0');

function seeded(seed){let x=seed>>>0;return()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296}}
function synthDraws(count=320,seed=12345){
  const rnd=seeded(seed),out=[];
  for(let id=1;id<=count;id++){
    const s=new Set();while(s.size<6)s.add(1+Math.floor(rnd()*55));
    out.push({id,result:[...s].sort((a,b)=>a-b)});
  }
  return out;
}

const draws=synthDraws();
const target=301;
const model=D.buildModel(draws,target);
assert.equal(model.targetId,target);
assert.equal(model.cutoffId,300);
assert.equal(model.historyCount,300);
assert.ok(model.modelHash.length===8);
assert.deepEqual(Object.keys(model.weights).sort(),['D1','D2','D3','D4']);
assert.ok(Math.abs(Object.values(model.weights).reduce((a,b)=>a+b,0)-1)<1e-9);
for(let n=1;n<=55;n++){
  assert.ok(Number.isFinite(model.nodeScores[n]));
  assert.ok(model.stability[n]>=0&&model.stability[n]<=1);
}

// Anti-leak: data with id >= target must not change the model.
const leaked=[...draws,{id:999,result:[1,2,3,4,5,6]}];
const model2=D.buildModel(leaked,target);
assert.equal(model2.modelHash,model.modelHash,'future draw changed model hash');

const P=D.buildPortfolio(model,{count:20,candidates:1800});
assert.equal(P.tickets.length,20,'portfolio must contain 20 tickets');
assert.ok(P.hash.length===8);
for(const t of P.tickets){
  assert.equal(t.length,6);assert.equal(new Set(t).size,6);
  assert.ok(t.every(n=>Number.isInteger(n)&&n>=1&&n<=55));
}
assert.ok(P.audit.coverage>=35,'coverage unexpectedly narrow');
assert.ok(P.audit.maxExposure<=6,'exposure guard failed');
assert.ok(P.audit.entropy>.75,'entropy too low');

// Reproducibility: same model + seed => same portfolio.
const P2=D.buildPortfolio(model,{count:20,candidates:1800});
assert.equal(P2.hash,P.hash,'portfolio is not deterministic');

const actual=draws.find(x=>x.id===301).result;
const scored=D.scorePortfolio(P.tickets,actual);
assert.ok(scored.best>=0&&scored.best<=6);
assert.equal(scored.hits.length,20);
const nullBench=D.matchedNullBenchmark(P.tickets,actual,{trials:80,seed:42});
assert.ok(nullBench.pBest>0&&nullBench.pBest<=1);
assert.ok(nullBench.pTotal>0&&nullBench.pTotal<=1);

const updated=D.updateWeights({D1:.25,D2:.25,D3:.25,D4:.25},{D1:1.5,D2:-.5,D3:.2,D4:0});
assert.ok(updated.D1>updated.D2);
assert.ok(Math.abs(Object.values(updated).reduce((a,b)=>a+b,0)-1)<1e-9);

const lowLogs=[];
for(let i=1;i<=24;i++)lowLogs.push({source:'feed',targetId:1000+i,D:{best:2,total:18,null:{bestMean:2.3}}});
const drift=D.evaluateDrift(lowLogs,{window:12,cooldown:8,lastChangeTarget:1000});
assert.equal(drift.trigger,true,'sustained weak performance should open challenger');

const shadow=[];
for(let i=0;i<8;i++)shadow.push({champion:{best:2,total:20},challenger:{best:i%3===0?4:3,total:32}});
const promo=D.promotionDecision(shadow,{minRows:6,margin:.01});
assert.equal(promo.promote,true,'clearly stronger challenger should promote');

const gate=D.confidenceGate(model);
assert.ok(['NORMAL','LOW_CONFIDENCE'].includes(gate.confidence));

const s0=D.newResearchState();
const s1=D.registerHypothesis(s0,{id:'H-TEST',problem:'weak residual edge',change:'swap horizon weights',successMetric:'prospective composite',minOfficial:6});
assert.equal(s1.hypotheses.at(-1).id,'H-TEST');
const s2=D.retireEngine(s1,{engineId:'D-OLD',reason:'failed shadow'});
assert.equal(s2.memory.at(-1).status,'RETIRED');

console.log('Adaptive Track D core tests passed:', {model:model.modelHash,portfolio:P.hash,audit:P.audit,drift:drift.state,promotion:promo.state,confidence:gate.confidence});
