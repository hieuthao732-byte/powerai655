
/* =========================
   RC8.3 — DIRECT AUTH + CLOUD LOCK
   Auth UI is handled by auth.js with direct Supabase HTTP APIs (no external CDN).
   localStorage stays as a per-device cache; signed-in cloud state is authoritative.
   ========================= */
const POWERAI_PREFIX="powerai_rc6_";
let cloudUser=null,cloudHydrating=false,cloudSaveTimer=null,cloudInitialized=false;
function appStorageKeys(){const out=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(POWERAI_PREFIX))out.push(k)}return out}
function captureLocalState(){const state={};for(const k of appStorageKeys())state[k]=localStorage.getItem(k);return state}
function clearPowerAILocal(){for(const k of appStorageKeys())localStorage.removeItem(k)}
function hydrateLocalState(state){cloudHydrating=true;try{clearPowerAILocal();for(const [k,v] of Object.entries(state||{})){if(k.startsWith(POWERAI_PREFIX)&&typeof v==="string")localStorage.setItem(k,v)}}finally{cloudHydrating=false}}
function getAuthBridge(){return window.PowerAIAuth||null}
async function cloudLoadState(){
  const auth=getAuthBridge();
  if(!auth||!cloudUser)return null;
  const q=`/rest/v1/user_app_state?user_id=eq.${encodeURIComponent(cloudUser.id)}&select=local_state,active_draw_id,locked_draw_id,abc_locked,l_locked`;
  const data=await auth.request(q,{method:"GET",auth:true});
  return Array.isArray(data)?(data[0]||null):data;
}
async function cloudSaveState(){
  const auth=getAuthBridge();
  if(!auth||!cloudUser||cloudHydrating)return;
  const state=captureLocalState(),active=Number(window.targetId||0)||null;
  const currentLock=active?getLock(active):null;
  const currentLL=active?getLearningLock(active):null;
  const payload={user_id:cloudUser.id,active_draw_id:active,locked_draw_id:currentLock?active:null,abc_locked:!!currentLock,l_locked:!!currentLL,abc_lock_snapshot:currentLock||null,l_lock_snapshot:currentLL||null,local_state:state};
  await auth.request('/rest/v1/user_app_state?on_conflict=user_id',{method:'POST',auth:true,headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:payload});
}
function cloudSyncSoon(){if(!cloudUser||cloudHydrating)return;clearTimeout(cloudSaveTimer);cloudSaveTimer=setTimeout(()=>cloudSaveState().catch(e=>{console.error("Cloud save failed",e);showToast?.("Không lưu được cloud: "+e.message,"bad")}),350)}
async function applyCloudUser(next,{reload=true}={}){
  if(next&&(!cloudUser||cloudUser.id!==next.id)){
    cloudUser=next;
    try{
      const remote=await cloudLoadState();
      if(remote?.local_state)hydrateLocalState(remote.local_state);else await cloudSaveState();
      if(reload&&typeof load==="function")await load();
      showToast?.("Đã đồng bộ dữ liệu tài khoản từ cloud.","good");
    }catch(e){console.error(e);showToast?.("Đăng nhập được nhưng đồng bộ cloud lỗi: "+e.message,"bad")}
  }else if(!next&&cloudUser){
    cloudUser=null;
    clearPowerAILocal();
    if(reload&&typeof load==="function")await load();
    showToast?.("Đã đăng xuất. Trang chuyển về chế độ chỉ xem.","good");
  }
}
async function initCloudAuth(){
  if(cloudInitialized)return;cloudInitialized=true;
  const auth=getAuthBridge();
  if(!auth){console.error("Auth bridge missing");return}
  window.addEventListener('powerai-auth-changed',e=>{applyCloudUser(e.detail?.user||null,{reload:true}).catch(console.error)});
  const current=auth.getUser?.()||null;
  if(current)await applyCloudUser(current,{reload:false});
}

const URL="https://raw.githubusercontent.com/vietvudanh/vietlott-data/master/data/power655.jsonl";
const $=id=>document.getElementById(id);
let draws=[],latest=null,targetId=null,geo=null,legacy=null,legacyModel=null,legacyBuilding=false,legacyRanked=null,hybrid=null,hybridBuilding=false,consensusNums=null,matrixModel=null,learningPortfolio=null,learningPortfolioBuilding=false,learningPortfolioMeta=null;

function nums(d){return (d?.result||[]).map(Number).filter(n=>n>=1&&n<=55).slice(0,6).sort((a,b)=>a-b)}
function seeded(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function edgeKey(a,b){return a<b?`${a}-${b}`:`${b}-${a}`}
function overlap(a,b){const s=new Set(a);let n=0;for(const x of b)if(s.has(x))n++;return n}
function hits(a,b){const s=new Set(b);let n=0;for(const x of a)if(s.has(x))n++;return n}
function balls(a,actual=[]){const s=new Set(actual);return a.map(n=>`<span class="ball ${s.has(n)?'hit':''}">${String(n).padStart(2,"0")}</span>`).join("")}
function simpleHash(P){let h=2166136261>>>0,s=P.map(t=>t.join("-")).join("|");for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return("00000000"+(h>>>0).toString(16)).slice(-8).toUpperCase()}

/* TRACK A — RC7.0 SIMULATION-OPTIMIZED GEOMETRY
   No historical lottery data is used. A searches many valid incidence shapes,
   evaluates them on common uniform synthetic outcomes, and selects a robust shape.
   Hard geometry invariants stay compatible with Track C.
*/
function generateIncidenceShape(target,salt=0){
  const baseSeed=(Number(target)*7919+550055+Math.imul(salt+1,2246822519))>>>0;
  for(let restart=0;restart<220;restart++){
    const rnd=seeded((baseSeed+Math.imul(restart+1,104729))>>>0),used=new Set(),triCnt=Array(20).fill(0),triangles=[];
    let fail=false;
    for(let q=0;q<10;q++){
      const feasible=[];
      for(let a=0;a<18;a++)for(let b=a+1;b<19;b++)for(let c=b+1;c<20;c++){
        if(triCnt[a]>=3||triCnt[b]>=3||triCnt[c]>=3)continue;
        if(used.has(edgeKey(a,b))||used.has(edgeKey(a,c))||used.has(edgeKey(b,c)))continue;
        const next=triCnt.slice();next[a]++;next[b]++;next[c]++;
        let variance=0,maxv=0;for(const x of next){variance+=(x-1.5)*(x-1.5);maxv=Math.max(maxv,x)}
        feasible.push({tri:[a,b,c],score:variance+maxv*.12+rnd()*.08});
      }
      if(!feasible.length){fail=true;break}
      feasible.sort((x,y)=>x.score-y.score);
      const pick=feasible[Math.floor(rnd()*Math.min(24,feasible.length))].tri;
      triangles.push(pick);pick.forEach(t=>triCnt[t]++);
      used.add(edgeKey(pick[0],pick[1]));used.add(edgeKey(pick[0],pick[2]));used.add(edgeKey(pick[1],pick[2]));
    }
    if(fail)continue;
    const rem=triCnt.map(x=>6-x),edges=[];
    for(let step=0;step<45;step++){
      const active=[...Array(20).keys()].filter(i=>rem[i]>0);if(!active.length)break;
      const mx=Math.max(...active.map(i=>rem[i])),us=active.filter(i=>rem[i]===mx),u=us[Math.floor(rnd()*us.length)];
      let vs=active.filter(v=>v!==u&&rem[v]>0&&!used.has(edgeKey(u,v)));if(!vs.length){fail=true;break}
      const vmax=Math.max(...vs.map(v=>rem[v]));vs=vs.filter(v=>rem[v]>=vmax-1);const v=vs[Math.floor(rnd()*vs.length)];
      used.add(edgeKey(u,v));edges.push([u,v]);rem[u]--;rem[v]--;
    }
    if(fail||edges.length!==45||rem.some(x=>x!==0))continue;

    // Canonical labels during structural search: 1..10 are triple-exposure slots, 11..55 double.
    const P=Array.from({length:20},()=>[]);
    triangles.forEach((tri,i)=>tri.forEach(t=>P[t].push(i+1)));
    edges.forEach((e,i)=>e.forEach(t=>P[t].push(i+11)));
    P.forEach(t=>t.sort((a,b)=>a-b));
    const a=auditGeo(P);
    if(a.coverage===55&&a.repeatedPairs===0&&a.maxOverlap<=1&&a.minExp===2&&a.maxExp===3)
      return{tickets:P,shapeSeed:baseSeed,audit:a};
  }
  throw new Error("Không dựng được cấu trúc A hợp lệ.");
}
function relabelIncidenceShape(P,target,shapeSeed){
  const rnd=seeded((Number(target)*2654435761+(shapeSeed||0)+700701)>>>0);
  const labels=shuffle([...Array(55)].map((_,i)=>i+1),rnd),map=Array(56).fill(0);
  for(let i=1;i<=55;i++)map[i]=labels[i-1];
  return P.map(t=>t.map(n=>map[n]).sort((a,b)=>a-b));
}
function pop32(x){x=x>>>0;x=x-((x>>>1)&0x55555555);x=(x&0x33333333)+((x>>>2)&0x33333333);return((((x+(x>>>4))&0x0F0F0F0F)*0x01010101)>>>24)}
function mask6(a){let lo=0,hi=0;for(const n of a){if(n<=32)lo=(lo|(1<<(n-1)))>>>0;else hi=(hi|(1<<(n-33)))>>>0}return[lo,hi]}
function uniformOutcomeMasks(seed,count){
  const rnd=seeded(seed),out=[];
  for(let k=0;k<count;k++){
    const s=new Set();while(s.size<6)s.add(1+Math.floor(rnd()*55));
    out.push(mask6([...s]));
  }
  return out;
}
function geometryStructureStats(P){
  const a=auditGeo(P),exp=a.exp,triLoad=[],degree=[],adj=Array.from({length:20},()=>Array(20).fill(false));
  for(let i=0;i<P.length;i++){
    triLoad.push(P[i].filter(n=>exp[n]===3).length);
    let d=0;for(let j=0;j<P.length;j++)if(i!==j&&overlap(P[i],P[j])>0){d++;adj[i][j]=true}degree.push(d);
  }
  const mean=x=>x.reduce((s,v)=>s+v,0)/x.length,sd=x=>{const m=mean(x);return Math.sqrt(mean(x.map(v=>(v-m)*(v-m))))};
  let graphTriangles=0;for(let i=0;i<18;i++)for(let j=i+1;j<19;j++)for(let k=j+1;k<20;k++)if(adj[i][j]&&adj[i][k]&&adj[j][k])graphTriangles++;
  return{triLoad,degree,triLoadSd:sd(triLoad),degreeSd:sd(degree),graphTriangles};
}
function simulateGeometry(P,samples,detail=false){
  const tm=P.map(mask6),hist=Array(7).fill(0),n=samples.length;
  const td=detail?P.map(()=>({topCredit:0,uniqueBest:0,ge3:0,marginal:0})):null;
  const hs=Array(P.length).fill(0);
  for(const sm of samples){
    let best=-1,second=-1,ties=0;
    for(let i=0;i<tm.length;i++){
      const h=pop32((tm[i][0]&sm[0])>>>0)+pop32((tm[i][1]&sm[1])>>>0);hs[i]=h;
      if(h>best){second=best;best=h;ties=1}else if(h===best){ties++}else if(h>second)second=h;
    }
    hist[best]++;
    if(detail){
      for(let i=0;i<hs.length;i++){
        if(hs[i]>=3)td[i].ge3++;
        if(hs[i]===best)td[i].topCredit+=1/ties;
      }
      if(ties===1){const u=hs.indexOf(best);td[u].uniqueBest++;td[u].marginal+=Math.max(0,best-second)}
    }
  }
  const ge=k=>hist.slice(k).reduce((s,x)=>s+x,0)/n*100;
  const avgBest=hist.reduce((s,c,i)=>s+c*i,0)/n;
  return{n,hist,p2:ge(2),p3:ge(3),p4:ge(4),avgBest,ticket:td};
}
function geometryObjective(sim,st){
  // P(Best>=3) is the primary target. Secondary terms stabilize mean coverage and structure.
  return sim.p3+2.6*sim.avgBest+.04*sim.p2+.08*sim.p4-.035*st.degreeSd-.055*st.triLoadSd;
}
function buildIncidence(target){
  const N_CAND=72,N_PROBE=4200,N_STABILITY=4200,N_FINAL=10000,N_DISPLAY=8000;
  const probe=uniformOutcomeMasks((Number(target)*69069+701001)>>>0,N_PROBE);
  const stability=uniformOutcomeMasks((Number(target)*1103515245+702002)>>>0,N_STABILITY);
  const candidates=[],seen=new Set();
  for(let salt=0;salt<180&&candidates.length<N_CAND;salt++){
    const c=generateIncidenceShape(target,salt),sig=simpleHash(c.tickets);if(seen.has(sig))continue;seen.add(sig);
    const st=geometryStructureStats(c.tickets),s1=simulateGeometry(c.tickets,probe),s2=simulateGeometry(c.tickets,stability),o1=geometryObjective(s1,st),o2=geometryObjective(s2,st);
    candidates.push({...c,structure:st,probe:s1,stability:s2,o1,o2,robust:.65*Math.min(o1,o2)+.35*((o1+o2)/2)});
  }
  if(!candidates.length)throw new Error("A Simulation Optimizer không tạo được candidate.");
  const baseline=candidates[0],eligible=candidates.filter(c=>c.o1>=baseline.o1-.01&&c.o2>=baseline.o2-.01);
  const shortlist=(eligible.length?eligible:candidates).slice().sort((a,b)=>b.robust-a.robust).slice(0,8);
  const finalBank=uniformOutcomeMasks((Number(target)*1664525+703003)>>>0,N_FINAL);
  for(const c of shortlist){c.final=simulateGeometry(c.tickets,finalBank);c.finalObjective=geometryObjective(c.final,c.structure)}
  const baseFinal=simulateGeometry(baseline.tickets,finalBank),baseFinalObjective=geometryObjective(baseFinal,baseline.structure);
  let chosen=shortlist.slice().sort((a,b)=>b.finalObjective-a.finalObjective)[0]||baseline;
  if(chosen.finalObjective<baseFinalObjective)chosen=baseline;

  const relabeled=relabelIncidenceShape(chosen.tickets,target,chosen.shapeSeed),audit=auditGeo(relabeled),structure=geometryStructureStats(relabeled);
  const displayBank=uniformOutcomeMasks((Number(target)*22695477+704004)>>>0,N_DISPLAY);
  const display=simulateGeometry(relabeled,displayBank,true);
  const baselineRelabeled=relabelIncidenceShape(baseline.tickets,target,baseline.shapeSeed),baselineDisplay=simulateGeometry(baselineRelabeled,displayBank,false);
  return{
    tickets:relabeled,seed:chosen.shapeSeed,audit,engine:"A7 Simulation Optimizer",
    analysis:{candidateCount:candidates.length,probeN:N_PROBE,stabilityN:N_STABILITY,finalN:N_FINAL,displayN:N_DISPLAY,display,baselineDisplay,structure,selectedHash:simpleHash(chosen.tickets),baselineHash:simpleHash(baseline.tickets),improved:simpleHash(chosen.tickets)!==simpleHash(baseline.tickets),optimizerGain:Math.max(0,chosen.finalObjective-baseFinalObjective),finalists:shortlist.length}
  };
}

function auditGeo(P){
  const exp=Array(56).fill(0),pairs=new Map();let maxOverlap=0;
  for(const t of P){for(const n of t)exp[n]++;for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){const k=edgeKey(t[i],t[j]);pairs.set(k,(pairs.get(k)||0)+1)}}
  for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++)maxOverlap=Math.max(maxOverlap,overlap(P[i],P[j]));
  const e=exp.slice(1);return{exp,coverage:e.filter(x=>x>0).length,minExp:Math.min(...e),maxExp:Math.max(...e),triple:e.filter(x=>x===3).length,double:e.filter(x=>x===2).length,repeatedPairs:[...pairs.values()].filter(v=>v>1).length,maxOverlap,uniquePairs:pairs.size};
}

