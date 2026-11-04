/* PowerAI ONE — single runtime composition.
 * Providers feed one pipeline; post-draw and challenger services are exposed
 * through the same runtime facade. No persistence or auto-promotion.
 */
(function(root){
 "use strict";
 function create(deps={}){
  const D=deps.domain||root.PowerAIDomain;
  const S=deps.selectorModule||root.PowerAIOneUnifiedSelector||root.PowerAIUnifiedSelector;
  const P=deps.pipelineModule||root.PowerAIOnePipeline;
  const G=deps.governor||root.PowerAIOneAdaptiveGovernor;
  const A=deps.afterDrawModule||root.PowerAIOneAfterDrawEvaluation;
  const R=deps.shadowRunnerModule||root.PowerAIOneAdaptiveShadowRunner;
  const C=deps.challengerGate||root.PowerAIOneChallengerGate;
  if(!D||!S||!P||!G||!A||!R||!C)throw new TypeError("ONE runtime dependencies are incomplete");
  const selector=typeof S.create==="function"?S.create(D):S;
  const pipeline=P.create(D,selector);
  const afterDraw=A.create(D,G);
  const shadow=R.create(D,G,C);
  return Object.freeze({
   registerProvider:provider=>pipeline.registerProvider(provider),
   listProviders:()=>pipeline.listProviders(),
   buildPortfolio:request=>pipeline.build(request),
   evaluateAfterDraw:input=>afterDraw.evaluate(input),
   runShadowReplay:(draws,options)=>shadow.run(draws,options),
   evaluateChallengerEvidence:(records,options)=>C.evaluate(records,options),
   policy:Object.freeze({singleFinalSelector:true,automaticPromotion:false,productionMutation:false})
  });
 }
 const API=Object.freeze({create});
 root.PowerAIOneRuntime=API;
 if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:this);
