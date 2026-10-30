/* PowerAI ONE — Track C shadow candidate provider. */
(function(root){
"use strict";
function register(pipeline,engine=root.PowerAIOneC,dependencies={}){
 if(!pipeline||typeof pipeline.registerProvider!=="function")throw new TypeError("ONE pipeline required");
 if(!engine||typeof engine.generate!=="function")throw new TypeError("Track C engine required");
 const A=dependencies.A||root.PowerAIOneA,B=dependencies.B||root.PowerAIOneB,legacy=dependencies.legacy||B;
 if(!A?.generate||!B?.generate||!legacy?.buildLegacyModel)throw new TypeError("Track A and B dependencies required");
 const candidateCount=Number(dependencies.candidateCount??50000);
 pipeline.registerProvider({
  id:"C_RC6",version:"legacy-C-RC6-extracted-shadow-1",status:"shadow",
  propose:async ctx=>{
   const a=A.generate(ctx.targetDrawId);
   const b=B.generate(ctx.draws,ctx.targetDrawId,{candidateCount,seed:ctx.seed??null});
   const support=b.candidates.slice().sort((x,y)=>y.score-x.score).slice(0,20);
   const result=engine.generate(ctx.draws,a,support,legacy,ctx.targetDrawId);
   return result.candidates.map(x=>({ticket:x.main,score:x.score,components:x.components,tags:x.tags,metadata:{...x.metadata,audit:result.audit,seed:result.seed,objective:result.objective}}));
  },
  validateCandidate:ticket=>ticket.main.length===6
 });
 return pipeline;
}
const API=Object.freeze({register});root.PowerAIOneCProvider=API;if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:this);
