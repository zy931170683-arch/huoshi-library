'use strict';

// Offline prototype only. IndexedDB is not a server-side security boundary.
// Never write cleartext passwords to IndexedDB or to the exportable activity log.
window.createLocalAccountStore = database => {
  const iterations = 600000;
  const sessionKey = `${database.name}:account-session`;
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(`${database.name}:accounts`) : null;
  const encode = value => new TextEncoder().encode(value);
  const hex = buffer => [...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join('');
  const normalize = value => {
    const phone=String(value).trim().replace(/[\s-]/g,'').replace(/^(?:\+86|0086)/,'');
    if(!/^1[3-9]\d{9}$/.test(phone))throw new Error('请输入有效的 11 位中国大陆手机号。');
    return phone;
  };
  const validatePassword = value => {if(typeof value!=='string'||value.length<8||value.length>128||!value.trim())throw new Error('密码需要 8–128 位，且不能全部为空格。');};
  const read = (store,key) => new Promise((resolve,reject)=>{const r=database.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  async function derive(password,salt) {
    if(!crypto.subtle)throw new Error('当前环境不支持密码保护，请使用现代浏览器打开本地文件或 HTTPS 网站。');
    const key=await crypto.subtle.importKey('raw',encode(password),'PBKDF2',false,['deriveBits']);
    return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(salt),iterations,hash:'SHA-256'},key,256));
  }
  async function credentials(password){const salt=[...crypto.getRandomValues(new Uint8Array(16))];return {salt,passwordHash:await derive(password,salt),iterations,algorithm:'PBKDF2-SHA256'};}
  const publicUser = account => ({phone:account.phone,createdAt:account.createdAt,revision:account.revision});
  function transact(stores,callback){return new Promise((resolve,reject)=>{const tx=database.transaction(stores,'readwrite');let failure,result;const fail=e=>{if(failure)return;failure=e;try{tx.abort();}catch{reject(e);}};try{callback(tx,fail,value=>{result=value;});}catch(e){fail(e);}tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(failure||new Error('账号未保存，请检查浏览器存储空间。'));tx.onabort=()=>reject(failure||new Error('操作未完成，原有数据未改变。'));});}
  const event = (action,phone) => ({id:crypto.randomUUID(),action,phone,at:Date.now(),scope:'browser-local-demo'});
  function sessionToken(){try{return sessionStorage.getItem(sessionKey);}catch{return null;}}
  function canStoreSession(){try{sessionStorage.setItem(`${sessionKey}:check`,'1');sessionStorage.removeItem(`${sessionKey}:check`);}catch{throw new Error('浏览器禁止保存登录状态，请允许网站存储后重试。');}}
  function saveToken(token){sessionStorage.setItem(sessionKey,token);}
  const announce = () => channel?.postMessage('changed');
  let identity=null;
  async function current(){
    const token=sessionToken();identity=null;if(!token)return null;
    const session=await read('authSessions',token);if(!session||session.expiresAt<=Date.now()){sessionStorage.removeItem(sessionKey);return null;}
    const account=await read('accounts',session.phone);if(!account||account.revision!==session.revision){sessionStorage.removeItem(sessionKey);return null;}
    identity=publicUser(account);return identity;
  }
  async function register(raw,password){
    const phone=normalize(raw);validatePassword(password);canStoreSession();
    if(await read('accounts',phone))throw new Error('该手机号已注册，请直接登录或重置密码。');
    const account={phone,...await credentials(password),createdAt:Date.now(),revision:1};const token=crypto.randomUUID();
    await transact(['accounts','authEvents','authSessions'],(tx,fail)=>{
      const request=tx.objectStore('accounts').add(account);
      request.onerror=e=>{e.preventDefault();fail(new Error('该手机号已注册，请直接登录或重置密码。'));};
      tx.objectStore('authEvents').add(event('register',phone));
      tx.objectStore('authSessions').add({token,phone,revision:1,expiresAt:Date.now()+24*60*60*1000});
    });
    saveToken(token);announce();return current();
  }
  async function login(raw,password){
    const phone=normalize(raw);validatePassword(password);canStoreSession();
    const account=await read('accounts',phone);
    if(!account||await derive(password,account.salt)!==account.passwordHash)throw new Error('手机号或密码不正确。');
    const token=crypto.randomUUID();
    await transact(['accounts','authEvents','authSessions'],(tx,fail)=>{
      const r=tx.objectStore('accounts').get(phone);r.onsuccess=()=>{if(r.result?.revision!==account.revision){fail(new Error('密码已更改，请重新登录。'));return;}tx.objectStore('authSessions').add({token,phone,revision:account.revision,expiresAt:Date.now()+24*60*60*1000});tx.objectStore('authEvents').add(event('login',phone));};
    });saveToken(token);return current();
  }
  async function reset(){throw new Error('密码重置已改为管理员操作，请使用共享后台版。');}
  async function logout(){
    const token=sessionToken();const user=await current();
    if(token)await transact(['authSessions','authEvents'],tx=>{tx.objectStore('authSessions').delete(token);if(user)tx.objectStore('authEvents').add(event('logout',user.phone));});
    sessionStorage.removeItem(sessionKey);identity=null;announce();
  }
  async function logs(){const user=await current();if(!user)throw new Error('请先登录后查看账号记录。');return new Promise((resolve,reject)=>{const request=database.transaction('authEvents').objectStore('authEvents').index('phone').getAll(user.phone);request.onsuccess=()=>resolve(request.result.sort((a,b)=>a.at-b.at));request.onerror=()=>reject(request.error);});}
  // Include these stores in every asset mutation, so a reset/logout cannot race a save.
  function authorizeTransaction(tx,callback){const token=sessionToken();if(!token){tx.abort();return;}const r=tx.objectStore('authSessions').get(token);r.onsuccess=()=>{const session=r.result;if(!session||session.expiresAt<=Date.now()){tx.abort();return;}const account=tx.objectStore('accounts').get(session.phone);account.onsuccess=()=>{if(!account.result||account.result.revision!==session.revision){tx.abort();return;}callback(publicUser(account.result));};};}
  channel?.addEventListener('message',()=>window.HuoshiAccounts.refresh().catch(()=>{}));
  return {current,register,login,reset,logout,logs,authorizeTransaction,normalize,
    notice:'离线界面预览 · 此处账号与素材不共享。请启动共享后台使用团队账号。',
    resetDescription:'请联系管理员重置密码。',
    logNotice:'仅显示当前账号的注册、登录和重置记录；不包含密码。可导出为 .log 文件。'};
};
