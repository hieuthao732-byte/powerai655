import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const appPath = join('dist', 'app.js');
const htmlPath = join('dist', 'index.html');
const cssPath = join('dist', 'style.css');

let app = readFileSync(appPath, 'utf8');
let html = readFileSync(htmlPath, 'utf8');
let css = readFileSync(cssPath, 'utf8');

html = html.replaceAll('RC9.3', 'RC9.4').replaceAll('v=9.3', 'v=9.4');
html = html.replace(
  '<span class="versionPill">NAVIGATION HUB • RC9.4</span>',
  '<span class="versionPill">RESULT DOCK • RC9.4</span>'
);

const runtimePatch = String.raw`
/* =========================
   RC9.4 — RESULT DOCK
   Kết quả is always visible outside the main navigation.
   Main nav is now: Chọn vé / Phân tích / Hiệu suất.
   ========================= */
function rc94DockResults(){
  if(document.querySelector('.rc94ResultDock'))return;
  const nav=document.querySelector('.rc93MainNav');
  const compare=document.querySelector('.comparePanel');
  const resultBtn=document.querySelector('[data-main-view="result"]');
  const resultPane=document.querySelector('[data-main-pane="result"]');
  if(!nav||!compare)return;

  const dock=document.createElement('section');
  dock.className='rc94ResultDock';
  dock.innerHTML='<div class="rc94ResultDockHead"><div><span>KẾT QUẢ KỲ ĐANG CHỌN</span><h2>🏆 Kết quả & chấm giải</h2><p>Luôn hiển thị bên ngoài các tab để xem nhanh hit, Jackpot 1/2, Giải Nhất/Nhì/Ba và tổng kết A/B/C/L.</p></div><em class="rc94ResultState">KẾT QUẢ</em></div>';
  nav.parentNode.insertBefore(dock,nav);
  dock.appendChild(compare);

  if(resultBtn)resultBtn.remove();
  if(resultPane)resultPane.remove();

  const oldActivate=typeof rc93ActivateMain==='function'?rc93ActivateMain:null;
  if(oldActivate){
    rc93ActivateMain=function(view,opts={}){
      if(view==='result')view='choose';
      return oldActivate(view,opts);
    };
  }

  try{
    if(rc93MainView==='result')rc93ActivateMain('choose');
  }catch(e){}

  function refreshState(){
    const el=dock.querySelector('.rc94ResultState');if(!el)return;
    let has=false;
    try{has=!!getLog(targetId)}catch(e){}
    el.textContent=has?'CÓ KẾT QUẢ':'CHƯA CÓ KQ';
    el.classList.toggle('ready',has);
  }
  refreshState();

  try{
    const baseSetTarget=setTarget;
    setTarget=async function(id){const r=await baseSetTarget(id);refreshState();return r};
  }catch(e){}
}

rc94DockResults();
window.addEventListener('load',rc94DockResults,{once:true});
`;

if(!app.includes('RC9.4 — RESULT DOCK')) app += '\n'+runtimePatch+'\n';

css += `
/* RC9.4 — RESULT OUTSIDE MAIN NAV */
.rc93MainNav{grid-template-columns:repeat(3,minmax(0,1fr))!important}
.rc94ResultDock{margin:0 0 14px}
.rc94ResultDockHead{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:0 0 8px;padding:12px 14px;border:1px solid rgba(255,201,107,.22);border-radius:14px;background:linear-gradient(180deg,rgba(45,31,12,.34),rgba(15,25,36,.72))}
.rc94ResultDockHead>div>span{font-size:9px;font-weight:900;letter-spacing:.13em;color:#f2c86f}.rc94ResultDockHead h2{margin:3px 0 4px;font-size:18px}.rc94ResultDockHead p{margin:0;max-width:900px;color:var(--muted);font-size:10px;line-height:1.5}
.rc94ResultState{font-style:normal;font-size:8px;font-weight:900;letter-spacing:.08em;padding:7px 9px;border-radius:999px;border:1px solid rgba(255,201,107,.28);color:#d9b96d;background:rgba(112,72,17,.08);white-space:nowrap}.rc94ResultState.ready{color:#9af1c3;border-color:rgba(113,227,173,.36);background:rgba(61,166,116,.08)}
.rc94ResultDock>.comparePanel{margin:0!important;border-color:rgba(255,201,107,.18)}
@media(max-width:980px){.rc93MainNav{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
@media(max-width:620px){.rc93MainNav{grid-template-columns:1fr!important}.rc94ResultDockHead{align-items:flex-start}.rc94ResultState{display:none}}
`;

writeFileSync(appPath, app);
writeFileSync(htmlPath, html);
writeFileSync(cssPath, css);
console.log('RC9.4 applied — results moved outside the main tabs');