/* TRACK B — frozen legacy V1.3 */
function pairScore(a,m){let s=0;for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)s+=m.pair.get(a[i]+"-"+a[j])||0;return s}
function buildLegacyModel(ds){
  const f=Array(56).fill(0),pos=Array.from({length:56},()=>[]),pair=new Map();
  ds.forEach((d,i)=>{const a=nums(d);a.forEach(n=>{f[n]++;pos[n].push(i)});for(let x=0;x<6;x++)for(let y=x+1;y<6;y++){const k=a[x]+"-"+a[y];pair.set(k,(pair.get(k)||0)+1)}});
  const over=Array(56).fill(0);
  for(let n=1;n<=55;n++){const p=pos[n];if(p.length>=2){let s=0;for(let i=1;i<p.length;i++)s+=p[i]-p[i-1];const avg=s/(p.length-1),last=ds.length-1-p.at(-1);over[n]=avg?last/avg:0}}
  const mf=Math.max(...f),mo=Math.max(...over),heat=Array(56).fill(0);
  for(let n=1;n<=55;n++)heat[n]=.6*(f[n]/Math.max(1,mf))+.4*(mo?over[n]/mo:0);
  const m={f,over,heat,pair,maxPair:1};
  let mx=0;ds.forEach(d=>mx=Math.max(mx,pairScore(nums(d),m)));m.maxPair=mx||1;return m;
}
function validLegacy(a){const o=a.filter(n=>n%2).length,sm=a.filter(n=>n<=27).length,t=a.reduce((x,y)=>x+y,0);let c=0;for(let i=0;i<5;i++)if(a[i+1]-a[i]===1)c++;return[2,3,4].includes(o)&&[2,3,4].includes(sm)&&t>=90&&t<=210&&c<=2}
function legacyComponents(a,m){
  const heat=a.reduce((s,n)=>s+m.heat[n],0)/6*100,pair=pairScore(a,m)/m.maxPair*100,o=a.filter(n=>n%2).length,odd=o===3?100:[2,4].includes(o)?80:50,sm=a.filter(n=>n<=27).length,small=sm===3?100:[2,4].includes(sm)?80:50,t=a.reduce((x,y)=>x+y,0),sum=t>=120&&t<=200?100:t>=100&&t<=220?80:40;
  return{heat,pair,odd,small,sum,score:.4*heat+.3*pair+.1*odd+.1*small+.1*sum};
}
function randomValidPool(n,seed){
  const rnd=seeded(seed),out=[],seen=new Set();
  while(out.length<n){const s=new Set();while(s.size<6)s.add(1+Math.floor(rnd()*55));const a=[...s].sort((x,y)=>x-y),k=a.join(",");if(seen.has(k)||!validLegacy(a))continue;seen.add(k);out.push({a})}
  return out;
}
function portfolioSelect(ranked,k=20){
  if(!ranked.length)return[];const selected=[ranked[0]],used=new Map();ranked[0].a.forEach(n=>used.set(n,1));
  const shortlist=ranked.slice(1,Math.min(ranked.length,1200));
  while(selected.length<k&&shortlist.length){
    let bestI=0,bestAdj=-Infinity;
    for(let i=0;i<shortlist.length;i++){const p=shortlist[i];let maxOv=0,sumOv=0;for(const q of selected){const ov=overlap(p.a,q.a);maxOv=Math.max(maxOv,ov);sumOv+=ov}
      const newNums=p.a.filter(n=>!used.has(n)).length,pen=maxOv>=5?24:maxOv===4?12:maxOv===3?5:maxOv===2?1.5:0,adj=p.score-pen-.18*sumOv+.65*newNums;
      if(adj>bestAdj){bestAdj=adj;bestI=i}}
    const pick=shortlist.splice(bestI,1)[0];selected.push(pick);pick.a.forEach(n=>used.set(n,(used.get(n)||0)+1));
  }return selected;
}
async function buildLegacyPortfolio(){
  if(!historyReadyForTarget(targetId)){
    const p=pendingPredecessorForTarget(targetId);
    if($("legacyProgress"))$("legacyProgress").innerHTML=p
      ?`⏳ <b>Chờ xác nhận ${drawLabel(p)}</b> • kết quả nhập tay chưa được dùng để tạo B cho ${drawLabel(targetId)}.`
      :`⏳ Dữ liệu chính thức chưa đủ đến kỳ trước ${drawLabel(targetId)}.`;
    showToast(p?`B đang chờ feed xác nhận ${drawLabel(p)}.`:"Dữ liệu chính thức chưa đủ để tạo B.","warn");
    return;
  }

  if(knownTargetResult(targetId)&&!getLock(targetId)&&!isReplayTarget(targetId)){
    showToast(`Kỳ ${drawLabel(targetId)} đã có kết quả. Bộ B chỉ có thể xem lại, không tạo mới sau kết quả.`,"warn");
    return;
  }

  if(legacyBuilding)return;legacyBuilding=true;$("lockBothBtn").disabled=true;$("regenLegacyBtn").disabled=true;
  try{
    const ds=draws.filter(d=>Number(d.id)<Number(targetId));legacyModel=buildLegacyModel(ds);
    $("cutoffId").textContent=ds.length?"#"+String(ds.at(-1).id).padStart(5,"0"):"—";
    $("legacyProgress").textContent="Đang sinh 50.000 candidate theo engine V1.3...";
    await new Promise(r=>setTimeout(r,20));
    const pool=randomValidPool(50000,(Number(targetId)*104729+130013)>>>0),scored=[];
    for(let i=0;i<pool.length;i++){
      const c=legacyComponents(pool[i].a,legacyModel);scored.push({a:pool[i].a,...c});
      if(i%2500===0){$("legacyProgress").textContent=`Đang chấm ${i.toLocaleString("vi-VN")} / 50.000 candidate...`;await new Promise(r=>setTimeout(r,0))}
    }
    scored.sort((a,b)=>b.score-a.score);legacyRanked=scored;legacy=portfolioSelect(scored,20);
    $("legacyProgress").textContent=`✓ Track B sẵn sàng • 50.000 candidates • cutoff ${ds.length?("#"+ds.at(-1).id):"—"}`;
    renderLegacyAnalytics();renderLegacyTickets();buildHybridPortfolio();renderState();
  }catch(e){console.error(e);$("legacyProgress").textContent="Lỗi dựng Track B: "+e.message}
  legacyBuilding=false;$("regenLegacyBtn").disabled=!!getLock(targetId);renderState();
}
function renderLegacyAnalytics(){
  if(!legacyModel)return;
  const nums55=[...Array(55)].map((_,i)=>i+1);
  const hot=nums55.slice().sort((a,b)=>legacyModel.heat[b]-legacyModel.heat[a]).slice(0,12);
  const cold=nums55.slice().sort((a,b)=>legacyModel.heat[a]-legacyModel.heat[b]).slice(0,12);
  const over=nums55.slice().sort((a,b)=>legacyModel.over[b]-legacyModel.over[a]).slice(0,12);
  const pairs=[...legacyModel.pair.entries()].sort((a,b)=>b[1]-a[1]).slice(0,15);
  $("hotList").innerHTML=hot.map(n=>`<span class="chip">${String(n).padStart(2,"0")} • ${(legacyModel.heat[n]*100).toFixed(1)}</span>`).join("");
  $("coldList").innerHTML=cold.map(n=>`<span class="chip">${String(n).padStart(2,"0")} • ${(legacyModel.heat[n]*100).toFixed(1)}</span>`).join("");
  $("overList").innerHTML=over.map(n=>`<span class="chip">${String(n).padStart(2,"0")} • ${legacyModel.over[n].toFixed(2)}</span>`).join("");
  $("pairList").innerHTML=pairs.map(([k,v])=>`<span class="chip">${k} • ${v}×</span>`).join("");
  const mh=Math.max(...legacyModel.heat.slice(1)),mn=Math.min(...legacyModel.heat.slice(1));
  $("heatmap").innerHTML=nums55.map(n=>{const q=(legacyModel.heat[n]-mn)/Math.max(.0001,mh-mn);return`<div class="heatCell" style="--a:${(.08+.55*q).toFixed(2)}"><b>${String(n).padStart(2,"0")}</b><br>${(legacyModel.heat[n]*100).toFixed(0)}</div>`}).join("");
}

function rankClass(rank){return rank===1?"top1":rank===2?"top2":rank===3?"top3":""}
function pctScore(raw,min,max){
  if(!Number.isFinite(raw))return 0;
  if(max<=min)return 100;
  return 60+40*(raw-min)/(max-min);
}
function ensureGeoAnalysis(){
  if(!geo?.tickets?.length)return null;
  if(geo.analysis?.display?.ticket)return geo.analysis;
  const bank=uniformOutcomeMasks((Number(targetId)*22695477+704004)>>>0,8000),display=simulateGeometry(geo.tickets,bank,true),structure=geometryStructureStats(geo.tickets);
  geo.analysis={...(geo.analysis||{}),candidateCount:geo.analysis?.candidateCount||0,displayN:8000,display,baselineDisplay:geo.analysis?.baselineDisplay||null,structure};
  return geo.analysis;
}
function rankGeoRows(){
  if(!geo?.tickets?.length)return[];
  const an=ensureGeoAnalysis(),td=an?.display?.ticket||[];
  const rows=geo.tickets.map((t,originalIndex)=>{
    const d=td[originalIndex]||{topCredit:0,uniqueBest:0,ge3:0,marginal:0};
    const raw=4*d.uniqueBest+2*d.topCredit+1.25*d.ge3+5*d.marginal;
    return{a:t,originalIndex,raw,...d};
  });
  const min=Math.min(...rows.map(x=>x.raw)),max=Math.max(...rows.map(x=>x.raw));
  rows.forEach(x=>x.displayScore=pctScore(x.raw,min,max));
  rows.sort((x,y)=>y.displayScore-x.displayScore||y.uniqueBest-x.uniqueBest||x.originalIndex-y.originalIndex);
  rows.forEach((x,i)=>x.rank=i+1);
  return rows;
}
function rankLegacyRows(){
  if(!legacy?.length)return[];
  const rows=legacy.map((p,originalIndex)=>{
    let q=p;
    if((!Number.isFinite(p.score)||p.score===0)&&legacyModel){
      q={...p,...legacyComponents(p.a,legacyModel)};
    }
    return{...q,originalIndex,displayScore:Number(q.score)||0};
  });
  rows.sort((x,y)=>y.displayScore-x.displayScore||x.originalIndex-y.originalIndex);
  rows.forEach((x,i)=>x.rank=i+1);
  return rows;
}
function rankHybridRows(){
  if(!hybrid?.length||!consensusNums)return[];
  const sig=consensusNums;
  const rows=hybrid.map((x,originalIndex)=>{
    const p=Array.isArray(x)?{a:x}:x;
    const matrixScore=Number.isFinite(p.matrixScore)?p.matrixScore:ticketAffinity(p.a,sig.aff)/15*100;
    const consensusScore=Number.isFinite(p.consensusScore)?p.consensusScore:p.a.reduce((s,n)=>s+sig.consensus[n],0)/6*100;
    const displayScore=(matrixScore+consensusScore)/2; // equal-weight UI ranking only
    return{...p,originalIndex,matrixScore,consensusScore,displayScore};
  });
  rows.sort((x,y)=>y.displayScore-x.displayScore||y.matrixScore-x.matrixScore||x.originalIndex-y.originalIndex);
  rows.forEach((x,i)=>x.rank=i+1);
  return rows;
}

