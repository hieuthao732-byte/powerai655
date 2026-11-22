/* PowerAI ONE browser bridge v2.0 — portfolio lock, archive, reverse analytics and controlled learning. */
(function(root){
 "use strict";
 root.__POWERAI_ONE_BRIDGE_LOADED=true;
 var runtime=null,busy=false,initialized=false,currentPortfolio=null;
 var STORE_KEY="powerai_rc6_one_portfolios";
 function el(id){return document.getElementById(id);}
 function say(message,bad){var n=el("oneStatus");if(n){n.textContent=message;n.className=bad?"one-status-message bad":"one-status-message";}}
 function drawLabel(id){return "#"+String(Number(id)||0).padStart(5,"0");}
 function readStore(){try{var x=JSON.parse(localStorage.getItem(STORE_KEY)||"{}");if(!x||typeof x!=="object"||Array.isArray(x))x={};if(!x.portfolios||typeof x.portfolios!=="object"||Array.isArray(x.portfolios))x.portfolios={};if(!Array.isArray(x.evaluations))x.evaluations=[];if(!Array.isArray(x.unlockLog))x.unlockLog=[];return x;}catch(_){return {portfolios:{},evaluations:[],unlockLog:[]};}}
 function writeStore(s){localStorage.setItem(STORE_KEY,JSON.stringify(s));try{if(typeof cloudSyncSoon==="function")cloudSyncSoon();}catch(e){console.warn("ONE cloud sync queue unavailable",e);}}
 function targetKey(id){return String(Number(id));}
 function getLocked(id){var s=readStore();return s.portfolios[targetKey(id)]||null;}
 function getActual(id){try{return (draws||[]).find(function(d){return Number(d.id)===Number(id);})||null;}catch(_){return null;}}
 function getMain(d){return (d&&(d.result||d.main)||[]).map(Number).filter(function(n){return n>=1&&n<=55;}).slice(0,6);}
 function ensureWorkspace(){
  if(el("oneWorkspace"))return;
  var host=el("onePanel"),anchor=host&&host.querySelector(".one-audit-panel");if(!host||!anchor)return;
  var wrap=document.createElement("section");wrap.id="oneWorkspace";wrap.className="one-workspace";
  wrap.innerHTML='<div class="one-workspace-head"><div><span class="one-kicker">PORTFOLIO CONTROL CENTER</span><h3>Quản lý bộ vé ONE</h3><p>Khóa vé, lưu lịch sử, đánh giá kết quả và theo dõi quá trình học có kiểm định.</p></div><div class="one-lock-state" id="oneLockState">CHƯA KHÓA</div></div><div class="one-workspace-actions"><button type="button" id="oneLockBtn" disabled>🔒 KHÓA 20 BỘ VÉ</button><button type="button" id="oneUnlockBtn" disabled>Mở khóa trước kỳ quay</button><button type="button" id="oneExportBtn">Xuất dữ liệu</button></div><div class="one-workspace-grid"><article><small>VÉ ĐÃ KHÓA</small><b id="oneLockedCount">0</b><span>Danh mục được lưu theo kỳ</span></article><article><small>KỲ ĐÃ ĐỐI CHIẾU</small><b id="oneEvaluatedCount">0</b><span>Kết quả được ghi nhận</span></article><article><small>THÀNH TÍCH CAO NHẤT</small><b id="oneBestHit">—</b><span>Số chính trùng nhiều nhất</span></article><article><small>CHUỖI KỲ DƯỚI 3 HIT</small><b id="oneMissStreak">0</b><span>Kích hoạt rà soát khi đạt 10</span></article></div><div class="one-workspace-columns"><section class="one-subpanel"><h4>Hồ sơ phân tích ngược</h4><p id="oneReverseMeta">Đang tính trên dữ liệu lịch sử…</p><div id="oneReverseStats"></div></section><section class="one-subpanel"><h4>Learning & Challenger</h4><p id="oneLearningStatus">Chưa có đủ kỳ đã khóa và đối chiếu.</p><div id="oneLearningLog"></div></section></div><section class="one-subpanel"><div class="one-subhead"><div><h4>Lịch sử bộ vé đã khóa</h4><p>Không ghi đè bộ vé cũ khi tạo kỳ mới.</p></div></div><div id="onePortfolioArchive" class="one-archive">Chưa có bộ vé nào được khóa.</div></section><section class="one-subpanel"><h4>Đánh giá sau quay</h4><p id="oneEvaluationNote">Kết quả sẽ được đối chiếu khi có dữ liệu kỳ tương ứng. Dữ liệu mirror chỉ được đánh dấu tham khảo, không tự nhận là nguồn chính thức.</p><div id="oneEvaluationList" class="one-archive"></div></section><div class="one-integrity-note">Nguyên tắc: vé đã khóa không bị thay đổi bởi lần tạo vé mới hoặc cập nhật thuật toán. Challenger chỉ được đề xuất sau kiểm định; không tự động thay mô hình chính. Dữ liệu thống kê quá khứ không đảm bảo dự đoán kết quả tương lai.</div></section>';
  anchor.insertAdjacentElement("afterend",wrap);
  el("oneLockBtn").addEventListener("click",lockCurrent);
  el("oneUnlockBtn").addEventListener("click",unlockCurrent);
  el("oneExportBtn").addEventListener("click",exportData);
 }
 function renderTickets(tickets,hash,target,locked){
  var grid=el("oneTickets");if(!grid)return;grid.replaceChildren();
  (tickets||[]).forEach(function(ticket,i){
   var main=Array.isArray(ticket.main)?ticket.main:ticket;
   var card=document.createElement("div");card.className="ticketCard";
   var head=document.createElement("div");head.className="ticketHead";
   var label=document.createElement("b");label.textContent="ONE #"+String(i+1).padStart(2,"0");
   var source=document.createElement("small");source.textContent=locked?"ĐÃ KHÓA · "+drawLabel(target):"BẢN XEM TRƯỚC";
   head.append(label,source);var balls=document.createElement("div");balls.className="balls";
   main.forEach(function(n){var b=document.createElement("span");b.className="ball";b.textContent=String(n).padStart(2,"0");balls.append(b);});
   var info=document.createElement("button");info.type="button";info.className="one-ticket-info";info.textContent="i";info.setAttribute("aria-expanded","false");info.setAttribute("aria-label","Xem lý do AI chọn vé "+(i+1));
   var detail=document.createElement("div");detail.className="one-ticket-reason";detail.hidden=true;
   var targetHistory=(typeof draws!=="undefined"&&Array.isArray(draws))?draws.filter(function(d){return Number(d.id)<Number(target);}).sort(function(a,b){return Number(a.id)-Number(b.id);}):[];
   var recentHistory=targetHistory.slice(-30),freq=Array(56).fill(0),pairCounts={};
   recentHistory.forEach(function(d){getMain(d).forEach(function(n){freq[n]++;});});
   targetHistory.forEach(function(d){var a=getMain(d);for(var x=0;x<a.length;x++)for(var y=x+1;y<a.length;y++){var k=[a[x],a[y]].sort(function(m,n){return m-n;}).join("-");pairCounts[k]=(pairCounts[k]||0)+1;}});
   var nums=main.map(Number),sum=nums.reduce(function(a,b){return a+b;},0),odd=nums.filter(function(n){return n%2;}).length,low=nums.filter(function(n){return n<=27;}).length;
   var overlaps=(tickets||[]).filter(function(other,j){return j!==i;}).map(function(other){var om=Array.isArray(other.main)?other.main:other;return nums.filter(function(n){return om.map(Number).indexOf(n)>=0;}).length;});
   var maxOverlap=overlaps.length?Math.max.apply(null,overlaps):0;
   var ranked=nums.map(function(n){return {n:n,f:freq[n]};}).sort(function(a,b){return b.f-a.f;});
   var pairs=[];for(var pi=0;pi<nums.length;pi++)for(var pj=pi+1;pj<nums.length;pj++){var pk=[nums[pi],nums[pj]].sort(function(a,b){return a-b;}).join("-");if(pairCounts[pk])pairs.push({key:pk,count:pairCounts[pk]});}
   pairs.sort(function(a,b){return b.count-a.count;});
   detail.innerHTML='<div class="one-reason-title">Vì sao ONE chọn vé này?</div><div><b>Cấu trúc vé:</b> Tổng '+sum+' · '+odd+' lẻ / '+(6-odd)+' chẵn · '+low+' số từ 01–27 / '+(6-low)+' số từ 28–55.</div><div><b>Tần suất 30 kỳ gần nhất:</b> '+ranked.map(function(x){return String(x.n).padStart(2,"0")+" ("+x.f+" lần)";}).join(" · ")+'.</div><div><b>Liên kết lịch sử:</b> '+(pairs.length?pairs.slice(0,4).map(function(x){return x.key+" ("+x.count+" lần)";}).join(" · "):"Không có cặp nào trong vé xuất hiện cùng nhau ở dữ liệu đã nạp.")+'</div><div><b>Độ đa dạng:</b> Trùng tối đa '+maxOverlap+' số với một vé khác trong bộ 20 vé.</div><small>Các số liệu trên mô tả dữ liệu trước kỳ mục tiêu và cấu trúc danh mục; không chứng minh các số có xác suất trúng cao hơn.</small>';
   info.addEventListener("click",function(){detail.hidden=!detail.hidden;info.setAttribute("aria-expanded",String(!detail.hidden));});
   head.append(info);card.append(head,balls,detail);grid.append(card);
  });
  if(el("oneTicketCount"))el("oneTicketCount").textContent=String((tickets||[]).length);
 }
 function readHistory(){
  try{
   if(typeof draws==="undefined"||!Array.isArray(draws)||!draws.length||typeof latest==="undefined"||!latest)return false;
   var target=Number(targetId)||Number(latest.id)+1,hist=draws.filter(function(d){return Number(d.id)<target;}).sort(function(a,b){return Number(a.id)-Number(b.id);});
   var recent=hist.slice(-30),freq=Array(56).fill(0),allFreq=Array(56).fill(0),sums=[],oddEven={},pairs={};
   recent.forEach(function(d){var a=getMain(d);a.forEach(function(n){freq[n]++;});if(a.length===6)sums.push(a.reduce(function(x,y){return x+y;},0));});
   hist.forEach(function(d){var a=getMain(d);a.forEach(function(n){allFreq[n]++;});for(var i=0;i<a.length;i++)for(var j=i+1;j<a.length;j++){var k=a[i]+"-"+a[j];pairs[k]=(pairs[k]||0)+1;}if(a.length===6){var odd=a.filter(function(n){return n%2;}).length,key=odd+":"+ (6-odd);oddEven[key]=(oddEven[key]||0)+1;}});
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
   if(el("oneRecentDraws"))el("oneRecentDraws").innerHTML='<div class="one-recent-title">5 KỲ GẦN NHẤT TRƯỚC KỲ MỤC TIÊU</div>'+hist.slice(-5).reverse().map(function(d){return '<div class="one-draw-row"><b>'+drawLabel(d.id)+'</b><span>'+getMain(d).map(function(n){return '<i>'+String(n).padStart(2,"0")+'</i>';}).join("")+'</span><small>'+String(d.date||"")+'</small></div>';}).join("");
   var allOrder=Array.from({length:55},function(_,i){return i+1;}).sort(function(a,b){return allFreq[b]-allFreq[a]||a-b;}),topPairs=Object.keys(pairs).sort(function(a,b){return pairs[b]-pairs[a]||a.localeCompare(b);}).slice(0,5);
   if(el("oneReverseMeta"))el("oneReverseMeta").textContent="Phân tích ngược "+hist.length+" kỳ · dữ liệu đến "+(hist.length?drawLabel(hist[hist.length-1].id):"—")+" · mô tả lịch sử, không phải quy luật dự báo.";
   if(el("oneReverseStats"))el("oneReverseStats").innerHTML='<div><small>TẦN SUẤT CAO TOÀN BỘ</small><b>'+allOrder.slice(0,6).map(function(n){return String(n).padStart(2,"0")+" ("+allFreq[n]+")";}).join(" · ")+'</b></div><div><small>TẦN SUẤT THẤP TOÀN BỘ</small><b>'+allOrder.slice(-6).reverse().map(function(n){return String(n).padStart(2,"0")+" ("+allFreq[n]+")";}).join(" · ")+'</b></div><div><small>CẶP ĐỒNG XUẤT HIỆN NHIỀU</small><b>'+topPairs.map(function(k){return k+" ("+pairs[k]+")";}).join(" · ")+'</b></div><div><small>PHÂN BỐ LẺ:CHẴN</small><b>'+Object.keys(oddEven).sort().map(function(k){return k.replace(":","/")+" ("+oddEven[k]+")";}).join(" · ")+'</b></div>';
   return true;
  }catch(e){say("Lỗi phân tích lịch sử: "+e.message,true);return false;}
 }
 function refreshWorkspace(){
  ensureWorkspace();var s=readStore(),ids=Object.keys(s.portfolios||{}).sort(function(a,b){return Number(b)-Number(a);}),evals=s.evaluations||[];
  if(el("oneLockedCount"))el("oneLockedCount").textContent=String(ids.length);
  if(el("oneEvaluatedCount"))el("oneEvaluatedCount").textContent=String(evals.length);
  var best=evals.reduce(function(m,r){return Math.max(m,Number(r.maxMainHits)||0);},0);
  if(el("oneBestHit"))el("oneBestHit").textContent=evals.length?best+"/6":"—";
  var streak=0;for(var i=evals.length-1;i>=0;i--){if(Number(evals[i].maxMainHits)<3)streak++;else break;}
  if(el("oneMissStreak"))el("oneMissStreak").textContent=String(streak);
  if(el("oneLearningStatus"))el("oneLearningStatus").textContent=evals.length+" kỳ đã đối chiếu · "+ids.length+" bộ vé khóa. Learning hiện ở chế độ quan sát/đề xuất; không tự thay trọng số hoặc mô hình chính.";
  if(el("oneLearningLog"))el("oneLearningLog").textContent=streak>=10?"Đã đạt ngưỡng 10 kỳ liên tiếp dưới 3 hit: cần chạy rà soát Challenger và kiểm định độc lập trước khi cân nhắc thay đổi.":"Ngưỡng rà soát: 10 kỳ liên tiếp không có vé đạt 3 số chính. Hiện tại: "+streak+"/10.";
  if(el("onePortfolioArchive"))el("onePortfolioArchive").innerHTML=ids.length?ids.map(function(id){var p=s.portfolios[id];return '<div class="one-archive-row"><b>'+drawLabel(id)+'</b><span>'+((p.tickets||[]).length)+' vé · '+String(p.selectionHash||"").slice(0,12)+'</span><strong>ĐÃ KHÓA</strong></div>';}).join(""):"Chưa có bộ vé nào được khóa.";
  if(el("oneEvaluationList"))el("oneEvaluationList").innerHTML=evals.length?evals.slice().reverse().map(function(r){return '<div class="one-archive-row"><b>'+drawLabel(r.targetDrawId)+'</b><span>Max '+r.maxMainHits+'/6 · '+r.ticketsAt3+' vé đạt 3+ · Power: '+(r.specialHits||0)+' · random kỳ vọng '+Number(r.randomExpectedTicketsAt3||0).toFixed(2)+' vé 3+</span><strong>'+ (r.sourceVerified?"ĐÃ XÁC MINH":"MIRROR")+'</strong></div>';}).join(""):"Chưa có kỳ nào được đối chiếu.";
  var active=Number(targetId)||0,locked=active?getLocked(active):null;
  if(el("oneLockState"))el("oneLockState").textContent=locked?"ĐÃ KHÓA "+drawLabel(active):"CHƯA KHÓA";
  if(el("oneLockBtn")){el("oneLockBtn").disabled=!currentPortfolio||!!locked;el("oneLockBtn").textContent=locked?"✓ BỘ VÉ ĐÃ KHÓA":"🔒 KHÓA 20 BỘ VÉ";}
  if(el("oneUnlockBtn"))el("oneUnlockBtn").disabled=!locked||!!getActual(active);
 }
 function lockCurrent(){
  if(!currentPortfolio)return say("Hãy tạo đủ 20 vé trước khi khóa.",true);
  var p=currentPortfolio,target=Number(p.targetDrawId),latestId=Number(latest&&latest.id)||0;if(target!==Number(targetId))return say("Bộ vé đang hiển thị không thuộc kỳ mục tiêu hiện tại. Hãy tạo lại trước khi khóa.",true);
  if(!root.PowerAIAuth||!root.PowerAIAuth.getUser||!root.PowerAIAuth.getUser())return say("Cần đăng nhập để khóa và đồng bộ bộ vé.",true);
  if(!Number.isInteger(target)||target<=latestId)return say("Không thể khóa vé cho kỳ đã quay.",true);
  if(getLocked(target))return say("Kỳ này đã có bộ vé khóa. Không được ghi đè.",true);
  if(!confirm("Khóa cố định 20 vé cho kỳ "+drawLabel(target)+"? Sau khi khóa, vé sẽ không thể tạo lại hoặc ghi đè."))return;
  var s=readStore();s.portfolios=s.portfolios||{};s.portfolios[targetKey(target)]={targetDrawId:target,tickets:p.tickets.map(function(t){return {main:t.main.slice()};}),selectionHash:p.selectionHash,cutoffDrawId:p.cutoffDrawId,generatedAt:p.generatedAt||new Date().toISOString(),lockedAt:new Date().toISOString(),model:"A7+B1.3 → ONE",audit:p.audit||{},immutable:true};
  writeStore(s);currentPortfolio=s.portfolios[targetKey(target)];renderTickets(currentPortfolio.tickets,currentPortfolio.selectionHash,target,true);if(el("oneSafeNote"))el("oneSafeNote").textContent="🔒 Bộ vé đã khóa và đưa vào lưu trữ Cloud.";
  if(el("oneAudit"))el("oneAudit").textContent="Bộ vé đã khóa · "+drawLabel(target)+" · mã "+currentPortfolio.selectionHash+" · dữ liệu đến "+drawLabel(currentPortfolio.cutoffDrawId)+".";
  say("Đã khóa cố định 20 vé cho "+drawLabel(target)+" và đưa vào hàng đợi đồng bộ Cloud.");refreshWorkspace();
 }
 function unlockCurrent(){
  var target=Number(targetId),s=readStore(),p=s.portfolios&&s.portfolios[targetKey(target)];
  if(!p||getActual(target)||(Number(latest&&latest.id)||0)>=target)return say("Không thể mở khóa: không có bộ vé hoặc kỳ đã quay/đã có dữ liệu kết quả.",true);
  if(!confirm("Mở khóa bộ vé "+drawLabel(target)+"? Thao tác này sẽ ghi lại lịch sử mở khóa."))return;
  delete s.portfolios[targetKey(target)];s.unlockLog=s.unlockLog||[];s.unlockLog.push({targetDrawId:target,at:new Date().toISOString()});writeStore(s);currentPortfolio=null;
  say("Đã mở khóa bộ vé "+drawLabel(target)+".");refreshWorkspace();
 }
 function evaluateAvailable(){
  var s=readStore(),changed=false;s.evaluations=s.evaluations||[];
  Object.keys(s.portfolios||{}).forEach(function(id){
   if(s.evaluations.some(function(e){return Number(e.targetDrawId)===Number(id);}))return;
   var d=getActual(Number(id));if(!d)return;
   var actual=getMain(d);if(actual.length!==6)return;
   var p=s.portfolios[id],scores=(p.tickets||[]).map(function(t){var a=(t.main||[]),h=a.filter(function(n){return actual.indexOf(n)>=0;}).length;return h;}),draw=getActual(Number(id)),special=Number((draw.result||[])[6]||0),specialHits=special>0?(p.tickets||[]).filter(function(t){return (t.main||[]).indexOf(special)>=0;}).length:0;
   function choose(n,k){var v=1;for(var z=1;z<=k;z++)v=v*(n-z+1)/z;return v;}
   var randomAtLeast3=20*((choose(6,3)*choose(49,3)+choose(6,4)*choose(49,2)+choose(6,5)*choose(49,1)+choose(6,6))/choose(55,6));
   s.evaluations.push({targetDrawId:Number(id),evaluatedAt:new Date().toISOString(),maxMainHits:Math.max.apply(null,scores),ticketsAt3:scores.filter(function(h){return h>=3;}).length,specialHits:specialHits,randomExpectedTicketsAt3:randomAtLeast3,distribution:[0,1,2,3,4,5,6].map(function(h){return {hits:h,count:scores.filter(function(x){return x===h;}).length};}),sourceVerified:false,sourceLabel:"Third-party mirrored history; official verification pending"});
   changed=true;
  });
  if(changed)writeStore(s);
 }
 function exportData(){
  var s=readStore(),payload={exportedAt:new Date().toISOString(),portfolios:s.portfolios||{},evaluations:s.evaluations||[],unlockLog:s.unlockLog||[]};
  var blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="powerai-one-history.json";a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);
 }
 function restoreActive(){
  var id=Number(targetId)||Number(latest&&latest.id)+1,p=getLocked(id);
  currentPortfolio=p||null;
  if(p){renderTickets(p.tickets,p.selectionHash,id,true);if(el("oneAudit"))el("oneAudit").textContent="Bộ vé đã khóa · "+drawLabel(id)+" · mã "+p.selectionHash+" · dữ liệu đến "+drawLabel(p.cutoffDrawId)+".";if(el("oneSafeNote"))el("oneSafeNote").textContent="🔒 Bộ vé đã khóa · không thể ghi đè.";}
  else if(el("oneTickets")){el("oneTickets").innerHTML='<div class="one-empty-state"><div class="one-empty-icon">✧</div><b>Chưa có bộ vé cho kỳ này</b><span>Tạo 20 vé mới rồi khóa để lưu cố định.</span></div>';if(el("oneSafeNote"))el("oneSafeNote").textContent="Chưa khóa vé · Chưa lưu cloud";}
  refreshWorkspace();
 }
 function initialize(){
  if(initialized)return;initialized=true;
  ensureWorkspace();
  var btn=el("oneBuildBtn");if(!btn){say("Không tìm thấy nút tạo vé ONE.",true);return;}
  var required=["PowerAIDomain","PowerAIUnifiedSelector","PowerAIOnePipeline","PowerAIOneAdaptiveGovernor","PowerAIOneAfterDrawEvaluation","PowerAIOneAdaptiveShadowRunner","PowerAIOneChallengerGate","PowerAIOneRuntime","PowerAIOneA","PowerAIOneB","PowerAIOneAProvider","PowerAIOneBProvider"];
  var missing=required.filter(function(k){return !root[k];});
  if(missing.length){say("ONE thiếu thành phần: "+missing.join(", "),true);btn.disabled=true;return;}
  try{runtime=root.PowerAIOneRuntime.create({selectorModule:root.PowerAIUnifiedSelector});root.PowerAIOneAProvider.register(runtime,root.PowerAIOneA);root.PowerAIOneBProvider.register(runtime,root.PowerAIOneB,{candidateCount:6000});}
  catch(e){say("Khởi tạo ONE lỗi: "+e.message,true);btn.disabled=true;return;}
  btn.disabled=false;if(!btn.dataset.oneBound){btn.addEventListener("click",build);btn.dataset.oneBound="1";}
  say("Lõi ONE đã nạp. Đang chờ lịch sử và kỳ mục tiêu…");
  var start=Date.now(),poll=setInterval(function(){if(readHistory()){clearInterval(poll);evaluateAvailable();restoreActive();say("Đã nạp "+draws.length+" kỳ lịch sử · phân tích ngược và ONE sẵn sàng.");}else if(Date.now()-start>20000){clearInterval(poll);say("Chưa nhận được lịch sử từ ứng dụng chính. Kiểm tra nguồn dữ liệu.",true);}},250);
  var target=el("targetId");if(target&&root.MutationObserver)new root.MutationObserver(function(){readHistory();evaluateAvailable();restoreActive();}).observe(target,{childList:true,subtree:true,characterData:true});
 }
 async function build(){
  if(busy||!runtime)return;busy=true;var btn=el("oneBuildBtn");if(btn)btn.disabled=true;
  try{
   say("Đang xác nhận lịch sử và kỳ mục tiêu…");var start=Date.now();
   while((typeof draws==="undefined"||!Array.isArray(draws)||!draws.length||typeof latest==="undefined"||!latest||!Number(targetId))&&Date.now()-start<15000)await new Promise(function(r){setTimeout(r,150);});
   if(typeof draws==="undefined"||!Array.isArray(draws)||!draws.length||!latest)throw new Error("HISTORY_NOT_READY");
   var latestId=Math.max.apply(null,draws.map(function(d){return Number(d.id)||0;})),target=typeof nextProspectiveTarget==="function"?Number(nextProspectiveTarget()):latestId+1;
   if(!Number.isInteger(target)||target<=latestId)target=latestId+1;
   if(Number(targetId)!==target){targetId=target;try{localStorage.setItem("powerai_rc6_active_target",String(target));}catch(_){}if(el("targetId"))el("targetId").textContent=drawLabel(target);if(typeof renderTargetSelect==="function")renderTargetSelect();if(typeof renderTargetContexts==="function")renderTargetContexts();if(typeof renderState==="function")renderState();}
   var already=getLocked(target);if(already){currentPortfolio=already;renderTickets(already.tickets,already.selectionHash,target,true);throw new Error("Kỳ "+drawLabel(target)+" đã khóa. Hệ thống khôi phục bộ vé cũ, không tạo đè.");}
   if(!root.PowerAIAuth||typeof root.PowerAIAuth.getUser!=="function"||!root.PowerAIAuth.getUser())throw new Error("Cần đăng nhập để tạo vé.");
   if(typeof historyReadyForTarget!=="function"||!historyReadyForTarget(target))throw new Error("Dữ liệu kỳ trước chưa được xác nhận.");
   el("oneTickets").replaceChildren();el("oneAudit").textContent="";say("A7 và B1.3 đang phân tích lịch sử, sinh ứng viên và chọn 20 vé…");
   await new Promise(function(r){requestAnimationFrame(function(){setTimeout(r,30);});});
   var result=await runtime.buildPortfolio({targetDrawId:target,draws:draws,providerIds:["A7","B1.3"],mode:"prospective",count:20,maxOverlap:4,candidateLimit:120,beamWidth:24,searchNodeBudget:200000,seed:(target*104729+130013)>>>0,scoreWeight:.7,diversityWeight:.3});
   var p=result&&result.portfolio;if(!p||!Array.isArray(p.tickets)||p.tickets.length!==20)throw new Error("ONE không trả về đủ 20 vé.");
   if(Number(p.targetDrawId)!==target||Number(p.cutoffDrawId)>=target)throw new Error("Sai kỳ mục tiêu hoặc cutoff.");
   currentPortfolio={targetDrawId:target,tickets:p.tickets,selectionHash:p.selectionHash,cutoffDrawId:p.cutoffDrawId,generatedAt:new Date().toISOString(),audit:p.audit||{}};
   renderTickets(p.tickets,p.selectionHash,target,false);
   var a=p.audit||{};el("oneAudit").textContent="Mã bộ vé: "+p.selectionHash+" · Kỳ: "+drawLabel(target)+" · Dữ liệu đến: "+drawLabel(p.cutoffDrawId)+" · Độ phủ: "+a.coverage+"/55 · Cặp lặp: "+a.repeatedPairs+" · Chồng lặp tối đa: "+a.maxOverlap+".";
   if(el("oneSafeNote"))el("oneSafeNote").textContent="Chưa khóa · Chưa lưu lịch sử. Khóa để cố định 20 vé.";
   say("Đã tạo đủ 20 vé ONE cho "+drawLabel(target)+". Kiểm tra vé rồi nhấn Khóa 20 bộ vé để lưu cố định.");refreshWorkspace();
  }catch(e){if(String(e.message||e).indexOf("đã khóa")<0&&el("oneTickets"))el("oneTickets").replaceChildren();say("Trạng thái hệ thống: "+String(e&&e.message||e),true);}
  finally{busy=false;if(btn)btn.disabled=false;}
 }
 root.addEventListener("error",function(e){say("Lỗi JavaScript: "+String(e.message||"không rõ"),true);});
 root.addEventListener("unhandledrejection",function(e){say("Lỗi tác vụ nền: "+String(e.reason&&e.reason.message||e.reason),true);});
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize,{once:true});else initialize();
})(window);
