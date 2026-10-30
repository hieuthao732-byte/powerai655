/* PowerAI ONE — Track D shadow candidate provider. */
(function(root){
"use strict";
function register(pipeline,engine=root.PowerAIOneD,D=root.PowerAIAdaptiveD,options={}){
 if(!pipeline||typeof pipeline.registerProvider!=="function")throw new TypeError("ONE pipeline required");
 if(!engine?.generate||!D?.buildModel)throw new TypeError("Track D adapter/core required");
 const candidateCount=Number(options.candidateCount??3200),state=options.state||{};
 pipeline.registerProvider({id:"D_ADAPTIVE",version:D.VERSION+"-ONE-shadow",status:"shadow",
  propose:async ctx=>engine.generate(ctx.draws,ctx.targetDrawId,D,{candidateCount,seed:ctx.seed,state}).candidates,
  validateCandidate:ticket=>ticket.main.length===6});
 return pipeline;
}
const API=Object.freeze({register});root.PowerAIOneDProvider=API;if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:this);