function renderLegacyTickets(actual=[]){
  if(!legacy)return;
  const cov=new Set();legacy.forEach(p=>p.a.forEach(n=>cov.add(n)));
  const rows=rankLegacyRows();
  $("legacyMetrics").innerHTML=[
    ["Số khác nhau",cov.size+"/55"],["Số vé","20"],["Mẫu thử","50.000"],["Dữ liệu đến",$("#cutoffId")?.textContent||"—"],["Điểm cao nhất",rows.length?rows[0].displayScore.toFixed(1):"—"],["Công thức","ĐÃ KHÓA"]
  ].map(x=>`<div class="metric"><span>${x[0]}</span><b>${x[1]}</b></div>`).join("");
  $("legacyTickets").innerHTML=rows.map(p=>`<div class="ticket">
    <div class="ticketTop"><b>VÉ B${String(p.rank).padStart(2,"0")}</b><span>gốc #${String(p.originalIndex+1).padStart(2,"0")}</span></div>
    <div class="balls">${balls(p.a,actual)}</div>
    <div class="ticketRankRow">
      <span class="rankBadge ${rankClass(p.rank)}">Hạng #${p.rank}</span>
      <span class="ticketScore">Điểm <b>${p.displayScore.toFixed(1)}</b>/100</span>
    </div>
    <div class="scoreBar"><i style="width:${Math.max(0,Math.min(100,p.displayScore)).toFixed(1)}%"></i></div>
  </div>`).join("");
}
function renderGeo(actual=[]){
  if(!geo){
    if($("geoState"))$("geoState").textContent="Bộ A chưa có 20 vé.";
    return;
  }
  const a=geo.audit||auditGeo(geo.tickets),an=ensureGeoAnalysis(),sim=an?.display,base=an?.baselineDisplay,st=an?.structure||geometryStructureStats(geo.tickets),rows=rankGeoRows();
  const oldSnapshot=!geo.engine||geo.engine!=="A7 Simulation Optimizer";
  if($("geoState"))$("geoState").innerHTML=oldSnapshot
    ?`✓ <b>Snapshot A cũ của ${drawLabel(targetId)}</b> • giữ nguyên vì đã khóa từ phiên bản trước.`
    :`✓ <b>A7 cho ${drawLabel(targetId)} đã tối ưu xong</b> • ${an.candidateCount||72} cấu trúc • không dùng lịch sử xổ số.`;
  $("geoAudit").innerHTML=[
    ["Cấu trúc đã thử",oldSnapshot?"SNAPSHOT CŨ":(an?.candidateCount||"—")],
    ["Finalist",oldSnapshot?"—":(an?.finalists||"—")],
    ["Mẫu kiểm tra độc lập",sim?sim.n.toLocaleString("vi-VN"):"—"],
    ["Mô phỏng Best ≥3",sim?sim.p3.toFixed(2)+"%":"—"],
    ["Best-hit TB",sim?sim.avgBest.toFixed(3):"—"],
    ["Tối ưu vs baseline",oldSnapshot?"—":(an?.improved?"ĐÃ CHỌN CẤU TRÚC MỚI":"GIỮ BASELINE")],
    ["Độ lệch kết nối",st.degreeSd.toFixed(2)],
    ["Phủ số",a.coverage+"/55"],
    ["Cặp bị lặp",a.repeatedPairs],
    ["Trùng tối đa 2 vé",a.maxOverlap],
    ["Mã bộ vé",simpleHash(geo.tickets)]
  ].map(x=>`<div class="metric"><span>${x[0]}</span><b>${x[1]}</b></div>`).join("");
  $("geoTickets").innerHTML=rows.map(p=>`<div class="ticket">
    <div class="ticketTop"><b>VÉ A${String(p.rank).padStart(2,"0")}</b><span>gốc #${String(p.originalIndex+1).padStart(2,"0")}</span></div>
    <div class="balls">${balls(p.a,actual)}</div>
    <div class="ticketRankRow">
      <span class="rankBadge ${rankClass(p.rank)}">Hạng #${p.rank}</span>
      <span class="ticketScore">Đóng góp <b>${p.displayScore.toFixed(1)}</b>/100</span>
    </div>
    <div class="scoreBar"><i style="width:${p.displayScore.toFixed(1)}%"></i></div>
    <div class="ticketMetaMini"><span>Top-credit ${p.topCredit.toFixed(1)}</span><span>≥3: ${p.ge3}</span><span>Unique-best ${p.uniqueBest}</span></div>
  </div>`).join("");
}
/* TRACK C — RC6.0 GEOMETRY-CONSTRAINED MATRIX HYBRID
   Historical features are empirical ranks/affinities, NOT calibrated future probabilities.
   RC5 weight/combo search is CLOSED. RC6 preserves A's geometry invariants.
*/
function rankNorm55(values){
  const arr=[];for(let n=1;n<=55;n++)arr.push([n,Number(values[n]||0)]);
  arr.sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
  const out=Array(56).fill(0);
  // Average-rank ties.
  let i=0;
  while(i<arr.length){
    let j=i+1;while(j<arr.length&&Math.abs(arr[j][1]-arr[i][1])<1e-12)j++;
    const r=((i+j-1)/2)/(arr.length-1);
    for(let k=i;k<j;k++)out[arr[k][0]]=r;
    i=j;
  }
  return out;
}
function median(a){
  const x=a.slice().sort((p,q)=>p-q),m=Math.floor(x.length/2);
  return x.length%2?x[m]:(x[m-1]+x[m])/2;
}
function buildMatrixModel(ds,m){
  const N=Math.max(1,ds.length),freq=m.f,pair=m.pair,alpha=1.0;
  const aff=Array.from({length:56},()=>Array(56).fill(0)),central=Array(56).fill(0);
  let maxAff=0;
  for(let i=1;i<=55;i++)for(let j=i+1;j<=55;j++){
    const cij=pair.get(i+"-"+j)||0;
    const pji=(cij+alpha)/(freq[i]+alpha*55),pij=(cij+alpha)/(freq[j]+alpha*55);
    const expected=Math.max(.000001,(freq[i]/N)*(freq[j]/N));
    const observed=(cij+alpha)/(N+alpha);
    const lift=Math.min(3,observed/expected),shrink=cij/(cij+4);
    const a=.65*((pji+pij)/2)+.35*(shrink*lift/3);
    aff[i][j]=aff[j][i]=a;maxAff=Math.max(maxAff,a);
  }
  if(maxAff<=0)maxAff=1;
  for(let i=1;i<=55;i++){
    const vals=[];for(let j=1;j<=55;j++)if(j!==i)vals.push(aff[i][j]/maxAff);
    vals.sort((a,b)=>b-a);central[i]=vals.slice(0,8).reduce((s,x)=>s+x,0)/8;
  }
  return{aff,central,maxAff};
}
function deriveGeometrySlots(P){
  const loc=Array.from({length:56},()=>[]);
  P.forEach((t,ti)=>t.forEach(n=>loc[n].push(ti)));
  const slots=[];
  for(let n=1;n<=55;n++)slots.push({sourceNumber:n,tickets:loc[n].slice(),exp:loc[n].length});
  return slots;
}
function slotEdgesFromSlots(slots){
  const byTicket=Array.from({length:20},()=>[]);
  slots.forEach((s,si)=>s.tickets.forEach(t=>byTicket[t].push(si)));
  const edges=[];
  for(const ids of byTicket)for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)edges.push([ids[i],ids[j]]);
  return edges; // exactly 20*C(6,2)=300 under valid geometry.
}
function ticketsFromMapping(slots,mapping){
  const P=Array.from({length:20},()=>[]);
  slots.forEach((s,i)=>s.tickets.forEach(t=>P[t].push(mapping[i])));
  P.forEach(t=>t.sort((a,b)=>a-b));
  return P;
}
function mappingObjective(mapping,slotEdges,aff){
  let s=0;for(const e of slotEdges)s+=aff[mapping[e[0]]][mapping[e[1]]];return s;
}
function ticketAffinity(t,aff){
  let s=0;for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)s+=aff[t[i]][t[j]];return s;
}
function buildConstrainedSignals(ds,A,B){
  const windows=[30,60,120,250],models=[];
  for(const w of windows){
    const cut=ds.slice(Math.max(0,ds.length-w)),lm=buildLegacyModel(cut),mm=buildMatrixModel(cut,lm);
    models.push({
      w,lm,mm,
      freq:rankNorm55(lm.f),
      gap:rankNorm55(lm.over),
      heat:rankNorm55(lm.heat),
      matrix:rankNorm55(mm.central)
    });
  }

  const freq=Array(56).fill(0),gap=Array(56).fill(0),heat=Array(56).fill(0),matrix=Array(56).fill(0);
  for(let n=1;n<=55;n++){
    freq[n]=median(models.map(x=>x.freq[n]));
    gap[n]=median(models.map(x=>x.gap[n]));
    heat[n]=median(models.map(x=>x.heat[n]));
    matrix[n]=median(models.map(x=>x.matrix[n]));
  }

  const bExp=Array(56).fill(0);B.forEach(p=>(p.a||p).forEach(n=>bExp[n]++));
  const legacy=rankNorm55(bExp);

  // Equal-treatment robust rank fusion: no tuned weights.
  const consensus=Array(56).fill(0),tie=Array(56).fill(0);
  for(let n=1;n<=55;n++){
    const v=[freq[n],gap[n],heat[n],matrix[n],legacy[n]];
    consensus[n]=median(v);
    tie[n]=v.reduce((s,x)=>s+x,0)/v.length;
  }

  // Robust pair affinity = median normalized affinity across 4 windows.
  const aff=Array.from({length:56},()=>Array(56).fill(0));
  for(let i=1;i<=55;i++)for(let j=i+1;j<=55;j++){
    const vals=models.map(x=>x.mm.aff[i][j]/x.mm.maxAff);
    aff[i][j]=aff[j][i]=median(vals);
  }

  const central=Array(56).fill(0);
  for(let n=1;n<=55;n++){
    const vals=[];for(let j=1;j<=55;j++)if(j!==n)vals.push(aff[n][j]);
    vals.sort((a,b)=>b-a);central[n]=vals.slice(0,8).reduce((s,x)=>s+x,0)/8;
  }

  const order=[...Array(55)].map((_,i)=>i+1).sort((a,b)=>
    consensus[b]-consensus[a] || tie[b]-tie[a] || central[b]-central[a] || a-b
  );
  const boosted=order.slice(0,10);

  return{windows,models,freq,gap,heat,matrix,legacy,bExp,consensus,tie,aff,central,boosted,order};
}
function optimizeConstrainedMapping(A,sig,target){
  const slots=deriveGeometrySlots(A.tickets),slotEdges=slotEdgesFromSlots(slots);
  const triSlots=[],dblSlots=[];
  slots.forEach((s,i)=>(s.exp===3?triSlots:dblSlots).push(i));
  if(triSlots.length!==10||dblSlots.length!==45||slotEdges.length!==300)throw new Error("Geometry skeleton A không đúng invariant RC6.");

  const tripleNums=sig.boosted.slice(),tripleSet=new Set(tripleNums);
  const doubleNums=[...Array(55)].map((_,i)=>i+1).filter(n=>!tripleSet.has(n));
  const baseSeed=(Number(target)*2654435761+600055)>>>0;

  let globalBest=null,globalScore=-Infinity;
  const restarts=5,iterations=4500;
  for(let r=0;r<restarts;r++){
    const rnd=seeded((baseSeed+r*104729)>>>0);
    let ts=tripleNums.slice(),ds=doubleNums.slice();
    // Restart 0 is deterministic signal order; later restarts explore permutations.
    if(r>0){shuffle(ts,rnd);shuffle(ds,rnd)}
    const map=Array(55);
    triSlots.forEach((si,k)=>map[si]=ts[k]);
    dblSlots.forEach((si,k)=>map[si]=ds[k]);
    let score=mappingObjective(map,slotEdges,sig.aff);

    for(let it=0;it<iterations;it++){
      const group=rnd()<10/55?triSlots:dblSlots;
      let ia=Math.floor(rnd()*group.length),ib=Math.floor(rnd()*group.length);
      if(ia===ib)continue;
      const a=group[ia],b=group[ib],tmp=map[a];map[a]=map[b];map[b]=tmp;
      const ns=mappingObjective(map,slotEdges,sig.aff);
      if(ns>=score){score=ns}
      else{const t=map[a];map[a]=map[b];map[b]=t}
    }
    if(score>globalScore){globalScore=score;globalBest=map.slice()}
  }

  const P=ticketsFromMapping(slots,globalBest),audit=auditGeo(P);
  const ok=audit.coverage===55&&audit.minExp===2&&audit.maxExp===3&&audit.triple===10&&audit.double===45&&audit.repeatedPairs===0&&audit.maxOverlap<=1&&audit.uniquePairs===300;
  if(!ok)throw new Error("RC6 invariant audit FAIL — portfolio C bị từ chối.");

  const aObj=A.tickets.reduce((s,t)=>s+ticketAffinity(t,sig.aff),0);
  const cObj=P.reduce((s,t)=>s+ticketAffinity(t,sig.aff),0);

  const rows=P.map(a=>{
    const matrixScore=ticketAffinity(a,sig.aff)/15*100;
    const consensusScore=a.reduce((s,n)=>s+sig.consensus[n],0)/6*100;
    return{a,matrixScore,consensusScore};
  }).sort((x,y)=>y.matrixScore-x.matrixScore||y.consensusScore-x.consensusScore);

  return{tickets:rows,audit,slots,slotEdges,matrixObjective:cObj,aMatrixObjective:aObj,gain:cObj-aObj};
}
function buildHybridPortfolio(){
  if(!historyReadyForTarget(targetId)){
    const p=pendingPredecessorForTarget(targetId);
    showToast(p?`C đang chờ feed xác nhận ${drawLabel(p)}.`:"Dữ liệu chính thức chưa đủ để tạo C.","warn");
    return;
  }

  if(knownTargetResult(targetId)&&!getLock(targetId)&&!isReplayTarget(targetId)){
    showToast(`Kỳ ${drawLabel(targetId)} đã có kết quả. Bộ C không được tạo mới sau kết quả.`,"warn");
    return;
  }

  if(hybridBuilding)return;
  if(!geo||!legacy||!legacyModel){if($("consensusNote"))$("consensusNote").textContent="Cần A + B sẵn sàng trước.";return}
  if(getLock(targetId))return;
  hybridBuilding=true;$("rebuildHybridBtn").disabled=true;
  try{
    const ds=draws.filter(d=>Number(d.id)<Number(targetId));
    consensusNums=buildConstrainedSignals(ds,geo,legacy);
    const result=optimizeConstrainedMapping(geo,consensusNums,targetId);
    hybrid=result.tickets;
    consensusNums.rc6=result;
    renderHybrid();
  }catch(e){
    console.error(e);
    if($("consensusNote"))$("consensusNote").textContent="RC6 lỗi: "+e.message;
    hybrid=null;
  }
  hybridBuilding=false;$("rebuildHybridBtn").disabled=!!getLock(targetId);renderState();
}
function renderHybrid(actual=[]){
  if(!hybrid||!consensusNums)return;
  const sig=consensusNums,nums55=[...Array(55)].map((_,i)=>i+1);
  const rows=rankHybridRows();

  $("consensusBalls").innerHTML=balls(rows[0].a,actual);
  $("consensusNote").innerHTML=`✓ <span class="good">Bộ C cho ${drawLabel(targetId)} đã sẵn sàng</span> • 20 vé đã được chấm điểm và xếp hạng.`;

  const top=nums55.slice().sort((a,b)=>sig.consensus[b]-sig.consensus[a]||sig.tie[b]-sig.tie[a]).slice(0,12);
  $("consensusList").innerHTML=top.map(n=>`<span class="chip">${String(n).padStart(2,"0")} • ${(sig.consensus[n]*100).toFixed(1)}</span>`).join("");
  $("geoSupportList").innerHTML=sig.boosted.map(n=>`<span class="chip">${String(n).padStart(2,"0")} • ×3</span>`).join("");

  const legacyTop=nums55.slice().sort((a,b)=>sig.legacy[b]-sig.legacy[a]).slice(0,12);
  $("legacySupportList").innerHTML=legacyTop.map(n=>`<span class="chip">${String(n).padStart(2,"0")} • ${(sig.legacy[n]*100).toFixed(0)}</span>`).join("");
  const heatTop=nums55.slice().sort((a,b)=>sig.heat[b]-sig.heat[a]).slice(0,12);
  $("hybridHeatList").innerHTML=heatTop.map(n=>`<span class="chip">${String(n).padStart(2,"0")} • ${(sig.heat[n]*100).toFixed(0)}</span>`).join("");

  const centralTop=nums55.slice().sort((a,b)=>sig.central[b]-sig.central[a]).slice(0,12);
  $("matrixCentralityList").innerHTML=centralTop.map(n=>`<span class="chip">${String(n).padStart(2,"0")} • ${(sig.central[n]*100).toFixed(1)}</span>`).join("");

  const pairs=[];
  for(let i=1;i<=55;i++)for(let j=i+1;j<=55;j++)pairs.push([i,j,sig.aff[i][j]]);
  pairs.sort((a,b)=>b[2]-a[2]);
  $("matrixPairList").innerHTML=pairs.slice(0,15).map(x=>`<span class="chip">${String(x[0]).padStart(2,"0")}-${String(x[1]).padStart(2,"0")} • ${(x[2]*100).toFixed(1)}</span>`).join("");

  const freqTop=nums55.slice().sort((a,b)=>sig.freq[b]-sig.freq[a]).slice(0,12);
  $("freqSupportList").innerHTML=freqTop.map(n=>`<span class="chip">${String(n).padStart(2,"0")} • ${(sig.freq[n]*100).toFixed(0)}</span>`).join("");
  const gapTop=nums55.slice().sort((a,b)=>sig.gap[b]-sig.gap[a]).slice(0,12);
  $("gapSupportList").innerHTML=gapTop.map(n=>`<span class="chip">${String(n).padStart(2,"0")} • ${(sig.gap[n]*100).toFixed(0)}</span>`).join("");

  const a=auditGeo(rows.map(x=>x.a)),rc=sig.rc6;
  const gain=rc?rc.gain:NaN;
  $("hybridMetrics").innerHTML=[
    ["Phủ số",a.coverage+"/55"],
    ["Số lần xuất hiện",`${a.double} số ×2 • ${a.triple} số ×3`],
    ["Cặp bị lặp",a.repeatedPairs],
    ["Trùng tối đa giữa 2 vé",a.maxOverlap],
    ["Điểm cao nhất",rows.length?rows[0].displayScore.toFixed(1):"—"],["Trạng thái","ĐẠT ĐIỀU KIỆN"]
  ].map(x=>`<div class="metric"><span>${x[0]}</span><b>${x[1]}</b></div>`).join("");

  $("hybridTickets").innerHTML=rows.map(p=>`<div class="ticket">
    <div class="ticketTop"><b>VÉ C${String(p.rank).padStart(2,"0")}</b><span>gốc #${String(p.originalIndex+1).padStart(2,"0")}</span></div>
    <div class="balls">${balls(p.a,actual)}</div>
    <div class="ticketRankRow">
      <span class="rankBadge ${rankClass(p.rank)}">Hạng #${p.rank}</span>
      <span class="ticketScore">Điểm <b>${p.displayScore.toFixed(1)}</b>/100</span>
    </div>
    <div class="scoreBar"><i style="width:${Math.max(0,Math.min(100,p.displayScore)).toFixed(1)}%"></i></div>
  </div>`).join("");
}



