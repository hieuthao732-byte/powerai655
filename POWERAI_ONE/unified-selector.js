/* PowerAI ONE — Unified Ticket Selector
 * All engines are candidate/signal providers. This is the sole final ticket-selection policy.
 * Scores are ranking signals, never winning probabilities.
 */
(function(root){
  "use strict";

  function createUnifiedSelector(domain){
    if(!domain || typeof domain.normalizeTicket!=="function" || typeof domain.auditPortfolio!=="function") {
      throw new TypeError("PowerAIDomain is required");
    }

    const finite=x=>Number.isFinite(Number(x))?Number(x):null;
    const key=t=>t.main.join("-");
    const overlap=(a,b)=>{const s=new Set(a.main);return b.main.reduce((n,x)=>n+(s.has(x)?1:0),0)};

    function normalizeCandidates(input){
      const errors=[],byKey=new Map();
      (Array.isArray(input)?input:[]).forEach((raw,index)=>{
        const parsed=domain.normalizeTicket(raw.ticket ?? raw.main ?? raw.a ?? raw.numbers ?? raw);
        if(!parsed.ok){errors.push({index,code:"INVALID_TICKET"});return;}
        const score=finite(raw.score ?? raw.rawScore ?? raw.displayScore);
        const candidate={
          ticket:parsed.ticket,
          source:String(raw.source ?? raw.engineId ?? "unspecified"),
          rawScore:score,
          sourceScores:{},
          components:raw.components && typeof raw.components==="object"?{...raw.components}:{},
          tags:Array.isArray(raw.tags)?raw.tags.slice():[],
          metadata:raw.metadata ?? null
        };
        if(score!==null)candidate.sourceScores[candidate.source]=score;
        const k=key(candidate.ticket),old=byKey.get(k);
        if(!old){byKey.set(k,candidate);return;}
        // Keep raw scores isolated by source. A's score is never compared to B's.
        if(!old.sources)old.sources=[old.source];
        if(!old.sources.includes(candidate.source))old.sources.push(candidate.source);
        if(score!==null){
          const previous=old.sourceScores[candidate.source];
          if(previous===undefined || score>previous)old.sourceScores[candidate.source]=score;
        }
        if(!old.components || Object.keys(old.components).length===0)old.components=candidate.components;
      });
      return {candidates:[...byKey.values()],errors};
    }

    function percentileScores(candidates){
      const groups=new Map();
      candidates.forEach(c=>{
        for(const [source,score] of Object.entries(c.sourceScores||{})){
          if(!groups.has(source))groups.set(source,[]);
          groups.get(source).push(score);
        }
      });
      const rank=(score,values)=>{
        if(values.length<2)return .5;
        const sorted=values.slice().sort((a,b)=>a-b);
        let below=0,equal=0;
        for(const x of sorted){if(x<score)below++;else if(x===score)equal++;}
        return (below+Math.max(0,equal-1)/2)/Math.max(1,sorted.length-1);
      };
      for(const c of candidates){
        const ranks=Object.entries(c.sourceScores||{}).map(([source,score])=>rank(score,groups.get(source)||[]));
        c.rankScore=ranks.length?Math.max(...ranks):.5;
        c.sourceRankScores=Object.fromEntries(Object.entries(c.sourceScores||{}).map(([source,score])=>[source,rank(score,groups.get(source)||[])]));
      }
      return candidates;
    }

    function select(input,options={}){
      const count=Number(options.count ?? 20);
      if(!Number.isInteger(count)||count<1)throw new Error("INVALID_SELECTION_COUNT");
      const normalized=normalizeCandidates(input);
      const candidates=percentileScores(normalized.candidates);
      if(candidates.length<count)throw new Error("INSUFFICIENT_UNIQUE_CANDIDATES");

      const maxOverlap=Number(options.maxOverlap ?? 4);
      const maxPerNumber=options.maxPerNumber==null?Infinity:Number(options.maxPerNumber);
      const scoreWeight=Number(options.scoreWeight ?? .7);
      const diversityWeight=Number(options.diversityWeight ?? .3);
      if(!Number.isInteger(maxOverlap)||maxOverlap<0||maxOverlap>6)throw new Error("INVALID_MAX_OVERLAP");
      if(!(maxPerNumber===Infinity||(Number.isInteger(maxPerNumber)&&maxPerNumber>=1)))throw new Error("INVALID_MAX_EXPOSURE");
      if(!(scoreWeight>=0&&diversityWeight>=0&&Number.isFinite(scoreWeight)&&Number.isFinite(diversityWeight)&&scoreWeight+diversityWeight>0))throw new Error("INVALID_WEIGHTS");

      const exposure=Array(56).fill(0),selected=[],remaining=candidates.slice();
      const rejected={overlap:0,exposure:0};
      while(selected.length<count){
        let bestIndex=-1,bestValue=-Infinity;
        for(let i=0;i<remaining.length;i++){
          const c=remaining[i],t=c.ticket;
          if(t.main.some(n=>exposure[n]>=maxPerNumber)){rejected.exposure++;continue;}
          const overlaps=selected.map(s=>overlap(t,s.ticket));
          const maxOv=overlaps.length?Math.max(...overlaps):0;
          if(maxOv>maxOverlap){rejected.overlap++;continue;}
          const meanOv=overlaps.length?overlaps.reduce((a,b)=>a+b,0)/overlaps.length:0;
          const novelty=t.main.reduce((n,x)=>n+(exposure[x]===0?1:0),0)/6;
          const sourceSpread=selected.length && !selected.some(s=>s.sources?.includes(c.source)||s.source===c.source)?1:0;
          const value=scoreWeight*c.rankScore + diversityWeight*(.65*novelty+.25*(1-meanOv/6)+.10*sourceSpread);
          if(value>bestValue || (value===bestValue && key(t)<key(remaining[bestIndex]?.ticket||{main:[56]}))){
            bestValue=value;bestIndex=i;
          }
        }
        if(bestIndex<0)throw new Error("SELECTION_CONSTRAINTS_INFEASIBLE");
        const chosen=remaining.splice(bestIndex,1)[0];
        chosen.selectionScore=bestValue;
        chosen.rank=selected.length+1;
        selected.push(chosen);
        chosen.ticket.main.forEach(n=>exposure[n]++);
      }

      const tickets=selected.map(x=>x.ticket);
      const audit=domain.auditPortfolio(tickets);
      const sources={};
      selected.forEach(x=>(x.sources||[x.source]).forEach(s=>sources[s]=(sources[s]||0)+1));
      return {
        tickets,
        ranked:selected.map(x=>({
          main:x.ticket.main,rank:x.rank,source:x.source,sources:x.sources||[x.source],
          rawScore:x.rawScore,sourceScores:x.sourceScores,sourceRankScores:x.sourceRankScores,rankScore:x.rankScore,selectionScore:x.selectionScore,
          components:x.components,tags:x.tags
        })),
        audit,
        sourceDistribution:sources,
        rejectedCandidates:normalized.errors.length,
        rejectedByConstraints:rejected,
        policy:{id:"ONE_UNIFIED_GREEDY_V1",count,maxOverlap,maxPerNumber,scoreWeight,diversityWeight},
        hash:domain.stableHash(tickets.map(t=>t.main))
      };
    }

    return Object.freeze({select,normalizeCandidates});
  }

  root.PowerAIUnifiedSelector={create:createUnifiedSelector};
  if(typeof module!=="undefined"&&module.exports)module.exports=root.PowerAIUnifiedSelector;
})(typeof globalThis!=="undefined"?globalThis:this);
