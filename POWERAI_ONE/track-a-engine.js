/* PowerAI ONE — A7 adapter to the existing RC7 geometry optimizer.
 * Exposes a stable engine contract; it does not create a second final selector.
 */
(function(root){
 "use strict";
 function generate(targetDrawId){
  if(typeof buildIncidence!=="function")throw new Error("A7_SOURCE_ENGINE_MISSING");
  const result=buildIncidence(Number(targetDrawId));
  const tickets=(result.tickets||[]).map(main=>({main:Array.isArray(main)?main.slice():main.main}));
  if(tickets.length!==20||tickets.some(t=>!Array.isArray(t.main)||t.main.length!==6))throw new Error("A7_RETURNED_INVALID_PORTFOLIO");
  return {tickets,seed:result.seed,audit:result.audit,analysis:result.analysis};
 }
 root.PowerAIOneA=Object.freeze({id:"A7",version:"RC7-GEOMETRY-ADAPTER-1",generate});
})(window);
