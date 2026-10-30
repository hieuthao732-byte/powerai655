/* PowerAI ONE — portfolio orchestration service
 * Engine-agnostic coordinator. Legacy engines plug in through explicit adapters.
 * No DOM, persistence, network, or automatic engine substitution.
 */
(function(root){
  "use strict";
  const MODES = new Set(["prospective","retrospective","shadow","manual"]);

  function createPortfolioService(domain){
    if(!domain || typeof domain.normalizeHistory!=="function" || typeof domain.normalizePortfolio!=="function"){
      throw new TypeError("PowerAIDomain is required");
    }
    const engines = new Map();

    function register(adapter){
      if(!adapter || !adapter.id || typeof adapter.generate!=="function") throw new TypeError("Invalid engine adapter");
      if(engines.has(adapter.id)) throw new Error("Engine already registered: "+adapter.id);
      const status=adapter.status || "enabled";
      if(!["enabled","shadow","retired"].includes(status)) throw new Error("Invalid engine status: "+status);
      engines.set(adapter.id,Object.freeze({
        id:String(adapter.id),version:String(adapter.version||"legacy"),
        status,expectedTicketCount:adapter.expectedTicketCount ?? 20,
        generate:adapter.generate,audit:adapter.audit || null,
        mapInput:adapter.mapInput || (x=>x),
        mapOutput:adapter.mapOutput || (x=>x)
      }));
      return engines.get(adapter.id);
    }

    function list(){
      return [...engines.values()].map(e=>({id:e.id,version:e.version,status:e.status,expectedTicketCount:e.expectedTicketCount}));
    }

    async function generate(engineId, request={}){
      const engine=engines.get(String(engineId));
      if(!engine) throw new Error("UNKNOWN_ENGINE");
      if(engine.status==="retired") throw new Error("ENGINE_RETIRED");
      const mode=request.mode || "manual";
      if(!MODES.has(mode)) throw new Error("INVALID_EVALUATION_MODE");
      if(engine.status==="shadow" && mode!=="shadow" && mode!=="retrospective") throw new Error("SHADOW_ENGINE_MODE_REQUIRED");
      if(engine.status==="enabled" && mode==="shadow" && request.allowEnabledShadow!==true) throw new Error("EXPLICIT_SHADOW_OPT_IN_REQUIRED");

      const target=Number(request.targetDrawId);
      if(!Number.isInteger(target) || target<1) throw new Error("INVALID_TARGET_DRAW_ID");
      const history=domain.normalizeHistory(request.draws,target,{source:"imported"});
      if(!history.draws.length) throw new Error("NO_VALID_HISTORY_BEFORE_TARGET");

      const input={
        draws:history.draws,targetDrawId:target,cutoffDrawId:history.cutoffDrawId,
        config:request.config || {},seed:request.seed ?? null,mode
      };
      const engineInput=engine.mapInput(input);
      const raw=await engine.generate(engineInput);
      const mapped=engine.mapOutput(raw,input);
      if(!mapped || typeof mapped!=="object") throw new Error("ENGINE_RETURNED_NO_PORTFOLIO");

      const candidate={
        ...mapped,
        engineId:mapped.engineId || engine.id,
        engineVersion:mapped.engineVersion || mapped.version || engine.version,
        targetDrawId:mapped.targetDrawId ?? mapped.targetId ?? target,
        cutoffDrawId:mapped.cutoffDrawId ?? mapped.cutoffId ?? history.cutoffDrawId,
        tickets:mapped.tickets ?? mapped.portfolio,
        provenance:{
          ...(mapped.provenance || {}),
          mode,
          sourceDrawIds:history.draws.map(d=>d.id)
        }
      };
      const normalized=domain.normalizePortfolio(candidate,{
        expectedTicketCount:request.expectedTicketCount ?? engine.expectedTicketCount,
        mode,sourceDrawIds:history.draws.map(d=>d.id),engineId:engine.id
      });
      if(!normalized.ok){
        const error=new Error("PORTFOLIO_VALIDATION_FAILED");
        error.details=normalized.errors;
        throw error;
      }
      if(engine.audit){
        const engineAudit=engine.audit(raw);
        normalized.portfolio.engineAudit=engineAudit ?? null;
      }
      return {portfolio:normalized.portfolio,history:{used:history.draws.length,cutoffDrawId:history.cutoffDrawId,rejected:history.errors.length}};
    }

    return Object.freeze({register,list,generate});
  }

  root.PowerAIPortfolioService={create:createPortfolioService};
  if(typeof module!=="undefined" && module.exports) module.exports=root.PowerAIPortfolioService;
})(typeof globalThis!=="undefined"?globalThis:this);
