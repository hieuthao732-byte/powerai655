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
      const constraints=options.constraints||{};
      const maxPerNumber=options.maxPerNumber==null?(constraints.maxExposure==null?Infinity:Number(constraints.maxExposure)):Number(options.maxPerNumber);
      const minExposure=constraints.minExposure==null?0:Number(constraints.minExposure);
      const requireCoverage=constraints.requireCoverage===true;
      const maxRepeatedPairs=constraints.maxRepeatedPairs==null?Infinity:Number(constraints.maxRepeatedPairs);
      const scoreWeight=Number(options.scoreWeight ?? .7);
      const diversityWeight=Number(options.diversityWeight ?? .3);
      if(!Number.isInteger(maxOverlap)||maxOverlap<0||maxOverlap>6)throw new Error("INVALID_MAX_OVERLAP");
      if(!(maxPerNumber===Infinity||(Number.isInteger(maxPerNumber)&&maxPerNumber>=1)))throw new Error("INVALID_MAX_EXPOSURE");
      if(!Number.isInteger(minExposure)||minExposure<0||minExposure>count)throw new Error("INVALID_MIN_EXPOSURE");
      if(!(maxRepeatedPairs===Infinity||(Number.isInteger(maxRepeatedPairs)&&maxRepeatedPairs>=0)))throw new Error("INVALID_MAX_REPEATED_PAIRS");
      if(!(scoreWeight>=0&&diversityWeight>=0&&Number.isFinite(scoreWeight)&&Number.isFinite(diversityWeight)&&scoreWeight+diversityWeight>0))throw new Error("INVALID_WEIGHTS");

      // Bounded beam search: ONE remains the only final selector, but now
      // explores alternative partial portfolios instead of committing greedily.
      const beamWidth=Math.max(8,Math.min(256,Number(options.beamWidth??24)));
      const candidateLimit=Math.max(count,Math.min(1200,Number(options.candidateLimit??100)));
      const nodeBudget=Math.max(1000,Number(options.searchNodeBudget??800000));
      const pool=candidates.slice().sort((a,b)=>b.rankScore-a.rankScore||key(a.ticket).localeCompare(key(b.ticket))).slice(0,candidateLimit);
      const rejected={overlap:0,exposure:0,repeatedPairs:0};
      const pairKeys=t=>{const out=[];for(let a=0;a<6;a++)for(let b=a+1;b<6;b++)out.push(t.main[a]+"-"+t.main[b]);return out;};
      const initial={indices:[],exposure:Array(56).fill(0),pairCounts:Object.create(null),repeatedPairCount:0,score:0,coverage:0,sourceSet:[]};
      let beam=[initial],expanded=0,budgetHit=false;
      const partialValue=(candidate,state)=>{
        const t=candidate.ticket;
        const novel=t.main.reduce((n,x)=>n+(state.exposure[x]===0?1:0),0);
        const meanExposure=t.main.reduce((n,x)=>n+state.exposure[x],0)/6;
        const sourceSpread=state.sourceSet.includes(candidate.source)?0:1;
        return scoreWeight*candidate.rankScore+diversityWeight*(.70*novel/6+.20/(1+meanExposure)+.10*sourceSpread);
      };
      for(let depth=0;depth<count;depth++){
        const next=[],seen=new Set();
        for(const state of beam){
          for(let ci=0;ci<pool.length;ci++){
            if(state.indices.includes(ci))continue;
            if(++expanded>nodeBudget){budgetHit=true;break;}
            const candidate=pool[ci],t=candidate.ticket;
            if(t.main.some(n=>state.exposure[n]>=maxPerNumber)){rejected.exposure++;continue;}
            let invalid=false;
            for(const prevIndex of state.indices){
              if(overlap(t,pool[prevIndex].ticket)>maxOverlap){invalid=true;break;}
            }
            if(invalid){rejected.overlap++;continue;}
            // Pair accounting is expensive and unnecessary when no pair cap is active.
            // Keep the hot path allocation-light for providers such as B that only
            // request overlap/exposure constraints.
            let nextRepeatedPairCount=state.repeatedPairCount;
            let pairCounts=state.pairCounts;
            if(Number.isFinite(maxRepeatedPairs)){
              const pairs=pairKeys(t);
              nextRepeatedPairCount+=pairs.filter(pk=>(state.pairCounts[pk]||0)===1).length;
              if(nextRepeatedPairCount>maxRepeatedPairs){rejected.repeatedPairs++;continue;}
              pairCounts={...state.pairCounts};
              pairs.forEach(pk=>pairCounts[pk]=(pairCounts[pk]||0)+1);
            }
            const exposure=state.exposure.slice();
            t.main.forEach(n=>exposure[n]++);
            const indices=state.indices.concat(ci);
            const sourceSet=state.sourceSet.includes(candidate.source)?state.sourceSet:state.sourceSet.concat(candidate.source);
            const coverage=exposure.slice(1).filter(Boolean).length;
            const score=state.score+partialValue(candidate,state)+(requireCoverage?coverage*.0005:0)+(minExposure>0?exposure.slice(1).filter(x=>x>=minExposure).length*.0002:0);
            const signature=indices.slice().sort((a,b)=>a-b).join(",");
            if(seen.has(signature))continue;
            seen.add(signature);
            const nextState={indices,exposure,pairCounts,repeatedPairCount:nextRepeatedPairCount,score,coverage,sourceSet};
            // Keep only the best bounded set; tie-break deterministically.
            let pos=next.findIndex(x=>x.score<score);
            if(pos<0)pos=next.length;
            next.splice(pos,0,nextState);
            if(next.length>beamWidth)next.pop();
          }
          if(budgetHit)break;
        }
        if(!next.length){
          if(budgetHit)throw new Error("SELECTION_SEARCH_BUDGET_EXHAUSTED");
          throw new Error("SELECTION_CONSTRAINTS_INFEASIBLE");
        }
        beam=next;
        if(budgetHit)break;
      }
      if(budgetHit && !beam.some(s=>s.indices.length===count))throw new Error("SELECTION_SEARCH_BUDGET_EXHAUSTED");
      const feasible=beam.filter(state=>{
        if(state.indices.length!==count)return false;
        const audit=domain.auditPortfolio(state.indices.map(i=>pool[i].ticket));
        return (!requireCoverage||audit.coverage===55)&&audit.minExposure>=minExposure&&
          (!Number.isFinite(maxPerNumber)||audit.maxExposure<=maxPerNumber)&&
          (!Number.isFinite(maxRepeatedPairs)||audit.repeatedPairs<=maxRepeatedPairs)&&audit.maxOverlap<=maxOverlap;
      });
      if(!feasible.length)throw new Error(budgetHit?"SELECTION_SEARCH_BUDGET_EXHAUSTED":"SELECTION_CONSTRAINTS_INFEASIBLE");
      feasible.sort((a,b)=>b.score-a.score||a.indices.join(",").localeCompare(b.indices.join(",")));
      const winner=feasible[0];
      const selected=winner.indices.map((ci,index)=>{
        const item=pool[ci];
        item.selectionScore=winner.score;
        item.rank=index+1;
        return item;
      });
      const exposure=winner.exposure;
      const tickets=selected.map(x=>x.ticket);
      const audit=domain.auditPortfolio(tickets);
      if(requireCoverage&&audit.coverage!==55)throw new Error("HARD_CONSTRAINT_COVERAGE_FAILED");
      if(minExposure>0&&audit.minExposure<minExposure)throw new Error("HARD_CONSTRAINT_MIN_EXPOSURE_FAILED");
      if(Number.isFinite(maxPerNumber)&&audit.maxExposure>maxPerNumber)throw new Error("HARD_CONSTRAINT_MAX_EXPOSURE_FAILED");
      if(Number.isFinite(maxRepeatedPairs)&&audit.repeatedPairs>maxRepeatedPairs)throw new Error("HARD_CONSTRAINT_REPEATED_PAIRS_FAILED");
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
        policy:{id:"ONE_BOUNDED_FEASIBILITY_BEAM_V1",search:{algorithm:"bounded-beam",beamWidth,candidateLimit,nodeBudget,expanded,budgetHit},count,maxOverlap,maxPerNumber,scoreWeight,diversityWeight,constraints:{requireCoverage,minExposure,maxExposure:maxPerNumber,maxRepeatedPairs}},
        hash:domain.stableHash(tickets.map(t=>t.main))
      };
    }

    return Object.freeze({select,normalizeCandidates});
  }

  root.PowerAIUnifiedSelector={create:createUnifiedSelector};
  if(typeof module!=="undefined"&&module.exports)module.exports=root.PowerAIUnifiedSelector;
})(typeof globalThis!=="undefined"?globalThis:this);
