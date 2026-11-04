/* PowerAI ONE — chronological walk-forward evaluator
 * Research only. It never writes official logs, learning weights, locks or promotion state.
 */
(function(root){
  "use strict";
  function create(domain){
    if(!domain||typeof domain.normalizeDraw!=="function"||typeof domain.normalizeTicket!=="function"||typeof domain.scoreTicket!=="function")throw new TypeError("Canonical domain API is required");

    function summarize(records){
      const ticketHits=records.flatMap(r=>r.tickets.map(t=>t.mainHits));
      const maxHits=records.map(r=>r.maxMainHits);
      const ticketCount=ticketHits.length;
      const countAtLeast=n=>ticketHits.filter(x=>x>=n).length;
      const portfoliosAtLeast=n=>records.filter(r=>r.maxMainHits>=n).length;
      return {
        draws:records.length,tickets:ticketCount,
        mainHitDistribution:[0,1,2,3,4,5,6].map(h=>({hits:h,tickets:ticketHits.filter(x=>x===h).length})),
        ticketHitRates:{
          atLeast2:ticketCount?countAtLeast(2)/ticketCount:0,
          atLeast3:ticketCount?countAtLeast(3)/ticketCount:0,
          atLeast4:ticketCount?countAtLeast(4)/ticketCount:0,
          atLeast5:ticketCount?countAtLeast(5)/ticketCount:0,
          six:ticketCount?countAtLeast(6)/ticketCount:0
        },
        portfolioHitRates:{
          atLeast3:records.length?portfoliosAtLeast(3)/records.length:0,
          atLeast4:records.length?portfoliosAtLeast(4)/records.length:0,
          atLeast5:records.length?portfoliosAtLeast(5)/records.length:0,
          six:records.length?portfoliosAtLeast(6)/records.length:0
        },
        specialHits:ticketHits.length?records.reduce((sum,r)=>sum+r.specialHitTickets,0):0,
        meanMaxMainHits:maxHits.length?maxHits.reduce((a,b)=>a+b,0)/maxHits.length:0
      };
    }

    function readTickets(output){
      const raw=Array.isArray(output)?output:(output?.tickets??output?.portfolio?.tickets);
      if(!Array.isArray(raw)||!raw.length)throw new Error("WALK_FORWARD_GENERATOR_RETURNED_NO_TICKETS");
      return raw.map((item,index)=>{
        const parsed=domain.normalizeTicket(item?.ticket??item?.main??item);
        if(!parsed.ok)throw new Error("WALK_FORWARD_INVALID_TICKET:"+index);
        return parsed.ticket;
      });
    }

    async function evaluate(drawRows,options={}){
      const generate=options.generate;
      if(typeof generate!=="function")throw new TypeError("A portfolio generator callback is required");
      const baseline=options.baselineGenerator??null;
      if(baseline!==null&&typeof baseline!=="function")throw new TypeError("baselineGenerator must be a function");
      const minHistory=Number(options.minHistory??30);
      if(!Number.isInteger(minHistory)||minHistory<1)throw new Error("INVALID_MIN_HISTORY");
      const normalized=[],seen=new Set(),rejected=[];
      (Array.isArray(drawRows)?drawRows:[]).forEach((row,index)=>{
        const parsed=domain.normalizeDraw(row);
        if(!parsed.ok){rejected.push({index,id:row?.id??null,errors:parsed.errors});return;}
        if(seen.has(parsed.draw.id)){rejected.push({index,id:parsed.draw.id,errors:["DUPLICATE_DRAW_ID"]});return;}
        seen.add(parsed.draw.id);normalized.push(parsed.draw);
      });
      normalized.sort((a,b)=>a.id-b.id);
      if(normalized.length<=minHistory)throw new Error("INSUFFICIENT_WALK_FORWARD_DRAWS");
      const startIndex=Number(options.startIndex??minHistory);
      if(!Number.isInteger(startIndex)||startIndex<minHistory||startIndex>=normalized.length)throw new Error("INVALID_WALK_FORWARD_START_INDEX");
      const records=[];
      for(let i=startIndex;i<normalized.length;i++){
        const target=normalized[i],prior=normalized.slice(0,i);
        const ctx=Object.freeze({
          targetDrawId:target.id,cutoffDrawId:prior[prior.length-1].id,
          draws:Object.freeze(prior.slice()),mode:"retrospective",
          historyCount:prior.length
        });
        const generated=await generate(ctx);
        const generatedCutoff=generated?.cutoffDrawId??generated?.portfolio?.cutoffDrawId??null;
        if(generatedCutoff!==null&&Number(generatedCutoff)>=target.id)throw new Error("FUTURE_LEAKAGE_GENERATOR_CUTOFF");
        const tickets=readTickets(generated);
        const scored=tickets.map(ticket=>domain.scoreTicket(ticket,target));
        if(scored.some(x=>!x.ok))throw new Error("WALK_FORWARD_SCORING_FAILED");
        const row={
          targetDrawId:target.id,cutoffDrawId:ctx.cutoffDrawId,historyCount:ctx.historyCount,
          tickets:scored.map((x,index)=>({mainHits:x.mainHits,specialHit:x.specialHit,ticketIndex:index})),
          maxMainHits:Math.max(...scored.map(x=>x.mainHits)),
          specialHitTickets:scored.filter(x=>x.specialHit).length
        };
        if(baseline){
          const baseTickets=readTickets(await baseline(ctx));
          const baseScores=baseTickets.map(ticket=>domain.scoreTicket(ticket,target));
          if(baseScores.some(x=>!x.ok))throw new Error("WALK_FORWARD_BASELINE_SCORING_FAILED");
          row.baseline={
            ticketCount:baseScores.length,
            maxMainHits:Math.max(...baseScores.map(x=>x.mainHits)),
            atLeast3:baseScores.filter(x=>x.mainHits>=3).length,
            atLeast4:baseScores.filter(x=>x.mainHits>=4).length,
            specialHitTickets:baseScores.filter(x=>x.specialHit).length
          };
        }
        records.push(row);
      }
      const summary=summarize(records);
      const baselineSummary=baseline?{
        draws:records.length,
        portfoliosAtLeast3:records.filter(r=>r.baseline.maxMainHits>=3).length,
        portfoliosAtLeast4:records.filter(r=>r.baseline.maxMainHits>=4).length,
        portfoliosAtLeast5:records.filter(r=>r.baseline.maxMainHits>=5).length,
        portfoliosSix:records.filter(r=>r.baseline.maxMainHits===6).length,
        specialHitTickets:records.reduce((sum,r)=>sum+r.baseline.specialHitTickets,0)
      }:null;
      return {
        reportType:"POWERAI_ONE_WALK_FORWARD_RESEARCH",
        researchOnly:true,officialLogsWritten:false,learningUpdated:false,
        targetRange:{first:records[0].targetDrawId,last:records[records.length-1].targetDrawId},
        history:{validDraws:normalized.length,rejectedDraws:rejected.length,minHistory},
        summary,baselineSummary,records,rejected
      };
    }
    return Object.freeze({evaluate,summarize});
  }
  root.PowerAIOneWalkForward={create};
  if(typeof module!=="undefined"&&module.exports)module.exports=root.PowerAIOneWalkForward;
})(typeof globalThis!=="undefined"?globalThis:this);
