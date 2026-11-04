/* PowerAI ONE — prospective-style adaptive shadow replay.
 * Replays locked portfolios chronologically. A challenger is evaluated only
 * after the active portfolio has triggered the governor; it never replaces ONE.
 */
(function(root){
 "use strict";
 function create(domain,governor){
  if(!domain||typeof domain.normalizeDraw!=="function"||typeof domain.scoreTicket!=="function"||typeof governor?.evaluate!=="function")throw new TypeError("Domain and adaptive governor are required");
  function ticketsOf(output){
   const raw=Array.isArray(output)?output:(output?.tickets??output?.portfolio?.tickets);
   if(!Array.isArray(raw)||!raw.length)throw new Error("ADAPTIVE_RUNNER_NO_TICKETS");
   return raw.map((item,i)=>{
    const p=domain.normalizeTicket(item?.ticket??item?.main??item);
    if(!p.ok)throw new Error("ADAPTIVE_RUNNER_INVALID_TICKET:"+i);
    return p.ticket;
   });
  }
  async function run(drawRows,options={}){
   if(typeof options.generateActive!=="function"||typeof options.generateChallenger!=="function")throw new TypeError("Active and challenger generators are required");
   const minHistory=Number(options.minHistory??30);
   if(!Number.isInteger(minHistory)||minHistory<1)throw new Error("INVALID_MIN_HISTORY");
   const threshold=Number(options.threshold??10);
   const normalized=[],seen=new Set(),rejected=[];
   (Array.isArray(drawRows)?drawRows:[]).forEach((raw,index)=>{
    const p=domain.normalizeDraw(raw);
    if(!p.ok){rejected.push({index,errors:p.errors});return;}
    if(seen.has(p.draw.id)){rejected.push({index,errors:["DUPLICATE_DRAW_ID"]});return;}
    seen.add(p.draw.id);normalized.push(p.draw);
   });
   normalized.sort((a,b)=>a.id-b.id);
   if(normalized.length<=minHistory)throw new Error("INSUFFICIENT_ADAPTIVE_HISTORY");
   const records=[],challengerRecords=[],governorEvents=[];
   let challengerActive=false;
   for(let i=minHistory;i<normalized.length;i++){
    const target=normalized[i],prior=normalized.slice(0,i);
    const challengerWasActive=challengerActive;
    const ctx=Object.freeze({targetDrawId:target.id,cutoffDrawId:prior[prior.length-1].id,draws:Object.freeze(prior.slice()),historyCount:prior.length,mode:"shadow"});
    const active=await options.generateActive(ctx);
    const activeTickets=ticketsOf(active);
    const lockedAt=active?.lockedAt??active?.generatedAt??active?.portfolio?.generatedAt;
    const resultAvailableAt=target.date;
    const scores=activeTickets.map(t=>domain.scoreTicket(t,target));
    if(scores.some(s=>!s.ok))throw new Error("ADAPTIVE_ACTIVE_SCORING_FAILED");
    const maxMainHits=Math.max(...scores.map(s=>s.mainHits));
    const official=target.source==="official"&&target.verified===true;
    // Evaluate the complete accumulated record history to enforce a true consecutive streak.
    records.push({targetDrawId:target.id,lockedAt,resultAvailableAt,portfolio:{tickets:activeTickets},result:{id:target.id,main:target.main,source:target.source,verified:target.verified,date:target.date}});
    const cumulative=governor.evaluate(records,{threshold});
    const newlyTriggered=cumulative.events.filter(e=>!governorEvents.some(old=>old.targetDrawId===e.targetDrawId));
    governorEvents.push(...newlyTriggered);
    if(newlyTriggered.length)challengerActive=true;
    const row={targetDrawId:target.id,cutoffDrawId:ctx.cutoffDrawId,maxMainHits,activeMiss:maxMainHits<3,officialVerified:official};
    if(challengerWasActive){
     const challenger=await options.generateChallenger(ctx);
     const challengerTickets=ticketsOf(challenger);
     const challengerScores=challengerTickets.map(t=>domain.scoreTicket(t,target));
     if(challengerScores.some(s=>!s.ok))throw new Error("ADAPTIVE_CHALLENGER_SCORING_FAILED");
     const challengerMax=Math.max(...challengerScores.map(s=>s.mainHits));
     challengerRecords.push({targetDrawId:target.id,cutoffDrawId:ctx.cutoffDrawId,source:target.source,verified:target.verified===true,activeMaxMainHits:maxMainHits,challengerMaxMainHits:challengerMax,activeAtLeast3:maxMainHits>=3,challengerAtLeast3:challengerMax>=3,activeSpecialHit:activeScores.some(s=>s.specialHit),challengerSpecialHit:challengerScores.some(s=>s.specialHit)});
     row.challengerMaxMainHits=challengerMax;
    }
    row.governorEvent= newlyTriggered.length>0;
    records[records.length-1].maxMainHits=maxMainHits;
   }
   const paired=challengerRecords.length;
   const active3=challengerRecords.filter(r=>r.activeAtLeast3).length;
   const challenger3=challengerRecords.filter(r=>r.challengerAtLeast3).length;
   return {
    reportType:"POWERAI_ONE_ADAPTIVE_SHADOW_REPLAY",researchOnly:true,
    activeModelMutated:false,automaticPromotion:false,threshold,
    evaluatedDraws:records.length,challengerEvaluatedDraws:paired,
    triggerEvents:governorEvents,records:records.map((r,i)=>({targetDrawId:r.targetDrawId,maxMainHits:r.maxMainHits,governorEvent:governorEvents.some(e=>e.targetDrawId===r.targetDrawId),challenger:challengerRecords.find(c=>c.targetDrawId===r.targetDrawId)||null})),
    pairedComparison:{draws:paired,activePortfolioAtLeast3:paired?active3/paired:0,challengerPortfolioAtLeast3:paired?challenger3/paired:0,activeSuccesses:active3,challengerSuccesses:challenger3},
    rejectedRows:rejected.length,policy:"SHADOW_ONLY_REQUIRES_HUMAN_REVIEW"
   };
  }
  return Object.freeze({run});
 }
 const API=Object.freeze({create});
 root.PowerAIOneAdaptiveShadowRunner=API;
 if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:this);