/* =========================
   RC6.5 — LEARNING ENGINE V1
   Học từ log prospective đã khóa. Không tự deploy.
   ========================= */
const LEARN_KEY="powerai_rc6_learning_report_v1";
function learnMean(a){return a.length?a.reduce((s,x)=>s+x,0)/a.length:0}
function safeCorr(xs,ys){
  if(xs.length<3||ys.length!==xs.length)return 0;
  const mx=learnMean(xs),my=learnMean(ys);let num=0,dx=0,dy=0;
  for(let i=0;i<xs.length;i++){const a=xs[i]-mx,b=ys[i]-my;num+=a*b;dx+=a*a;dy+=b*b}
  return dx>0&&dy>0?num/Math.sqrt(dx*dy):0;
}
function learningSourceLogs(){
  const all=allLogs().sort((a,b)=>Number(a.targetId)-Number(b.targetId));
  const confirmed=all.filter(x=>x.source==="feed");
  const pending=all.filter(x=>x.source==="manual");
  const use=confirmed.slice(-30);
  return{all,confirmed,pending,use,provisional:false};
}
function maturityFor(n){
  if(n>=20)return{pct:100,label:"Đủ dữ liệu để validation challenger"};
  if(n>=10)return{pct:70,label:"Đủ để tạo challenger thử nghiệm"};
  if(n>=5)return{pct:40,label:"Học sơ bộ"};
  return{pct:Math.min(20,n*4),label:"Chỉ quan sát • cần ít nhất 5 kỳ"};
}
function trackWindowStats(logs,k){
  if(!logs.length)return{n:0,avgBest:0,ge3:0,lead:0,solo:0,totalAvg:0};
  let lead=0,solo=0;
  for(const r of logs){
    const mx=Math.max(r.A.best,r.B.best,r.C.best);if(r[k].best===mx)lead++;
    const others=["A","B","C"].filter(x=>x!==k);
    if(r[k].best>r[others[0]].best&&r[k].best>r[others[1]].best)solo++;
  }
  return{n:logs.length,avgBest:learnMean(logs.map(r=>r[k].best)),ge3:logs.filter(r=>r[k].best>=3).length,lead,solo,totalAvg:learnMean(logs.map(r=>r[k].total))};
}
function rebuildLegacyForTarget(id){return buildLegacyModel(draws.filter(d=>Number(d.id)<Number(id)))}
function signalScoreForTicket(a,m){
  const c=legacyComponents(a,m);
  return{Heat:c.heat/100,Pair:c.pair/100,OddEven:c.odd/100,SmallBig:c.small/100,Sum:c.sum/100,LegacyTotal:c.score/100};
}
function evaluateBSignals(logs){
  const names=["Heat","Pair","OddEven","SmallBig","Sum","LegacyTotal"],bucket=Object.fromEntries(names.map(n=>[n,{scores:[],hits:[],drawCorr:[]}])) ;
  for(const log of logs){
    const L=getLock(log.targetId);if(!L?.B?.tickets?.length)continue;
    const m=rebuildLegacyForTarget(log.targetId),per=Object.fromEntries(names.map(n=>[n,{x:[],y:[]}])) ;
    for(const t of L.B.tickets){const s=signalScoreForTicket(t,m),h=hits(t,log.actual);for(const n of names){bucket[n].scores.push(s[n]);bucket[n].hits.push(h);per[n].x.push(s[n]);per[n].y.push(h)}}
    for(const n of names)bucket[n].drawCorr.push(safeCorr(per[n].x,per[n].y));
  }
  return names.map(name=>{
    const b=bucket[name],corr=safeCorr(b.scores,b.hits),drawAvg=learnMean(b.drawCorr),stability=b.drawCorr.length?b.drawCorr.filter(x=>x>0).length/b.drawCorr.length:0;
    const strength=.55*corr+.45*drawAvg;return{name,corr,drawAvg,stability,strength,nDraws:b.drawCorr.length};
  }).sort((a,b)=>b.strength-a.strength);
}
function scoreAForLockedTickets(tickets){
  const exp=Array(56).fill(0);tickets.forEach(t=>t.forEach(n=>exp[n]++));
  return tickets.map((t,idx)=>{const triple=t.filter(n=>exp[n]===3).length;let contacts=0;for(let j=0;j<tickets.length;j++)if(j!==idx&&overlap(t,tickets[j])>0)contacts++;return 100-triple*7-contacts*2.5});
}
function scoreCForLockedTickets(log,L){
  const hist=draws.filter(d=>Number(d.id)<Number(log.targetId)),fakeB=L.B.tickets.map(a=>({a})),sig=buildConstrainedSignals(hist,{tickets:L.A.tickets},fakeB);
  return L.C.tickets.map(t=>{const matrix=ticketAffinity(t,sig.aff)/15*100,cons=t.reduce((s,n)=>s+sig.consensus[n],0)/6*100;return(matrix+cons)/2});
}
function rankingCalibrationFor(logs){
  const out={A:{top:[],mid:[],low:[]},B:{top:[],mid:[],low:[]},C:{top:[],mid:[],low:[]}};
  for(const log of logs){
    const L=getLock(log.targetId);if(!L)continue;const lm=rebuildLegacyForTarget(log.targetId);
    const sets={A:[L.A.tickets,scoreAForLockedTickets(L.A.tickets)],B:[L.B.tickets,L.B.tickets.map(t=>legacyComponents(t,lm).score)],C:[L.C.tickets,scoreCForLockedTickets(log,L)]};
    for(const k of ["A","B","C"]){const [tickets,scores]=sets[k],rows=tickets.map((t,i)=>({t,s:scores[i],h:hits(t,log.actual)})).sort((x,y)=>y.s-x.s);out[k].top.push(...rows.slice(0,5).map(x=>x.h));out[k].mid.push(...rows.slice(5,15).map(x=>x.h));out[k].low.push(...rows.slice(15).map(x=>x.h))}
  }
  return out;
}
function buildChallenger(signals,n){
  if(n<10)return null;
  const base={Heat:.40,Pair:.30,OddEven:.10,SmallBig:.10,Sum:.10},raw={...base};
  const useful=signals.filter(s=>s.name!=="LegacyTotal"&&s.strength>0&&s.stability>=.55),weak=signals.filter(s=>s.name!=="LegacyTotal"&&(s.strength<=0||s.stability<.45));
  if(!useful.length)return{name:"B-L0 • Giữ nguyên",weights:base,reason:"Chưa có tín hiệu nào đủ ổn định để đề xuất đổi B.",ready:false};
  for(const s of useful)raw[s.name]=base[s.name]*(1+Math.min(.25,.15+Math.max(0,s.strength)*.15));
  for(const s of weak)raw[s.name]=base[s.name]*.85;
  const total=Object.values(raw).reduce((a,b)=>a+b,0);Object.keys(raw).forEach(k=>raw[k]/=total);
  return{name:"B-L1 • Learned Challenger",weights:raw,reason:`Tăng nhẹ ${useful.map(x=>x.name).join(", ")}; giảm tín hiệu kém ổn định. Chỉ dùng để validation, chưa thay B hiện tại.`,ready:n>=20};
}

function learningLockKey(id){return`powerai_rc6_learning_lock_${id}`}
function getLearningLock(id){try{return JSON.parse(localStorage.getItem(learningLockKey(id))||"null")}catch{return null}}

function baseLearningWeights(){
  return{Heat:.40,Pair:.30,OddEven:.10,SmallBig:.10,Sum:.10};
}
function learnedPortfolioWeights(report){
  const base=baseLearningWeights();
  if(!report?.signals?.length)return{weights:base,alpha:0,mode:"B-GỐC",note:"Chưa có báo cáo Learning nên chưa điều chỉnh trọng số."};

  const signalMap=Object.fromEntries(report.signals.filter(s=>s.name!=="LegacyTotal").map(s=>[s.name,s]));
  // Learning strength grows slowly and is capped at 25%.
  const alpha=Math.min(.25,(Number(report.n)||0)/20*.25);
  const raw={};
  for(const k of Object.keys(base)){
    const s=signalMap[k],strength=Math.max(-1,Math.min(1,Number(s?.strength)||0));
    raw[k]=base[k]*(1+alpha*strength);
  }
  const total=Object.values(raw).reduce((a,b)=>a+b,0)||1;
  const weights=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,v/total]));
  const n=Number(report.n)||0;
  const mode=n>=20?"VALIDATION CANDIDATE":n>=10?"CHALLENGER":n>=5?"HỌC SƠ BỘ":"PREVIEW";
  const note=n>=20
    ?"Đã có ≥20 kỳ: bộ L đủ điều kiện mang sang validation riêng, vẫn chưa thay B."
    :n>=10
      ?"Đã có ≥10 kỳ: Learning được phép tạo challenger, chưa thay B."
      :n>=5
        ?"Dữ liệu còn ít: điều chỉnh nhỏ, chủ yếu vẫn bám B gốc."
        :"Dữ liệu rất ít: Learning chỉ tác động rất nhẹ để tránh overfit.";
  return{weights,alpha,mode,note};
}
function learningScoreComponents(c,w){
  return w.Heat*c.heat+w.Pair*c.pair+w.OddEven*c.odd+w.SmallBig*c.small+w.Sum*c.sum;
}
function rankLearningRows(){
  if(!learningPortfolio?.length)return[];
  const rows=learningPortfolio.map((p,originalIndex)=>({...p,originalIndex,displayScore:Number(p.score)||0}));
  rows.sort((a,b)=>b.displayScore-a.displayScore||a.originalIndex-b.originalIndex);
  rows.forEach((x,i)=>x.rank=i+1);
  return rows;
}

function isVerifiedLog(log){return !!log&&log.source==="feed"}
function verifiedCompletedDraw(){
  let maxId=latest?Number(latest.id):0;
  for(const x of allLogs()){
    if(isVerifiedLog(x)&&x?.actual?.length===6)maxId=Math.max(maxId,Number(x.targetId)||0);
  }
  return maxId;
}
function pendingManualDraw(){
  let maxId=0;
  for(const x of allLogs()){
    if(x?.source==="manual"&&x?.actual?.length===6)maxId=Math.max(maxId,Number(x.targetId)||0);
  }
  return maxId||null;
}
function nextProspectiveTarget(){
  const maxDone=verifiedCompletedDraw();
  return maxDone>0?maxDone+1:Number(targetId);
}
function nextNavigableTarget(){
  const verifiedNext=nextProspectiveTarget(),pending=pendingManualDraw();
  return pending&&pending>=verifiedNext?Math.max(verifiedNext,pending+1):verifiedNext;
}
function historyReadyForTarget(id){
  const need=Number(id)-1;
  return verifiedCompletedDraw()>=need;
}
function pendingPredecessorForTarget(id){
  const prev=Number(id)-1,log=getLog(prev);
  return log?.source==="manual"?prev:null;
}
async function prepareAndBuildLearningPortfolio(){
  if(learningPortfolioBuilding)return;

  const desired=nextProspectiveTarget();

  // If user is looking at a completed draw, move them to the real next target.
  if(knownTargetResult(targetId)){
    showToast(`Kỳ ${drawLabel(targetId)} đã có kết quả. Đang chuyển sang ${drawLabel(desired)} để tạo L...`,"warn");
    await setTarget(desired);
  }

  if(getLearningLock(targetId)){
    showToast(`Bộ L cho ${drawLabel(targetId)} đã khóa rồi.`,"warn");
    return;
  }

  // L needs the same historical model foundation as B.
  if(!historyReadyForTarget(targetId)){
    const p=pendingPredecessorForTarget(targetId);
    showToast(p?`Chờ feed chính thức xác nhận ${drawLabel(p)} trước khi tạo L cho ${drawLabel(targetId)}.`:`Dữ liệu lịch sử chưa đủ đến kỳ trước ${drawLabel(targetId)}.`,"warn");
    return;
  }

  if(!legacyModel){
    showToast(`Đang chuẩn bị dữ liệu B cho ${drawLabel(targetId)}...`,"good");
    await buildLegacyPortfolio();
  }

  if(!legacyModel){
    showToast("Chưa chuẩn bị được dữ liệu B nên chưa thể tạo bộ L.","bad");
    return;
  }

  await buildLearningPortfolio(getLearningReport());
}

