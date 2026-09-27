import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const appPath = join('dist', 'app.js');
const htmlPath = join('dist', 'index.html');
const cssPath = join('dist', 'style.css');

let app = readFileSync(appPath, 'utf8');
let html = readFileSync(htmlPath, 'utf8');
let css = readFileSync(cssPath, 'utf8');

html = html.replaceAll('RC9.2', 'RC9.3').replaceAll('v=9.2', 'v=9.3');
html = html.replace(
  '<span class="versionPill">NUMBER INTELLIGENCE • RC9.3</span>',
  '<span class="versionPill">NAVIGATION HUB • RC9.3</span>'
);
writeFileSync(htmlPath, html);

const runtimePatch = String.raw`
/* =========================
   RC9.3 — NAVIGATION RESTRUCTURE
   Level 1: Chọn vé / Phân tích / Kết quả / Hiệu suất
   Level 2 inside Chọn vé: A / B / C / L
   Algorithms and stored data are unchanged.
   ========================= */
let rc93MainView='choose';

function rc93ViewIntro(kicker,title,desc){
  const el=document.createElement('div');
  el.className='rc93ViewIntro';
  el.innerHTML='<div><span>'+kicker+'</span><h2>'+title+'</h2><p>'+desc+'</p></div>';
  return el;
}

function rc93RefreshNavMeta(){
  const resultState=document.querySelector('[data-main-view="result"] .rc93MainState');
  if(resultState){
    let has=false;
    try{has=!!getLog(targetId)||!!hasOfficialResult(targetId)}catch{}
    resultState.textContent=has?'CÓ KẾT QUẢ':'CHƯA CÓ KQ';
    resultState.classList.toggle('ready',has);
  }
  const perfState=document.querySelector('[data-main-view="performance"] .rc93MainState');
  if(perfState){
    const n=typeof rc90HistoryBeforeTarget==='function'?rc90HistoryBeforeTarget().length:0;
    perfState.textContent=n?Math.min(n,250)+' KỲ':'LỊCH SỬ';
  }
}

function rc93ActivateMain(view,{scroll=false}={}){
  const valid=['choose','analysis','result','performance'];
  if(!valid.includes(view))view='choose';
  rc93MainView=view;
  document.querySelectorAll('.rc93View').forEach(el=>{el.hidden=el.dataset.mainPane!==view});
  document.querySelectorAll('.rc93MainBtn').forEach(btn=>{
    const active=btn.dataset.mainView===view;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-selected',active?'true':'false');
  });
  try{localStorage.setItem('powerai_rc93_main_view',view)}catch{}
  if(view==='analysis'&&typeof renderNumberIntelligence==='function')queueMicrotask(renderNumberIntelligence);
  if(view==='performance'){
    if(typeof renderAHistoricalValidation==='function')queueMicrotask(renderAHistoricalValidation);
    if(typeof renderInsights==='function')queueMicrotask(renderInsights);
  }
  rc93RefreshNavMeta();
  if(scroll){
    const nav=document.querySelector('.rc93MainNav');
    nav?.scrollIntoView({behavior:'smooth',block:'start'});
  }
}

function rc93BuildNavigation(){
  if(document.querySelector('.rc93MainNav'))return;
  const main=document.querySelector('main');
  const compare=document.querySelector('.comparePanel');
  const trackTabs=document.querySelector('.trackTabs');
  const panes={
    A:document.getElementById('geometryTab'),
    B:document.getElementById('legacyTab'),
    C:document.getElementById('hybridTab'),
    L:document.getElementById('learningTab'),
    N:document.getElementById('numberIntelTab')
  };
  const insights=document.getElementById('insightsPanel');
  const aHistory=document.getElementById('aHistoryValidation');
  if(!main||!compare||!trackTabs||!panes.A||!panes.B||!panes.C||!panes.L||!panes.N)return;

  const nav=document.createElement('nav');
  nav.className='rc93MainNav';
  nav.setAttribute('aria-label','Khu vực chính PowerAI');
  nav.innerHTML=`
    <button type="button" class="rc93MainBtn active" data-main-view="choose" aria-selected="true">
      <i>🎟</i><span><b>Chọn vé</b><small>A / B / C / Learning</small></span><em class="rc93MainState">4 BỘ</em>
    </button>
    <button type="button" class="rc93MainBtn" data-main-view="analysis" aria-selected="false">
      <i>🔎</i><span><b>Phân tích</b><small>Number Intelligence 01–55</small></span><em class="rc93MainState">55 SỐ</em>
    </button>
    <button type="button" class="rc93MainBtn" data-main-view="result" aria-selected="false">
      <i>🏆</i><span><b>Kết quả</b><small>Hit • giải thưởng • kỳ quay</small></span><em class="rc93MainState">KẾT QUẢ</em>
    </button>
    <button type="button" class="rc93MainBtn" data-main-view="performance" aria-selected="false">
      <i>📈</i><span><b>Hiệu suất</b><small>Backtest • validation • trend</small></span><em class="rc93MainState">LỊCH SỬ</em>
    </button>`;

  const host=document.createElement('div');
  host.className='rc93ViewHost';
  host.innerHTML='<section class="rc93View" data-main-pane="choose"></section><section class="rc93View" data-main-pane="analysis" hidden></section><section class="rc93View" data-main-pane="result" hidden></section><section class="rc93View" data-main-pane="performance" hidden></section>';

  compare.parentNode.insertBefore(nav,compare);
  compare.parentNode.insertBefore(host,compare);

  const choose=host.querySelector('[data-main-pane="choose"]');
  const analysis=host.querySelector('[data-main-pane="analysis"]');
  const result=host.querySelector('[data-main-pane="result"]');
  const performance=host.querySelector('[data-main-pane="performance"]');

  choose.appendChild(rc93ViewIntro('CHỌN VÉ','🎟 Chọn bộ vé cho kỳ đang xem','Bốn phương pháp A / B / C / Learning được gom riêng tại đây. Chuyển giữa các tab bên dưới để xem, tạo, khóa hoặc sao chép bộ vé.'));
  choose.appendChild(trackTabs);

  const nTab=trackTabs.querySelector('[data-tab="numberIntelTab"]');
  if(nTab)nTab.remove();
  [panes.A,panes.B,panes.C,panes.L].forEach(p=>choose.appendChild(p));

  analysis.appendChild(rc93ViewIntro('PHÂN TÍCH','🔎 Phân tích dữ liệu','Nghiên cứu từng số và các tín hiệu mô tả lịch sử mà không trộn chúng với khu vực chọn vé.'));
  panes.N.classList.add('rc93StandalonePane');
  panes.N.classList.remove('active');
  analysis.appendChild(panes.N);

  result.appendChild(rc93ViewIntro('KẾT QUẢ','🏆 Kết quả & chấm giải','Xem kết quả kỳ mục tiêu, số hit, Jackpot 1/2, Giải Nhất/Nhì/Ba và tổng kết A/B/C/L.'));
  result.appendChild(compare);

  performance.appendChild(rc93ViewIntro('HIỆU SUẤT','📈 Hiệu suất & kiểm chứng','Tập trung toàn bộ kiểm chứng lịch sử, backtest và xu hướng nhiều kỳ ở một nơi riêng.'));
  const perfPanel=document.createElement('section');
  perfPanel.className='panel rc93PerformancePanel';
  performance.appendChild(perfPanel);
  if(aHistory)perfPanel.appendChild(aHistory);
  if(insights)perfPanel.appendChild(insights);

  if(aHistory){
    const shortcut=document.createElement('div');
    shortcut.className='rc93AHistoryShortcut';
    shortcut.innerHTML='<div><span>KIỂM CHỨNG LỊCH SỬ</span><b>Historical Validation đã được chuyển sang mục Hiệu suất</b><small>Hạng A vẫn do mô phỏng quyết định; lịch sử chỉ dùng để kiểm chứng.</small></div><button type="button" id="rc93OpenAHistory">Xem chi tiết →</button>';
    const geoAudit=document.getElementById('geoAudit');
    if(geoAudit)geoAudit.insertAdjacentElement('afterend',shortcut);
    shortcut.querySelector('button')?.addEventListener('click',()=>rc93ActivateMain('performance',{scroll:true}));
  }

  nav.querySelectorAll('[data-main-view]').forEach(btn=>btn.addEventListener('click',()=>rc93ActivateMain(btn.dataset.mainView)));

  // Recover from RC9.2 if Number Intelligence was the saved secondary tab.
  let savedTrack='geometryTab';
  try{savedTrack=localStorage.getItem('powerai_rc6_ui_tab')||'geometryTab'}catch{}
  if(!['geometryTab','legacyTab','hybridTab','learningTab'].includes(savedTrack))savedTrack='geometryTab';
  try{activateTrack(savedTrack)}catch{try{activateTrack('geometryTab')}catch{}}

  let savedMain='choose';
  try{savedMain=localStorage.getItem('powerai_rc93_main_view')||'choose'}catch{}
  rc93ActivateMain(savedMain);
  rc93RefreshNavMeta();
}

// Track pills elsewhere should always take the user back to the Chọn vé area.
try{
  const rc93OpenTrackBase=openTrack;
  openTrack=function(tabId){rc93ActivateMain('choose');return rc93OpenTrackBase(tabId)};
}catch{}

// Refresh top-level state after changing draw. This wraps the latest RC9.2 setTarget.
try{
  const rc93SetTargetBase=setTarget;
  setTarget=async function(id){const r=await rc93SetTargetBase(id);rc93RefreshNavMeta();return r};
}catch{}

rc93BuildNavigation();
window.addEventListener('load',()=>{rc93BuildNavigation();rc93RefreshNavMeta()},{once:true});
`;

