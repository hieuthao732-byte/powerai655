const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync(__dirname+"/one-web-bridge.js","utf8");
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function element(){
 return {textContent:"",className:"",disabled:false,hidden:false,innerHTML:"",children:[],listeners:{},dataset:{},
  addEventListener(name,fn){this.listeners[name]=fn;},
  setAttribute(){},
  querySelector(){return null;},
  append(...items){this.children.push(...items);},
  replaceChildren(...items){this.children=[...items];}};
}
async function run(){
 const els={oneBuildBtn:element(),oneStatus:element(),oneTickets:element(),oneAudit:element(),oneSafeNote:element()};
 const store={};
 const localStorage={
  getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,
  setItem:(k,v)=>{store[k]=String(v);},
  removeItem:k=>{delete store[k];}
 };
 const windowListeners={};
 let engineCalls=0,buildRequest=null,user={id:"test-user"},historyReady=true;
 const runtime={registerProvider(){},buildPortfolio:async request=>{
  engineCalls++;
  buildRequest=request;
  return {portfolio:{targetDrawId:request.targetDrawId,cutoffDrawId:1,selectionHash:"TESTHASH",
   tickets:Array.from({length:20},(_,i)=>({main:[1,2,3,4,5,i+6]})),
   ranked:Array.from({length:20},()=>({sources:["A7","B1.3"]})),
   audit:{coverage:55,repeatedPairs:0,maxOverlap:4}}};
 }};
 const ctx={console,Promise,Math,Number,Array,String,Error,Date,setTimeout,setInterval,clearInterval,localStorage,
  addEventListener(name,fn){windowListeners[name]=fn;},
  requestAnimationFrame:fn=>setTimeout(fn,0),
  document:{readyState:"complete",getElementById:id=>els[id],createElement:()=>element()},
  draws:[{id:1,date:"2026-01-01",result:[1,2,3,4,5,6,7]}],latest:{id:1},targetId:2,
  historyReadyForTarget:()=>historyReady,
  PowerAIAuth:{getUser:()=>user},
  PowerAIDomain:{},PowerAIUnifiedSelector:{},PowerAIOnePipeline:{},
  PowerAIOneAdaptiveGovernor:{},PowerAIOneAfterDrawEvaluation:{},
  PowerAIOneAdaptiveShadowRunner:{},PowerAIOneChallengerGate:{},
  PowerAIOneRuntime:{create:()=>runtime},
  PowerAIOneA:{},PowerAIOneB:{},
  PowerAIOneAProvider:{register(){}},PowerAIOneBProvider:{register(){}}
 };
 ctx.window=ctx;
 vm.runInNewContext(source,ctx);

 // Initialization is asynchronous: the bridge polls until the main app has loaded history.
 assert.equal(els.oneStatus.textContent.includes("Lõi ONE đã nạp"),true);
 await wait(400);
 assert.equal(els.oneStatus.textContent.includes("ONE sẵn sàng"),true);

 // Building a fresh set targets the next undrawn period, uses A7 + B1.3, and neither locks nor saves.
 await els.oneBuildBtn.listeners.click();
 assert.equal(engineCalls,1);
 assert.equal(buildRequest.mode,"prospective");
 assert.equal(buildRequest.targetDrawId,2);
 assert.deepEqual([...buildRequest.providerIds],["A7","B1.3"]);
 assert.equal(els.oneTickets.children.length,20);
 assert.equal(els.oneStatus.textContent.includes("Đã tạo đủ 20 vé"),true);
 assert.equal(els.oneSafeNote.textContent.includes("Chưa khóa"),true);
 assert.equal(store.powerai_rc6_one_portfolios,undefined,"a preview must not be persisted");

 // A past/current draw must never be generated as a fresh ticket set: the bridge moves to the next target.
 ctx.targetId=1;
 await els.oneBuildBtn.listeners.click();
 assert.equal(engineCalls,2);
 assert.equal(buildRequest.targetDrawId,2);
 assert.equal(ctx.targetId,2);
 assert.equal(store.powerai_rc6_active_target,"2");

 // Without a signed-in user the engine must not run.
 user=null;
 await els.oneBuildBtn.listeners.click();
 assert.equal(engineCalls,2);
 assert.equal(els.oneStatus.textContent.includes("Cần đăng nhập"),true);

 // Missing historical readiness must block before calling the engine.
 user={id:"test-user"};historyReady=false;
 await els.oneBuildBtn.listeners.click();
 assert.equal(engineCalls,2);
 assert.equal(els.oneStatus.textContent.includes("chưa được xác nhận"),true);

 // Global error handlers must surface problems in the status line instead of failing silently.
 assert.equal(typeof windowListeners.error,"function");
 assert.equal(typeof windowListeners.unhandledrejection,"function");
 windowListeners.error({message:"boom"});
 assert.equal(els.oneStatus.textContent.includes("Lỗi JavaScript: boom"),true);
 windowListeners.unhandledrejection({reason:new Error("late")});
 assert.equal(els.oneStatus.textContent.includes("Lỗi tác vụ nền: late"),true);
 console.log("PowerAI ONE website bridge tests: PASS");
}
run().catch(error=>{console.error(error);process.exitCode=1;});
