import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const htmlPath = join('dist', 'index.html');
const cssPath = join('dist', 'style.css');
const appPath = join('dist', 'app.js');

let html = readFileSync(htmlPath, 'utf8');
let css = readFileSync(cssPath, 'utf8');
let app = readFileSync(appPath, 'utf8');

html = html.replaceAll('RC9.0', 'RC9.1').replaceAll('v=9.0', 'v=9.1');
html = html.replace(
  '<span class="versionPill">A SIMULATION OPTIMIZER</span>',
  '<span class="versionPill">INTERACTIVE UI • RC9.1</span>'
);
writeFileSync(htmlPath, html);

css += `
/* RC9.1 — INTERACTION HIGHLIGHT / AFFORDANCE */
:where(button,a[href],summary,input,select,textarea,.tab,[role="button"]){
  -webkit-tap-highlight-color:transparent;
}

/* Anything actionable must look actionable. */
button:not(:disabled),
a[href],
summary,
.tab:not(:disabled),
[role="button"]{
  cursor:pointer;
}

button:not(:disabled):not(.textBtn){
  border-color:rgba(116,190,246,.38);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 5px 18px rgba(0,0,0,.14);
}
button:not(:disabled):not(.textBtn):hover{
  transform:translateY(-2px);
  border-color:rgba(116,198,255,.78);
  background:#12304a;
  box-shadow:0 0 0 2px rgba(89,174,242,.10),0 11px 28px rgba(0,0,0,.25),0 0 22px rgba(72,160,228,.10);
}
button:not(:disabled):active{
  transform:translateY(0) scale(.985);
}
button.primary:not(:disabled),
.signupPrimary:not(:disabled),
.lockBtn:not(:disabled){
  border-color:rgba(114,201,255,.86);
  background:linear-gradient(135deg,#1978c0,#195b8f);
  box-shadow:0 0 0 1px rgba(112,197,255,.10),0 10px 30px rgba(31,126,198,.26),inset 0 1px 0 rgba(255,255,255,.10);
}
button.primary:not(:disabled):hover,
.signupPrimary:not(:disabled):hover,
.lockBtn:not(:disabled):hover{
  border-color:#9ed9ff;
  background:linear-gradient(135deg,#2189d6,#206ba2);
  box-shadow:0 0 0 3px rgba(100,181,255,.13),0 13px 34px rgba(31,126,198,.32),0 0 28px rgba(79,169,238,.16);
}

/* Tabs should read as navigation controls, not labels. */
.trackTabs{
  border-color:rgba(112,189,247,.28);
  box-shadow:0 10px 30px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.025);
}
.tab{
  position:relative;
  border:1px solid rgba(120,176,218,.10);
  background:rgba(10,27,43,.46);
  transition:transform .16s ease,border-color .16s ease,background .16s ease,box-shadow .16s ease;
}
.tab:not(:disabled):hover{
  transform:translateY(-2px);
  color:#e8f5ff;
  border-color:rgba(114,195,255,.52);
  background:rgba(20,53,81,.84);
  box-shadow:0 8px 22px rgba(0,0,0,.20),0 0 18px rgba(82,167,233,.08);
}
.tab:not(:disabled)::after{
  content:'BẤM';
  position:absolute;
  right:9px;
  top:7px;
  font-size:7px;
  font-weight:900;
  letter-spacing:.10em;
  color:rgba(169,211,241,.42);
  transition:.16s ease;
}
.tab:not(:disabled):hover::after{color:#9ed8ff}
.tab.active{
  border-color:rgba(111,194,255,.70);
  background:linear-gradient(180deg,rgba(27,69,104,.98),rgba(16,45,70,.98));
  box-shadow:0 0 0 2px rgba(91,180,247,.10),0 10px 27px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.05);
}
.tab.active::after{content:'ĐANG XEM';color:#9ed8ff}
.authTab:not(:disabled){
  border:1px solid rgba(112,184,236,.24);
}
.authTab:not(:disabled):hover{border-color:rgba(112,199,255,.62);background:rgba(26,65,96,.70)}
.authTab.active{box-shadow:0 0 0 2px rgba(99,184,247,.10)}

/* Form controls: strong focus and obvious editable state. */
input:not(:disabled),select:not(:disabled),textarea:not(:disabled){
  cursor:text;
  border-color:rgba(119,188,240,.38);
  background:#081a29;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.025);
}
select:not(:disabled){cursor:pointer}
input:not(:disabled):hover,select:not(:disabled):hover,textarea:not(:disabled):hover{
  border-color:rgba(115,201,255,.64);
}
input:not(:disabled):focus,select:not(:disabled):focus,textarea:not(:disabled):focus,
.resultInputWrap:focus-within{
  border-color:#79c7ff;
  box-shadow:0 0 0 3px rgba(81,176,243,.16),0 0 20px rgba(69,155,219,.08);
}
.resultInputWrap:has(input:not(:disabled)){
  border-color:rgba(111,193,250,.35);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.025);
}

/* Keyboard accessibility: interaction must be visible without a mouse too. */
:where(button,a[href],summary,input,select,textarea,.tab,[role="button"]):focus-visible{
  outline:2px solid #8bd0ff;
  outline-offset:3px;
  box-shadow:0 0 0 5px rgba(87,177,242,.14);
}

/* Disabled means clearly unavailable, not merely a dim active button. */
button:disabled,input:disabled,select:disabled,textarea:disabled{
  cursor:not-allowed !important;
  opacity:.33 !important;
  filter:saturate(.35);
  box-shadow:none !important;
  border-style:dashed;
}
button:disabled:hover{transform:none!important}

/* Text actions and links. */
.textBtn:not(:disabled),a[href]{
  color:#8fd1ff;
  text-decoration-thickness:1px;
  text-underline-offset:3px;
}
.textBtn:not(:disabled):hover,a[href]:hover{color:#c2e7ff;text-decoration:underline}

/* Expand/collapse controls. */
summary{
  position:relative;
  padding-right:28px;
  transition:color .16s ease,background .16s ease;
}
summary::after{
  content:'＋';
  position:absolute;
  right:5px;top:50%;transform:translateY(-50%);
  color:#86caff;font-weight:900;font-size:14px;
}
details[open]>summary::after{content:'−'}
summary:hover{color:#c8e9ff}

/* Guest mode: make the reason for unavailable actions impossible to miss. */
.guestReadOnlyBar{
  border-color:rgba(255,201,107,.48)!important;
  background:linear-gradient(90deg,rgba(112,72,17,.92),rgba(58,41,18,.92))!important;
  color:#ffe4ad!important;
  box-shadow:0 9px 28px rgba(0,0,0,.22),0 0 0 1px rgba(255,201,107,.07);
  font-weight:750;
}
body.guestMode main button,body.guestMode main input,body.guestMode main select{
  filter:saturate(.35);
}

/* Small action groups should read as controls. */
.actions{
  padding:5px;
  border-radius:14px;
}
.actions:has(button:not(:disabled)){
  background:rgba(7,23,37,.30);
}

/* Auth and account actions get stronger affordance. */
.authMini button:not(:disabled),.authActions button:not(:disabled),.dangerBtn:not(:disabled),.adminTinyBtn:not(:disabled){
  position:relative;
}
.dangerBtn:not(:disabled){border-color:rgba(255,126,145,.55);box-shadow:0 0 0 1px rgba(255,126,145,.06)}
.dangerBtn:not(:disabled):hover{border-color:rgba(255,143,161,.90);background:rgba(112,28,43,.72)}

/* Touch devices: keep controls obvious even without hover. */
@media(hover:none){
  button:not(:disabled):not(.textBtn),.tab:not(:disabled),input:not(:disabled),select:not(:disabled){border-color:rgba(116,190,246,.46)}
  .tab:not(:disabled)::after{color:rgba(169,211,241,.62)}
  button.primary:not(:disabled),.signupPrimary:not(:disabled),.lockBtn:not(:disabled){box-shadow:0 0 0 2px rgba(100,181,255,.10),0 8px 22px rgba(31,126,198,.22)}
}

@media(max-width:620px){
  .tab:not(:disabled)::after{display:none}
  button{min-height:42px}
}
`;
writeFileSync(cssPath, css);

const uxPatch = String.raw`
/* RC9.1 — semantic interaction hints */
function rc91RefreshInteractionHints(){
  document.querySelectorAll('button,input,select,textarea,.tab,summary,a[href]').forEach(el=>{
    const disabled=('disabled' in el&&el.disabled)||el.getAttribute('aria-disabled')==='true';
    el.classList.toggle('uxInteractive',!disabled);
    el.classList.toggle('uxUnavailable',!!disabled);
  });
}
const rc91Observer=new MutationObserver(rc91RefreshInteractionHints);
rc91Observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['disabled','aria-disabled','class']});
window.addEventListener('load',rc91RefreshInteractionHints,{once:true});
queueMicrotask(rc91RefreshInteractionHints);
`;

if (!app.includes('RC9.1 — semantic interaction hints')) {
  app += `\n${uxPatch}\n`;
}
writeFileSync(appPath, app);

console.log('RC9.1 applied — interactive controls highlighted');
