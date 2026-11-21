/* PowerAI ONE browser bridge v1.6 — auto-align prospective target. */
(function(root){
 "use strict";
 root.__POWERAI_ONE_BRIDGE_LOADED=true;
 var runtime=null,busy=false,initialized=false;
 function el(id){return document.getElementById(id);}
 function say(message,bad){var n=el("oneStatus");if(n){n.textContent=message;n.className=bad?"one-status-message bad":"one-status-message";}}
 function drawLabel(id){return "#"+String(Number(id)||0).padStart(5,"0");}
 function readHistory(){
  try{
   if(typeof draws==="undefined"||!Array.isArray(draws)||!draws.length||typeof latest==="undefined"||!latest)return false;
   var target=Number(targetId)||Number(latest.id)+1;
   var hist=draws.filter(function(d){return Number(d.id)<target;}).sort(function(a,b){return Number(a.id)-Number(b.id);});
   var recent=hist.slice(-30),freq=Array(56).fill(0),sums=[];
   recent.forEach(function(d){var a=(d.result||[]).map(Number).filter(function(n){return n>=1&&n<=55;}).slice(0,6);a.forEach(function(n){freq[n]++;});if(a.length===6)sums.push(a.reduce(function(x,y){return x+y;},0));});
   var ordered=Array.from({length:55},function(_,i){return i+1;}).sort(function(a,b){return freq[b]-freq[a]||a-b;});
   if(el("oneHistoryCount"))el("oneHistoryCount").textContent=String(hist.length);
   if(el("oneHistoryCutoff"))el("oneHistoryCutoff").textContent=hist.length?drawLabel(hist[hist.length-1].id):"—";
   if(el("oneHistoryMeta"))el("oneHistoryMeta").textContent="Kỳ mới nhất "+drawLabel(latest.id)+" · mục tiêu "+drawLabel(target)+" · chỉ sử dụng kỳ trước mục tiêu.";
   if(el("targetIdOne"))el("targetIdOne").textContent=drawLabel(target);
   if(el("oneHistoryAnalysis")){
    var hot=ordered.slice(0,6).map(function(n){return String(n).padStart(2,"0")+" ("+freq[n]+")";}).join(" · ");
    var cold=ordered.slice(-6).reverse().map(function(n){return String(n).padStart(2,"0")+" ("+freq[n]+")";}).join(" · ");
    var avg=sums.length?(sums.reduce(function(a,b){return a+b;},0)/sums.length).toFixed(1):"—";
    el("oneHistoryAnalysis").innerHTML='<div><small>30 KỲ GẦN NHẤT · XUẤT HIỆN NHIỀU</small><b>'+hot+'</b></div><div><small>30 KỲ GẦN NHẤT · XUẤT HIỆN ÍT</small><b>'+cold+'</b></div><div><small>TỔNG TRUNG BÌNH 6 SỐ</small><b>'+avg+'</b></div>';
   }
   if(el("oneRecentDraws")){
    el("oneRecentDraws").innerHTML='<div class="one-recent-title">5 KỲ GẦN NHẤT TRƯỚC KỲ MỤC TIÊU</div>'+hist.slice(-5).reverse().map(function(d){
     var balls=(d.result||[]).slice(0,6).map(function(n){return '<i>'+String(n).padStart(2,"0")+'</i>';}).join("");
     return '<div class="one-draw-row"><b>'+drawLabel(d.id)+'</b><span>'+balls+'</span><small>'+String(d.date||"")+'</small></div>';
    }).join("");
   }
   return true;
  }catch(e){say("Lỗi phân tích lịch sử: "+e.message,true);return false;}
 }
 function initialize(){
  if(initialized)return;initialized=true;
  var btn=el("oneBuildBtn");
  if(!btn){say("Không tìm thấy nút tạo vé ONE.",true);return;}
  var required=["PowerAIDomain","PowerAIUnifiedSelector","PowerAIOnePipeline","PowerAIOneAdaptiveGovernor","PowerAIOneAfterDrawEvaluation","PowerAIOneAdaptiveShadowRunner","PowerAIOneChallengerGate","PowerAIOneRuntime","PowerAIOneA","PowerAIOneB","PowerAIOneAProvider","PowerAIOneBProvider"];
  var missing=required.filter(function(k){return !root[k];});
  if(missing.length){say("ONE thiếu thành phần: "+missing.join(", "),true);btn.disabled=true;return;}
  try{
   runtime=root.PowerAIOneRuntime.create({selectorModule:root.PowerAIUnifiedSelector});
   root.PowerAIOneAProvider.register(runtime,root.PowerAIOneA);
   root.PowerAIOneBProvider.register(runtime,root.PowerAIOneB,{candidateCount:6000});
  }catch(e){say("Khởi tạo ONE lỗi: "+e.message,true);btn.disabled=true;return;}
  btn.disabled=false;
  if(!btn.dataset.oneBound){btn.addEventListener("click",build);btn.dataset.oneBound="1";}
  say("Lõi ONE đã nạp. Đang chờ lịch sử và kỳ mục tiêu…");
  var start=Date.now(),poll=setInterval(function(){
   if(readHistory()){clearInterval(poll);say("Đã nạp "+draws.length+" kỳ lịch sử · A7/B1.3 sẵn sàng · ONE có thể tạo bộ 20 vé.");}
   else if(Date.now()-start>20000){clearInterval(poll);say("Chưa nhận được lịch sử từ ứng dụng chính. Kiểm tra nguồn dữ liệu.",true);}
  },250);
  var target=el("targetId");
  if(target&&root.MutationObserver)new root.MutationObserver(function(){readHistory();}).observe(target,{childList:true,subtree:true,characterData:true});
 }
 async function build(){
  if(busy||!runtime)return;
  busy=true;var btn=el("oneBuildBtn");if(btn)btn.disabled=true;
  try{
   say("Đang xác nhận lịch sử và kỳ mục tiêu…");
   var start=Date.now();
   while((typeof draws==="undefined"||!Array.isArray(draws)||!draws.length||typeof latest==="undefined"||!latest||!Number(targetId))&&Date.now()-start<15000)await new Promise(function(r){setTimeout(r,150);});
   if(typeof draws==="undefined"||!Array.isArray(draws)||!draws.length||!latest)throw new Error("HISTORY_NOT_READY");
   readHistory();
   if(!root.PowerAIAuth||typeof root.PowerAIAuth.getUser!=="function"||!root.PowerAIAuth.getUser())throw new Error("Cần đăng nhập để tạo vé.");
   var latestId=Math.max.apply(null,draws.map(function(d){return Number(d.id)||0;}));
   var target=typeof nextProspectiveTarget==="function"?Number(nextProspectiveTarget()):latestId+1;
   if(!Number.isInteger(target)||target<=latestId)target=latestId+1;
   // ONE is prospective-only: always move a stale/past selection to the next unplayed draw.
   if(Number(targetId)!==target){
    targetId=target;
    try{localStorage.setItem("powerai_rc6_active_target",String(target));}catch(_){}
    if(el("targetId"))el("targetId").textContent=drawLabel(target);
    if(typeof renderTargetSelect==="function")renderTargetSelect();
    if(typeof renderTargetContexts==="function")renderTargetContexts();
    if(typeof renderState==="function")renderState();
    readHistory();
   }
   if(typeof historyReadyForTarget!=="function"||!historyReadyForTarget(target))throw new Error("Dữ liệu kỳ trước chưa được xác nhận.");
   el("oneTickets").replaceChildren();el("oneAudit").textContent="";
   say("A7 và B1.3 đang phân tích lịch sử, sinh ứng viên và chọn 20 vé…");
   await new Promise(function(r){requestAnimationFrame(function(){setTimeout(r,30);});});
   var result=await runtime.buildPortfolio({targetDrawId:target,draws:draws,providerIds:["A7","B1.3"],mode:"prospective",count:20,maxOverlap:4,candidateLimit:120,beamWidth:24,searchNodeBudget:200000,seed:(target*104729+130013)>>>0,scoreWeight:.7,diversityWeight:.3});
   var p=result&&result.portfolio;
   if(!p||!Array.isArray(p.tickets)||p.tickets.length!==20)throw new Error("ONE không trả về đủ 20 vé.");
   if(Number(p.targetDrawId)!==target||Number(p.cutoffDrawId)>=target)throw new Error("Sai kỳ mục tiêu hoặc cutoff.");
   var grid=el("oneTickets");grid.replaceChildren();
   p.tickets.forEach(function(ticket,i){
    var card=document.createElement("div");card.className="ticketCard";
    var head=document.createElement("div");head.className="ticketHead";
    var label=document.createElement("b");label.textContent="ONE #"+String(i+1).padStart(2,"0");
    var source=document.createElement("small");source.textContent=(p.ranked&&p.ranked[i]&&p.ranked[i].sources||["A7/B1.3"]).join(" + ");
    head.append(label,source);
    var balls=document.createElement("div");balls.className="balls";
    ticket.main.forEach(function(n){var ball=document.createElement("span");ball.className="ball";ball.textContent=String(n).padStart(2,"0");balls.append(ball);});
    card.append(head,balls);grid.append(card);
   });
   if(el("oneTicketCount"))el("oneTicketCount").textContent="20";
   var a=p.audit||{};el("oneAudit").textContent="Mã bộ vé: "+p.selectionHash+" · Kỳ: "+drawLabel(target)+" · Dữ liệu đến: "+drawLabel(p.cutoffDrawId)+" · Độ phủ: "+a.coverage+"/55 · Cặp lặp: "+a.repeatedPairs+" · Chồng lặp tối đa: "+a.maxOverlap+".";
   say("Đã tạo đủ 20 vé ONE cho "+drawLabel(target)+". Bản xem trước, chưa khóa và chưa lưu cloud.");
  }catch(e){if(el("oneTickets"))el("oneTickets").replaceChildren();say("Chưa tạo được vé: "+String(e&&e.message||e),true);}
  finally{busy=false;if(btn)btn.disabled=false;}
 }
 root.addEventListener("error",function(e){say("Lỗi JavaScript: "+String(e.message||"không rõ"),true);});
 root.addEventListener("unhandledrejection",function(e){say("Lỗi tác vụ nền: "+String(e.reason&&e.reason.message||e.reason),true);});
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize,{once:true});else initialize();
})(window);
