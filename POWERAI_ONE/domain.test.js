"use strict";
const assert = require("node:assert/strict");
const D = require("./domain.js");

const feedRow = {id:10,result:[1,8,17,29,42,55,33]};
const draw = D.normalizeDraw(feedRow);
assert.equal(draw.ok,true);
assert.deepEqual(draw.draw.main,[1,8,17,29,42,55]);
assert.equal(draw.draw.special,33);

assert.equal(D.normalizeDraw({id:11,result:[1,2,3,4,5,5,6]}).ok,false);
assert.equal(D.normalizeDraw({id:11,result:[1,2,3,4,5,6,6]}).ok,false);
assert.equal(D.normalizeDraw({id:11,result:[1,2,3,4,5,6]}).ok,true);

const history = D.normalizeHistory([
  {id:9,result:[1,2,3,4,5,6,7]},
  {id:10,result:[2,3,4,5,6,7,8]},
  {id:8,result:[1,2,3,4,5,6,7]},
  {id:8,result:[2,3,4,5,6,7,8]},
  {id:12,result:[1,2,3,4,5,6,7]}
],10);
assert.deepEqual(history.draws.map(x=>x.id),[8,9]);
assert.equal(history.cutoffDrawId,9);
assert.ok(history.errors.some(x=>x.codes.includes("DRAW_NOT_BEFORE_TARGET")));
assert.ok(history.errors.some(x=>x.codes.includes("DUPLICATE_DRAW_ID")));

assert.equal(D.normalizeTicket([1,2,3,4,5,6]).ok,true);
assert.equal(D.normalizeTicket([1,2,3,4,5,5]).ok,false);
const p=D.normalizePortfolio({
  engineId:"A",version:"legacy",targetId:20,cutoffId:19,
  tickets:[[1,2,3,4,5,6],[1,7,8,9,10,11]]
},{expectedTicketCount:2});
assert.equal(p.ok,true);
assert.equal(p.portfolio.audit.ticketCount,2);
assert.equal(p.portfolio.audit.coverage,11);
assert.equal(D.normalizePortfolio({...{targetId:10,cutoffId:10,tickets:[[1,2,3,4,5,6]]}}).ok,false);

const score=D.scoreTicket([1,2,3,4,5,6],{id:30,result:[1,2,3,4,5,7,6]});
assert.equal(score.ok,true);
assert.equal(score.mainHits,5);
assert.equal(score.specialHit,true);
console.log("PowerAI ONE domain tests: PASS");
