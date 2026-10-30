'use strict';
window.HuoshiBackend=(()=>{
 let connected=false;
 async function request(url,options={}){
   const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options,headers:{'X-Huoshi-Request':'1',...(options.body instanceof Blob?{}:{'Content-Type':'application/json'}),...options.headers}});
   let result;try{result=await response.json();}catch{throw new Error('后台返回异常，请检查服务器连接。');}
   if(!response.ok){if(response.status===401&&window.HuoshiAccounts?.user)void window.HuoshiAccounts.refresh().catch(()=>{});throw new Error(result.error||'操作未完成，请稍后重试。');}return result;
 }
 async function connect(){
   // Server pages opt in. An outage must never downgrade a shared workspace to local accounts.
   if(location.protocol==='file:'||!document.querySelector('meta[name="huoshi-backend"]'))return null;
   const config=await request('/api/config');if(config.backend!=='huoshi'||config.mode!=='shared')throw new Error('无法连接共享后台。');connected=true;
   return {shared:true,notice:'团队共享账号 · 登录后可上传、下载和整理素材。忘记密码请联系管理员。',logNotice:'记录保存在服务器，日志不包含密码。管理员可查看全部账号记录。',
     current:async()=>(await request('/api/auth/me')).user,
     register:(phone,password)=>request('/api/auth/register',{method:'POST',body:JSON.stringify({phone,password})}),
     login:(phone,password)=>request('/api/auth/login',{method:'POST',body:JSON.stringify({phone,password})}),
     logout:()=>request('/api/auth/logout',{method:'POST',body:'{}'}),
     logs:async()=>(await request('/api/auth/logs')).logs,
     users:async()=>(await request('/api/admin/users')).users,
     adminReset:(phone,password)=>request('/api/admin/reset-password',{method:'POST',body:JSON.stringify({phone,password})})};
 }
 async function upload(blob,name){if(!blob)return null;const result=await request('/api/files',{method:'POST',headers:{'Content-Type':blob.type||'application/octet-stream','X-File-Name':encodeURIComponent(name||blob.name||'file')},body:blob});return result.id;}
 async function serialize(asset){
   const record={...asset};
   if(asset.blob instanceof Blob)record.originalId=await upload(asset.blob,asset.fileName||asset.title);
   if(asset.thumbnail instanceof Blob)record.thumbnailId=await upload(asset.thumbnail,'preview.webp');
   if(asset.cover instanceof Blob)record.coverId=await upload(asset.cover,'cover.webp');
   record.references=[];
   for(const ref of asset.references||[]){const out={...ref};if(ref.blob instanceof Blob)out.fileId=await upload(ref.blob,ref.name);if(ref.thumbnail instanceof Blob)out.thumbnailId=await upload(ref.thumbnail,'reference.webp');delete out.blob;delete out.thumbnail;record.references.push(out);}
   delete record.blob;delete record.thumbnail;delete record.cover;return record;
 }
 async function save(items){const records=[];for(const a of items)records.push(await serialize(a));const saved=(await request('/api/assets',{method:'POST',body:JSON.stringify({assets:records})})).assets;for(const item of items){const record=saved.find(a=>a.id===item.id);for(const key of Object.keys(item))delete item[key];Object.assign(item,record);}return saved;}
 async function list(){return(await request('/api/assets')).assets;}
 async function deletionLogs(){return(await request('/api/deletion-logs')).logs;}
 async function remove(ids,reason){return(await request('/api/assets/delete',{method:'POST',body:JSON.stringify({ids,reason})})).log;}
 return {connect,save,list,deletionLogs,remove,request,get connected(){return connected;}};
})();
