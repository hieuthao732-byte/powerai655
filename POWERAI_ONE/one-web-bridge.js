/* PowerAI ONE website bridge — preview-only integration.
 * Does not replace legacy flows, persist state, lock tickets, or deploy anything.
 */
(function(root){
 "use strict";
 let runtime=null,busy=false;
 const $=id=>document.getElementById(id);
 function status(message,bad=false){const el=$("oneStatus");if(el){el.textContent=message;el.className=bad?"notice bad":"notice";}}
 function init(){
  const btn=$("oneBuildBtn");if(!btn)return;
  const required=["PowerAIDomain","PowerAIUnifiedSelector","PowerAIOnePipeline","PowerAIOneAdaptiveGovernor","PowerAIOneAfterDrawEvaluation","PowerAIOneAdaptiveShadowRunner","PowerAIOneChallengerGate","PowerAIOneRuntime","PowerAIOneA","PowerAIOneB","PowerAIOneAProvider","PowerAIOneBProvider"];
  const missing=required.filter(k=>!root[k]);
  if(missing.length){status("ONE chưa khởi tạo đủ thành phần: "+missing.join(", "),true);btn.disabled=true;return;}
  try{
   runtime=root.PowerAIOneRuntime.create({selectorModule:root.PowerAIUnifiedSelector});
   root.PowerAIOneAProvider.register(runtime,root.PowerAIOneA);
   root.PowerAIOneBProvider.register(runtime,root.PowerAIOneB,{candidateCount:6000});
  }catch(e){status("Không thể khởi tạo ONE: "+e.message,true);btn.disabled=true;return;}
  status("ONE đã sẵn sàng • A7 + B1.3 • 1 bộ chọn cuối cùng.");
  btn.addEventListener("click",build);
 }
 async function build(){
  if(busy)return;
  if(!runtime||typeof draws==="undefined"||!Array.isArray(draws)||!draws.length){status("Chưa có dữ liệu lịch sử hợp lệ.",true);return;}
  const auth=root.PowerAIAuth;
  if(!auth||!auth.getUser||!auth.getUser()){status("Cần đăng nhập để sử dụng chức năng tạo bộ vé.",true);return;}
  const target=Number(targetId);
  if(!Number.isInteger(target)||target<1){status("Chưa xác định được kỳ mục tiêu.",true);return;}
  busy=true;const btn=$("oneBuildBtn");btn.disabled=true;
  $("oneTickets").textContent="";
  status("ONE đang tạo ứng viên và tìm bộ 20 vé khả thi…");
  try{
   const latest=Math.max(...draws.map(d=>Number(d.id)||0));
   const mode=target<=latest?"retrospective":"prospective";
   const result=await runtime.buildPortfolio({
    targetDrawId:target,draws:draws,providerIds:["A7","B1.3"],mode,count:20,
    maxOverlap:4,candidateLimit:120,beamWidth:24,searchNodeBudget:200000,
    seed:(target*104729+130013)>>>0,scoreWeight:.7,diversityWeight:.3
   });
   const tickets=result.portfolio.tickets;
   const grid=$("oneTickets");grid.replaceChildren();
   tickets.forEach((ticket,index)=>{
    const card=document.createElement("div");card.className="ticketCard";
    const head=document.createElement("div");head.className="ticketHead";
    const label=document.createElement("b");label.textContent="ONE #"+String(index+1).padStart(2,"0");
    const source=document.createElement("small");source.textContent=(result.portfolio.ranked[index]?.sources||[result.portfolio.ranked[index]?.source||"ONE"]).join(" + ");
    head.append(label,source);
    const balls=document.createElement("div");balls.className="balls";
    ticket.main.forEach(n=>{const ball=document.createElement("span");ball.className="ball";ball.textContent=String(n).padStart(2,"0");balls.append(ball);});
    card.append(head,balls);grid.append(card);
   });
   const a=result.portfolio.audit;
   $("oneAudit").textContent="Mã bộ vé: "+result.portfolio.selectionHash+" • Kỳ mục tiêu: "+target+" • Dữ liệu đến kỳ: "+result.portfolio.cutoffDrawId+" • Độ phủ: "+a.coverage+"/55 • Trùng cặp: "+a.repeatedPairs+" • Chồng lặp tối đa: "+a.maxOverlap+" • Nguồn ứng viên: A7 + B1.3.";
   status("Đã tạo 20 vé ONE ở chế độ "+(mode==="prospective"?"trước kỳ quay":"hồi cứu")+". Đây là bản xem trước, chưa khóa và chưa lưu.");
  }catch(e){status("ONE chưa tạo được bộ vé: "+e.message,true);}
  finally{busy=false;btn.disabled=false;}
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})(window);
