const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync(__dirname+"/one-web-bridge.js","utf8");
function element(){
 return {textContent:"",className:"",disabled:false,children:[],listeners:{},
  addEventListener(name,fn){this.listeners[name]=fn;},
  append(...items){this.children.push(...items);},
  replaceChildren(...items){this.children=[...items];}};
}
async function run(){
 const els={oneBuildBtn:element(),oneStatus:element(),oneTickets:element(),oneAudit:element()};
 let buildRequest=null;
 const runtime={registerProvider(){},buildPortfolio:async request=>{
  buildRequest=request;
  return {portfolio:{targetDrawId:request.targetDrawId,cutoffDrawId:1,selectionHash:"TESTHASH",
   tickets:Array.from({length:20},(_,i)=>({main:[1,2,3,4,5,i+6]})),
   ranked:Array.from({length:20},()=>({sources:["A7","B1.3"]})),
   audit:{coverage:55,repeatedPairs:0,maxOverlap:4}}};
 }};
 const ctx={console,Promise,Math,Number,Array,String,Error,
  document:{readyState:"complete",getElementById:id=>els[id],createElement:()=>element()},
  draws:[{id:1,result:[1,2,3,4,5,6,7]}],targetId:2,
  historyReadyForTarget:()=>true,
  PowerAIAuth:{getUser:()=>({id:"test-user"})},
  PowerAIDomain:{},PowerAIUnifiedSelector:{},PowerAIOnePipeline:{},
  PowerAIOneAdaptiveGovernor:{},PowerAIOneAfterDrawEvaluation:{},
  PowerAIOneAdaptiveShadowRunner:{},PowerAIOneChallengerGate:{},
  PowerAIOneRuntime:{create:()=>runtime},
  PowerAIOneA:{},PowerAIOneB:{},
  PowerAIOneAProvider:{register(){}},PowerAIOneBProvider:{register(){}}
 };
 ctx.window=ctx;
 vm.runInNewContext(source,ctx);
 assert.equal(els.oneStatus.textContent.includes("đã sẵn sàng"),true);
 await els.oneBuildBtn.listeners.click();
 assert.equal(buildRequest.mode,"prospective");
 assert.deepEqual([...buildRequest.providerIds],["A7","B1.3"]);
 assert.equal(els.oneTickets.children.length,20);
 assert.equal(els.oneStatus.textContent.includes("chưa khóa và chưa lưu"),true);
 // A past/current draw must never be generated as a fresh ticket set.
 ctx.targetId=1;
 await els.oneBuildBtn.listeners.click();
 assert.equal(els.oneStatus.textContent.includes("không được tạo vé mới"),true);
 // Missing historical readiness must block before calling the engine.
 ctx.targetId=2;ctx.historyReadyForTarget=()=>false;
 await els.oneBuildBtn.listeners.click();
 assert.equal(els.oneStatus.textContent.includes("tạm dừng"),true);
 console.log("PowerAI ONE website bridge tests: PASS");
}
run().catch(error=>{console.error(error);process.exitCode=1;});