async function buildLearningPortfolio(report=getLearningReport()){
  if(!historyReadyForTarget(targetId)){
    const p=pendingPredecessorForTarget(targetId);
    showToast(p?`Learning không dùng kết quả nhập tay. Chờ xác nhận ${drawLabel(p)}.`:"Dữ liệu chính thức chưa đủ để tạo L.","warn");
    return;
  }

  if(learningPortfolioBuilding)return;
  const locked=getLearningLock(targetId);
  if(locked){
    learningPortfolio=locked.tickets.map(x=>({...x}));
    learningPortfolioMeta=locked.meta||null;
    renderLearningPortfolio();
    renderState();
    return;
  }
  if(knownTargetResult(targetId)){
    showToast(`Kỳ ${drawLabel(targetId)} đã có kết quả. Learning không tạo bộ L mới cho kỳ đã biết kết quả.`,"warn");
    return;
  }
  if(!legacyModel){
    showToast("Cần dữ liệu B sẵn sàng trước khi tạo bộ L.","warn");
    return;
  }

  learningPortfolioBuilding=true;
  if($("buildLearningPortfolioBtn"))$("buildLearningPortfolioBtn").disabled=true;
  try{
    const learned=learnedPortfolioWeights(report);
    const seed=(Number(targetId)*1301081+660066)>>>0;
    const pool=randomValidPool(50000,seed),scored=[];
    if($("learningPortfolioNote"))$("learningPortfolioNote").textContent="Đang chấm 50.000 bộ số...";
    await new Promise(r=>setTimeout(r,20));

    for(let i=0;i<pool.length;i++){
      const c=legacyComponents(pool[i].a,legacyModel);
      const score=learningScoreComponents(c,learned.weights);
      scored.push({a:pool[i].a,...c,score});
      if(i%5000===0){
        if($("learningPortfolioNote"))$("learningPortfolioNote").textContent=`Đang chấm ${i.toLocaleString("vi-VN")} / 50.000...`;
        await new Promise(r=>setTimeout(r,0));
      }
    }
    scored.sort((a,b)=>b.score-a.score);
    learningPortfolio=portfolioSelect(scored,20);
    learningPortfolioMeta={
      targetId:Number(targetId),
      reportCreatedAt:report?.createdAt||null,
      learningN:Number(report?.n)||0,
      provisional:!!report?.provisional,
      weights:learned.weights,
      alpha:learned.alpha,
      mode:learned.mode,
      note:learned.note,
      seed
    };
    renderLearningPortfolio();
    showToast(`Đã tạo 20 vé L • ${learned.mode}.`,"good");
  }catch(e){
    console.error(e);
    learningPortfolio=null;learningPortfolioMeta=null;
    showToast("Không tạo được bộ L: "+e.message,"bad");
  }finally{
    learningPortfolioBuilding=false;
    renderState();
  }
}
function renderLearningPortfolio(actual=[]){
  const lock=getLearningLock(targetId);
  if(lock&&!learningPortfolio){
    learningPortfolio=lock.tickets.map(x=>({...x}));
    learningPortfolioMeta=lock.meta||null;
  }
  const rows=rankLearningRows();
  if(!rows.length){
    $("learningTopBalls").innerHTML="";
    $("learningPortfolioMode").textContent="CHƯA TẠO";
    $("learningPortfolioNote").textContent=knownTargetResult(targetId)?`Kỳ ${drawLabel(targetId)} đã có kết quả. Bấm “Tạo 20 vé L” để tự chuyển sang ${drawLabel(nextProspectiveTarget())}.`:`Chạy Learning rồi tạo 20 vé L cho ${drawLabel(targetId)}.`;
    $("learningWeights").innerHTML="";
    $("learningPortfolioMetrics").innerHTML="";
    $("learningTickets").innerHTML="";
    $("learningLockNote").className="notice";
    $("learningLockNote").innerHTML=`Bộ L này dành cho <b>${drawLabel(targetId)}</b>. Muốn tính prospective thì phải tạo và khóa L trước khi biết kết quả kỳ đó.`;
    return;
  }

  const meta=learningPortfolioMeta||lock?.meta||{};
  $("learningTopBalls").innerHTML=balls(rows[0].a,actual);
  $("learningPortfolioMode").textContent=(lock?"ĐÃ KHÓA • ":"")+(meta.mode||"LEARNING");
  $("learningPortfolioNote").textContent=lock
    ?`Đã khóa ${new Date(lock.lockedAt).toLocaleString("vi-VN")} • dùng ${meta.learningN||0} kỳ học.`
    :(meta.note||"Bộ Learning thử nghiệm.");

  const w=meta.weights||baseLearningWeights();
  $("learningWeights").innerHTML=Object.entries(w).map(([k,v])=>`<span>${k}: <b>${(v*100).toFixed(1)}%</b></span>`).join("");

  const cov=new Set();rows.forEach(p=>p.a.forEach(n=>cov.add(n)));
  $("learningPortfolioMetrics").innerHTML=[
    ["Số vé","20"],
    ["Số khác nhau",cov.size+"/55"],
    ["Điểm cao nhất",rows[0].displayScore.toFixed(1)],
    ["Kỳ dùng để học",meta.learningN||0],
    ["Mức học",`${((meta.alpha||0)*100).toFixed(1)}%`]
  ].map(x=>`<div class="metric"><span>${x[0]}</span><b>${x[1]}</b></div>`).join("");

  $("learningLockNote").className="notice"+(lock?" learningLocked":"");
  $("learningLockNote").innerHTML=lock
    ?`<b>✓ Bộ L đã khóa.</b> Nếu kỳ này có kết quả, L sẽ được chấm cùng A/B/C và lưu vào log.`
    :`<b>Chưa khóa L cho ${drawLabel(targetId)}.</b> Đây mới là preview. Khóa trước khi biết kết quả kỳ này nếu muốn tính prospective.`;

  $("learningTickets").innerHTML=rows.map(p=>`<div class="ticket">
    <div class="ticketTop"><b>VÉ L${String(p.rank).padStart(2,"0")}</b><span>gốc #${String(p.originalIndex+1).padStart(2,"0")}</span></div>
    <div class="balls">${balls(p.a,actual)}</div>
    <div class="ticketRankRow">
      <span class="rankBadge ${rankClass(p.rank)}">Hạng #${p.rank}</span>
      <span class="ticketScore">Điểm L <b>${p.displayScore.toFixed(1)}</b>/100</span>
    </div>
    <div class="scoreBar"><i style="width:${Math.max(0,Math.min(100,p.displayScore)).toFixed(1)}%"></i></div>
  </div>`).join("");
}
function lockLearningPortfolio(){
  if(knownTargetResult(targetId)){
    showToast(`Không thể khóa L cho ${drawLabel(targetId)} vì kết quả đã được biết.`,"warn");
    return;
  }

  if(getLearningLock(targetId)){showToast("Bộ L của kỳ này đã khóa.","warn");return}
  const rows=rankLearningRows();
  if(rows.length!==20){showToast("Phải tạo đủ 20 vé L trước khi khóa.","warn");return}
  const obj={
    version:"RC6.6 LearningPortfolio",
    targetId:Number(targetId),
    lockedAt:new Date().toISOString(),
    tickets:rows.map(p=>({a:p.a,score:p.displayScore})),
    meta:{...(learningPortfolioMeta||{}),lockedFromReport:getLearningReport()?.createdAt||null},
    hash:simpleHash(rows.map(p=>p.a))
  };
  localStorage.setItem(learningLockKey(targetId),JSON.stringify(obj));cloudSyncSoon();
  learningPortfolio=obj.tickets.map(x=>({...x}));
  learningPortfolioMeta=obj.meta;
  renderLearningPortfolio();
  renderState();
  showToast(`Đã khóa 20 vé Learning cho kỳ #${targetId}.`,"good");
}
function learningLogStats(){
  const logs=allLogs().filter(x=>x.L);
  if(!logs.length)return null;
  return{
    n:logs.length,
    avgBest:logs.reduce((s,x)=>s+x.L.best,0)/logs.length,
    ge3:logs.filter(x=>x.L.best>=3).length,
    avgTotal:logs.reduce((s,x)=>s+x.L.total,0)/logs.length,
    lead:logs.filter(x=>x.L.best>=Math.max(x.A.best,x.B.best,x.C.best)).length,
    solo:logs.filter(x=>x.L.best>x.A.best&&x.L.best>x.B.best&&x.L.best>x.C.best).length
  };
}

function saveLearningReport(r){try{localStorage.setItem(LEARN_KEY,JSON.stringify(r));cloudSyncSoon()}catch{}}
function getLearningReport(){try{return JSON.parse(localStorage.getItem(LEARN_KEY)||"null")}catch{return null}}
function renderLearningReport(report){
  const src=learningSourceLogs(),n=report?.n||0,m=maturityFor(n);if(!$("learnTotalLogs"))return;
  $("learnTotalLogs").textContent=src.all.length;$("learnConfirmedLogs").textContent=src.confirmed.length;$("learnMaturity").textContent=m.pct+"%";$("learnMaturityNote").textContent=m.label;$("learnState").textContent=report?"ĐÃ HỌC":"CHƯA CHẠY";
  if(!report){$("learningTrackCards").innerHTML="";$("learningTrendNote").textContent="Chưa có báo cáo Learning.";$("signalLearningTable").innerHTML="Chưa chạy Learning.";$("rankingCalibration").innerHTML="";$("challengerBox").innerHTML="Chưa đủ dữ liệu để tạo challenger.";return}
  $("learningTrackCards").innerHTML=["A","B","C"].map(k=>{const s=report.track[k],name=k==="A"?"Toán học":k==="B"?"Lịch sử":"Kết hợp";return`<div class="learnTrack ${k.toLowerCase()}"><h3>${k} • ${name}</h3><div class="big">${s.avgBest.toFixed(2)}</div><div class="sub">TB số trúng của vé tốt nhất</div><dl><dt>Kỳ dẫn / hòa</dt><dd>${s.lead}/${s.n}</dd><dt>Kỳ dẫn riêng</dt><dd>${s.solo}/${s.n}</dd><dt>Kỳ có ≥3 số</dt><dd>${s.ge3}/${s.n}</dd><dt>TB tổng số trùng / 20 vé</dt><dd>${s.totalAvg.toFixed(1)}</dd></dl></div>`}).join("")+(()=>{
    const l=learningLogStats();
    return l?`<div class="learnTrack l"><h3>L • Learning</h3><div class="big">${l.avgBest.toFixed(2)}</div><div class="sub">TB số trúng của vé tốt nhất</div><dl><dt>Kỳ dẫn / hòa A/B/C</dt><dd>${l.lead}/${l.n}</dd><dt>Kỳ dẫn riêng</dt><dd>${l.solo}/${l.n}</dd><dt>Kỳ có ≥3 số</dt><dd>${l.ge3}/${l.n}</dd><dt>TB tổng số trùng / 20 vé</dt><dd>${l.avgTotal.toFixed(1)}</dd></dl></div>`:`<div class="learnTrack l"><h3>L • Learning</h3><div class="big">—</div><div class="sub">Chưa có kỳ L nào được khóa và chấm.</div><dl><dt>Việc cần làm</dt><dd>Khóa L trước kỳ quay</dd></dl></div>`;
  })();
  const order=["A","B","C"].sort((x,y)=>report.track[y].avgBest-report.track[x].avgBest);$("learningTrendNote").innerHTML=`<b>Hiện tại:</b> ${order[0]} có Best-hit trung bình cao nhất trong ${n} kỳ học. ${report.provisional?'<span class="warn">Đang dùng cả log thủ công vì chưa đủ 3 kỳ feed chính thức.</span>':'Chỉ dùng các kỳ đã xác nhận chính thức.'}`;
  $("signalLearningTable").className="learningTable";$("signalLearningTable").innerHTML=`<div class="tableScroll"><table><thead><tr><th>Tín hiệu B</th><th>Tương quan vé→hit</th><th>TB theo từng kỳ</th><th>Kỳ dương</th><th>Đánh giá</th></tr></thead><tbody>${report.signals.map(s=>{const state=s.stability>=.65&&s.strength>0?"good":s.stability>=.45?"watch":"weak",label=state==="good"?"Ổn định":state==="watch"?"Theo dõi":"Yếu",pct=Math.max(0,Math.min(100,(s.strength+1)/2*100));return`<tr><td><b>${s.name}</b></td><td>${s.corr.toFixed(3)}</td><td>${s.drawAvg.toFixed(3)}</td><td>${Math.round(s.stability*100)}%</td><td><div class="signalBar"><i style="width:${pct.toFixed(0)}%"></i></div><span class="signalState ${state}">${label}</span></td></tr>`}).join("")}</tbody></table></div>`;
  $("rankingCalibration").innerHTML=["A","B","C"].map(k=>{const r=report.calibration[k],d=learnMean(r.top)-learnMean(r.low);return`<div class="calCard"><h3>${k} • Xếp hạng vé</h3><div class="calRow"><span>Top 5 • hit TB</span><b>${learnMean(r.top).toFixed(2)}</b></div><div class="calRow"><span>Hạng 6–15 • hit TB</span><b>${learnMean(r.mid).toFixed(2)}</b></div><div class="calRow"><span>Hạng 16–20 • hit TB</span><b>${learnMean(r.low).toFixed(2)}</b></div><div class="calRow"><span>Top 5 hơn cuối bảng</span><b class="${d>=0?'good':'bad'}">${d>=0?'+':''}${d.toFixed(2)}</b></div></div>`}).join("");
  const ch=report.challenger;if(!ch){$("challengerBox").className="challengerBox emptyLearning";$("challengerBox").innerHTML=`Cần ít nhất 10 kỳ học trước khi tạo challenger. Hiện có ${n} kỳ.`}else{$("challengerBox").className="challengerBox";$("challengerBox").innerHTML=`<div class="challengerTitle">${ch.name}</div><div>${ch.reason}</div><div class="challengerWeights">${Object.entries(ch.weights).map(([k,v])=>`<span>${k}: <b>${(v*100).toFixed(1)}%</b></span>`).join("")}</div><div class="${ch.ready?'good':'learnWarning'}">${ch.ready?'Đủ dữ liệu để đưa challenger sang validation riêng.':'Chưa deploy. Cần khoảng 20 kỳ để đánh giá nghiêm túc hơn.'}</div>`}
  renderLearningPortfolio();
}
function runLearning(){
  const btn=$("runLearningBtn");btn.disabled=true;btn.textContent="⏳ Đang học...";
  setTimeout(()=>{try{const src=learningSourceLogs(),logs=src.use;if(!logs.length){showToast("Chưa có kỳ nào được feed chính thức xác nhận để Learning học.","warn");return}const track={A:trackWindowStats(logs,"A"),B:trackWindowStats(logs,"B"),C:trackWindowStats(logs,"C")},signals=evaluateBSignals(logs),calibration=rankingCalibrationFor(logs),challenger=buildChallenger(signals,logs.length),report={createdAt:new Date().toISOString(),n:logs.length,provisional:src.provisional,track,signals,calibration,challenger};saveLearningReport(report);renderLearningReport(report);prepareAndBuildLearningPortfolio();showToast(`Learning đã cập nhật từ ${logs.length} kỳ.`,"good")}catch(e){console.error(e);showToast("Learning lỗi: "+e.message,"bad")}finally{btn.disabled=false;btn.textContent="Chạy Learning"}},40);
}
function resetLearning(){
  try{localStorage.removeItem(LEARN_KEY);cloudSyncSoon()}catch{}
  if(!getLearningLock(targetId)){learningPortfolio=null;learningPortfolioMeta=null}
  renderLearningReport(null);renderLearningPortfolio();
  showToast("Đã xóa báo cáo Learning. Các bộ L đã khóa và log A/B/C/L vẫn giữ nguyên.","good")
}


