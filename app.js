'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const icons = {
  plus:'<path d="M12 5v14M5 12h14"/>',
  x:'<path d="m6 6 12 12M6 18 18 6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  history:'<path d="M3 11a9 9 0 1 1 2.4 7M3 4v7h7m2-4v6l4 2"/>',
  select:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/>',
  upload:'<path d="M12 16V3m-4 4 4-4 4 4M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
  download:'<path d="M12 3v13m-4-4 4 4 4-4M4 17v4h16v-4"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  video:'<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  folder:'<path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z"/>',
  file:'<path d="M14 2H5v20h14V7l-5-5Z"/><path d="M14 2v6h5M8 12h8m-8 4h6"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  tag:'<path d="M3 3h8l10 10-8 8L3 11V3Z"/><circle cx="7.5" cy="7.5" r="1"/>',
  bookmark:'<path d="M6 3h12v18l-6-4-6 4V3Z"/>',
  sort:'<path d="M4 6h15M4 12h10M4 18h5m9-8v11m-3-3 3 3 3-3"/>',
  'chevron-down':'<path d="m6 9 6 6 6-6"/>',
  copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  external:'<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>',
  play:'<path d="m8 5 11 7-11 7V5Z"/>'
};
function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.file}</svg>`; }
function hydrateIcons(root = document) { $$('[data-icon]', root).forEach(el => el.innerHTML = icon(el.dataset.icon)); }
function escapeHTML(value = '') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
const typeLabels = {image:'图片',video:'视频',project:'项目'};
const typeIcons = {image:'image',video:'video',project:'folder'};
const routeConfig = {
  home:{title:'火石素材库',eyebrow:'HUOSHI CREATIVE ARCHIVE',description:'',section:'首页',upload:'上传素材',drop:'',hint:'',type:'all'},
  library:{title:'火石项目库',eyebrow:'A HOME FOR YOUR IDEAS',description:'把项目、影像与灵感收在一起，让好创意在下一次创作中继续。',section:'全部素材',upload:'上传素材',drop:'给灵感，一个落脚的地方',hint:'将图片、视频或项目文件拖到这里，也可以添加项目链接',type:'all'},
  projects:{title:'把好创意，整理成章',eyebrow:'PROJECTS & POSSIBILITIES',description:'从第一份提案到最后一次交付，让项目的每一步都清晰可见。',section:'项目总管',upload:'添加项目',drop:'每个项目，都从一个想法开始',hint:'拖入提案、项目文档，或添加飞书、Notion 等项目链接',type:'project'},
  images:{title:'收藏每一个，心动瞬间',eyebrow:'COLLECT THE WAY YOU SEE',description:'整理画面、记录灵感，让值得收藏的影像随时被找到。',section:'图片整理',upload:'上传图片',drop:'把值得珍藏的画面，放在这里',hint:'拖拽图片到这里，支持 JPG、PNG、WebP、GIF 等格式',type:'image'},
  videos:{title:'让每一帧，都有归处',eyebrow:'MOTION WITH A MEANING',description:'从随手记录到精心制作，建立属于团队的动态影像资料库。',section:'视频整理',upload:'上传视频',drop:'下一段故事，从这里开始',hint:'拖拽视频到这里，支持 MP4、WebM、MOV 等格式',type:'video'}
};
const MAX_FILE_BYTES = 500 * 1024 * 1024;
const blobURLs = new WeakMap();
const activeURLs = new Set();
let db;
let assets = [];
let route = 'home';
let filterType = 'all';
let filterTag = '';
let favoritesOnly = false;
let search = '';
let sort = 'newest';
let uploadType = 'image';
let selectedFiles = [];
let draft = null;
let working = false;
let draftBusy = false;
let storageReady = false;
let tagQuery = '';
let sidebarPinned = false;
let sidebarTimer;
let selectionMode = false;
const selectedIds = new Set();
let pendingDelete = null;
let deletionLogs = [];

function blobURL(blob) {
  if (!blobURLs.has(blob)) { const url = URL.createObjectURL(blob); blobURLs.set(blob, url); activeURLs.add(url); }
  return blobURLs.get(blob);
}
function mediaURL(asset) { return asset.blob ? blobURL(asset.blob) : asset.src || ''; }
function previewURL(asset) { return asset.cover ? blobURL(asset.cover) : asset.thumbnail ? blobURL(asset.thumbnail) : asset.preview || ((asset.mediaKind || asset.type) === 'image' ? mediaURL(asset) : ''); }
function formatBytes(bytes) { if (!bytes) return '—'; const unit = bytes >= 1024 ** 3 ? 'GB' : bytes >= 1024 ** 2 ? 'MB' : 'KB'; const divisor = {GB:1024 ** 3,MB:1024 ** 2,KB:1024}[unit]; return `${(bytes/divisor).toFixed(1)} ${unit}`; }
function formatDuration(seconds) { if (!Number.isFinite(seconds)) return ''; return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`; }
function formatDate(value) { return new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Shanghai'}).format(new Date(value)); }
function safeLink(value) { try { const url = new URL(value); return ['http:','https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
function toast(message, error = false) { const el = document.createElement('div'); el.className = `toast${error?' error':''}`; el.innerHTML = `${icon(error?'info':'check')}<span>${escapeHTML(message)}</span>`; const region=$('#toast-region'); region.append(el); while(region.children.length>2)region.firstElementChild.remove(); setTimeout(() => el.remove(), error?6500:3800); }
function storageError(error) { return error?.name === 'QuotaExceededError' ? '浏览器存储空间不足，请减少文件大小并保留原文件。' : '保存失败，请检查浏览器是否允许网站存储，然后重试。'; }

function openDatabase() {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open('frame-asset-library',2);
    request.onupgradeneeded = () => {
      const database=request.result;
      if(!database.objectStoreNames.contains('assets'))database.createObjectStore('assets',{keyPath:'id'});
      if(!database.objectStoreNames.contains('settings'))database.createObjectStore('settings');
      if(!database.objectStoreNames.contains('deletionLogs'))database.createObjectStore('deletionLogs',{keyPath:'id'});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('请关闭其他旧版页面后重试'));
  });
}
function readStore(name, key) { return new Promise((resolve,reject) => { const req = key === undefined ? db.transaction(name).objectStore(name).getAll() : db.transaction(name).objectStore(name).get(key); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
function saveAssets(items) { return new Promise((resolve,reject) => { const tx = db.transaction('assets','readwrite'); items.forEach(item => tx.objectStore('assets').put(item)); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); }
function seedDatabase(items) { return new Promise((resolve,reject) => { const tx = db.transaction(['assets','settings'],'readwrite'); items.forEach(item => tx.objectStore('assets').put(item)); tx.objectStore('settings').put(true,'seeded'); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); }
function createSamples() {
  const definitions = [
    ['image','山脊之上 · 清晨的第一束光','mountain',['自然','山野','光影']],
    ['image','城市切片 · 日常的另一面','city',['城市','街景','纪实']],
    ['image','林间来信 · 绿色的呼吸','forest',['自然','森林','氛围']],
    ['image','留白之间 · 建筑的线条','architecture',['建筑','极简','线条']],
    ['image','海的另一边 · 蔚蓝时刻','ocean',['自然','海洋','蓝色']],
    ['project','山野之间 · 品牌短片企划','mist',['项目','品牌','自然']],
    ['image','沙丘之上 · 风的形状','desert',['自然','沙漠','纹理']],
    ['video','风里的花 · 动态影像练习','flower',['自然','花卉','特写']],
    ['image','镜湖 · 山与水的对白','lake',['自然','山野','倒影']],
    ['image','街头交响 · 穿行于人海','skyline',['城市','街景','纪实']],
    ['image','星河低垂 · 山间夜色','night',['自然','星空','山野']],
    ['project','光影档案 · 视觉参考项目','architecture',['项目','建筑','灵感']],
    ['image','雾起时 · 遇见旷野','mist',['自然','山野','氛围']],
    ['image','向林深处 · 一场漫游','woods',['自然','森林','纪实']],
    ['image','霓虹漫游 · 城市的另一种颜色','stars',['城市','夜景','赛博朋克']]
  ];
  return definitions.map(([type,title,photo,tags],index) => ({id:`demo-${index+1}`,type,title,tags,demo:true,favorite:false,createdAt:new Date('2026-10-28T02:00:00Z').getTime()-index*3600000,updatedAt:Date.now(),src:type==='video'?'./assets/flower.mp4':type==='image'?`./assets/${photo}.jpg`:'',preview:type==='video'?'':`./assets/${photo}.jpg`,format:type==='video'?'MP4':type==='project'?'PROJECT':'JPG',fileName:type==='image'?`${photo}.jpg`:type==='video'?'flower.mp4':'',mediaKind:type==='video'?'video':type==='image'?'image':'document',prompt:index===0?'远处连绵的山脊，清晨柔和的侧光，冷暖交织的自然色调。以宽幅构图表现山体的层次和空间感，保留岩石与云雾的细节。\n\n创作笔记示例，可替换为你的实际提示词。':'',references:[],url:'',description:type==='project'?'这是一个项目示例。你可以修改标题、添加项目链接，并在下方记录提示词和参考图。':'',duration:type==='video'?5:undefined}));
}

function currentScope() { const type = routeConfig[route].type; return assets.filter(asset => type === 'all' || asset.type === type); }
function filteredAssets() {
  const terms = search.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return currentScope().filter(a => (filterType==='all'||a.type===filterType)&&(!filterTag||a.tags.includes(filterTag))&&(!favoritesOnly||a.favorite)&&terms.every(term => [a.title,a.fileName,a.prompt,a.projectDetails,a.description,a.url,...a.tags].join(' ').toLocaleLowerCase().includes(term))).sort((a,b) => sort==='title' ? a.title.localeCompare(b.title,'zh-CN') : sort==='oldest' ? a.createdAt-b.createdAt : b.createdAt-a.createdAt);
}
function updateRoute() {
  const next = location.hash.replace(/^#\/?/,'').split('?')[0];
  route = Object.hasOwn(routeConfig,next) ? next : 'home';
  const config = routeConfig[route]; filterType = config.type; filterTag = ''; search = ''; favoritesOnly = false;
  selectedIds.clear();selectionMode=false;tagQuery='';$('#tag-search').value='';
  $('#search-input').value = ''; $('#favorite-filter').setAttribute('aria-pressed','false');
  $$('.main-nav a').forEach(a => { a.classList.toggle('active',a.dataset.route===route); if(a.dataset.route===route)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current'); });
  $('#page-title').innerHTML = `${escapeHTML(config.title)}<span class="title-dot">。</span>`;
  $('#page-eyebrow').textContent=config.eyebrow; $('#page-description').textContent=config.description; $('#section-title').textContent=config.section; $('#upload-button-text').textContent=config.upload; $('#drop-title').textContent=config.drop; $('#drop-description').textContent=config.hint;
  $('#type-tabs').hidden=route!=='library'; document.title=`${route==='home'?'火石素材库':route==='library'?'火石项目库':config.section} · 火石 AIGC`;
  setSidebar(false);window.HuoshiHome.setVisible(route==='home');
  render();
}
function renderTags() {
  const scope=currentScope().filter(a=>filterType==='all'||a.type===filterType);
  const counts = new Map();scope.forEach(a=>new Set(a.tags).forEach(t=>counts.set(t,(counts.get(t)||0)+1)));
  const tags=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'zh-CN')).map(([tag])=>tag);
  if(filterTag&&!counts.has(filterTag)){tags.unshift(filterTag);counts.set(filterTag,0)}
  const matches=tags.filter(tag=>tag.toLocaleLowerCase().includes(tagQuery.trim().toLocaleLowerCase()));
  $('#tag-filters').innerHTML = `<button data-tag="" class="${filterTag?'':'active'}" aria-pressed="${!filterTag}"><span>全部标签</span><small>${scope.length}</small></button>${matches.map(tag=>`<button data-tag="${escapeHTML(tag)}" class="${filterTag===tag?'active':''}" aria-pressed="${filterTag===tag}"><span># ${escapeHTML(tag)}</span><small>${counts.get(tag)}</small></button>`).join('')}`;
  $('#tag-total').textContent=`${counts.size} 个标签`;$('#no-tags').hidden=!!matches.length;
  $('#tag-scope').textContent=`${filterType==='all'?'全部素材':typeLabels[filterType]}中的标签 · 数字为关联数量`;
}
function cardHTML(asset, index) {
  const preview=previewURL(asset); let media;
  if(preview) media=`<img src="${escapeHTML(preview)}" alt="${escapeHTML(asset.title)}" loading="${index<10?'eager':'lazy'}" decoding="async">`;
  else if(asset.type==='video'&&mediaURL(asset)) media=`<video src="${escapeHTML(mediaURL(asset))}#t=0.1" preload="metadata" muted playsinline aria-label="${escapeHTML(asset.title)}"></video>`;
  else media=`<div class="document-preview">${icon(asset.type==='project'?'folder':'file')}<span>${escapeHTML(asset.format||'PROJECT')}</span></div>`;
  return `<article class="asset-card" data-id="${escapeHTML(asset.id)}" style="animation-delay:${Math.min(index,9)*18}ms"><button class="asset-preview" data-open="${escapeHTML(asset.id)}" aria-label="查看 ${escapeHTML(asset.title)}">${media}<span class="preview-type">${icon(typeIcons[asset.type])}${typeLabels[asset.type]}</span>${asset.type==='video'?`<span class="video-play">${icon('play')}</span>`:''}<span class="preview-format">${escapeHTML(asset.type==='video'&&asset.duration?formatDuration(asset.duration):asset.format||'FILE')}</span>${asset.demo?'<span class="preview-demo">示例</span>':''}</button><button class="card-favorite ${asset.favorite?'saved':''}" data-favorite="${escapeHTML(asset.id)}" aria-pressed="${!!asset.favorite}" aria-label="${asset.favorite?'取消收藏':'收藏'} ${escapeHTML(asset.title)}">${icon('bookmark')}</button><div class="asset-title-row"><span class="asset-kind">${icon(typeIcons[asset.type])}</span><button class="asset-title" data-open="${escapeHTML(asset.id)}" title="${escapeHTML(asset.title)}">${escapeHTML(asset.title)}</button></div><div class="asset-tags">${asset.tags.length?asset.tags.slice(0,3).map(t=>`<span>${escapeHTML(t)}</span>`).join(''):'<span class="no-tag">添加标签，让灵感更好找</span>'}</div></article>`;
}
function render() {
  window.HuoshiHome.render(assets);
  for(const [plural,type] of [['projects','project'],['images','image'],['videos','video']]) $(`#count-${plural}`).textContent=String(assets.filter(a=>a.type===type).length).padStart(2,'0');
  const filtered=filteredAssets(); $('#result-count').textContent=filtered.length; $('#demo-label').hidden=!filtered.some(a=>a.demo);
  $$('#type-tabs button').forEach(b=>{b.classList.toggle('active',b.dataset.type===filterType);b.setAttribute('aria-pressed',b.dataset.type===filterType);});
  const hasFilter=search||filterTag||favoritesOnly||filterType!==routeConfig[route].type;
  $('#clear-filters').hidden=!hasFilter; renderTags();
  $('#asset-grid').innerHTML=filtered.map(cardHTML).join(''); $('#asset-grid').hidden=!filtered.length; $('#empty-state').hidden=!!filtered.length; $('#grid-end').hidden=!filtered.length;
  const visibleIds=new Set(filtered.map(a=>a.id));for(const id of selectedIds)if(!visibleIds.has(id))selectedIds.delete(id);
  decorateCards();renderSelection();
  $('#sidebar-filter-dot').hidden=!hasFilter;$('#reset-visible-filters').hidden=!hasFilter;
  $('#filter-summary-text').textContent=[filterTag?`标签：${filterTag}`:'',search?`搜索：${search}`:'',favoritesOnly?'已收藏':''].filter(Boolean).join(' · ')||`${routeConfig[route].section} · 点击左侧标签，找到下一份灵感`;
  $('#empty-action').textContent=hasFilter?'重置筛选':routeConfig[route].upload;
  if(!filtered.length){$('#empty-state h3').textContent=hasFilter?'还没有找到这份灵感':'给你的第一份灵感，留个位置';$('#empty-state p').textContent=hasFilter?'试试其他关键词或标签，发现更多素材。':'上传文件或添加项目链接，开始建立你的资产库。';}
}
function resetFilters() { search='';filterTag='';tagQuery='';$('#tag-search').value='';favoritesOnly=false;filterType=routeConfig[route].type;$('#search-input').value='';$('#favorite-filter').setAttribute('aria-pressed','false');render(); }

function getMediaKind(file) { const ext=file.name.split('.').pop().toLowerCase(); if(file.type.startsWith('image/')||['jpg','jpeg','png','webp','gif','avif','bmp','svg','heic','heif'].includes(ext))return 'image'; if(file.type.startsWith('video/')||['mp4','webm','mov','m4v','ogv','avi','mkv'].includes(ext))return 'video'; return 'document'; }
function imageMetadata(file) {
  return new Promise(resolve=>{
    const image=new Image();const url=URL.createObjectURL(file);let completed=false;
    const finish=result=>{if(completed)return;completed=true;clearTimeout(timer);URL.revokeObjectURL(url);resolve(result)};
    const timer=setTimeout(()=>finish({}),10000);
    image.onload=()=>{const dimensions={width:image.naturalWidth,height:image.naturalHeight};try {const scale=Math.min(1,1200/image.naturalWidth,1200/image.naturalHeight);const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);canvas.toBlob(thumbnail=>finish({...dimensions,thumbnail}),'image/webp',.85);}catch{finish(dimensions)}};
    image.onerror=()=>finish({});image.src=url;
  });
}
function videoMetadata(file) {
  return new Promise(resolve=>{
    const video=document.createElement('video');const url=URL.createObjectURL(file);let completed=false;let dimensions={};
    const finish=result=>{if(completed)return;completed=true;clearTimeout(timer);video.removeAttribute('src');video.load();URL.revokeObjectURL(url);resolve(result)};
    const timer=setTimeout(()=>finish(dimensions),7000);video.preload='metadata';video.muted=true;video.playsInline=true;
    video.onloadedmetadata=()=>{dimensions={width:video.videoWidth,height:video.videoHeight,duration:Number.isFinite(video.duration)?video.duration:undefined};video.currentTime=Math.min(.2,(video.duration||1)/2)};
    video.onseeked=()=>{try{const canvas=document.createElement('canvas');canvas.width=Math.min(video.videoWidth,800);canvas.height=Math.max(1,Math.round(video.videoHeight*canvas.width/video.videoWidth));canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);canvas.toBlob(thumbnail=>finish({...dimensions,thumbnail}),'image/webp',.8)}catch{finish(dimensions)}};
    video.onerror=()=>finish(dimensions);video.src=url;
  });
}
async function assetFromFile(file, type) {
  const kind=getMediaKind(file);const media=kind==='image'?await imageMetadata(file):kind==='video'?await videoMetadata(file):{};
  return {id:crypto.randomUUID(),type:type==='all'?(kind==='document'?'project':kind):type,title:file.name.replace(/\.[^.]+$/,''),fileName:file.name,blob:file,size:file.size,mime:file.type,mediaKind:kind,format:(file.name.includes('.')?file.name.split('.').pop():'FILE').toUpperCase().slice(0,10),tags:[],prompt:'',references:[],url:'',favorite:false,demo:false,createdAt:Date.now(),updatedAt:Date.now(),...media};
}
function validateFiles(files,type) {
  if(!files.length)return;
  for(const file of files){if(file.size>MAX_FILE_BYTES)throw new Error(`「${file.name}」超过 500 MB，请选择较小的文件。`);if(type!=='all'&&type!=='project'&&getMediaKind(file)!==type)throw new Error(`此页面仅接受${typeLabels[type]}文件，请切换到对应分类上传。`);}
}
async function addFiles(files,type,project={}) {
  validateFiles(files,type);const records=[];
  for(const file of files) records.push(await assetFromFile(file,type));
  if(type==='project'&&!files.length)records.push({id:crypto.randomUUID(),type:'project',mediaKind:'document',title:'',tags:[],prompt:'',references:[],format:'LINK',favorite:false,demo:false,createdAt:Date.now(),updatedAt:Date.now()});
  if(type==='project'){records.forEach((record,index)=>{if(project.title)record.title=records.length===1?project.title:`${project.title} · ${index+1}`;if(project.url)record.url=project.url;if(!record.title)record.title=new URL(project.url).hostname;});}
  await saveAssets(records);assets.push(...records);resetFilters();return records;
}
function setUploadType(type) {
  uploadType=type;selectedFiles=[];$('#upload-files').value='';$('#upload-error').textContent='';
  $$('#upload-types button').forEach(b=>{b.classList.toggle('active',b.dataset.uploadType===type);b.setAttribute('aria-pressed',b.dataset.uploadType===type)});
  $('#project-fields').hidden=type!=='project';$('#upload-files').accept=type==='image'?'image/*':type==='video'?'video/*,.mkv,.avi':'';
  $('#file-hint').textContent={image:'支持 JPG、PNG、WebP、GIF 等常用图片格式',video:'支持 MP4、WebM、MOV 等；预览取决于浏览器编码支持',project:'支持 PDF、PPT、Word、ZIP 等项目文件'}[type];renderSelectedFiles();
}
function openUpload() { if(!storageReady){toast('存储暂不可用，请刷新页面重试。',true);return}setSidebar(false);$('#upload-form').reset();setUploadType(routeConfig[route].type==='all'?'image':routeConfig[route].type);$('#upload-dialog').showModal(); }
function renderSelectedFiles() { $('#selected-files').innerHTML=selectedFiles.map((f,i)=>`<div class="selected-file"><span>${escapeHTML(f.name)}</span><small>${formatBytes(f.size)}</small><button type="button" data-remove-file="${i}" aria-label="移除 ${escapeHTML(f.name)}">${icon('x')}</button></div>`).join(''); }
function selectFiles(files) { try{validateFiles(files,uploadType);selectedFiles.push(...files);renderSelectedFiles();$('#upload-error').textContent=''}catch(e){$('#upload-error').textContent=e.message} }
function attachDropZone(element, onFiles) { let depth=0;element.addEventListener('dragenter',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();depth++;element.classList.add('drag-over')}});element.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy'});element.addEventListener('dragleave',()=>{depth=Math.max(0,depth-1);if(!depth)element.classList.remove('drag-over')});element.addEventListener('drop',e=>{e.preventDefault();depth=0;element.classList.remove('drag-over');if(e.dataTransfer.files.length)onFiles([...e.dataTransfer.files])}) }

function renderEditableTags() { $('#editable-tags').innerHTML=draft.tags.map((tag,index)=>`<span class="editable-tag">${escapeHTML(tag)}<button type="button" data-remove-tag="${index}" aria-label="移除标签 ${escapeHTML(tag)}">${icon('x')}</button></span>`).join(''); }
function commitTags() {const values=$('#detail-tags').value.split(/[,，;；\n]+/).map(t=>t.trim()).filter(Boolean);if(values.some(t=>t.length>30))throw new Error('每个标签请控制在 30 个字符以内。');const all=[...new Set([...draft.tags,...values])];if(all.length>24)throw new Error('每个素材最多添加 24 个标签。');draft.tags=all;$('#detail-tags').value='';renderEditableTags()}
function renderReferences() { $('#reference-count').textContent=`${draft.references.length} / 8`;$('#reference-list').innerHTML=draft.references.map((ref,index)=>`<div class="reference-item"><img src="${escapeHTML(blobURL(ref.thumbnail||ref.blob))}" alt="参考图：${escapeHTML(ref.name)}"><button type="button" class="reference-remove" data-remove-reference="${index}" aria-label="移除参考图 ${escapeHTML(ref.name)}">${icon('x')}</button></div>`).join('')+(draft.references.length<8?`<button type="button" class="reference-add" id="add-reference">${icon('plus')}<span>添加参考图</span></button>`:''); }
function renderPreview() {
  const el=$('#detail-preview');const source=mediaURL(draft);const preview=previewURL(draft);
  if((draft.mediaKind||draft.type)==='video'&&source){el.innerHTML=`<video controls playsinline preload="metadata" src="${escapeHTML(source)}" ${preview?`poster="${escapeHTML(preview)}"`:''}></video>`;const video=$('video',el);video.onerror=()=>{el.innerHTML=`<div class="preview-message">${icon('video')}当前浏览器无法预览此视频<p>原文件已保留，可以下载后使用本地播放器打开。</p></div>`};}
  else if(preview){el.innerHTML=`<img src="${escapeHTML(preview)}" alt="${escapeHTML(draft.title)}">`;$('img',el).onerror=()=>{el.innerHTML=`<div class="preview-message">${icon('image')}当前浏览器无法预览此图片<p>原文件已保留，你可以下载后查看。</p></div>`};}
  else if(draft.mime==='application/pdf'&&source){el.innerHTML=`<iframe src="${escapeHTML(source)}" title="PDF 文档预览"></iframe>`;}
  else {el.innerHTML=`<div class="preview-message">${icon(draft.type==='project'?'folder':'file')}${escapeHTML(draft.title)}<p>${draft.url?'项目链接已收录，可在右侧打开。':draft.blob?'项目文件已保存，可下载原文件查看。':'添加项目链接或设置封面，让项目一目了然。'}</p></div>`;}
}
function openDetail(id) {
  const asset=assets.find(a=>a.id===id);if(!asset)return;
  setSidebar(false);
  draft={...asset,tags:[...asset.tags],references:[...(asset.references||[])]};
  $('#detail-form').reset();$('#detail-error').textContent='';$('#detail-title').value=draft.title;$('#detail-prompt').value=draft.prompt||'';$('#detail-demo').hidden=!draft.demo;$('#detail-type-icon').innerHTML=icon(typeIcons[draft.type]);$('#detail-dialog-title').textContent=`${typeLabels[draft.type]}详情`;
  const isProject=draft.type==='project';
  $('label[for="detail-title"]').textContent=isProject?'项目标题':'素材标题';
  $('#detail-title').placeholder=isProject?'给项目起一个名字':'给素材起一个名字';
  $('label[for="detail-prompt"]').innerHTML=isProject?'项目详情 <span>PROJECT DETAILS</span>':'创作提示词 <span>PROMPT</span>';
  $('#detail-prompt').placeholder=isProject?'记录项目背景、目标、制作要求、进度与交付说明…':'记录这份素材的提示词、创作思路或生成参数，让灵感可以再次发生…';
  const projectDescription=draft.demo&&draft.description==='这是一个项目示例。你可以修改标题、添加项目链接，并在下方记录提示词和参考图。'?'这是一个项目示例。你可以记录项目背景、目标、制作要求与交付计划，并补充参考图片。':draft.description;
  if(isProject)$('#detail-prompt').value=draft.projectDetails ?? ([projectDescription,draft.prompt].filter(Boolean).join('\n\n'));
  $('#delete-current').innerHTML=`${icon('trash')}删除${isProject?'项目':'素材'}`;
  $('#detail-project-link-field').hidden=draft.type!=='project';$('#detail-project-link').value=draft.url||'';$('#visit-project').hidden=!safeLink(draft.url);$('#visit-project').href=safeLink(draft.url)||'#';
  const meta=[['素材类型',typeLabels[draft.type]],['文件格式',draft.format||'—'],['文件大小',formatBytes(draft.size)],...(draft.width?[['分辨率',`${draft.width} × ${draft.height}`]]:[]),...(draft.duration?[['时长',formatDuration(draft.duration)]]:[]),['添加日期',formatDate(draft.createdAt)],['所在空间',draft.demo?'示例素材':'本地工作区']];
  $('#detail-metadata').innerHTML=`<dl>${meta.map(([key,value])=>`<div class="meta-row"><dt>${key}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')}</dl>`;
  $('#download-asset').hidden=!mediaURL(draft);$('#choose-cover').hidden=draft.type==='image';renderEditableTags();renderReferences();renderPreview();$('#detail-dialog').showModal();
}
function downloadAsset() { if(!draft)return;const source=mediaURL(draft);if(!source)return;const link=document.createElement('a');link.href=source;link.download=draft.fileName||draft.title;document.body.append(link);link.click();link.remove(); }

function setSidebar(open, pinned = false) {
  clearTimeout(sidebarTimer);sidebarPinned=open&&pinned;
  const panel=$('#tag-sidebar');panel.classList.toggle('open',open);panel.inert=!open;
  document.body.classList.toggle('sidebar-pinned',sidebarPinned);
  $('#sidebar-toggle').setAttribute('aria-expanded',String(open));$('#sidebar-toggle').setAttribute('aria-pressed',String(sidebarPinned));
  $('#sidebar-open').setAttribute('aria-expanded',String(open));$('#sidebar-toggle').classList.toggle('open',open);
  $('#sidebar-toggle').setAttribute('aria-label',open?'固定或收起标签侧栏':'展开标签侧栏');
  $('#sidebar-hint').textContent=sidebarPinned?'侧栏已固定 · 点击 × 收起':'悬停展开 · 点击按钮固定';
}
function decorateCards() {
  $$('.asset-card').forEach(card=>{
    const asset=assets.find(a=>a.id===card.dataset.id);
    card.insertAdjacentHTML('beforeend',`<label class="asset-checkbox"><input type="checkbox" data-select="${escapeHTML(asset.id)}" aria-label="选择 ${escapeHTML(asset.title)}"></label><button class="card-delete" data-delete="${escapeHTML(asset.id)}" aria-label="删除 ${escapeHTML(asset.title)}" title="删除">${icon('trash')}</button>`);
    $$('.asset-tags span:not(.no-tag)',card).forEach(label=>{const button=document.createElement('button');button.className='asset-tag';button.dataset.cardTag=label.textContent;button.textContent=label.textContent;button.title=`筛选标签：${label.textContent}`;label.replaceWith(button)});
  });
}
function renderSelection() {
  $('#asset-grid').classList.toggle('batch-mode',selectionMode);$('#batch-bar').hidden=!selectionMode;
  $('#batch-toggle').setAttribute('aria-pressed',String(selectionMode));$('#selection-count').textContent=`已选 ${selectedIds.size} 项`;
  $('#delete-selected').disabled=!selectedIds.size||working||!storageReady;
  const visible=filteredAssets();$('#select-all').checked=visible.length>0&&visible.every(a=>selectedIds.has(a.id));
  $('#select-all').indeterminate=selectedIds.size>0&&!$('#select-all').checked;$('#select-all').disabled=!visible.length;
  $$('.asset-card').forEach(card=>{const selected=selectedIds.has(card.dataset.id);card.classList.toggle('selected',selected);$('[data-select]',card).checked=selected});
}
function toggleSelection(id) { if(selectedIds.has(id))selectedIds.delete(id);else selectedIds.add(id);renderSelection(); }
function requestDelete(ids,reason='single') {
  if(working||draftBusy)return;if(!storageReady){toast('当前浏览器无法保存删除日志，请刷新后重试。',true);return}
  const records=assets.filter(a=>ids.includes(a.id));if(!records.length){toast('没有可删除的内容');return}
  setSidebar(false);pendingDelete={ids:records.map(a=>a.id),reason};$('#delete-error').textContent='';
  $('#delete-title').textContent=reason==='single'?`删除这份${typeLabels[records[0].type]}？`:`删除这 ${records.length} 项内容？`;
  $('#delete-description').textContent=reason==='demo_cleanup'?'将移除示例内容，你自己上传的素材会保留。':`即将从资产库移除以下 ${records.length} 项内容：`;
  $('#delete-list').innerHTML=records.map(a=>`<li>${icon(typeIcons[a.type])}<span>${escapeHTML(a.title)}</span><small>${typeLabels[a.type]}</small></li>`).join('');
  $('#delete-dialog').showModal();
}
function deleteAssetsWithLog(ids,reason) {
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['assets','deletionLogs'],'readwrite');const assetStore=tx.objectStore('assets');
    const unique=[...new Set(ids)];let remaining=unique.length;const records=[];let log=null;
    function finalize() {
      if(!records.length)return;
      log={id:crypto.randomUUID(),deletedAt:Date.now(),action:reason,count:records.length,source:'本地工作区',items:records.map(a=>({id:a.id,type:a.type,title:a.title,tags:[...(a.tags||[])],fileName:a.fileName||'',url:a.url||'',demo:!!a.demo}))};
      tx.objectStore('deletionLogs').add(log);records.forEach(a=>assetStore.delete(a.id));
    }
    unique.forEach(id=>{const request=assetStore.get(id);request.onsuccess=()=>{if(request.result)records.push(request.result);remaining--;if(remaining===0)finalize()}});
    tx.oncomplete=()=>resolve(log);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('删除已取消，内容保持原样。'));
  });
}
async function confirmDeletion() {
  if(working||!pendingDelete)return;working=true;const target=pendingDelete;
  $('#confirm-delete').disabled=true;$('#confirm-delete').textContent='正在删除…';
  try {
    const log=await deleteAssetsWithLog(target.ids,target.reason);
    assets=assets.filter(a=>!target.ids.includes(a.id));target.ids.forEach(id=>selectedIds.delete(id));
    $('#delete-dialog').close();if(draft&&target.ids.includes(draft.id))$('#detail-dialog').close();
    if(target.reason==='demo_cleanup')$('#info-dialog').close();
    pendingDelete=null;if(log)deletionLogs.unshift(log);render();toast(log?`已删除 ${log.count} 项，记录已保存至删除日志`:'这些内容已被删除，列表已更新');
  } catch(err) { $('#delete-error').textContent=`删除未完成，内容未被移除。${storageError(err)}`; }
  finally {working=false;$('#confirm-delete').disabled=false;$('#confirm-delete').innerHTML=`${icon('trash')}确认删除`;renderSelection();}
}
function renderLogs() {
  const query=$('#log-search').value.trim().toLocaleLowerCase();const type=$('#log-type').value;
  const matches=deletionLogs.map(log=>({...log,matched:log.items.filter(item=>(type==='all'||item.type===type)&&[item.title,item.fileName,item.id,log.id,...item.tags].join(' ').toLocaleLowerCase().includes(query))})).filter(log=>log.matched.length);
  $('#logs-count').textContent=matches.reduce((sum,log)=>sum+log.matched.length,0);
  const dateFormat=new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'medium',timeZone:'Asia/Shanghai',hour12:false});
  $('#log-list').innerHTML=matches.length?matches.map(log=>`<section class="log-entry"><div class="log-entry-header"><span class="log-action">${icon('trash')}${{single:'单个删除',bulk:'批量删除',demo_cleanup:'移除示例素材'}[log.action]||'删除'}<small>${log.count} 项</small></span><time datetime="${new Date(log.deletedAt).toISOString()}">${escapeHTML(dateFormat.format(log.deletedAt))}</time></div><ul>${log.matched.map(item=>`<li><span class="log-item-icon">${icon(typeIcons[item.type])}</span><div><strong>${escapeHTML(item.title)}</strong><p>${typeLabels[item.type]}${item.demo?' · 示例':''}${item.fileName?` · ${escapeHTML(item.fileName)}`:''}</p><div class="log-tags">${item.tags.map(tag=>`<span># ${escapeHTML(tag)}</span>`).join('')||'<span>无标签</span>'}</div><small class="log-asset-id">素材编号 ${escapeHTML(item.id)}</small></div></li>`).join('')}</ul><div class="log-entry-footer"><span>本地工作区 · 本次 ${log.count} 项${log.matched.length!==log.count?`，当前匹配 ${log.matched.length} 项`:''}</span><span title="${escapeHTML(log.id)}">记录 ${escapeHTML(log.id.slice(0,8))}</span></div></section>`).join(''):`<div class="logs-empty">${icon('history')}<h3>${deletionLogs.length?'没有匹配的记录':'还没有删除记录'}</h3><p>${deletionLogs.length?'换一个关键词或素材类型试试。':'删除内容后，记录会保留在这里。'}</p></div>`;
}
async function openLogs() {
  if(!storageReady){toast('日志存储暂不可用，请刷新后重试。',true);return}
  setSidebar(false);try{deletionLogs=(await readStore('deletionLogs')).sort((a,b)=>b.deletedAt-a.deletedAt);$('#log-search').value='';$('#log-type').value='all';renderLogs();$('#logs-dialog').showModal()}catch(err){toast('无法读取日志，请刷新页面后重试。',true)}
}
function bindManagementEvents() {
  const panel=$('#tag-sidebar'),handle=$('#sidebar-toggle');
  [panel,handle].forEach(el=>{
    el.addEventListener('pointerenter',e=>{clearTimeout(sidebarTimer);if(e.pointerType==='mouse'&&!$('dialog[open]'))setSidebar(true,sidebarPinned)});
    el.addEventListener('pointerleave',()=>{clearTimeout(sidebarTimer);sidebarTimer=setTimeout(()=>{if(!sidebarPinned&&!panel.contains(document.activeElement))setSidebar(false)},200)});
  });
  handle.addEventListener('click',()=>setSidebar(!sidebarPinned,!sidebarPinned));
  $('#sidebar-open').addEventListener('click',()=>{setSidebar(true,true);$('#search-input').focus()});
  $('#sidebar-close').addEventListener('click',()=>{setSidebar(false);handle.focus()});
  panel.addEventListener('focusout',()=>{setTimeout(()=>{if(!sidebarPinned&&!panel.contains(document.activeElement)&&!panel.matches(':hover')&&!handle.matches(':hover'))setSidebar(false)},0)});
  document.addEventListener('pointerdown',e=>{if(sidebarPinned&&matchMedia('(min-width:1150px)').matches)return;if(!panel.contains(e.target)&&!handle.contains(e.target)&&!$('#sidebar-open').contains(e.target))setSidebar(false)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('dialog[open]')&&panel.classList.contains('open')){setSidebar(false);handle.focus()}});
  $('#tag-search').addEventListener('input',e=>{tagQuery=e.target.value;renderTags()});
  $('#reset-visible-filters').addEventListener('click',resetFilters);
  $('#batch-toggle').addEventListener('click',()=>{selectionMode=!selectionMode;selectedIds.clear();renderSelection()});
  $('#batch-cancel').addEventListener('click',()=>{selectionMode=false;selectedIds.clear();renderSelection()});
  $('#select-all').addEventListener('change',e=>{selectedIds.clear();if(e.target.checked)filteredAssets().forEach(a=>selectedIds.add(a.id));renderSelection()});
  $('#asset-grid').addEventListener('change',e=>{if(e.target.matches('[data-select]'))toggleSelection(e.target.dataset.select)});
  $('#delete-selected').addEventListener('click',()=>requestDelete([...selectedIds],'bulk'));
  $('#delete-current').addEventListener('click',()=>{if(draft)requestDelete([draft.id])});
  $('#confirm-delete').addEventListener('click',confirmDeletion);
  $('#delete-dialog').addEventListener('close',()=>{if(!working)pendingDelete=null});
  $('#open-logs').addEventListener('click',openLogs);
  $('#log-search').addEventListener('input',renderLogs);$('#log-type').addEventListener('change',renderLogs);
}

