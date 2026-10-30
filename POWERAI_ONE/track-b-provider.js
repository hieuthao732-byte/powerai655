/* PowerAI ONE — Track B candidate provider adapter. */
(function(root){
"use strict";
function register(pipeline,engine=root.PowerAIOneB,options={}){
 if(!pipeline||typeof pipeline.registerProvider!=="function")throw new TypeError("ONE pipeline required");
 if(!engine||typeof engine.generate!=="function")throw new TypeError("Track B engine required");
 const candidateCount=Number(options.candidateCount??50000);
 pipeline.registerProvider({
  id:"B1.3",version:"legacy-B1.3-extracted-1",status:"enabled",
  propose:async ctx=>{
   const result=engine.generate(ctx.draws,ctx.targetDrawId,{candidateCount,seed:ctx.seed??null});
   return result.candidates;
  },
  validateCandidate:(ticket,item)=>engine.validLegacy(ticket.main)
 });
 return pipeline;
}
const API=Object.freeze({register});
root.PowerAIOneBProvider=API;
if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:this);