/* RC6.6.1 target-clarity helpers */
function drawLabel(id){return"#"+String(Number(id)||0).padStart(5,"0")}
function knownTargetResult(id){
  return hasOfficialResult(id)||!!getLog(id);
}
function targetStateInfo(){
  const official=hasOfficialResult(targetId),log=getLog(targetId),mainLock=getLock(targetId);
  const verifiedNext=nextProspectiveTarget(),navNext=nextNavigableTarget(),pending=pendingManualDraw();

  if(official&&isReplayTarget(targetId))return{kind:"past",label:"XEM LẠI • REPLAY",desc:"Dựng lại A/B/C bằng đúng dữ liệu trước kỳ này để tham khảo. Replay không được tính vào prospective, Learning hay bảng thành tích."};
  if(official||log?.source==="feed")return{kind:"feed",label:"ĐÃ XÁC NHẬN",desc:"Kỳ này đã có kết quả chính thức. Nếu có snapshot đã khóa từ trước, hệ thống giữ nguyên snapshot đó để đối chiếu."};
  if(log?.source==="manual")return{kind:"pending",label:"NHẬP TAY • CHỜ XÁC NHẬN",desc:"Kết quả này chỉ để xem tạm. Không được dùng cho Learning hoặc dữ liệu B/C/L cho kỳ kế tiếp."};
  if(!historyReadyForTarget(targetId)){
    const p=pendingPredecessorForTarget(targetId);
    return{kind:"blocked",label:"CHỜ KỲ TRƯỚC XÁC NHẬN",desc:p?`Đã mở tạm ${drawLabel(targetId)} nhưng ${drawLabel(p)} mới là kết quả nhập tay. A vẫn xem được; B/C/L phải chờ feed chính thức.`:"Dữ liệu chính thức chưa đủ đến kỳ trước."};
  }
  if(mainLock)return{kind:"locked",label:"A/B/C ĐÃ KHÓA",desc:"A/B/C đã khóa trước kết quả. Chờ kết quả chính thức để đối chiếu."};
  if(Number(targetId)===verifiedNext)return{kind:"future",label:"KỲ TIẾP THEO",desc:`Đây là kỳ prospective chính thức sau ${drawLabel(verifiedNext-1)}.`};
  if(Number(targetId)<=verifiedCompletedDraw())return{kind:"past",label:"KỲ CŨ / XEM LẠI",desc:"Đây là kỳ lịch sử. Chỉ snapshot đã khóa từ trước mới có giá trị prospective."};
  if(pending&&Number(targetId)<=navNext)return{kind:"pending",label:"MỞ TẠM",desc:"Kỳ này được mở tạm trong lúc chờ feed; không dùng dữ liệu nhập tay cho model."};
  return{kind:"view",label:"KỲ ĐANG CHỌN",desc:"Kiểm tra số kỳ trước khi khóa."};
}
function contextHTML(track){
  const s=targetStateInfo(),id=drawLabel(targetId),cut=latest?drawLabel(Math.min(Number(targetId)-1,Number(latest.id))):"—";
  const descriptions={
    A:`<b>Bộ A Simulation Optimizer dành cho ${id}</b>. A không dùng lịch sử xổ số; nó tìm nhiều cấu trúc hợp lệ và chọn dàn ổn định hơn trên mô phỏng ngẫu nhiên đồng nhất.`,
    B:`<b>Bộ B dành cho ${id}</b>. B chỉ được phép dùng dữ liệu trước ${id}; cutoff hiện tại là <b>${$("#cutoffId")?.textContent||cut}</b>.`,
    C:`<b>Bộ C dành cho ${id}</b>. C dùng khung A đã tối ưu mô phỏng của ${id} và dữ liệu lịch sử trước ${id}.`,
    L:`<b>Bộ L dành cho ${id}</b>. Learning học từ các kỳ đã hoàn tất trước đó, rồi tạo 20 vé L riêng cho ${id}.`
  };
  return`<div class="targetMain">${track} • ${id}</div><div class="targetDesc">${descriptions[track]}<br><span class="muted">${s.desc}</span></div><span class="targetState ${s.kind}">${s.label}</span>`;
}
function renderTargetContexts(){
  if($("trackContextA"))$("trackContextA").innerHTML=contextHTML("A");
  if($("trackContextB"))$("trackContextB").innerHTML=contextHTML("B");
  if($("trackContextC"))$("trackContextC").innerHTML=contextHTML("C");
  if($("trackContextL"))$("trackContextL").innerHTML=contextHTML("L");
  if($("learningTargetInline"))$("learningTargetInline").textContent=drawLabel(targetId);

  if($("tabSubA"))$("tabSubA").textContent=`Tối ưu 20 vé cho ${drawLabel(targetId)}`;
  if($("tabSubB"))$("tabSubB").textContent=`Dữ liệu trước ${drawLabel(targetId)}`;
  if($("tabSubC"))$("tabSubC").textContent=`20 vé cho ${drawLabel(targetId)}`;
  if($("tabSubL"))$("tabSubL").textContent=`Học quá khứ → vé cho ${drawLabel(targetId)}`;
}

/* RC6.2.1 interaction helpers */
let toastTimer=null;
function showToast(message,type="good"){
  const el=$("toast");if(!el)return;
  el.textContent=message;el.className=`toast ${type} show`;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.className="toast",2200);
}
function syncTrackPills(tabId){
  document.querySelectorAll("[data-open-tab]").forEach(p=>{
    p.classList.toggle("selected",p.dataset.openTab===tabId);
  });
}
function activateTrack(tabId,{scroll=false}={}){
  const btn=[...document.querySelectorAll(".tab")].find(x=>x.dataset.tab===tabId);
  const pane=$(tabId);
  if(!btn||!pane)return false;

  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".tabPane").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active");
  pane.classList.add("active");
  syncTrackPills(tabId);

  try{localStorage.setItem("powerai_rc6_ui_tab",tabId);cloudSyncSoon()}catch{}

  if(scroll){
    // Scroll to the actual content, not just change an off-screen tab.
    requestAnimationFrame(()=>{
      pane.scrollIntoView({behavior:"smooth",block:"start"});
      pane.classList.remove("trackNavFlash");
      void pane.offsetWidth;
      pane.classList.add("trackNavFlash");
    });
  }
  return true;
}
function openTrack(tabId){
  if(activateTrack(tabId,{scroll:true})){
    const name=tabId==="geometryTab"?`A Simulation • ${drawLabel(targetId)}`:tabId==="legacyTab"?`B • ${drawLabel(targetId)}`:tabId==="hybridTab"?`C • ${drawLabel(targetId)}`:`Learning • ${drawLabel(targetId)}`;
    showToast(`Đã mở ${name}.`,"good");
  }
}
function hasOfficialResult(id){
  return !!draws.find(x=>Number(x.id)===Number(id));
}
function isReplayTarget(id){
  return hasOfficialResult(id)&&!getLock(id)&&!getLog(id);
}
function previousNavigableTarget(){
  const cur=Number(targetId);
  const ids=draws.map(d=>Number(d.id)).filter(id=>Number.isFinite(id)&&id<cur);
  return ids.length?ids[ids.length-1]:null;
}
async function openLoggedTarget(id){
  await setTarget(Number(id));
  const log=getLog(Number(id));
  if(log)renderCompare(log);
  document.querySelector(".comparePanel")?.scrollIntoView({behavior:"smooth",block:"start"});
}
function fallbackCopy(text){
  const ta=document.createElement("textarea");
  ta.value=text;ta.setAttribute("readonly","");
  ta.style.position="fixed";ta.style.opacity="0";ta.style.pointerEvents="none";
  document.body.appendChild(ta);ta.select();
  let ok=false;
  try{ok=document.execCommand("copy")}catch{}
  ta.remove();
  return ok;
}

/* Lock + prospective logs */
function lockKey(id){return`powerai_rc6_lock_${id}`}
function logKey(id){return`powerai_rc6_log_${id}`}
function getLock(id){try{return JSON.parse(localStorage.getItem(lockKey(id))||"null")}catch{return null}}
function getLog(id){try{return JSON.parse(localStorage.getItem(logKey(id))||"null")}catch{return null}}
function lockBoth(){
  if(knownTargetResult(targetId)){
    showToast(`Không thể khóa A/B/C cho ${drawLabel(targetId)} vì kết quả đã được biết.`,"warn");
    return;
  }

  if(!geo||!legacy||legacy.length!==20||!hybrid||hybrid.length!==20){alert("Cả 3 track chưa sẵn sàng.");return}
  const ds=draws.filter(d=>Number(d.id)<Number(targetId));
  const obj={version:"RC7.0 ASimulationOptimizer",targetId:Number(targetId),cutoffId:ds.length?Number(ds.at(-1).id):null,lockedAt:new Date().toISOString(),
    A:{name:"A7 Simulation Optimizer",engine:geo.engine||"A7 Simulation Optimizer",tickets:geo.tickets,hash:simpleHash(geo.tickets),seed:geo.seed,analysis:geo.analysis||null},
    B:{name:"Legacy Analytics V1.3",tickets:legacy.map(p=>p.a),hash:simpleHash(legacy.map(p=>p.a)),formula:"40 Heat + 30 Pair + 10 Odd + 10 Small + 10 Sum"},
    C:{name:"Geometry-Constrained Matrix Hybrid",tickets:hybrid.map(p=>p.a),hash:simpleHash(hybrid.map(p=>p.a)),formula:"A geometry skeleton locked; robust rank consensus selects 10 triple-exposure numbers; robust pair matrix optimizes label assignment within triple/double groups"}};
  localStorage.setItem(lockKey(targetId),JSON.stringify(obj));cloudSyncSoon();renderState();showToast(`Đã khóa A, B và C cho kỳ #${targetId}.`,"good");checkOfficial();
}
function scoreTrack(P,actual){
  const hs=P.map(t=>hits(t,actual)),best=Math.max(...hs),bestIdx=hs.indexOf(best);
  return{best,bestIdx,total:hs.reduce((a,b)=>a+b,0),g2:hs.filter(x=>x>=2).length,g3:hs.filter(x=>x>=3).length,g4:hs.filter(x=>x>=4).length,hs};
}
function saveResult(actual,source){
  const L=getLock(targetId);if(!L){alert("Phải khóa CẢ 3 track trước khi chấm kết quả.");return}
  const A=scoreTrack(L.A.tickets,actual),B=scoreTrack(L.B.tickets,actual),C=scoreTrack(L.C.tickets,actual),
    LL=getLearningLock(targetId),LS=LL?.tickets?.length===20?scoreTrack(LL.tickets.map(x=>x.a||x),actual):null,
    obj={targetId:Number(targetId),source,actual,checkedAt:new Date().toISOString(),lockedAt:L.lockedAt,A,B,C,hashA:L.A.hash,hashB:L.B.hash,hashC:L.C.hash};
  if(LS){obj.L=LS;obj.learningLockedAt=LL.lockedAt;obj.hashL=LL.hash}
  localStorage.setItem(logKey(targetId),JSON.stringify(obj));cloudSyncSoon();renderCompare(obj);renderHistory();renderState();
  renderGeo(actual);
  legacy=L.B.tickets.map(a=>({a,score:0,heat:0,pair:0}));renderLegacyTickets(actual);
  hybrid=L.C.tickets.map(a=>({a}));if(!consensusNums){const ds=draws.filter(d=>Number(d.id)<Number(targetId));consensusNums=buildConstrainedSignals(ds,geo,legacy)}renderHybrid(actual);
  const LLock=getLearningLock(targetId);if(LLock){learningPortfolio=LLock.tickets.map(x=>({...x}));learningPortfolioMeta=LLock.meta||null;renderLearningPortfolio(actual)}
}
function parseManual(s){
  const a=(s.match(/\d+/g)||[]).map(Number);if(a.length!==6||new Set(a).size!==6||a.some(n=>n<1||n>55))throw new Error("Nhập đúng 6 số khác nhau từ 1–55.");return a.sort((x,y)=>x-y);
}
function manualResult(){
  try{
    if(hasOfficialResult(targetId)){
      checkOfficial();
      showToast("Kỳ này đã có kết quả trên feed; feed được giữ làm chuẩn.","warn");
      return;
    }
    saveResult(parseManual($("manualResult").value),"manual");
    showToast("Đã lưu TẠM kết quả nhập tay. Kết quả này không được Learning dùng và chưa được coi là chính thức.","warn");
  }catch(e){showToast(e.message,"bad")}
}
function checkOfficial(){
  const d=draws.find(x=>Number(x.id)===Number(targetId));if(!d)return;
  const L=getLock(targetId);if(!L)return;
  const actual=nums(d),prev=getLog(targetId);

  if(prev?.source==="feed"&&prev.actual.join(",")===actual.join(","))return;

  if(prev?.source==="manual"){
    const same=prev.actual.join(",")===actual.join(",");
    if(!same)console.warn("Kết quả nhập thủ công khác dữ liệu chính thức; dữ liệu chính thức được dùng làm chuẩn.");
    saveResult(actual,"feed");
    showToast(
      same ? "Kết quả thủ công đã được xác nhận từ dữ liệu chính thức."
           : "Dữ liệu chính thức khác kết quả nhập tay; hệ thống đã tự cập nhật.",
      same ? "good" : "warn"
    );
    return;
  }
  saveResult(actual,"feed");
}

