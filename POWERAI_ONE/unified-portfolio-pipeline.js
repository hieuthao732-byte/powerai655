/* PowerAI ONE — single portfolio pipeline
 * A/B/C/L/D are providers only. Exactly one final selector owns ticket selection.
 */
(function(root){
  "use strict";
  function createPipeline(domain,selector){
    if(!domain||!selector||typeof selector.select!=="function")throw new TypeError("Domain and unified selector are required");
    const providers=new Map();
    function registerProvider(provider){
      if(!provider||!provider.id||typeof provider.propose!=="function")throw new TypeError("Invalid candidate provider");
      if(providers.has(provider.id))throw new Error("PROVIDER_ALREADY_REGISTERED");
      providers.set(String(provider.id),Object.freeze({
        id:String(provider.id),version:String(provider.version||"legacy"),
        status:provider.status||"enabled",propose:provider.propose,
        validateCandidate:provider.validateCandidate||null
      }));
    }
    function listProviders(){return [...providers.values()].map(p=>({id:p.id,version:p.version,status:p.status}));}

    async function build(request={}){
      const target=Number(request.targetDrawId);
      if(!Number.isInteger(target)||target<1)throw new Error("INVALID_TARGET_DRAW_ID");
      const mode=request.mode||"prospective";
      if(!["prospective","retrospective","shadow","manual"].includes(mode))throw new Error("INVALID_MODE");
      const history=domain.normalizeHistory(request.draws,target);
      if(!history.draws.length)throw new Error("NO_VALID_HISTORY_BEFORE_TARGET");

      const ids=request.providerIds||[...providers.keys()];
      const selectedProviders=ids.map(id=>{
        const p=providers.get(String(id));
        if(!p)throw new Error("UNKNOWN_PROVIDER:"+id);
        if(p.status==="retired")throw new Error("PROVIDER_RETIRED:"+id);
        if(p.status==="shadow"&&mode!=="shadow"&&mode!=="retrospective")throw new Error("SHADOW_PROVIDER_MODE_REQUIRED:"+id);
        return p;
      });
      if(!selectedProviders.length)throw new Error("NO_CANDIDATE_PROVIDERS");

      const ctx=Object.freeze({
        targetDrawId:target,cutoffDrawId:history.cutoffDrawId,
        draws:history.draws,config:request.config||{},seed:request.seed??null,mode,learningReport:request.learningReport??null
      });
      const outputs=await Promise.all(selectedProviders.map(async p=>{
        const raw=await p.propose(ctx);
        const items=Array.isArray(raw)?raw:(raw?.candidates??raw?.tickets??[]);
        if(!Array.isArray(items))throw new Error("PROVIDER_RETURNED_INVALID_CANDIDATES:"+p.id);
        const valid=[];
        for(let i=0;i<items.length;i++){
          const item=items[i],parsed=domain.normalizeTicket(item.ticket??item.main??item);
          if(!parsed.ok)continue;
          if(p.validateCandidate&&!await p.validateCandidate(parsed.ticket,item,ctx))continue;
          valid.push({
            ...item,ticket:parsed.ticket,source:p.id,
            providerVersion:p.version,
            tags:[...(Array.isArray(item.tags)?item.tags:[]),p.id]
          });
        }
        return {providerId:p.id,generated:items.length,eligible:valid.length,candidates:valid};
      }));

      const candidates=outputs.flatMap(x=>x.candidates);
      const selection=selector.select(candidates,{
        count:request.count??20,maxOverlap:request.maxOverlap??4,
        maxPerNumber:request.maxPerNumber,
        scoreWeight:request.scoreWeight??.7,diversityWeight:request.diversityWeight??.3
      });
      const portfolio={
        engineId:"POWERAI_ONE",engineVersion:"ONE-0.1.0",
        targetDrawId:target,cutoffDrawId:history.cutoffDrawId,
        tickets:selection.tickets,generatedAt:new Date().toISOString(),
        seed:request.seed??null,modelHash:null,
        selectionPolicy:selection.policy,
        selectionHash:selection.hash,
        ranked:selection.ranked,
        audit:selection.audit,
        provenance:{
          mode,providerIds:selectedProviders.map(p=>p.id),
          sourceDrawIds:history.draws.map(d=>d.id),
          providerStats:outputs.map(({providerId,generated,eligible})=>({providerId,generated,eligible})),
          historyRejected:history.errors.length
        }
      };
      return {portfolio,selection,history:{used:history.draws.length,cutoffDrawId:history.cutoffDrawId,rejected:history.errors.length}};
    }
    return Object.freeze({registerProvider,listProviders,build});
  }
  root.PowerAIOnePipeline={create:createPipeline};
  if(typeof module!=="undefined"&&module.exports)module.exports=root.PowerAIOnePipeline;
})(typeof globalThis!=="undefined"?globalThis:this);
