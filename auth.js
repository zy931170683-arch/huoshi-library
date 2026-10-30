'use strict';

// UI is independent of account persistence. The storage adapter is supplied at init.
window.HuoshiAccounts = (() => {
  let service, user = null, mode = 'login', busy = false;
  const q = s => document.querySelector(s);
  const all = s => [...document.querySelectorAll(s)];
  const mask = phone => phone ? `${phone.slice(0,3)} ···· ${phone.slice(-4)}` : '';
  const message = (text = '', error = false) => { q('#auth-status').textContent = text; q('#auth-status').classList.toggle('error',error); };
  function setMode(next) {
    mode = next; q('#auth-form').reset(); message();
    q('#auth-password').type = 'password'; q('#auth-show-password').textContent = '显示';q('#auth-show-password').setAttribute('aria-pressed','false');q('#auth-show-password').setAttribute('aria-label','显示密码');
    q('#auth-title').textContent = {login:'欢迎回来',register:'加入火石素材库',reset:'重置密码'}[mode];
    q('#auth-intro').textContent = {login:'登录后，即可上传、下载和整理素材。',register:'用手机号和密码，开启你的创作空间。',reset:service.resetDescription}[mode];
    q('#auth-submit').textContent = {login:'登录',register:'注册并登录',reset:'重置密码'}[mode];
    q('#auth-password-label').textContent = mode === 'reset' ? '新密码' : '密码';
    q('#auth-password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    q('#auth-password').placeholder = mode === 'login' ? '请输入密码' : '设置 8–128 位密码';
    q('#auth-forgot').textContent = mode === 'reset' ? '返回登录' : '忘记密码？';
    q('.auth-tabs').hidden = mode === 'reset';
    all('[data-auth-mode]').forEach(b => {b.setAttribute('aria-selected',String(b.dataset.authMode === mode));b.tabIndex = b.dataset.authMode === mode ? 0 : -1;});
  }
  function sync() {
    document.body.classList.toggle('guest-view',!user);
    all('[data-account-open]').forEach(b => {b.classList.toggle('is-member',!!user);b.innerHTML = user ? user.phone.slice(-2) : icon('user');b.setAttribute('aria-label',user?`账号 ${mask(user.phone)}`:'登录或注册');b.title = user?mask(user.phone):'登录或注册';});
    all('#detail-title,#detail-prompt,#detail-project-link').forEach(el => el.readOnly = !user);
    q('#detail-project').disabled=!user;
    const note=q('#detail-readonly-note');if(note)note.hidden=!!user;
    q('#auth-footnote').textContent=service?.notice||'账号存储暂不可用，请刷新后重试。';
    q('#auth-entry').hidden=!!user;q('#account-panel').hidden=!user;
    q('#account-admin').hidden=user?.role!=='admin';q('#account-import').hidden=!user||!service?.shared||!db;
    if(user){q('#auth-title').textContent='我的账号';q('#account-phone').textContent=mask(user.phone);q('#account-initial').textContent=user.phone.slice(-2);q('#account-since').textContent=`注册于 ${new Date(user.createdAt).toLocaleDateString('zh-CN')}`;}
    if(!user){selectionMode=false;selectedIds.clear();if(storageReady)renderSelection();all('#upload-dialog[open],#delete-dialog[open],#account-logs-dialog[open],#logs-dialog[open],#admin-dialog[open],#import-local-dialog[open]').forEach(d=>d.close());}
  }
  function open() { if(!service){toast('账号服务正在准备，请稍后重试。',true);return;}if(!user)setMode('login');sync();q('#auth-dialog').showModal();if(!user)q('#auth-phone').focus(); }
  function requireLogin() { if(user)return true;toast('请先点击右上角头像登录，再进行此操作。');return false; }
  function assertLogin() {if(!user)throw new Error('请先登录后再操作。');}
  async function refresh() {const previous=user?.phone;try{user=await service.current();}catch(e){user=null;sync();throw e;}sync();if(previous!==user?.phone&&draft)renderPreview();}
  async function showRecords() {
    if(!requireLogin())return;
    try {
      const logs=await service.logs();q('#account-log-note').textContent=service.logNotice;
      q('#account-log-list').replaceChildren();
      const names={register:'注册账号',login:'登录',logout:'退出登录',reset:'重置密码'};
      for(const row of logs.slice().reverse()){
        const item=document.createElement('div');item.className='auth-log-row';
        const text=document.createElement('span');text.textContent=`${mask(row.phone)} · ${names[row.action]||row.action}`;
        const time=document.createElement('small');time.textContent=new Date(row.at).toLocaleString('zh-CN');item.append(text,time);q('#account-log-list').append(item);
      }
      if(!logs.length)q('#account-log-list').textContent='还没有账号记录';
      q('#account-log-status').textContent='';q('#auth-dialog').close();q('#account-logs-dialog').showModal();
    }catch(e){message(e.message,true);}
  }
  async function init(adapter) {
    service=adapter;
    const homeButton=document.createElement('button');homeButton.className='avatar';homeButton.setAttribute('data-account-open','');homeButton.setAttribute('aria-label','登录或注册');q('.home-header-right').insertBefore(homeButton,q('.home-header-right .huoshi-logo'));
    const note=document.createElement('div');note.id='detail-readonly-note';note.className='detail-readonly-note';note.textContent='当前为浏览模式，登录后可编辑、下载和删除。';q('#detail-dialog .dialog-header').after(note);
    all('[data-account-open]').forEach(b=>b.addEventListener('click',open));
    all('[data-auth-mode]').forEach(b=>b.addEventListener('click',()=>{if(!busy)setMode(b.dataset.authMode);}));
    q('.auth-tabs').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)&&!busy){e.preventDefault();setMode(mode==='login'?'register':'login');q(`[data-auth-mode="${mode}"]`).focus();}});
    q('#auth-forgot').addEventListener('click',()=>{if(!busy)message(service.shared?'请联系公司管理员确认身份，由管理员重置密码。无需短信验证码。':'共享后台版由管理员重置密码；此离线预览不提供自助重置。');});
    q('#auth-show-password').addEventListener('click',()=>{const show=q('#auth-password').type==='password';q('#auth-password').type=show?'text':'password';q('#auth-show-password').textContent=show?'隐藏':'显示';q('#auth-show-password').setAttribute('aria-label',show?'隐藏密码':'显示密码');q('#auth-show-password').setAttribute('aria-pressed',String(show));});
    q('#auth-form').addEventListener('submit',async e=>{
      e.preventDefault();if(busy)return;busy=true;message();
      const submit=q('#auth-submit');const label=submit.textContent;submit.textContent='请稍候…';all('#auth-dialog input,#auth-dialog button').forEach(b=>b.disabled=true);
      try {
        const phone=q('#auth-phone').value;const password=q('#auth-password').value;
        await service[mode](phone,password);await refresh();q('#auth-dialog').close();toast(mode==='register'?'注册成功，欢迎加入火石素材库':'登录成功');
      }catch(err){message(err.message||'操作未完成，请稍后重试。',true);}
      finally{busy=false;all('#auth-dialog input,#auth-dialog button').forEach(b=>b.disabled=false);submit.textContent={login:'登录',register:'注册并登录',reset:'重置密码'}[mode]||label;}
    });
    q('#auth-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
    q('#auth-dialog').addEventListener('close',()=>{q('#auth-password').value='';});
    q('#account-logout').addEventListener('click',async()=>{if(busy)return;busy=true;try{await service.logout();await refresh();q('#auth-dialog').close();all('#upload-dialog[open],#delete-dialog[open],#account-logs-dialog[open],#logs-dialog[open]').forEach(d=>d.close());toast('已退出登录，仍可浏览素材');}catch(e){toast(e.message,true);}finally{busy=false;}});
    q('#account-workspace').addEventListener('click',()=>{q('#auth-dialog').close();q('#info-dialog').showModal();});
    q('#account-records').addEventListener('click',showRecords);
    q('#account-admin').addEventListener('click',async()=>{
      if(user?.role!=='admin')return;
      try{const users=await service.users();q('#admin-users').replaceChildren();for(const item of users){const row=document.createElement('button');row.type='button';row.className='auth-log-row admin-user';row.textContent=`${item.phone} · ${item.role==='admin'?'管理员':'成员'}`;row.addEventListener('click',()=>{q('#admin-phone').value=item.phone;q('#admin-password').focus();});q('#admin-users').append(row);}q('#admin-reset-form').reset();q('#admin-status').textContent='';q('#auth-dialog').close();q('#admin-dialog').showModal();}catch(e){message(e.message,true);}
    });
    q('#admin-reset-form').addEventListener('submit',async e=>{
      e.preventDefault();if(busy||user?.role!=='admin')return;busy=true;q('#admin-reset-submit').disabled=true;q('#admin-status').textContent='正在重置…';
      try{await service.adminReset(q('#admin-phone').value,q('#admin-password').value);q('#admin-password').value='';q('#admin-status').textContent='密码已重置，旧登录已失效。请将新密码告知本人。';await refresh();}
      catch(err){q('#admin-status').textContent=err.message;}finally{busy=false;q('#admin-reset-submit').disabled=false;}
    });
    q('#admin-dialog').addEventListener('close',()=>{q('#admin-password').value='';});
    let importItems=[];
    q('#account-import').addEventListener('click',async()=>{
      if(!service.shared||!requireLogin())return;
      try{const remote=await window.HuoshiBackend.list();const existing=new Set(remote.map(a=>a.importKey));importItems=(await readStore('assets')).filter(a=>!a.demo&&!existing.has(`${user.phone}:${a.id}`));q('#import-local-description').textContent=`当前网址下的浏览器本地库中，有 ${importItems.length} 份素材可导入。其他网址或双击 HTML 中的素材不会自动出现在这里。`;q('#import-local-status').textContent='';q('#import-local-confirm').disabled=!importItems.length;q('#auth-dialog').close();q('#import-local-dialog').showModal();}catch(e){message(e.message,true);}
    });
    q('#import-local-confirm').addEventListener('click',async()=>{
      if(busy||!requireLogin())return;busy=true;q('#import-local-confirm').disabled=true;let completed=0;
      try{const local=await readStore('assets');const importedId=async originalId=>{const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${user.phone}:${originalId}`));return 'import-'+[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,32);};for(const asset of [...importItems].sort((a,b)=>Number(b.type==='project')-Number(a.type==='project'))){q('#import-local-status').textContent=`正在导入 ${completed+1} / ${importItems.length}…`;const importKey=`${user.phone}:${asset.id}`;const id=await importedId(asset.id);const localProject=local.find(a=>a.id===asset.projectId&&a.type==='project');const projectId=localProject&&!localProject.demo?await importedId(localProject.id):asset.projectId||'';await window.HuoshiBackend.save([{...asset,id,projectId,revision:undefined,importKey}]);completed++;}q('#import-local-status').textContent=`已导入 ${completed} 份素材，本地原记录保留。`;await refreshSharedAssets();}
      catch(e){q('#import-local-status').textContent=`已完成 ${completed} 份。${e.message} 重新打开此窗口可继续剩余内容。`;}
      finally{busy=false;}
    });
    q('#export-account-log').addEventListener('click',async()=>{
      if(!requireLogin())return;
      try{const logs=await service.logs();const blob=new Blob([logs.map(row=>JSON.stringify(row)).join('\n')+'\n'],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`huoshi-accounts-${new Date().toISOString().slice(0,10)}.log`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);q('#account-log-status').textContent='已导出账号日志，不包含密码。';}catch(e){q('#account-log-status').textContent=e.message;}
    });
    addEventListener('focus',()=>refresh().catch(()=>{}));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh().catch(()=>{});});
    setInterval(()=>{if(user)refresh().catch(()=>{});},30000);
    await refresh();
  }
  return {init,sync,refresh,requireLogin,assertLogin,get user(){return user;},get busy(){return busy;}};
})();
