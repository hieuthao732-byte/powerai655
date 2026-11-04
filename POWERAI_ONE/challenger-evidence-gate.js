/* PowerAI ONE — challenger evidence gate.
 * Produces a human-review recommendation only; never promotes or mutates a model.
 */
(function(root){
 "use strict";
 function binomialUpperTail(n,k){
  if(k<=0)return 1;
  if(k>n)return 0;
  const m=Math.min(k,n-k);
  let logChoose=0;
  for(let i=1;i<=m;i++)logChoose+=Math.log(n-m+i)-Math.log(i);
  let p=Math.exp(logChoose-n*Math.LN2);
  let sum=p;
  for(let j=k;j<n;j++){
   p*=((n-j)/(j+1));
   sum+=p;
  }
  return Math.min(1,sum);
 }
 function evaluate(records,options={}){
  const minPairs=Number(options.minPairs??200);
  const blockCount=Number(options.blockCount??4);
  const alpha=Number(options.alpha??0.05);
  const minLift=Number(options.minLift??0.02);
  const maxAtLeast4Regression=Number(options.maxAtLeast4Regression??0.02);
  const maxSpecialRegression=Number(options.maxSpecialRegression??0.05);
  if(!Number.isInteger(minPairs)||minPairs<40)throw new Error("INVALID_MIN_PAIRS");
  if(!Number.isInteger(blockCount)||blockCount<2)throw new Error("INVALID_BLOCK_COUNT");
  if(!(alpha>0&&alpha<1)||minLift<0||maxAtLeast4Regression<0||maxSpecialRegression<0)throw new Error("INVALID_GATE_OPTIONS");
  if(!Array.isArray(records)||records.length<minPairs)return {decision:"KEEP_SHADOW",eligible:false,reason:"INSUFFICIENT_PAIRED_DRAWS",sampleSize:Array.isArray(records)?records.length:0,minimum:minPairs,automaticPromotion:false};
  const rows=records.slice().sort((a,b)=>Number(a.targetDrawId)-Number(b.targetDrawId));
  const seen=new Set();
  for(let i=0;i<rows.length;i++){
   const r=rows[i],id=Number(r?.targetDrawId);
   if(!Number.isInteger(id)||id<1||seen.has(id))throw new Error("INVALID_OR_DUPLICATE_DRAW_ID");
   if(i&&id!==Number(rows[i-1].targetDrawId)+1)throw new Error("NON_CONSECUTIVE_DRAWS");
   seen.add(id);
   if(r.source!=="official"||r.verified!==true)throw new Error("UNVERIFIED_EVALUATION_ROW");
   if(!Number.isInteger(r.activeMaxMainHits)||r.activeMaxMainHits<0||r.activeMaxMainHits>6||!Number.isInteger(r.challengerMaxMainHits)||r.challengerMaxMainHits<0||r.challengerMaxMainHits>6)throw new Error("INVALID_MAIN_HIT_COUNTS");
   if(typeof r.activeSpecialHit!=="boolean"||typeof r.challengerSpecialHit!=="boolean")throw new Error("INVALID_SPECIAL_HIT_FLAGS");
  }
  const blocks=Array.from({length:blockCount},()=>[]);
  rows.forEach((r,i)=>blocks[Math.min(blockCount-1,Math.floor(i*blockCount/rows.length))].push(r));
  if(blocks.some(b=>b.length<Math.floor(minPairs/blockCount)))return {decision:"KEEP_SHADOW",eligible:false,reason:"INSUFFICIENT_BLOCK_SIZE",sampleSize:rows.length,automaticPromotion:false};
  const summarize=list=>{
   const n=list.length;
   const a3=list.filter(r=>r.activeMaxMainHits>=3).length,c3=list.filter(r=>r.challengerMaxMainHits>=3).length;
   const a4=list.filter(r=>r.activeMaxMainHits>=4).length,c4=list.filter(r=>r.challengerMaxMainHits>=4).length;
   const as=list.filter(r=>r.activeSpecialHit).length,cs=list.filter(r=>r.challengerSpecialHit).length;
   const wins=list.filter(r=>r.challengerMaxMainHits>=3&&r.activeMaxMainHits<3).length;
   const losses=list.filter(r=>r.activeMaxMainHits>=3&&r.challengerMaxMainHits<3).length;
   return {n,active3:a3/n,challenger3:c3/n,lift3:(c3-a3)/n,active4:a4/n,challenger4:c4/n,lift4:(c4-a4)/n,activeSpecial:as/n,challengerSpecial:cs/n,specialLift:(cs-as)/n,wins,losses};
  };
  const overall=summarize(rows),blockResults=blocks.map(summarize),discordant=overall.wins+overall.losses;
  const pValue=binomialUpperTail(discordant,overall.wins);
  const stableBlocks=blockResults.filter(b=>b.lift3>=0).length;
  const noSevereBlockRegression=blockResults.every(b=>b.lift3>=-0.05);
  const checks={
   minimumSample:rows.length>=minPairs,
   minimumLift:overall.lift3>=minLift,
   pairedSignificance:discordant>0&&pValue<=alpha,
   temporalStability:stableBlocks>=blockCount-1&&noSevereBlockRegression,
   atLeast4Guard:overall.lift4>=-maxAtLeast4Regression,
   specialGuard:overall.specialLift>=-maxSpecialRegression
  };
  const eligible=Object.values(checks).every(Boolean);
  return {
   reportType:"POWERAI_ONE_CHALLENGER_EVIDENCE_GATE",decision:eligible?"RECOMMEND_HUMAN_REVIEW":"KEEP_SHADOW",
   eligible,automaticPromotion:false,activeModelMutated:false,policy:"SHADOW_ONLY_HUMAN_APPROVAL_REQUIRED",
   sampleSize:rows.length,minimum:minPairs,alpha,minLift,overall,discordantPairs:discordant,exactOneSidedMcNemarP:pValue,
   blockResults,stableBlocks,checks,
   limitations:["Requires official verified prospective draws","Statistical evidence is not a guarantee of future performance","Special-number hits are evaluated separately from six main numbers"]
  };
 }
 const API=Object.freeze({evaluate,binomialUpperTail});
 root.PowerAIOneChallengerGate=API;
 if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:this);