if(!app.includes('RC9.3 — NAVIGATION RESTRUCTURE')) app += `\n${runtimePatch}\n`;
writeFileSync(appPath, app);

css += `
/* RC9.3 — TWO-LEVEL NAVIGATION */
.rc93MainNav{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;
  position:sticky;top:78px;z-index:22;margin:0 0 14px;padding:8px;
  border:1px solid rgba(120,190,244,.24);border-radius:17px;
  background:rgba(6,17,28,.92);backdrop-filter:blur(18px);
  box-shadow:0 14px 34px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.03)
}
.rc93MainBtn{
  min-width:0;display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:10px;
  padding:11px 12px;text-align:left;border-radius:13px!important;
  background:rgba(10,29,46,.68)!important;border:1px solid rgba(117,180,226,.16)!important;
  box-shadow:none!important;transform:none!important
}
.rc93MainBtn>i{width:38px;height:38px;display:grid;place-items:center;border-radius:11px;font-style:normal;font-size:18px;background:rgba(255,255,255,.045);border:1px solid var(--line)}
.rc93MainBtn>span{min-width:0;display:block}.rc93MainBtn>span b{display:block;font-size:12px;color:#d8e7f3}.rc93MainBtn>span small{display:block;margin-top:3px;font-size:8px;color:var(--muted2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rc93MainState{font-style:normal;font-size:7px;font-weight:900;letter-spacing:.08em;color:#7896ad;padding:5px 6px;border-radius:999px;border:1px solid var(--line);white-space:nowrap}
.rc93MainState.ready{color:#9af1c3;border-color:rgba(113,227,173,.34);background:rgba(61,166,116,.08)}
.rc93MainBtn:hover{border-color:rgba(116,198,255,.60)!important;background:rgba(18,51,77,.90)!important;box-shadow:0 8px 24px rgba(0,0,0,.19)!important;transform:translateY(-1px)!important}
.rc93MainBtn.active{border-color:rgba(116,201,255,.78)!important;background:linear-gradient(180deg,rgba(28,75,111,.98),rgba(16,47,72,.98))!important;box-shadow:0 0 0 2px rgba(93,181,247,.10),0 10px 28px rgba(0,0,0,.22)!important}
.rc93MainBtn.active>i{border-color:rgba(126,207,255,.42);background:rgba(73,161,225,.14)}
.rc93MainBtn.active>span b{color:#f0f9ff}.rc93MainBtn.active .rc93MainState{color:#aadaff;border-color:rgba(111,193,250,.35)}

.rc93View[hidden]{display:none!important}.rc93View{animation:rc93Fade .16s ease}@keyframes rc93Fade{from{opacity:.45;transform:translateY(4px)}to{opacity:1;transform:none}}
.rc93ViewIntro{display:flex;justify-content:space-between;align-items:end;gap:16px;margin:0 0 10px;padding:4px 2px}.rc93ViewIntro span{font-size:9px;font-weight:900;letter-spacing:.13em;color:#80bee9}.rc93ViewIntro h2{margin:3px 0 4px;font-size:18px}.rc93ViewIntro p{margin:0;color:var(--muted);font-size:10px;line-height:1.5;max-width:900px}

/* Secondary tabs belong only to Chọn vé now. */
.rc93View[data-main-pane="choose"]>.trackTabs{grid-template-columns:repeat(4,minmax(0,1fr))!important;position:relative!important;top:auto!important;z-index:5!important;margin-bottom:14px!important}
.rc93View[data-main-pane="choose"]>.trackTabs .tab::after{display:block}
.rc93StandalonePane{display:block!important}
.rc93View[data-main-pane="analysis"] .numberIntelPanel{margin-top:0}
.rc93View[data-main-pane="result"]>.comparePanel{margin-top:0}

.rc93PerformancePanel{padding:16px}.rc93PerformancePanel>.aHistoryValidation{margin-top:0}.rc93PerformancePanel>#insightsPanel{margin-top:16px}
.rc93AHistoryShortcut{display:flex;justify-content:space-between;align-items:center;gap:14px;margin:10px 0 14px;padding:12px 13px;border:1px solid rgba(100,181,255,.24);border-radius:13px;background:rgba(7,25,40,.72)}
.rc93AHistoryShortcut>div{display:grid;gap:2px}.rc93AHistoryShortcut span{font-size:8px;font-weight:900;letter-spacing:.11em;color:#83c7f6}.rc93AHistoryShortcut b{font-size:11px;color:#dcecf7}.rc93AHistoryShortcut small{font-size:9px;color:var(--muted2)}.rc93AHistoryShortcut button{white-space:nowrap;color:#bfe5ff;border-color:rgba(105,190,250,.43)}

/* The old 5-tab Number Intelligence slot is no longer part of the ticket selector. */
.trackTabs .tabN{display:none!important}

@media(max-width:1050px){
  .rc93MainNav{grid-template-columns:repeat(2,minmax(0,1fr));position:relative;top:auto}
}
@media(max-width:620px){
  .rc93MainNav{grid-template-columns:1fr 1fr;gap:6px;padding:6px}
  .rc93MainBtn{grid-template-columns:31px minmax(0,1fr);padding:9px;gap:8px;min-height:58px}
  .rc93MainBtn>i{width:31px;height:31px;font-size:15px}.rc93MainBtn>span b{font-size:10px}.rc93MainBtn>span small{font-size:7px}.rc93MainState{display:none}
  .rc93ViewIntro{padding:2px 0}.rc93ViewIntro h2{font-size:16px}.rc93ViewIntro p{font-size:9px}
  .rc93AHistoryShortcut{display:block}.rc93AHistoryShortcut button{width:100%;margin-top:9px}
  .rc93View[data-main-pane="choose"]>.trackTabs{grid-template-columns:repeat(2,minmax(0,1fr))!important}
}
`;
writeFileSync(cssPath, css);

console.log('RC9.3 applied — navigation split into Chọn vé / Phân tích / Kết quả / Hiệu suất');
