/* PowerAI ONE — post-draw evaluation service.
 * Evaluates one already-locked ONE portfolio against one verified official draw.
 * Pure: no database writes, state mutation, or automatic model promotion.
 */
(function(root){
 "use strict";
 function create(domain,governor){
  if(!domain||typeof domain.normalizeDraw!=="function"||typeof domain.normalizeTicket!=="function"||typeof domain.scoreTicket!=="function"||typeof governor?.evaluate!=="function")throw new TypeError("Canonical domain and adaptive governor are required");
  function evaluate(input={}){
   const portfolio=input.portfolio,rawDraw=input.draw,priorRecords=input.priorRecords??[];
   if(!portfolio||typeof portfolio!=="object")throw new Error("LOCKED_PORTFOLIO_REQUIRED");
   if(!Array.isArray(priorRecords))throw new Error("PRIOR_RECORDS_MUST_BE_ARRAY");
   const parsed=domain.normalizeDraw(rawDraw);
   if(!parsed.ok)throw new Error("INVALID_DRAW:"+parsed.errors.join(","));
   const draw=parsed.draw;
   if(draw.source!=="official"||draw.verified!==true)throw new Error("UNVERIFIED_OFFICIAL_DRAW_REQUIRED");
   if(Number(portfolio.targetDrawId)!==draw.id)throw new Error("PORTFOLIO_TARGET_DRAW_MISMATCH");
   const lockedAt=portfolio.lockedAt??portfolio.generatedAt;
   const lockTime=Date.parse(lockedAt??"");
   const resultTime=Date.parse(draw.date??"");
   if(!Number.isFinite(lockTime)||!Number.isFinite(resultTime)||lockTime>=resultTime)throw new Error("PORTFOLIO_NOT_LOCKED_BEFORE_RESULT");
   const rawTickets=portfolio.tickets??portfolio.portfolio?.tickets;
   if(!Array.isArray(rawTickets)||!rawTickets.length)throw new Error("LOCKED_PORTFOLIO_HAS_NO_TICKETS");
   const tickets=rawTickets.map((item,index)=>{
    const p=domain.normalizeTicket(item?.ticket??item?.main??item);
    if(!p.ok)throw new Error("INVALID_LOCKED_TICKET:"+index);
    return p.ticket;
   });
   if(priorRecords.some(r=>Number(r?.targetDrawId??r?.result?.id)>=draw.id))throw new Error("PRIOR_RECORDS_NOT_BEFORE_TARGET");
   const scored=tickets.map(ticket=>domain.scoreTicket(ticket,draw));
   if(scored.some(s=>!s.ok))throw new Error("POST_DRAW_SCORING_FAILED");
   const maxMainHits=Math.max(...scored.map(s=>s.mainHits));
   const record={
    targetDrawId:draw.id,lockedAt,resultAvailableAt:draw.date,
    portfolio:{tickets},result:{id:draw.id,date:draw.date,main:draw.main,special:draw.special,source:draw.source,verified:draw.verified},
    maxMainHits,activeAtLeast3:maxMainHits>=3,
    specialHitTickets:scored.filter(s=>s.specialHit).length,
    specialHit:scored.some(s=>s.specialHit),
    portfolioHash:portfolio.portfolioHash??portfolio.selectionHash??null,
    modelHash:portfolio.modelHash??null
   };
   const governorReport=governor.evaluate([...priorRecords,record],{threshold:input.threshold??10});
   return Object.freeze({
    reportType:"POWERAI_ONE_AFTER_DRAW_EVALUATION",
    researchOnly:false,officialVerified:true,
    targetDrawId:draw.id,portfolioHash:record.portfolioHash,
    ticketCount:tickets.length,maxMainHits,
    mainHitDistribution:[0,1,2,3,4,5,6].map(h=>({hits:h,tickets:scored.filter(s=>s.mainHits===h).length})),
    tickets:scored.map((s,index)=>({ticketIndex:index,mainHits:s.mainHits,specialHit:s.specialHit})),
    specialHitTickets:record.specialHitTickets,record,governor:governorReport,
    statePersisted:false,activeModelMutated:false,automaticPromotion:false,
    policy:"EVALUATION_ONLY_GOVERNOR_SHADOW_TRIGGER"
   });
  }
  return Object.freeze({evaluate});
 }
 const API=Object.freeze({create});
 root.PowerAIOneAfterDrawEvaluation=API;
 if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:this);
