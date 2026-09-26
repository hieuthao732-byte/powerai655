(() => {
  'use strict';
  const SUPABASE_URL='https://sznvpxbcvywhinhtbigk.supabase.co';
  const SUPABASE_KEY='sb_publishable_EFmueKQRtrftHz3VkC45hA_HMZnBhGG';
  const AUTH_STORAGE_KEY='powerai_auth_session_v1';
  let session=null;
  let busy=false;
  let mode='login';
  let role='user';

  const $=id=>document.getElementById(id);
  function setMessage(msg,type=''){
    const el=$('authMessage'); if(!el)return;
    el.textContent=msg; el.className='notice '+type;
  }
  function setBusy(on,label=''){
    busy=!!on;
    const login=$('authLoginBtn'), signup=$('authSignupBtn');
    if(login){login.disabled=on; login.textContent=on&&label==='login'?'Đang đăng nhập…':'Đăng nhập'}
    if(signup){signup.disabled=on; signup.textContent=on&&label==='signup'?'Đang tạo tài khoản…':'Tạo tài khoản'}
  }
  function saveSession(next){
    session=next||null;
    try{if(session)localStorage.setItem(AUTH_STORAGE_KEY,JSON.stringify(session));else localStorage.removeItem(AUTH_STORAGE_KEY)}catch{}
  }
  function readStoredSession(){
    try{const raw=localStorage.getItem(AUTH_STORAGE_KEY);return raw?JSON.parse(raw):null}catch{return null}
  }
  function currentUser(){return session?.user||null}
  function currentRole(){return role||'user'}
  function emit(){
    const user=currentUser();
    window.dispatchEvent(new CustomEvent('powerai-auth-changed',{detail:{session,user,role:currentRole()}}));
  }
  function applyGuestMode(){
    const user=currentUser();
    document.body.classList.toggle('guestMode',!user);
    const main=document.querySelector('main');
    if(main){main.inert=!user;main.setAttribute('aria-disabled',user?'false':'true')}
    const label=$('authUserLabel'), open=$('authOpenBtn'), account=$('accountBtn'), adminBtn=$('adminPanelBtn'), logout=$('authLogoutBtn'), guestBar=$('guestReadOnlyBar');
    if(label){label.innerHTML=''; const t=document.createTextNode(user?(user.email||'Đã đăng nhập'):'Khách • chỉ xem'); label.appendChild(t); if(user&&currentRole()==='admin'){const b=document.createElement('span');b.className='adminBadge';b.textContent='ADMIN';label.appendChild(b)}}
    if(open)open.hidden=!!user;
    if(account)account.hidden=!user;
    if(adminBtn)adminBtn.hidden=!(user&&currentRole()==='admin');
    if(logout)logout.hidden=!user;
    if(guestBar)guestBar.hidden=!!user;
  }
  function updateUI(){applyGuestMode()}
  function parseError(data,status){
    if(!data)return `Lỗi kết nối (${status})`;
    return data.msg||data.message||data.error_description||data.error||`Lỗi kết nối (${status})`;
  }
  async function request(path,{method='GET',body=null,headers={},auth=false,timeoutMs=12000}={}){
    let active=session;
    if(auth){active=await ensureFreshSession();if(!active?.access_token)throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.')}
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const h={apikey:SUPABASE_KEY,...headers};
      if(body!==null)h['Content-Type']='application/json';
      if(auth&&active?.access_token)h.Authorization=`Bearer ${active.access_token}`;
      const res=await fetch(SUPABASE_URL+path,{method,headers:h,body:body===null?undefined:JSON.stringify(body),signal:controller.signal});
      const text=await res.text();
      let data=null; if(text){try{data=JSON.parse(text)}catch{data=text}}
      if(!res.ok)throw new Error(parseError(typeof data==='string'?{message:data}:data,res.status));
      return data;
    }catch(e){
      if(e?.name==='AbortError')throw new Error('Kết nối quá thời gian. Hãy thử lại.');
      throw e;
    }finally{clearTimeout(timer)}
  }
  function normalizeSession(data){
    if(!data?.access_token)return null;
    const expiresAt=Number(data.expires_at)||Math.floor(Date.now()/1000)+(Number(data.expires_in)||3600);
    return {access_token:data.access_token,refresh_token:data.refresh_token||session?.refresh_token||null,expires_at:expiresAt,user:data.user||session?.user||null};
  }

  async function loadRole(){
    role='user';
    const user=currentUser();
    if(!user||!session?.access_token)return role;
    try{
      const rows=await request('/rest/v1/user_roles?select=role&user_id=eq.'+encodeURIComponent(user.id),{method:'GET',auth:true});
      role=Array.isArray(rows)&&rows[0]?.role==='admin'?'admin':'user';
    }catch(e){console.warn('Role lookup failed',e)}
    return role;
  }
  async function refreshSession(){
    if(!session?.refresh_token)return null;
    try{
      const data=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token},auth:false});
      const next=normalizeSession(data); if(!next)throw new Error('Không làm mới được phiên đăng nhập.');
      saveSession(next); updateUI(); return next;
    }catch(e){saveSession(null);updateUI();emit();return null}
  }
  async function ensureFreshSession(){
    if(!session)return null;
    const now=Math.floor(Date.now()/1000);
    if((Number(session.expires_at)||0)>now+60)return session;
    return await refreshSession();
  }

  function syncSharedEmail(from,to){
    const a=$(from), b=$(to); if(a&&b&&a.value&&!b.value)b.value=a.value;
  }
  function setMode(next,{focus=true}={}){
    mode=next==='signup'?'signup':'login';
    const loginPanel=$('authLoginPanel'), signupPanel=$('authSignupPanel');
    const loginTab=$('authModeLogin'), signupTab=$('authModeSignup');
    if(loginPanel)loginPanel.hidden=mode!=='login';
    if(signupPanel)signupPanel.hidden=mode!=='signup';
    if(loginTab){loginTab.classList.toggle('active',mode==='login');loginTab.setAttribute('aria-selected',mode==='login'?'true':'false')}
    if(signupTab){signupTab.classList.toggle('active',mode==='signup');signupTab.setAttribute('aria-selected',mode==='signup'?'true':'false')}
    if(mode==='signup'){
      syncSharedEmail('authLoginEmail','authSignupEmail');
      setMessage('Tạo tài khoản bằng bất kỳ email hợp lệ nào. Sau đăng ký có thể cần xác nhận email.');
      if(focus)setTimeout(()=>$('authSignupEmail')?.focus(),0);
    }else{
      syncSharedEmail('authSignupEmail','authLoginEmail');
      setMessage('Đăng nhập để mở khóa thao tác và tải dữ liệu cloud của riêng bạn.');
      if(focus)setTimeout(()=>$('authLoginEmail')?.focus(),0);
    }
  }
  function updatePasswordMatch(){
    const p=$('authSignupPassword')?.value||'', c=$('authSignupConfirm')?.value||'', hint=$('authPasswordMatch');
    if(!hint)return;
    if(!c){hint.textContent='Mật khẩu nhập lại phải trùng khớp.';hint.className='authFieldHint';return}
    if(p===c){hint.textContent='✓ Mật khẩu đã trùng khớp.';hint.className='authFieldHint good'}
    else {hint.textContent='Mật khẩu nhập lại chưa khớp.';hint.className='authFieldHint bad'}
  }
  function openModal(nextMode='login'){
    const m=$('authModal');if(m)m.hidden=false;
    setMode(nextMode,{focus:true});
  }
  function closeModal(){const m=$('authModal');if(m)m.hidden=true}

  async function login(){
    if(busy)return;
    const email=$('authLoginEmail')?.value.trim()||'', password=$('authLoginPassword')?.value||'';
    if(!email||!password){setMessage('Nhập email và mật khẩu để đăng nhập.','bad');return}
    setMessage('Đang đăng nhập…');setBusy(true,'login');
    try{
      const data=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password},auth:false});
      const next=normalizeSession(data); if(!next)throw new Error('Supabase không trả về phiên đăng nhập.');
      saveSession(next);await loadRole();updateUI();setMessage('Đăng nhập thành công.','good');closeModal();emit();
    }catch(e){setMessage(e.message||'Đăng nhập thất bại.','bad')}
    finally{setBusy(false)}
  }
  async function signup(){
    if(busy)return;
    const email=$('authSignupEmail')?.value.trim()||'';
    const password=$('authSignupPassword')?.value||'';
    const confirm=$('authSignupConfirm')?.value||'';
    if(!email){setMessage('Nhập email để tạo tài khoản.','bad');return}
    if(password.length<6){setMessage('Mật khẩu phải có tối thiểu 6 ký tự.','bad');return}
    if(!confirm){setMessage('Nhập lại mật khẩu để xác nhận.','bad');return}
    if(password!==confirm){setMessage('Hai mật khẩu chưa trùng khớp.','bad');updatePasswordMatch();return}
    setMessage('Đang tạo tài khoản…');setBusy(true,'signup');
    try{
      const redirect=encodeURIComponent('https://powerai655.vercel.app/');
      const data=await request(`/auth/v1/signup?redirect_to=${redirect}`,{method:'POST',body:{email,password},auth:false});
      const next=normalizeSession(data);
      if(next){saveSession(next);await loadRole();updateUI();setMessage('Đăng ký thành công và đã đăng nhập.','good');closeModal();emit()}
      else {setMessage('Đã tạo tài khoản. Hãy kiểm tra email để xác nhận rồi quay lại đăng nhập.','good');setMode('login',{focus:false});const le=$('authLoginEmail');if(le)le.value=email;}
    }catch(e){setMessage(e.message||'Đăng ký thất bại.','bad')}
    finally{setBusy(false)}
  }
  function setAccountMessage(msg,type=''){
    const el=$('accountMessage'); if(!el)return; el.textContent=msg; el.className='notice '+type;
  }
  function setAdminMessage(msg,type=''){
    const el=$('adminMessage'); if(!el)return; el.textContent=msg; el.className='notice '+type;
  }
  function openAccount(){
    const user=currentUser(); if(!user)return openModal('login');
    const m=$('accountModal'); if(m)m.hidden=false;
    if($('accountEmail'))$('accountEmail').textContent=user.email||'—';
    if($('accountRole'))$('accountRole').textContent=currentRole()==='admin'?'ADMIN':'USER';
    const del=$('deleteAccountBtn'); if(del){del.hidden=currentRole()==='admin';del.disabled=false;}
    setAccountMessage(currentRole()==='admin'?'Tài khoản Admin được bảo vệ, không thể tự hủy từ web.':'Dữ liệu cá nhân được tách riêng bằng Row Level Security.');
  }
  function closeAccount(){const m=$('accountModal');if(m)m.hidden=true}
  async function deleteMyAccount(){
    if(busy||!currentUser())return;
    if(currentRole()==='admin'){setAccountMessage('Tài khoản Admin được bảo vệ và không thể hủy tại đây.','bad');return}
    const typed=prompt('Nhập XOA để xác nhận hủy tài khoản và xóa toàn bộ dữ liệu cloud:');
    if(typed!=='XOA'){setAccountMessage('Đã hủy thao tác xóa tài khoản.');return}
    if(!confirm('Xác nhận lần cuối: hủy tài khoản PowerAI này?'))return;
    const btn=$('deleteAccountBtn'); if(btn){btn.disabled=true;btn.textContent='Đang xóa…'}
    setAccountMessage('Đang xóa tài khoản và dữ liệu cloud…');
    try{
      await request('/rest/v1/rpc/powerai_delete_my_account',{method:'POST',body:{},auth:true,timeoutMs:15000});
      saveSession(null);role='user';closeAccount();updateUI();emit();
      alert('Tài khoản đã được hủy. Dữ liệu cloud của tài khoản đã được xóa.');
    }catch(e){setAccountMessage(e.message||'Không thể hủy tài khoản.','bad')}
    finally{if(btn){btn.disabled=false;btn.textContent='Hủy tài khoản'}}
  }
  function closeAdmin(){const m=$('adminModal');if(m)m.hidden=true}
  function fmtDate(x){if(!x)return '—';try{return new Date(x).toLocaleString('vi-VN')}catch{return '—'}}
  async function loadAdminDashboard(){
    if(currentRole()!=='admin'){setAdminMessage('Bạn không có quyền quản trị.','bad');return}
    const box=$('adminSummary'), usersBox=$('adminUsers');
    if(box)box.innerHTML='<div class="adminStat"><span>Đang tải</span><b>…</b></div>';
    if(usersBox)usersBox.innerHTML='<div class="muted">Đang tải danh sách tài khoản…</div>';
    try{
      const [summary,users]=await Promise.all([
        request('/rest/v1/rpc/powerai_admin_summary',{method:'POST',body:{},auth:true}),
        request('/rest/v1/rpc/powerai_admin_users',{method:'POST',body:{},auth:true})
      ]);
      if(box){
        const s=summary||{};
        box.innerHTML=`<div class="adminStat"><span>Tổng tài khoản</span><b>${s.users_total??0}</b></div><div class="adminStat"><span>Đã xác nhận email</span><b>${s.users_confirmed??0}</b></div><div class="adminStat"><span>Hoạt động 7 ngày</span><b>${s.users_active_7d??0}</b></div><div class="adminStat"><span>Đang có A/B/C khóa</span><b>${s.users_with_abc_lock??0}</b></div><div class="adminStat"><span>Đang có L khóa</span><b>${s.users_with_l_lock??0}</b></div><div class="adminStat"><span>Sync gần nhất</span><b class="smallValue">${fmtDate(s.latest_sync_at)}</b></div>`;
      }
      renderAdminUsers(Array.isArray(users)?users:[]);
      setAdminMessage('Đã tải trạng thái hệ thống. Không đọc nội dung bộ số riêng của user.','good');
    }catch(e){setAdminMessage(e.message||'Không tải được Admin Dashboard.','bad')}
  }
  function renderAdminUsers(rows){
    const box=$('adminUsers'); if(!box)return;
    if(!rows.length){box.innerHTML='<div class="muted">Chưa có tài khoản.</div>';return}
    box.innerHTML=`<div class="adminTableHead"><span>Tài khoản</span><span>Trạng thái</span><span>Quyền</span><span>Cloud</span><span>Thao tác</span></div>`+rows.map(r=>{
      const self=currentUser()?.id===r.user_id;
      const protectedAdmin=(String(r.email||'').toLowerCase()==='hieuthao732@gmail.com');
      return `<div class="adminUserRow" data-user="${r.user_id}"><div class="adminUserIdentity"><b>${escapeHtml(r.email||'—')}</b><small>${r.email_confirmed?'✓ Email xác nhận':'• Chưa xác nhận'}</small></div><div><span class="statePill ${r.enabled?'good':'bad'}">${r.enabled?'ĐANG MỞ':'ĐÃ KHÓA'}</span></div><div><select class="adminRoleSelect" ${self||protectedAdmin?'disabled':''}><option value="user" ${r.role==='user'?'selected':''}>USER</option><option value="admin" ${r.role==='admin'?'selected':''}>ADMIN</option></select></div><div class="adminCloudState"><small>Sync: ${fmtDate(r.last_sync_at)}</small><small>${r.has_abc_lock?'A/B/C đã khóa':'A/B/C chưa khóa'} • ${r.has_l_lock?'L đã khóa':'L chưa khóa'}</small></div><div class="adminUserActions"><button class="ghostBtn adminSaveRole" ${self||protectedAdmin?'disabled':''}>Lưu quyền</button><button class="${r.enabled?'dangerOutlineBtn':'successOutlineBtn'} adminToggleUser" ${self||protectedAdmin?'disabled':''}>${r.enabled?'Khóa user':'Mở user'}</button></div></div>`;
    }).join('');
    box.querySelectorAll('.adminUserRow').forEach(row=>{
      const id=row.dataset.user;
      row.querySelector('.adminSaveRole')?.addEventListener('click',()=>adminSetRole(id,row.querySelector('.adminRoleSelect')?.value));
      row.querySelector('.adminToggleUser')?.addEventListener('click',()=>{
        const currentlyOpen=row.querySelector('.statePill')?.textContent?.includes('ĐANG MỞ');
        adminSetEnabled(id,!currentlyOpen);
      });
    });
  }
  function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  async function adminSetEnabled(userId,enabled){
    if(currentRole()!=='admin')return;
    try{await request('/rest/v1/rpc/powerai_admin_set_user_enabled',{method:'POST',body:{p_user_id:userId,p_enabled:!!enabled},auth:true});setAdminMessage(enabled?'Đã mở lại tài khoản.':'Đã khóa tài khoản.','good');await loadAdminDashboard()}catch(e){setAdminMessage(e.message||'Không đổi được trạng thái user.','bad')}
  }
  async function adminSetRole(userId,nextRole){
    if(currentRole()!=='admin')return;
    try{await request('/rest/v1/rpc/powerai_admin_set_role',{method:'POST',body:{p_user_id:userId,p_role:nextRole},auth:true});setAdminMessage('Đã cập nhật quyền tài khoản.','good');await loadAdminDashboard()}catch(e){setAdminMessage(e.message||'Không đổi được quyền user.','bad')}
  }
  async function openAdmin(){
    if(currentRole()!=='admin')return;
    const m=$('adminModal');if(m)m.hidden=false;await loadAdminDashboard();
  }

  async function logout(){
    if(busy)return;
    setBusy(true);
    try{if(session?.access_token)await request('/auth/v1/logout',{method:'POST',auth:true,timeoutMs:7000})}catch(e){console.warn('Logout remote failed',e)}
    saveSession(null);role='user';updateUI();closeModal();emit();setBusy(false);
  }
  async function restore(){
    session=readStoredSession();
    if(session){await ensureFreshSession();await loadRole()}
    updateUI(); emit();
  }
  function bind(){
    $('authOpenBtn')?.addEventListener('click',()=>openModal('login'));
    $('authCloseBtn')?.addEventListener('click',closeModal);
    $('authModeLogin')?.addEventListener('click',()=>setMode('login'));
    $('authModeSignup')?.addEventListener('click',()=>setMode('signup'));
    $('authGoSignup')?.addEventListener('click',()=>setMode('signup'));
    $('authGoLogin')?.addEventListener('click',()=>setMode('login'));
    $('authLoginBtn')?.addEventListener('click',login);
    $('authSignupBtn')?.addEventListener('click',signup);
    $('authLogoutBtn')?.addEventListener('click',logout);
    $('accountBtn')?.addEventListener('click',openAccount);
    $('accountCloseBtn')?.addEventListener('click',closeAccount);
    $('deleteAccountBtn')?.addEventListener('click',deleteMyAccount);
    $('adminPanelBtn')?.addEventListener('click',openAdmin);
    $('adminCloseBtn')?.addEventListener('click',closeAdmin);
    $('adminRefreshBtn')?.addEventListener('click',loadAdminDashboard);
    $('authLoginPassword')?.addEventListener('keydown',e=>{if(e.key==='Enter')login()});
    $('authSignupConfirm')?.addEventListener('keydown',e=>{if(e.key==='Enter')signup()});
    $('authSignupPassword')?.addEventListener('input',updatePasswordMatch);
    $('authSignupConfirm')?.addEventListener('input',updatePasswordMatch);
    $('authModal')?.addEventListener('click',e=>{if(e.target?.id==='authModal')closeModal()});
    $('accountModal')?.addEventListener('click',e=>{if(e.target?.id==='accountModal')closeAccount()});
    $('adminModal')?.addEventListener('click',e=>{if(e.target?.id==='adminModal')closeAdmin()});
    setMode('login',{focus:false});
    restore().catch(e=>{console.error('Auth restore failed',e);saveSession(null);updateUI();emit()});
  }
  window.PowerAIAuth={request,getSession:()=>session,getUser:()=>currentUser(),getRole:()=>currentRole(),login,signup,logout,openModal,closeModal,openAccount,openAdmin,loadAdminDashboard,deleteMyAccount,refreshSession,setMode};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
