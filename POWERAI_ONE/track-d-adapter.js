/* PowerAI ONE — Track D Adaptive Research candidate adapter. */
(function(root){
"use strict";
function generate(draws,targetDrawId,D,options={}){
 if(!D||typeof D.buildModel!=="function"||typeof D.generateCandidates!=="function")throw new TypeError("PowerAIAdaptiveD core with candidate API required");
 const target=Number(targetDrawId);if(!Number.isInteger(target)||target<1)throw new Error("INVALID_TARGET_DRAW_ID");
 const history=(draws||[]).filter(d=>Number(d.id)<target).map(d=>({id:d.id,result:d.main}));
 const state=options.state||{};
 const model=D.buildModel(history,target,state);
 const seed=options.seed==null?((target*2654435761)>>>0):Number(options.seed)>>>0;
 const candidates=D.generateCandidates(model,{candidates:Number(options.candidateCount??3200),seed});
 return{engineId:"D",engineVersion:D.VERSION,targetDrawId:target,cutoffDrawId:model.cutoffId,modelHash:model.modelHash,seed,weights:model.weights,horizons:model.horizons,confidence:D.confidenceGate(model),candidates};
}
const API=Object.freeze({generate});root.PowerAIOneD=API;if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:this);
