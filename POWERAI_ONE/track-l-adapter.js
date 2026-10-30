/* PowerAI ONE — Track L learned-weight candidate engine.
 * Pure calculation only. No storage, locks, logs, UI, or final portfolio selection.
 */
(function(root){
"use strict";
const BASE=Object.freeze({Heat:.40,Pair:.30,OddEven:.10,SmallBig:.10,Sum:.10});
function mean(a){return a.length?a.reduce((s,x)=>s+Number(x||0),0)/a.length:0}
function safeCorr(xs,ys){
 if(xs.length<3||ys.length!==xs.length)return 0;
 const mx=mean(xs),my=mean(ys);let num=0,dx=0,dy=0;
 for(let i=0;i<xs.length;i++){const a=xs[i]-mx,b=ys[i]-my;num+=a*b;dx+=a*a;dy+=b*b}
 return dx>0&&dy>0?num/Math.sqrt(dx*dy):0;
}
function verifiedLogs(logs){return(logs||[]).filter(x=>x&&x.source==="feed"&&Array.isArray(x.actual)&&x.actual.length===6).sort((a,b)=>Number(a.targetId)-Number(b.targetId)).slice(-30)}
function maturity(n){if(n>=20)return{pct:100,label:"VALIDATION CANDIDATE"};if(n>=10)return{pct:70,label:"CHALLENGER"};if(n>=5)return{pct:40,label:"EARLY LEARNING"};return{pct:Math.min(20,n*4),label:"OBSERVE ONLY"}}
function learnedPortfolioWeights(report){
 const n=Number(report?.n)||0,signals=Array.isArray(report?.signals)?report.signals:[];
 if(!signals.length)return{weights:{...BASE},alpha:0,mode:"B-BASELINE",note:"No verified learning report; frozen B weights retained."};
 const map=Object.fromEntries(signals.filter(s=>s.name!=="LegacyTotal").map(s=>[s.name,s]));
 const alpha=Math.min(.25,n/20*.25),raw={};
 for(const k of Object.keys(BASE)){const strength=Math.max(-1,Math.min(1,Number(map[k]?.strength)||0));raw[k]=BASE[k]*(1+alpha*strength)}
 const total=Object.values(raw).reduce((a,b)=>a+b,0)||1,weights=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,v/total]));
 const mode=n>=20?"VALIDATION CANDIDATE":n>=10?"CHALLENGER":n>=5?"EARLY LEARNING":"PREVIEW";
 return{weights,alpha,mode,note:n>=20?"At least 20 verified draws; validation only, not promotion.":n>=10?"At least 10 verified draws; challenger only.":n>=5?"Small learning effect; evidence remains limited.":"Very limited evidence; keep close to baseline."};
}
function challenger(signals,n){
 if(n<10)return null;
 const raw={...BASE},useful=(signals||[]).filter(s=>s.name!=="LegacyTotal"&&s.strength>0&&s.stability>=.55),weak=(signals||[]).filter(s=>s.name!=="LegacyTotal"&&(s.strength<=0||s.stability<.45));
 if(!useful.length)return{name:"B-L0",weights:{...BASE},ready:false};
 for(const s of useful)if(raw[s.name]!=null)raw[s.name]*=1+Math.min(.25,.15+Math.max(0,s.strength)*.15);
 for(const s of weak)if(raw[s.name]!=null)raw[s.name]*=.85;
 const total=Object.values(raw).reduce((a,b)=>a+b,0);for(const k of Object.keys(raw))raw[k]/=total;
 return{name:"B-L1",weights:raw,ready:n>=20};
}
function generate(draws,targetDrawId,report,B,options={}){
 if(!B||!B.buildLegacyModel||!B.randomValidPool||!B.legacyComponents)throw new TypeError("Track B pure engine required");
 const target=Number(targetDrawId);if(!Number.isInteger(target)||target<1)throw new Error("INVALID_TARGET_DRAW_ID");
 const history=(draws||[]).filter(d=>Number(d.id)<target).map(d=>({id:d.id,result:d.main}));
 if(!history.length)throw new Error("NO_VALID_HISTORY_BEFORE_TARGET");
 const count=Number(options.candidateCount??50000);if(!Number.isInteger(count)||count<20)throw new Error("INVALID_CANDIDATE_COUNT");
 const learned=learnedPortfolioWeights(report),model=B.buildLegacyModel(history),seed=options.seed==null?((target*1301081+660066)>>>0):Number(options.seed)>>>0;
 const pool=B.randomValidPool(count,seed);
 const candidates=pool.map((p,index)=>{const c=B.legacyComponents(p.a,model),score=learned.weights.Heat*c.heat+learned.weights.Pair*c.pair+learned.weights.OddEven*c.odd+learned.weights.SmallBig*c.small+learned.weights.Sum*c.sum;return{ticket:p.a,score,source:"L",components:{...c,learningScore:score},tags:["L_LEARNED_WEIGHTS"],metadata:{candidateIndex:index,learningN:Number(report?.n)||0,weights:learned.weights,alpha:learned.alpha,seed}}});
 return{engineId:"L",engineVersion:"legacy-L-RC6-extracted-shadow-1",targetDrawId:target,cutoffDrawId:Number(history.at(-1).id),seed,weights:learned.weights,alpha:learned.alpha,mode:learned.mode,note:learned.note,candidates};
}
const API=Object.freeze({BASE,mean,safeCorr,verifiedLogs,maturity,learnedPortfolioWeights,challenger,generate});
root.PowerAIOneL=API;if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:this);
