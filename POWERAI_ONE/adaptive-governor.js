/* PowerAI ONE — adaptive performance governor.
 * A 10-draw miss streak opens a shadow recalibration event; it never mutates
 * the active selector or claims that changing weights improves lottery odds.
 */
(function(root){
  "use strict";

  function evaluate(records, options={}){
    const threshold=Number(options.threshold??10);
    if(!Number.isInteger(threshold)||threshold<2||threshold>100)throw new Error("INVALID_STREAK_THRESHOLD");
    if(!Array.isArray(records))throw new TypeError("RECORDS_MUST_BE_ARRAY");
    const seen=new Set(), accepted=[], rejected=[], events=[];
    let streak=0, previousId=null, latched=false;
    for(let index=0;index<records.length;index++){
      const row=records[index]||{};
      const id=Number(row.targetDrawId??row.result?.id);
      if(!Number.isInteger(id)||id<1||seen.has(id)|| (previousId!==null&&id<=previousId)){
        rejected.push({index,code:"INVALID_OR_NON_CHRONOLOGICAL_TARGET"});
        streak=0;latched=false;previousId=Number.isInteger(id)?id:previousId;
        continue;
      }
      if(previousId!==null&&id!==previousId+1)streak=0;
      seen.add(id);previousId=id;
      const result=row.result||{};
      const tickets=row.portfolio?.tickets;
      const lockTime=Date.parse(row.lockedAt??row.portfolio?.generatedAt??"");
      const resultTime=Date.parse(row.resultAvailableAt??result.availableAt??result.date??"");
      const official=result.id===id&&result.source==="official"&&result.verified===true;
      const validMain=Array.isArray(result.main)&&result.main.length===6&&result.main.every(n=>Number.isInteger(n)&&n>=1&&n<=55)&&new Set(result.main).size===6;
      const validTickets=Array.isArray(tickets)&&tickets.length>0&&tickets.every(t=>{
        const a=Array.isArray(t)?t:t?.main;
        return Array.isArray(a)&&a.length===6&&a.every(n=>Number.isInteger(n)&&n>=1&&n<=55)&&new Set(a).size===6;
      });
      if(!official||!validMain||!validTickets||!Number.isFinite(lockTime)||!Number.isFinite(resultTime)||lockTime>=resultTime){
        rejected.push({index,targetDrawId:id,code:"UNVERIFIED_OR_INVALID_LOCKED_RESULT"});
        streak=0;latched=false;
        continue;
      }
      const winning=new Set(result.main);
      const maxMainHits=Math.max(...tickets.map(t=>(Array.isArray(t)?t:t.main).reduce((s,n)=>s+(winning.has(n)?1:0),0)));
      const miss=maxMainHits<3;
      streak=miss?streak+1:0;
      if(!miss)latched=false;
      if(streak>=threshold&&!latched){
        events.push({targetDrawId:id,streak,triggeredAtIndex:index,action:"RUN_SHADOW_CHALLENGER",activeModelMutation:false});
        latched=true;
      }
      accepted.push({targetDrawId:id,maxMainHits,miss,consecutiveMisses:streak});
    }
    return Object.freeze({
      threshold,acceptedDraws:accepted.length,rejected,
      currentStreak:streak,triggered:events.length>0,
      events,latest:accepted.length?accepted[accepted.length-1]:null,
      policy:"SHADOW_ONLY_NO_AUTOMATIC_PROMOTION"
    });
  }

  const API=Object.freeze({evaluate});
  root.PowerAIOneAdaptiveGovernor=API;
  if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:this);
