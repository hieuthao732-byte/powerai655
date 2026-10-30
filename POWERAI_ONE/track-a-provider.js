/* PowerAI ONE — Track A candidate provider adapter. */
(function(root){
"use strict";
function register(pipeline,engine= root.PowerAIOneA){
 if(!pipeline||typeof pipeline.registerProvider!=="function")throw new TypeError("ONE pipeline required");
 if(!engine||typeof engine.generate!=="function")throw new TypeError("Track A engine required");
 pipeline.registerProvider({
  id:"A7",version:"legacy-A7-extracted-1",status:"enabled",
  propose:async ctx=>{
   const result=engine.generate(ctx.targetDrawId);
   return result.tickets.map((ticket,index)=>{
    const stat=result.analysis?.display?.ticket?.[index]||{};
    return {
     ticket:ticket.main,
     score:Number(stat.topCredit)||0,
     components:{topCredit:Number(stat.topCredit)||0,uniqueBest:Number(stat.uniqueBest)||0,ge3:Number(stat.ge3)||0,marginal:Number(stat.marginal)||0},
     tags:["A7_GEOMETRY"],
     metadata:{seed:result.seed,audit:result.audit}
    };
   });
  },
  validateCandidate:ticket=>ticket.main.length===6
 });
 return pipeline;
}
const API=Object.freeze({register});
root.PowerAIOneAProvider=API;
if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:this);