/* comparison/history */
function leaders(vals){
  const mx=Math.max(...vals),labs=["A","B","C"].filter((x,i)=>vals[i]===mx);
  return labs.length===3?"Hòa A/B/C":labs.length===2?("Hòa "+labs.join("/")):labs[0];
}

function resultSourceLabel(source){
  if(source==="feed"){
    return `<span class="resultSource feed"><i class="sourceDot"></i>Đã xác nhận từ dữ liệu chính thức</span>`;
  }
  return `<span class="resultSource manual"><i class="sourceDot"></i>TẠM • nhập thủ công • KHÔNG dùng để học</span>`;
}
function historySourceLabel(source){
  return source==="feed"
    ? `<span class="historySource feed">● Đã xác nhận</span>`
    : `<span class="historySource manual">● Tạm • chưa tính thống kê</span>`;
}
function metricLeadCounts(M){
  const c={A:0,B:0,C:0};
  for(const x of M){
    const mx=Math.max(x[1],x[2],x[3]);
    if(x[1]===mx)c.A++;
    if(x[2]===mx)c.B++;
    if(x[3]===mx)c.C++;
  }
  return c;
}

function renderCompare(log){
  if(!log){$("compareBox").innerHTML='<span class="muted">Chưa có kết quả kỳ đang chọn.</span>';return}

  const L=getLock(log.targetId),M=[
    ["Vé trúng nhiều số nhất",log.A.best,log.B.best,log.C.best],
    ["Tổng số trùng trên 20 vé",log.A.total,log.B.total,log.C.total],
    ["Số vé trúng ≥2 số",log.A.g2,log.B.g2,log.C.g2],
    ["Số vé trúng ≥3 số",log.A.g3,log.B.g3,log.C.g3],
    ["Số vé trúng ≥4 số",log.A.g4,log.B.g4,log.C.g4]
  ];

  const lc=metricLeadCounts(M),maxLead=Math.max(lc.A,lc.B,lc.C);
  const winnerClass=k=>lc[k]===maxLead&&maxLead>0?"metricWinner":"";
  const metricRow=(x,idx)=> {
    const mx=Math.max(x[1],x[2],x[3]),isLead=x[idx]===mx;
    return `<div class="compareMetric ${isLead?'metricLead':''}"><span>${x[0]}</span><b class="${isLead?'lead':''}">${x[idx]}</b></div>`;
  };

  $("compareBox").innerHTML=`
  <div class="notice">
    Kết quả #${log.targetId}: <b>${log.actual.map(n=>String(n).padStart(2,"0")).join(" ")}</b>
    ${resultSourceLabel(log.source)}
    <span class="muted">• khóa ${new Date(log.lockedAt).toLocaleString("vi-VN")}</span>
  </div>
  <div class="compareGrid">
    <div class="compareCol">
      <h3>Chỉ số / Bên dẫn</h3>
      ${M.map(x=>`<div class="compareMetric"><span>${x[0]}</span><b>${leaders([x[1],x[2],x[3]])}</b></div>`).join("")}
    </div>

    <div class="compareCol ${winnerClass("A")}">
      <h3>A • Toán học</h3>
      <div class="balls">${balls(L.A.tickets[log.A.bestIdx],log.actual)}</div>
      ${M.map(x=>metricRow(x,1)).join("")}
    </div>

    <div class="compareCol ${winnerClass("B")}">
      <h3>B • Lịch sử</h3>
      <div class="balls">${balls(L.B.tickets[log.B.bestIdx],log.actual)}</div>
      ${M.map(x=>metricRow(x,2)).join("")}
    </div>

    <div class="compareCol ${winnerClass("C")}">
      <h3>C • Kết hợp</h3>
      <div class="balls">${balls(L.C.tickets[log.C.bestIdx],log.actual)}</div>
      ${M.map(x=>metricRow(x,3)).join("")}
    </div>
  </div>`;

  const cb=$("compareBox");
  if(cb){cb.classList.remove("resultFlash");void cb.offsetWidth;cb.classList.add("resultFlash")}
}
function renderReplayCompare(){
  const d=draws.find(x=>Number(x.id)===Number(targetId));
  if(!d||!isReplayTarget(targetId)){renderCompare(null);return}
  if(!geo?.tickets?.length||!legacy?.length||!hybrid?.length){
    $("compareBox").innerHTML=`<div class="notice"><b>Xem lại ${drawLabel(targetId)}</b> • đang dựng lại A/B/C bằng dữ liệu trước kỳ này...</div>`;
    return;
  }
  const actual=nums(d),AT=geo.tickets,BT=legacy.map(x=>x.a),CT=hybrid.map(x=>x.a),A=scoreTrack(AT,actual),B=scoreTrack(BT,actual),C=scoreTrack(CT,actual),M=[
    ["Vé trúng nhiều số nhất",A.best,B.best,C.best],
    ["Tổng số trùng trên 20 vé",A.total,B.total,C.total],
    ["Số vé trúng ≥2 số",A.g2,B.g2,C.g2],
    ["Số vé trúng ≥3 số",A.g3,B.g3,C.g3],
    ["Số vé trúng ≥4 số",A.g4,B.g4,C.g4]
  ];
  const lc=metricLeadCounts(M),maxLead=Math.max(lc.A,lc.B,lc.C),winnerClass=k=>lc[k]===maxLead&&maxLead>0?"metricWinner":"";
  const metricRow=(x,idx)=>{const mx=Math.max(x[1],x[2],x[3]),lead=x[idx]===mx;return`<div class="compareMetric ${lead?'metricLead':''}"><span>${x[0]}</span><b class="${lead?'lead':''}">${x[idx]}</b></div>`};
  $("compareBox").innerHTML=`
    <div class="notice replayNotice">
      <b>XEM LẠI ${drawLabel(targetId)}</b> • Kết quả chính thức: <b>${actual.map(n=>String(n).padStart(2,"0")).join(" ")}</b>
      <span class="resultSource manual"><i class="sourceDot"></i>REPLAY • dựng lại sau kết quả • KHÔNG tính prospective / Learning</span>
      <span class="muted">• chỉ dùng dữ liệu trước ${drawLabel(targetId)} cho B/C</span>
    </div>
    <div class="compareGrid">
      <div class="compareCol"><h3>Chỉ số / Bên dẫn</h3>${M.map(x=>`<div class="compareMetric"><span>${x[0]}</span><b>${leaders([x[1],x[2],x[3]])}</b></div>`).join("")}</div>
      <div class="compareCol ${winnerClass("A")}"><h3>A • Mô phỏng</h3><div class="balls">${balls(AT[A.bestIdx],actual)}</div>${M.map(x=>metricRow(x,1)).join("")}</div>
      <div class="compareCol ${winnerClass("B")}"><h3>B • Lịch sử</h3><div class="balls">${balls(BT[B.bestIdx],actual)}</div>${M.map(x=>metricRow(x,2)).join("")}</div>
      <div class="compareCol ${winnerClass("C")}"><h3>C • Kết hợp</h3><div class="balls">${balls(CT[C.bestIdx],actual)}</div>${M.map(x=>metricRow(x,3)).join("")}</div>
    </div>`;
  renderGeo(actual);renderLegacyTickets(actual);renderHybrid(actual);
}
function allLogs(){
  const out=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith("powerai_rc6_log_")){try{out.push(JSON.parse(localStorage.getItem(k)))}catch{}}}
  return out.sort((a,b)=>a.targetId-b.targetId);
}

