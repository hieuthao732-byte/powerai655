/* PowerAI ONE — canonical domain layer
 * Pure functions only. No DOM, storage, network, or mutation of legacy state.
 * Compatibility-first: legacy feed rows may store six or seven values in result[].
 */
(function(root){
  "use strict";

  const VERSION = "ONE-DOMAIN-0.1.0";
  const MIN = 1, MAX = 55, PICK = 6;

  function asInt(value){
    if(value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isInteger(n) ? n : null;
  }

  function sortedUniqueNumbers(values){
    if(!Array.isArray(values)) return null;
    const nums = values.map(asInt);
    if(nums.some(n => n === null || n < MIN || n > MAX)) return null;
    if(new Set(nums).size !== nums.length) return null;
    return nums.slice().sort((a,b)=>a-b);
  }

  function normalizeDraw(raw, options={}){
    const errors = [];
    if(!raw || typeof raw !== "object") return {ok:false,draw:null,errors:["DRAW_NOT_OBJECT"]};

    const id = asInt(raw.id ?? raw.drawId ?? raw.draw_id);
    if(id === null || id < 1) errors.push("INVALID_DRAW_ID");

    let mainRaw = raw.main ?? raw.actual ?? raw.numbers;
    let specialRaw = raw.special ?? raw.specialNumber ?? raw.special_number ?? null;
    if(!Array.isArray(mainRaw) && Array.isArray(raw.result)){
      mainRaw = raw.result.slice(0, PICK);
      if(specialRaw == null && raw.result.length >= 7) specialRaw = raw.result[6];
    }
    if(!Array.isArray(mainRaw)) errors.push("MAIN_NUMBERS_MISSING");

    const main = sortedUniqueNumbers(mainRaw);
    if(!main || main.length !== PICK) errors.push("MAIN_MUST_BE_SIX_UNIQUE_IN_RANGE");

    let special = null;
    if(specialRaw !== null && specialRaw !== undefined && specialRaw !== ""){
      special = asInt(specialRaw);
      if(special === null || special < MIN || special > MAX) errors.push("INVALID_SPECIAL");
      else if(main && main.includes(special) && options.requireDistinctSpecial !== false) errors.push("SPECIAL_DUPLICATES_MAIN");
    }

    const source = ["official","imported","manual"].includes(raw.source) ? raw.source : (options.source || "imported");
    const draw = errors.length ? null : {
      id,
      date: raw.date ?? raw.drawDate ?? raw.draw_date ?? null,
      main,
      special,
      source,
      sourceRef: raw.sourceRef ?? raw.source_ref ?? null,
      validated: true
    };
    return {ok:errors.length===0,draw,errors};
  }

  function normalizeHistory(rows, targetDrawId, options={}){
    const target = asInt(targetDrawId);
    const errors = [], seen = new Set(), valid = [];
    if(target === null || target < 1) return {draws:[],errors:["INVALID_TARGET_DRAW_ID"],cutoffDrawId:null};
    (Array.isArray(rows)?rows:[]).forEach((raw,index)=>{
      const result = normalizeDraw(raw,options);
      if(!result.ok){errors.push({index,id:raw?.id ?? raw?.drawId ?? null,codes:result.errors});return;}
      const d = result.draw;
      if(d.id >= target){errors.push({index,id:d.id,codes:["DRAW_NOT_BEFORE_TARGET"]});return;}
      if(seen.has(d.id)){errors.push({index,id:d.id,codes:["DUPLICATE_DRAW_ID"]});return;}
      seen.add(d.id);valid.push(d);
    });
    valid.sort((a,b)=>a.id-b.id);
    return {draws:valid,errors,cutoffDrawId:valid.length?valid[valid.length-1].id:null};
  }

  function normalizeTicket(raw){
    const values = Array.isArray(raw) ? raw : (raw && (raw.main || raw.a || raw.numbers));
    const main = sortedUniqueNumbers(values);
    if(!main || main.length !== PICK) return {ok:false,ticket:null,errors:["TICKET_MUST_BE_SIX_UNIQUE_IN_RANGE"]};
    return {ok:true,ticket:{main},errors:[]};
  }

  function stableHash(value){
    const input = typeof value === "string" ? value : JSON.stringify(value);
    let h = 2166136261 >>> 0;
    for(let i=0;i<input.length;i++){h ^= input.charCodeAt(i);h = Math.imul(h,16777619);}
    return ("00000000"+(h>>>0).toString(16)).slice(-8).toUpperCase();
  }

  function auditPortfolio(tickets){
    const exposure = Array(MAX+1).fill(0), pairs = new Map();
    let maxOverlap = 0;
    for(let i=0;i<tickets.length;i++){
      const a=tickets[i].main;
      for(const n of a) exposure[n]++;
      for(let x=0;x<PICK;x++) for(let y=x+1;y<PICK;y++){
        const key = a[x]+"-"+a[y]; pairs.set(key,(pairs.get(key)||0)+1);
      }
      for(let j=0;j<i;j++){
        const b=new Set(tickets[j].main);
        maxOverlap=Math.max(maxOverlap,a.reduce((sum,n)=>sum+(b.has(n)?1:0),0));
      }
    }
    const used=exposure.slice(1).filter(Boolean);
    return {
      ticketCount:tickets.length,
      coverage:used.length,
      minExposure:used.length?Math.min(...used):0,
      maxExposure:used.length?Math.max(...used):0,
      repeatedPairs:[...pairs.values()].filter(n=>n>1).length,
      maxOverlap
    };
  }

  function normalizePortfolio(raw, options={}){
    const errors=[];
    if(!raw || typeof raw!=="object") return {ok:false,portfolio:null,errors:["PORTFOLIO_NOT_OBJECT"]};
    const target=asInt(raw.targetDrawId ?? raw.targetId);
    const cutoff=asInt(raw.cutoffDrawId ?? raw.cutoffId);
    if(target===null || target<1) errors.push("INVALID_TARGET_DRAW_ID");
    if(cutoff!==null && target!==null && cutoff>=target) errors.push("CUTOFF_NOT_BEFORE_TARGET");

    const input=raw.tickets ?? raw.portfolio;
    if(!Array.isArray(input)) errors.push("TICKETS_MISSING");
    const tickets=[];
    (Array.isArray(input)?input:[]).forEach((item,index)=>{
      const parsed=normalizeTicket(item);
      if(!parsed.ok) errors.push("INVALID_TICKET_"+index);
      else tickets.push(parsed.ticket);
    });
    if(options.expectedTicketCount!=null && tickets.length!==options.expectedTicketCount) errors.push("UNEXPECTED_TICKET_COUNT");
    if(Array.isArray(input) && tickets.length!==input.length) errors.push("TICKET_COUNT_MISMATCH");

    const audit=auditPortfolio(tickets);
    const engineId=String(raw.engineId ?? raw.engine ?? options.engineId ?? "unknown");
    const engineVersion=String(raw.engineVersion ?? raw.version ?? "legacy");
    const portfolio={
      engineId,engineVersion,targetDrawId:target,cutoffDrawId:cutoff,
      tickets,generatedAt:raw.generatedAt ?? raw.lockedAt ?? null,
      seed:raw.seed ?? null,modelHash:raw.modelHash ?? null,
      portfolioHash:stableHash(tickets.map(t=>t.main)),
      audit,provenance:raw.provenance ?? {
        mode:options.mode || "manual",
        sourceDrawIds:Array.isArray(options.sourceDrawIds)?options.sourceDrawIds.slice():[]
      }
    };
    return {ok:errors.length===0,portfolio:errors.length?null:portfolio,errors};
  }

  function scoreTicket(ticket, result){
    const t=normalizeTicket(ticket),d=normalizeDraw(result);
    if(!t.ok || !d.ok) return {ok:false,mainHits:null,specialHit:null,errors:[...t.errors,...d.errors]};
    const winning=new Set(d.draw.main);
    return {
      ok:true,
      mainHits:t.ticket.main.reduce((sum,n)=>sum+(winning.has(n)?1:0),0),
      specialHit:d.draw.special!==null && t.ticket.main.includes(d.draw.special),
      errors:[]
    };
  }

  const API={VERSION,MIN,MAX,PICK,normalizeDraw,normalizeHistory,normalizeTicket,normalizePortfolio,auditPortfolio,stableHash,scoreTicket};
  root.PowerAIDomain=API;
  if(typeof module!=="undefined" && module.exports) module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:this);
