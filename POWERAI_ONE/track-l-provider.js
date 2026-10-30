/* PowerAI ONE — Track L shadow provider. */
(function(root){
"use strict";
function register(pipeline,engine=root.PowerAIOneL,B=root.PowerAIOneB,options={}){
 if(!pipeline||typeof pipeline.registerProvider!=="function")throw new TypeError("ONE pipeline required");
 if(!engine?.generate||!B?.buildLegacyModel)throw new TypeError("Track L and B engines required");
 const candidateCount=Number(options.candidateCount??50000);
 pipeline.registerProvider({id:"L_LEARNING",version:"legacy-L-RC6-extracted-shadow-1",status:"shadow",
  propose:async ctx=>engine.generate(ctx.draws,ctx.targetDrawId,ctx.learningReport||null,B,{candidateCount,seed:ctx.seed??null}).candidates,
  validateCandidate:ticket=>ticket.main.length===6});
 return pipeline;
}
const API=Object.freeze({register});root.PowerAIOneLProvider=API;if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:this);