function bindEvents() {
  bindManagementEvents();
  addEventListener('hashchange',()=>{updateRoute();if(route!=='home')window.scrollTo({top:0,behavior:'instant'})});
  $('#search-input').addEventListener('input',e=>{search=e.target.value;render()});
  $('#sort-select').addEventListener('change',e=>{sort=e.target.value;render()});
  $('#type-tabs').addEventListener('click',e=>{const button=e.target.closest('[data-type]');if(!button)return;filterType=button.dataset.type;filterTag='';render()});
  $('#tag-filters').addEventListener('click',e=>{const button=e.target.closest('[data-tag]');if(!button)return;filterTag=button.dataset.tag;render()});
  $('#favorite-filter').addEventListener('click',()=>{favoritesOnly=!favoritesOnly;$('#favorite-filter').setAttribute('aria-pressed',favoritesOnly);render()});
  $('#clear-filters').addEventListener('click',resetFilters);
  $('#empty-action').addEventListener('click',()=>$('#empty-action').textContent==='重置筛选'?resetFilters():openUpload());
  $('#open-upload').addEventListener('click',openUpload);$('#workspace-info').addEventListener('click',()=>$('#info-dialog').showModal());
  $('#asset-grid').addEventListener('click',async e=>{const remove=e.target.closest('[data-delete]');if(remove){requestDelete([remove.dataset.delete]);return}const tag=e.target.closest('[data-card-tag]');if(tag){filterTag=tag.dataset.cardTag;render();return}const open=e.target.closest('[data-open]');if(open){if(selectionMode)toggleSelection(open.dataset.open);else openDetail(open.dataset.open);return}const button=e.target.closest('[data-favorite]');if(!button)return;const asset=assets.find(a=>a.id===button.dataset.favorite);button.disabled=true;const updated={...asset,favorite:!asset.favorite};try{await saveAssets([updated]);assets=assets.map(a=>a.id===updated.id?updated:a);render();toast(updated.favorite?'已加入收藏':'已取消收藏')}catch(err){button.disabled=false;toast(storageError(err),true)}});
  document.addEventListener('click',e=>{const close=e.target.closest('[data-close]');if(close&&!working&&!draftBusy)document.getElementById(close.dataset.close).close()});
  $$('dialog').forEach(dialog=>{dialog.addEventListener('click',e=>{if(e.target===dialog&&!working&&!draftBusy){const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)dialog.close()}});dialog.addEventListener('cancel',e=>{if(working||draftBusy)e.preventDefault()})});
  $('#detail-dialog').addEventListener('close',()=>{$$('#detail-preview video').forEach(v=>v.pause());$('#detail-preview').replaceChildren();draft=null;});
  $('#upload-types').addEventListener('click',e=>{const button=e.target.closest('[data-upload-type]');if(button&&!working)setUploadType(button.dataset.uploadType)});
  $('#choose-files').addEventListener('click',()=>{if(!working)$('#upload-files').click()});
  $('#upload-files').addEventListener('change',e=>{selectFiles([...e.target.files]);e.target.value=''});
  $('#selected-files').addEventListener('click',e=>{const button=e.target.closest('[data-remove-file]');if(button&&!working){selectedFiles.splice(Number(button.dataset.removeFile),1);renderSelectedFiles()}});
  attachDropZone($('#choose-files'),files=>{if(!working)selectFiles(files)});
  attachDropZone($('#page-drop'),async files=>{if(working||!storageReady)return;working=true;$('#open-upload').disabled=true;$('#upload-button-text').textContent='正在保存…';try{const records=await addFiles(files,routeConfig[route].type);toast(`已添加 ${records.length} 份素材`)}catch(e){toast(e.name==='Error'?e.message:storageError(e),true)}finally{working=false;$('#open-upload').disabled=false;$('#upload-button-text').textContent=routeConfig[route].upload}});
  $('#upload-form').addEventListener('submit',async e=>{e.preventDefault();if(working)return;const title=$('#project-title').value.trim();const rawURL=$('#project-link').value.trim();const url=safeLink(rawURL);$('#upload-error').textContent='';if(rawURL&&!url){$('#upload-error').textContent='请输入有效的 http 或 https 项目链接。';return}if(!selectedFiles.length&&!(uploadType==='project'&&url)){$('#upload-error').textContent=uploadType==='project'?'请添加项目链接或选择项目文件。':'请先选择要上传的文件。';return}working=true;$('#confirm-upload').disabled=true;$('#confirm-upload').textContent='正在保存…';try{const records=await addFiles(selectedFiles,uploadType,{title,url});$('#upload-dialog').close();toast(`已添加 ${records.length} 份素材，可点击卡片编辑详情`)}catch(err){$('#upload-error').textContent=err.name==='Error'?err.message:storageError(err)}finally{working=false;$('#confirm-upload').disabled=false;$('#confirm-upload').innerHTML=`${icon('plus')}添加到资产库`}});
  $('#detail-tags').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();try{commitTags();$('#detail-error').textContent=''}catch(err){$('#detail-error').textContent=err.message}}});
  $('#editable-tags').addEventListener('click',e=>{const button=e.target.closest('[data-remove-tag]');if(button){draft.tags.splice(Number(button.dataset.removeTag),1);renderEditableTags()}});
  $('#reference-list').addEventListener('click',e=>{if(e.target.closest('#add-reference'))$('#reference-files').click();const remove=e.target.closest('[data-remove-reference]');if(remove){draft.references.splice(Number(remove.dataset.removeReference),1);renderReferences()}});
  $('#reference-files').addEventListener('change',async e=>{const files=[...e.target.files];e.target.value='';if(!draft||draftBusy)return;draftBusy=true;$('#save-detail').disabled=true;try{if(draft.references.length+files.length>8)throw new Error('最多可添加 8 张参考图。');validateFiles(files,'image');const refs=[];for(const file of files){if(file.size>20*1024*1024)throw new Error('单张参考图请控制在 20 MB 以内。');const meta=await imageMetadata(file);if(!meta.width)throw new Error('参考图无法读取，请使用 JPG、PNG、WebP 等格式。');refs.push({name:file.name,blob:file,thumbnail:meta.thumbnail})}draft.references.push(...refs);renderReferences();$('#detail-error').textContent=''}catch(err){$('#detail-error').textContent=err.message}finally{draftBusy=false;$('#save-detail').disabled=false}});
  $('#choose-cover').addEventListener('click',()=>$('#cover-file').click());
  $('#cover-file').addEventListener('change',async e=>{const file=e.target.files[0];e.target.value='';if(!file||!draft||draftBusy)return;draftBusy=true;$('#save-detail').disabled=true;try{validateFiles([file],'image');const meta=await imageMetadata(file);if(!meta.width)throw new Error('封面无法读取，请使用 JPG、PNG 或 WebP 图片。');draft.cover=meta.thumbnail||file;renderPreview();$('#detail-error').textContent=''}catch(err){$('#detail-error').textContent=err.message}finally{draftBusy=false;$('#save-detail').disabled=false}});
  $('#import-prompt').addEventListener('click',()=>$('#prompt-file').click());
  $('#prompt-file').addEventListener('change',async e=>{const file=e.target.files[0];e.target.value='';if(!file||!draft)return;draftBusy=true;$('#save-detail').disabled=true;try{if(file.size>2*1024*1024)throw new Error('文本请控制在 2 MB 以内。');$('#detail-prompt').value=await file.text();toast(`${draft.type==='project'?'项目详情':'提示词'}已导入，保存后生效`)}catch(err){$('#detail-error').textContent=err.message}finally{draftBusy=false;$('#save-detail').disabled=false}});
  $('#copy-prompt').addEventListener('click',async()=>{const value=$('#detail-prompt').value;if(!value){toast(draft?.type==='project'?'先写下一段项目详情吧':'先写下一段提示词吧');return}try{await navigator.clipboard.writeText(value);toast('文本已复制')}catch{$('#detail-prompt').focus();$('#detail-prompt').select();toast('请按 Ctrl+C 或 Command+C 复制选中的文本')}});
  $('#download-asset').addEventListener('click',downloadAsset);
  $('#detail-project-link').addEventListener('input',e=>{const url=safeLink(e.target.value);$('#visit-project').hidden=!url;$('#visit-project').href=url||'#'});
  $('#detail-form').addEventListener('submit',async e=>{e.preventDefault();if(!draft||working||draftBusy)return;$('#detail-error').textContent='';try{commitTags();const title=$('#detail-title').value.trim();if(!title)throw new Error(draft.type==='project'?'请填写项目标题。':'请填写素材标题。');const rawURL=$('#detail-project-link').value.trim();const url=draft.type==='project'?safeLink(rawURL):'';if(draft.type==='project'&&rawURL&&!url)throw new Error('项目链接必须以 http:// 或 https:// 开头。');if(draft.type==='project'&&!url&&!draft.blob&&!draft.demo)throw new Error('请保留项目链接，或重新上传项目文件。');const content=draft.type==='project'?{projectDetails:$('#detail-prompt').value}:{prompt:$('#detail-prompt').value};const updated={...draft,title,...content,url,updatedAt:Date.now()};working=true;$('#save-detail').disabled=true;$('#save-detail').textContent='正在保存…';await saveAssets([updated]);assets=assets.map(a=>a.id===updated.id?updated:a);$('#detail-dialog').close();render();toast('已保存，灵感已妥善收好')}catch(err){$('#detail-error').textContent=err.name==='Error'?err.message:storageError(err)}finally{working=false;$('#save-detail').disabled=false;$('#save-detail').innerHTML=`${icon('check')}保存修改`}});
  $('#remove-demos').addEventListener('click',()=>requestDelete(assets.filter(a=>a.demo).map(a=>a.id),'demo_cleanup'));
  addEventListener('keydown',e=>{if(route!=='home'&&e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!$('dialog[open]')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();setSidebar(true,true);$('#search-input').focus()}});
  addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault()});addEventListener('drop',e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault()});
  addEventListener('beforeunload',()=>activeURLs.forEach(url=>URL.revokeObjectURL(url)));
}

async function init() {
  hydrateIcons();bindEvents();window.HuoshiHome.init({onOpen:openDetail,previewURL,mediaURL,escapeHTML,icon});
  try{db=await openDatabase();db.onversionchange=()=>db.close();if(!await readStore('settings','seeded'))await seedDatabase(createSamples());assets=await readStore('assets');storageReady=true;updateRoute();}
  catch(err){console.error('Asset storage unavailable',err);assets=createSamples();updateRoute();$('#storage-status').textContent='存储不可用';$('#open-upload').disabled=true;toast('当前浏览器无法保存数据，请允许网站存储后刷新。',true);}
}
init();
