/* PowerAI ONE — B1.3 adapter to the existing legacy historical scorer.
 * Generates candidate signals only; ONE remains the only final selector.
 */
(function(root){
 "use strict";
 function generate(history,targetDrawId,options={}){
  if(typeof buildLegacyModel!=="function"||typeof randomValidPool!=="function"||typeof legacyComponents!=="function"||typeof validLegacy!=="function")throw new Error("B1_3_SOURCE_ENGINE_MISSING");
  const rows=(history||[]).filter(d=>Number(d.id)<Number(targetDrawId)).map(d=>({id:Number(d.id),result:(d.main||d.result||[]).slice(0,6)}));
  if(!rows.length)throw new Error("B1_3_NO_HISTORY_BEFORE_TARGET");
  const model=buildLegacyModel(rows);
  const count=Math.max(1000,Math.min(12000,Number(options.candidateCount)||6000));
  const seed=Number(options.seed??((Number(targetDrawId)*104729+130013)>>>0));
  const pool=randomValidPool(count,seed);
  const candidates=pool.map(({a})=>({ticket:a,score:legacyComponents(a,model).score,components:legacyComponents(a,model)}));
  return {candidates,cutoffDrawId:Number(rows[rows.length-1].id),candidateCount:candidates.length};
 }
 root.PowerAIOneB=Object.freeze({id:"B1.3",version:"RC7-LEGACY-SCORER-ADAPTER-1",generate,validLegacy:a=>validLegacy(a)});
})(window);