function sparkPath(values,w=100,h=100,pad=8){
  if(!values.length)return"";
  const max=Math.max(4,...values),min=0,dx=values.length>1?(w-pad*2)/(values.length-1):0;
  return values.map((v,i)=>{
    const x=pad+i*dx,y=h-pad-((v-min)/(max-min||1))*(h-pad*2);
    return`${i?"L":"M"}${x.toFixed(2)},${y.toFixed(2)}`
  }).join(" ");
}
function renderTrendChart(H){
  const box=$("trendChart"),ins=$("historyInsights");
  if(!box||!ins)return;
  if(!H.length){
    box.className="trendChart emptyChart";box.innerHTML="<span>Chưa đủ log prospective để vẽ trend.</span>";ins.innerHTML="";return;
  }

  box.className="trendChart";
  const W=1000,Hh=190,padL=34,padR=16,padT=14,padB=28,maxY=Math.max(4,...H.flatMap(x=>[x.A.best,x.B.best,x.C.best]));
  const x=i=>padL+(H.length===1?0:(i/(H.length-1))*(W-padL-padR));
  const y=v=>padT+(maxY-v)/maxY*(Hh-padT-padB);
  const pathFor=k=>H.map((r,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(r[k].best).toFixed(1)}`).join(" ");
  const pts=(k,cls)=>H.map((r,i)=>`<circle class="chartPoint" cx="${x(i)}" cy="${y(r[k].best)}" r="3" fill="${cls}" opacity=".9"><title>#${r.targetId} • ${k} Best ${r[k].best}</title></circle>`).join("");
  const labels=[0,1,2,3,4].filter(v=>v<=maxY).map(v=>`<text x="9" y="${y(v)+3}" class="chartAxis">${v}</text>`).join("");
  const xLabels=H.length<=10?H.map((r,i)=>`<text x="${x(i)}" y="${Hh-8}" text-anchor="middle" class="chartAxis">#${String(r.targetId).slice(-3)}</text>`).join("") :
    [0,Math.floor((H.length-1)/2),H.length-1].map(i=>`<text x="${x(i)}" y="${Hh-8}" text-anchor="middle" class="chartAxis">#${String(H[i].targetId).slice(-3)}</text>`).join("");

  box.innerHTML=`<svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" aria-label="Best hit trend">
    ${labels}${xLabels}
    <path d="${pathFor("A")}" fill="none" stroke="#64b5ff" stroke-width="2.4" vector-effect="non-scaling-stroke"/>
    <path d="${pathFor("B")}" fill="none" stroke="#ffc96b" stroke-width="2.4" vector-effect="non-scaling-stroke"/>
    <path d="${pathFor("C")}" fill="none" stroke="#a98aff" stroke-width="2.6" vector-effect="non-scaling-stroke"/>
    ${pts("A","#64b5ff")}${pts("B","#ffc96b")}${pts("C","#a98aff")}
  </svg>`;

  const avg=k=>H.reduce((s,r)=>s+r[k].best,0)/H.length;
  const ge=k=>H.filter(r=>r[k].best>=3).length;
  let soloC=0,topC=0;
  for(const r of H){const m=Math.max(r.A.best,r.B.best,r.C.best);if(r.C.best===m)topC++;if(r.C.best>r.A.best&&r.C.best>r.B.best)soloC++}
  ins.innerHTML=[
    ["C • TB vé tốt nhất",avg("C").toFixed(2),`A ${avg("A").toFixed(2)} • B ${avg("B").toFixed(2)}`],
    ["C • Kỳ có ≥3 số",`${ge("C")}/${H.length}`,`A ${ge("A")} • B ${ge("B")}`],
    ["C • Dẫn hoặc hòa",`${topC}/${H.length}`,"tính cả kỳ hòa"],
    ["C • Dẫn riêng",`${soloC}/${H.length}`,"cao hơn cả A và B"]
  ].map(x=>`<div class="insightMini"><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>`).join("");
}
function renderRecentStrip(H){
  const el=$("recentStrip");if(!el)return;
  if(!H.length){el.innerHTML="";return}
  el.innerHTML=H.slice(-8).reverse().map(r=>{
    const m=Math.max(r.A.best,r.B.best,r.C.best),wins=["A","B","C"].filter(k=>r[k].best===m);
    const w=wins.length===1?wins[0]:"=",cls=w==="A"?"wa":w==="B"?"wb":w==="C"?"wc":"wt";
    return`<button type="button" class="recentDraw" data-log-target="${r.targetId}" title="Mở kỳ #${r.targetId}"><span class="winnerBadge ${cls}">${w}</span><div><b>#${r.targetId}</b><div class="muted">A${r.A.best} • B${r.B.best} • C${r.C.best}</div></div></button>`
  }).join("");
  el.querySelectorAll("[data-log-target]").forEach(b=>b.onclick=()=>openLoggedTarget(b.dataset.logTarget));
}
function renderHistory(){
  const ALL=allLogs(),H=ALL.filter(x=>x.source==="feed");
  renderTrendChart(H);renderRecentStrip(H);
  if(!ALL.length){
    $("historyBox").innerHTML='<span class="muted">Chưa có kỳ A/B/C nào hoàn tất.</span>';
    $("scoreboard").innerHTML="";
    renderLearningReport(getLearningReport());
    return
  }
  if(H.length){
    let aw=0,bw=0,cw=0;
    for(const x of H){const mx=Math.max(x.A.best,x.B.best,x.C.best);if(x.A.best===mx)aw++;if(x.B.best===mx)bw++;if(x.C.best===mx)cw++}
    const avg=k=>H.reduce((s,x)=>s+x[k].best,0)/H.length,ge3=k=>H.filter(x=>x[k].best>=3).length;
    $("scoreboard").innerHTML=`<div class="scoreGrid">
      <div class="scoreCard"><span>Kỳ chính thức đã đối chiếu</span><b>${H.length}</b></div>
      <div class="scoreCard"><span>Số kỳ dẫn / hòa</span><b>A ${aw} • B ${bw} • C ${cw}</b></div>
      <div class="scoreCard"><span>TB số trúng của vé tốt nhất</span><b>A ${avg("A").toFixed(2)} • B ${avg("B").toFixed(2)} • C ${avg("C").toFixed(2)}</b></div>
      <div class="scoreCard"><span>Kỳ có vé trúng ≥3 số</span><b>A ${ge3("A")} • B ${ge3("B")} • C ${ge3("C")}</b></div>
    </div>`;
  }else{
    $("scoreboard").innerHTML=`<div class="notice manualGuardNote"><b>Chưa có kết quả chính thức.</b> Các kết quả nhập tay bên dưới chỉ để xem tạm và không được tính vào thống kê.</div>`;
  }
  $("historyBox").innerHTML=`<div class="tableScroll"><table><thead><tr><th>Kỳ</th><th>Kết quả</th><th>A Best</th><th>B Best</th><th>C Best</th><th>A ≥3</th><th>B ≥3</th><th>C ≥3</th><th>Nguồn</th></tr></thead><tbody>${ALL.slice().reverse().map(x=>{
    const m=Math.max(x.A.best,x.B.best,x.C.best),pending=x.source==="manual";
    return`<tr class="${pending?'manualPendingRow':''}"><td><b>#${x.targetId}</b></td><td>${x.actual.map(n=>String(n).padStart(2,"0")).join(" ")}</td><td class="${!pending&&x.A.best===m?'lead':''}">${x.A.best}</td><td class="${!pending&&x.B.best===m?'lead':''}">${x.B.best}</td><td class="${!pending&&x.C.best===m?'lead':''}">${x.C.best}</td><td>${x.A.g3}</td><td>${x.B.g3}</td><td>${x.C.g3}</td><td>${historySourceLabel(x.source)}</td></tr>`
  }).join("")}</tbody></table></div>`;
  renderLearningReport(getLearningReport());
}
function exportLogs(){
  const H=allLogs();
  if(!H.length){showToast("Chưa có log A/B/C để export.","warn");return}
  const blob=new Blob([JSON.stringify(H,null,2)],{type:"application/json"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="PowerAI_RC6_ABC_History.json";a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),500);
  showToast(`Đã export ${H.length} kỳ A/B/C.`,"good");
}

/* state/navigation */
function renderState(){
  $("targetId").textContent=drawLabel(targetId);
  const L=getLock(targetId),readyA=!!(geo?.tickets?.length===20),
        readyB=!!(legacy?.length===20)&&!legacyBuilding,
        readyC=!!(hybrid?.length===20)&&!hybridBuilding,
        loaded=!!latest,official=hasOfficialResult(targetId),
        log=getLog(targetId),manualPending=log?.source==="manual",
        verified=official||log?.source==="feed",
        anyResult=verified||manualPending,
        historyReady=historyReadyForTarget(targetId),
        logs=allLogs();

  if(L){
    $("lockState").textContent=verified?"ĐÃ KHÓA • KỲ ĐÃ XÁC NHẬN":manualPending?"ĐÃ KHÓA • KẾT QUẢ TẠM":"ĐÃ KHÓA A + B + C";
    $("lockState").className=verified?"good":manualPending?"warn":"good";
    $("lockTime").textContent=new Date(L.lockedAt).toLocaleString("vi-VN");
  }else if(anyResult){
    $("lockState").textContent=verified?"KỲ ĐÃ XÁC NHẬN":"KẾT QUẢ NHẬP TAY • CHƯA XÁC NHẬN";
    $("lockState").className=verified?"good":"warn";
    $("lockTime").textContent=verified?"Chỉ xem lại":"Không dùng để học / không coi là dữ liệu chính thức";
  }else{
    $("lockState").textContent=historyReady?"CHƯA KHÓA":"CHỜ XÁC NHẬN KỲ TRƯỚC";
    $("lockState").className=historyReady?"warn":"bad";
    $("lockTime").textContent=historyReady?`Các bộ hiện tại dành cho ${drawLabel(targetId)}`:"A có thể xem; B/C/L chờ feed chính thức";
  }

  $("lockBothBtn").disabled=anyResult||!!L||!(readyA&&readyB&&readyC)||!historyReady;
  $("copyGeoBtn").disabled=!readyA;
  $("copyLegacyBtn").disabled=!readyB;
  $("copyHybridBtn").disabled=!readyC;

  $("regenLegacyBtn").disabled=anyResult||!!L||legacyBuilding||!loaded||!targetId||!historyReady;
  $("rebuildHybridBtn").disabled=anyResult||!!L||hybridBuilding||!readyA||!readyB||!historyReady;

  $("manualResult").disabled=!L||official;
  $("manualBtn").disabled=!L||official;

  const prev=previousNavigableTarget();
  if($("prevBtn")){
    $("prevBtn").disabled=!loaded||prev===null;
    $("prevBtn").textContent=prev===null?"← Không còn kỳ trước":`← Xem ${drawLabel(prev)}`;
  }

  const navMax=nextNavigableTarget();
  $("nextBtn").disabled=!loaded||Number(targetId)>=navMax;
  if(Number(targetId)<navMax){
    const next=Number(targetId)+1,p=pendingManualDraw(),isTemp=p&&next>nextProspectiveTarget();
    $("nextBtn").textContent=isTemp?`→ Mở tạm ${drawLabel(next)}`:`→ Kỳ sau ${drawLabel(next)}`;
  }else if(!historyReady){
    const p=pendingPredecessorForTarget(targetId);
    $("nextBtn").textContent=p?`⏳ Chờ xác nhận ${drawLabel(p)}`:`⏳ Chờ dữ liệu chính thức`;
  }else{
    $("nextBtn").textContent=`✓ Đang ở kỳ tiếp theo ${drawLabel(nextProspectiveTarget())}`;
  }
  $("exportBtn").disabled=!logs.length;

  const learnLocked=!!getLearningLock(targetId),learnReady=!!(learningPortfolio?.length===20);
  if($("buildLearningPortfolioBtn")){
    const b=$("buildLearningPortfolioBtn");
    b.classList.remove("nextTarget","prepareTarget");
    if(learnLocked){
      b.disabled=true;b.textContent=`✓ Bộ L ${drawLabel(targetId)} đã khóa`;
    }else if(learningPortfolioBuilding){
      b.disabled=true;b.textContent="⏳ Đang tạo 20 vé L...";
    }else if(!historyReady){
      const p=pendingPredecessorForTarget(targetId);
      b.disabled=true;b.textContent=p?`⏳ Chờ xác nhận ${drawLabel(p)} để tạo L`:"⏳ Chờ dữ liệu chính thức";
    }else if(anyResult){
      b.disabled=true;b.textContent=manualPending?"Kết quả nhập tay chưa được xác nhận":"Kỳ này đã có kết quả";
    }else if(!legacyModel){
      b.disabled=!loaded;b.classList.add("prepareTarget");b.textContent=`Chuẩn bị dữ liệu & tạo L cho ${drawLabel(targetId)}`;
    }else{
      b.disabled=false;b.textContent=`Tạo 20 vé L cho ${drawLabel(targetId)}`;
    }
  }
  if($("copyLearningBtn"))$("copyLearningBtn").disabled=!learnReady;
  if($("lockLearningBtn"))$("lockLearningBtn").disabled=anyResult||learnLocked||!learnReady||!historyReady;

  renderTargetContexts();
}
async function setTarget(id){
  targetId=Number(id);try{localStorage.setItem("powerai_rc6_active_target",String(targetId))}catch{}cloudSyncSoon();
  $("targetId").textContent=drawLabel(targetId);renderTargetContexts();
  const L=getLock(targetId);

  // STAGE 1: Track A is always built/rendered first and painted before any heavy B/C work.
  try{
    if(L){
      geo={tickets:L.A.tickets,seed:L.A.seed,audit:auditGeo(L.A.tickets),engine:L.A.engine||L.A.name||"Legacy A Snapshot",analysis:L.A.analysis||null};
    }else{
      geo=buildIncidence(targetId);
    }
    renderGeo();
    renderState();
    await new Promise(r=>requestAnimationFrame(()=>r()));
  }catch(e){
    console.error("Track A init failed",e);
    if($("geoState"))$("geoState").innerHTML=`<span class="bad">Track A lỗi: ${e.message}</span>`;
  }

  // STAGE 2: B/C are isolated. Their failure must not blank Track A.
  try{
    if(L){
      legacy=L.B.tickets.map(a=>({a,score:0,heat:0,pair:0}));
      hybrid=L.C.tickets.map(a=>({a}));
      legacyModel=buildLegacyModel(draws.filter(d=>Number(d.id)<targetId));
      legacyRanked=null;
      consensusNums=buildConstrainedSignals(draws.filter(d=>Number(d.id)<targetId),geo,legacy);
      $("cutoffId").textContent=L.cutoffId?drawLabel(L.cutoffId):"—";renderTargetContexts();
      renderLegacyAnalytics();renderLegacyTickets();renderHybrid();
    }else{
      legacy=null;hybrid=null;legacyModel=null;legacyRanked=null;consensusNums=null;
      await buildLegacyPortfolio();
    }
  }catch(e){
    console.error("Track B/C init failed",e);
    $("legacyProgress").textContent="Track B/C lỗi: "+e.message+" • Track A vẫn dùng bình thường.";
  }

  const LL=getLearningLock(targetId);
  if(LL){
    learningPortfolio=LL.tickets.map(x=>({...x}));
    learningPortfolioMeta=LL.meta||null;
  }else{
    learningPortfolio=null;
    learningPortfolioMeta=null;
  }
  renderLearningPortfolio();

  renderGeo();
  renderState();
  const lg=getLog(targetId);
  if(lg)renderCompare(lg);else if(isReplayTarget(targetId))renderReplayCompare();else renderCompare(null);
  checkOfficial();
}
async function previousDraw(){
  if(!latest){showToast("Dữ liệu chưa tải xong.","warn");return}
  const prev=previousNavigableTarget();
  if(prev===null){showToast("Không còn kỳ chính thức trước đó trong dữ liệu.","warn");return}
  showToast(`Đang mở lại ${drawLabel(prev)} • chế độ xem lại.`,"good");
  await setTarget(prev);
}
async function nextDraw(){
  if(!latest){showToast("Dữ liệu chưa tải xong.","warn");return}
  const max=nextNavigableTarget(),next=Math.min(Number(targetId)+1,max);
  if(next===Number(targetId)){
    const p=pendingPredecessorForTarget(targetId);
    showToast(p?`Đang chờ feed xác nhận ${drawLabel(p)} trước khi mở thêm kỳ.`:`Đang ở kỳ prospective mới nhất ${drawLabel(max)}.`,"warn");
    return;
  }
  await setTarget(next);
}
async function copySet(P,label){
  if(!P?.length){showToast(`Track ${label} chưa sẵn sàng.`,"warn");return}
  const txt=P.map((t,i)=>`${label}${String(i+1).padStart(2,"0")}: ${t.map(n=>String(n).padStart(2,"0")).join(" ")}`).join("\n");
  let ok=false;
  try{
    if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(txt);ok=true}
  }catch{}
  if(!ok)ok=fallbackCopy(txt);
  showToast(ok?`Đã copy 20 vé ${label}.`:`Không copy tự động được. Hãy dùng trình duyệt hỗ trợ Clipboard.`,ok?"good":"bad");
}
async function load(){
  try{
    $("status").textContent="Đang tải dữ liệu...";const r=await fetch(URL,{cache:"no-store"}),txt=await r.text();
    draws=txt.trim().split(/\r?\n/).map(JSON.parse).filter(d=>nums(d).length===6).sort((a,b)=>Number(a.id)-Number(b.id));latest=draws.at(-1);
    $("latestId").textContent="#"+String(latest.id).padStart(5,"0");$("latestDate").textContent=latest.date||"";
    const lockedLatest=getLock(Number(latest.id)),logLatest=getLog(Number(latest.id));
    let preferredTarget=null;
    try{preferredTarget=Number(localStorage.getItem("powerai_rc6_active_target"))||null}catch{}
    // Recovery rule: an unresolved locked draw wins over default next-draw navigation.
    let unresolvedLocked=null;
    for(const k of appStorageKeys()){
      const m=k.match(/^powerai_rc6_lock_(\d+)$/);if(!m)continue;
      const id=Number(m[1]),L=getLock(id),lg=getLog(id);
      if(L&&!lg&&(unresolvedLocked===null||id>unresolvedLocked))unresolvedLocked=id;
    }
    const nextId=Number(latest.id)+1;
    const chosen=unresolvedLocked||((preferredTarget&&preferredTarget<=nextNavigableTarget()&&preferredTarget>=Number(draws[0]?.id||1))?preferredTarget:null)||(lockedLatest&&!logLatest?Number(latest.id):nextId);
    await setTarget(chosen);
    $("status").textContent=`🟢 REAL DATA • ${draws.length} kỳ`;renderHistory();renderState();
  }catch(e){
    console.error(e);
    $("status").textContent="🔴 Lỗi dữ liệu";
    $("legacyProgress").textContent=e.message;
    if($("geoState"))$("geoState").innerHTML=`<span class="bad">Không tải được nguồn dữ liệu nên chưa xác định được kỳ mục tiêu: ${e.message}</span>`;
  }
}

/* RC5 research branch CLOSED in RC6.0. */

document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>activateTrack(b.dataset.tab));
document.querySelectorAll("[data-open-tab]").forEach(b=>b.onclick=()=>openTrack(b.dataset.openTab));
$("manualResult").addEventListener("keydown",e=>{if(e.key==="Enter"&&!$("manualBtn").disabled)manualResult()});
$("runLearningBtn").onclick=runLearning;$("buildLearningPortfolioBtn").onclick=prepareAndBuildLearningPortfolio;$("copyLearningBtn").onclick=()=>copySet(rankLearningRows().map(p=>p.a),"L");$("lockLearningBtn").onclick=lockLearningPortfolio;$("resetLearningBtn").onclick=resetLearning;
$("refreshBtn").onclick=load;$("lockBothBtn").onclick=lockBoth;$("manualBtn").onclick=manualResult;if($("prevBtn"))$("prevBtn").onclick=previousDraw;$("nextBtn").onclick=nextDraw;$("regenLegacyBtn").onclick=buildLegacyPortfolio;$("rebuildHybridBtn").onclick=buildHybridPortfolio;
$("copyGeoBtn").onclick=()=>copySet(rankGeoRows().map(p=>p.a),"A");$("copyLegacyBtn").onclick=()=>copySet(rankLegacyRows().map(p=>p.a),"B");$("copyHybridBtn").onclick=()=>copySet(rankHybridRows().map(p=>p.a),"C");$("exportBtn").onclick=exportLogs;
initCloudAuth().catch(e=>console.error("Auth bootstrap failed",e));
load();


/* RC6 UI helpers — no algorithm changes */
(function(){
  const _renderState = renderState;
  renderState = function(){
    _renderState();
    const locked = !!getLock(targetId);
    document.body.classList.toggle("isLocked", locked);
  };
  let saved="geometryTab";
  try{saved=localStorage.getItem("powerai_rc6_ui_tab")||"geometryTab"}catch{}
  if(!activateTrack(saved))activateTrack("geometryTab");
})();

