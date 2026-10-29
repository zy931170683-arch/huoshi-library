/* The homepage shares the library's assets and detail editor. No duplicate storage. */
window.HuoshiHome=(()=>{
  let helpers,visible=false,ink,paging,signature=null;
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  function init(options){
    helpers=options;ink=createInk();paging=createPaging();
    $('#home-view').addEventListener('click',e=>{
      const card=e.target.closest('[data-showcase-id]');if(card)helpers.onOpen(card.dataset.showcaseId);
      const social=e.target.closest('[data-social]');if(social)$('#social-status').textContent=`${social.dataset.social}账号待添加，敬请期待。`;
      const link=e.target.closest('a[href^="#/home"]');if(link&&link.getAttribute('href')===location.hash){e.preventDefault();scrollToSection();}
    });
    const observer=new IntersectionObserver(entries=>{if(!visible)return;const section=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];if(section)setActiveSection(section.target.id)},{rootMargin:'-15% 0px -50% 0px',threshold:0});
    $$('.home-main>section').forEach(el=>observer.observe(el));
  }
  function setActiveSection(id){$$('[data-home-section]').forEach(a=>{const active=a.dataset.homeSection===id;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')})}
  function scrollToSection(){
    if(!visible)return;const id=new URLSearchParams(location.hash.split('?')[1]||'').get('section')||'show';paging.toSection(id);
  }
  function setVisible(next){
    visible=next;document.body.classList.toggle('landing-mode',next);$('#home-view').inert=!next;$('#main').inert=next;$('.site-header').inert=next;
    ink?.setVisible(next);if(next)requestAnimationFrame(scrollToSection);else paging?.cancel();
  }
  function createPaging(){
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let frame=0,animating=false,locked=false,lastWheel=0,amount=0,releaseTimer=0;
    const sections=$$('.home-main>section');
    const headerHeight=()=>$('.home-header').getBoundingClientRect().height;
    const topOf=section=>Math.max(0,scrollY+section.getBoundingClientRect().top-headerHeight());
    // Tall layouts retain intermediate reading stops, so narrow screens and zoom never skip content.
    function stops(){const height=innerHeight-headerHeight(),max=document.documentElement.scrollHeight-innerHeight;return sections.flatMap(section=>{const start=topOf(section),end=Math.max(start,start+section.offsetHeight-height),result=[{y:start,id:section.id}];for(let y=start+height;y<end-2;y+=height)result.push({y,id:section.id});if(end-start>2)result.push({y:end,id:section.id});return result}).map(stop=>({...stop,y:Math.min(max,stop.y)}))}
    function cancel(){cancelAnimationFrame(frame);frame=0;animating=false;locked=false;amount=0;clearTimeout(releaseTimer)}
    function release(){clearTimeout(releaseTimer);releaseTimer=setTimeout(()=>{if(!animating&&performance.now()-lastWheel>=190){locked=false;amount=0}else release()},200)}
    function go(y,id){
      cancelAnimationFrame(frame);const start=scrollY,distance=y-start,began=performance.now();locked=true;animating=true;setActiveSection(id);
      function finish(){window.scrollTo({top:y,behavior:'instant'});frame=0;animating=false;setActiveSection(id);release()}
      if(reduced.matches||Math.abs(distance)<1){finish();return}
      function step(now){if(!visible){cancel();return}const progress=Math.min(1,(now-began)/780),ease=progress<.5?16*Math.pow(progress,5):1-Math.pow(-2*progress+2,5)/2;window.scrollTo({top:start+distance*ease,behavior:'instant'});if(progress<1)frame=requestAnimationFrame(step);else finish()}
      frame=requestAnimationFrame(step);
    }
    function adjacent(direction){const list=stops();return direction>0?list.find(stop=>stop.y>scrollY+3):[...list].reverse().find(stop=>stop.y<scrollY-3)}
    window.addEventListener('wheel',event=>{
      if(!visible||$('dialog[open]')||event.ctrlKey||event.metaKey||event.altKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)||!event.deltaY)return;
      if(event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
      event.preventDefault();const now=performance.now(),gap=now-lastWheel;lastWheel=now;
      if(locked){if(!animating&&gap>220)locked=false;else{release();return}}
      const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1);
      if(gap>220||Math.sign(delta)!==Math.sign(amount))amount=0;amount+=delta;
      if(Math.abs(amount)<12)return;const target=adjacent(Math.sign(amount));amount=0;if(target)go(target.y,target.id);
    },{passive:false});
    window.addEventListener('keydown',event=>{
      if(!visible||$('dialog[open]')||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,textarea,select,button,a,[contenteditable="true"]'))return;
      let target;if(['ArrowDown','PageDown',' '].includes(event.key))target=adjacent(event.shiftKey?-1:1);else if(['ArrowUp','PageUp'].includes(event.key))target=adjacent(-1);else if(event.key==='Home')target=stops()[0];else if(event.key==='End')target=stops().at(-1);else return;
      event.preventDefault();if(!animating&&target)go(target.y,target.id);
    });
    // Touch and scrollbar dragging keep native control, including inside oversized sections.
    window.addEventListener('pointerdown',event=>{if(visible&&(event.pointerType==='touch'||event.clientX>=document.documentElement.clientWidth))cancel()},{passive:true});
    return{cancel,toSection(id){const section=sections.find(el=>el.id===id);if(section)go(topOf(section),id)}};
  }
  function render(items){
    if(!helpers)return;
    const key=items.map(x=>`${x.id}:${x.updatedAt}:${x.title}:${x.tags?.join(',')}`).join('|');if(signature===key)return;signature=key;
    const sorted=[...items].sort((a,b)=>Number(!!a.demo)-Number(!!b.demo)||new Date(b.createdAt)-new Date(a.createdAt));
    const projects=sorted.filter(x=>x.type==='project').slice(0,2),materials=sorted.filter(x=>x.type!=='project').slice(0,4);
    // Include a video when one is available, while giving uploaded assets priority.
    const video=sorted.find(x=>x.type==='video');if(video&&materials.length===4&&!materials.some(x=>x.type==='video')&&(!video.demo||materials.every(x=>x.demo)))materials[3]=video;
    $('#home-projects').innerHTML=projects.length?projects.map((a,i)=>card(a,i)).join(''):empty('项目','projects');
    $('#home-materials').innerHTML=materials.length?materials.map((a,i)=>card(a,i)).join(''):empty('素材','library');
    $('#project-showcase-note').textContent=projects.length&&projects.every(x=>x.demo)?'当前展示示例项目；上传公司项目后将优先展示。':'每个项目，都有自己的表达。';
  }
  function empty(label,route){return `<div class="home-empty">还没有可展示的${label}<br><a href="#/${route}">去上传${label} ↗</a></div>`}
  function card(asset,index){
    const {escapeHTML:e,previewURL,mediaURL,icon}=helpers,url=previewURL(asset),label=asset.type==='project'?'项目':asset.type==='video'?'视频':'图片';
    const media=url?`<img src="${e(url)}" alt="${e(asset.title)}" loading="lazy">`:asset.type==='video'?`<video src="${e(mediaURL(asset))}#t=0.1" muted playsinline preload="metadata" aria-label="${e(asset.title)}"></video>`:`<span class="showcase-placeholder">${icon('folder')}</span>`;
    return `<button class="showcase-card" data-showcase-id="${e(asset.id)}" aria-label="查看${label}：${e(asset.title)}"><div class="showcase-cover">${media}<span class="showcase-count">${String(index+1).padStart(2,'0')} / ${asset.demo?'示例 · ':''}${label}</span>${asset.type==='video'?`<span class="showcase-play" aria-hidden="true">${icon('play')}</span>`:''}<span class="showcase-open" aria-hidden="true">↗</span></div><div class="showcase-card-info"><h3>${e(asset.title)}</h3><p>${e((asset.tags||[]).slice(0,2).join(' / ')||label)}</p></div></button>`;
  }
  function createInk(){
    const hero=$('.ink-hero'),motion=$('#motion-toggle'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const trail=document.createElement('canvas'),brush=trail.getContext('2d'),lifetime=3000;
    // Redraw only living deposits. Repeated 8-bit alpha erasure can plateau above zero.
    const bloom=document.createElement('canvas');bloom.width=bloom.height=128;
    const bloomBrush=bloom.getContext('2d');
    for(let i=0;i<9;i++){const angle=i*2.4,r=i?21:0,x=64+Math.cos(angle)*r,y=64+Math.sin(angle)*r,size=i?30:42,gradient=bloomBrush.createRadialGradient(x,y,0,x,y,size);gradient.addColorStop(0,'rgba(255,255,255,.75)');gradient.addColorStop(.45,'rgba(255,255,255,.5)');gradient.addColorStop(1,'rgba(255,255,255,0)');bloomBrush.fillStyle=gradient;bloomBrush.fillRect(x-size,y-size,size*2,size*2)}
    let canvas=$('#ink-canvas'),renderer,frame=0,last=0,elapsed=0,enabled=false,inView=true,paused=reduced.matches,sized=false,previous=null,deposits=[];
    try{renderer=webglInk(canvas)}catch(_){const replacement=canvas.cloneNode();canvas.replaceWith(replacement);canvas=replacement;renderer=canvasInk(canvas)}hero.classList.add('ink-ready');
    function clear(){brush.clearRect(0,0,trail.width,trail.height);previous=null;deposits=[];}
    function resize(){const box=hero.getBoundingClientRect();if(box.width<1||box.height<1)return;const ratio=Math.min(1.25,devicePixelRatio||1,1350/box.width);canvas.width=Math.round(box.width*ratio);canvas.height=Math.round(box.height*ratio);trail.width=Math.min(800,canvas.width);trail.height=Math.round(trail.width*box.height/box.width);clear();renderer.resize(canvas.width,canvas.height);sized=true;draw();}
    function draw(){if(sized)renderer.draw(elapsed,trail)}
    function tick(now){
      frame=0;if(!enabled||!inView||document.hidden||paused)return;
      const delta=last?Math.min(now-last,60):16;last=now;elapsed+=delta/1000;
      deposits=deposits.filter(deposit=>now-deposit.born<lifetime);
      brush.clearRect(0,0,trail.width,trail.height);
      for(const deposit of deposits){
        const age=Math.max(0,(now-deposit.born)/lifetime),radius=deposit.radius*1.35*(1+age*(.8+.35*Math.sin(deposit.phase))),flow=Math.pow(age,.7)*deposit.radius*.65;
        const x=deposit.x+Math.sin(deposit.phase+age*2)*flow,y=deposit.y+Math.cos(deposit.phase*.7+age*2)*flow;
        brush.globalAlpha=Math.pow(1-age,2)*.85;brush.drawImage(bloom,x-radius,y-radius,radius*2,radius*2);
      }
      brush.globalAlpha=1;draw();if(deposits.length)frame=requestAnimationFrame(tick);else previous=null;
    }
    function schedule(){if(frame)cancelAnimationFrame(frame);frame=0;last=0;if(enabled&&inView&&!document.hidden&&!paused&&deposits.length)frame=requestAnimationFrame(tick)}
    function updateMotion(){motion.setAttribute('aria-pressed',String(paused));motion.setAttribute('aria-label',paused?'开启彩墨动画':'暂停彩墨动画');motion.title=paused?'开启彩墨动画':'暂停彩墨动画';motion.innerHTML=paused?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="m9 5 10 7-10 7Z"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 5v14M16 5v14"/></svg>';schedule()}
    function stamp(x,y,radius,born){deposits.push({x,y,radius,born,phase:x*.06+y*.07})}
    hero.addEventListener('pointermove',event=>{
      if(paused||!enabled||!sized||event.target.closest('a,button')){previous=null;return}
      const box=hero.getBoundingClientRect(),now=performance.now(),radius=trail.height*.04*1.5;
      const samples=event.getCoalescedEvents?.();
      for(const sample of samples?.length?samples:[event]){
        const current={x:(sample.clientX-box.left)/box.width*trail.width,y:(sample.clientY-box.top)/box.height*trail.height,born:now};
        if(previous&&now-previous.born<250){const distance=Math.hypot(current.x-previous.x,current.y-previous.y);if(distance<.7)continue;const steps=Math.max(1,Math.ceil(distance/(radius*.18)));for(let i=1;i<=steps;i++)stamp(previous.x+(current.x-previous.x)*i/steps,previous.y+(current.y-previous.y)*i/steps,radius,previous.born+(now-previous.born)*i/steps)}else stamp(current.x,current.y,radius,now);
        previous=current;
      }
      if(!frame)schedule();
    });
    hero.addEventListener('pointerleave',()=>{previous=null});hero.addEventListener('pointercancel',()=>{previous=null});
    motion.addEventListener('click',()=>{paused=!paused;clear();updateMotion();draw()});reduced.addEventListener('change',()=>{paused=reduced.matches;clear();updateMotion();draw()});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();draw()}schedule()});new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(!inView){clear();draw()}schedule()},{threshold:.01}).observe(hero);new ResizeObserver(resize).observe(hero);
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(frame)cancelAnimationFrame(frame);frame=0;hero.classList.remove('ink-ready');canvas.style.visibility='hidden'});
    canvas.addEventListener('webglcontextrestored',()=>{renderer=webglInk(canvas);hero.classList.add('ink-ready');canvas.style.visibility='';resize();schedule()});
    updateMotion();return{setVisible(next){enabled=next;clear();if(next)resize();schedule()}};
  }
  function webglInk(canvas){
    const gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true,powerPreference:'low-power'});if(!gl)throw new Error('Canvas fallback');
    const vertex='attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}';
    const fragment=`precision highp float;
        varying vec2 uv; uniform vec2 resolution; uniform float time; uniform sampler2D inkMask; uniform sampler2D titleMask;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float n=0.,a=.5;mat2 m=mat2(.8,-.6,.6,.8);for(int i=0;i<5;i++){n+=a*noise(p);p=m*p*2.07+7.13;a*=.5;}return n;}
      void main(){
        float aspect=resolution.x/resolution.y;vec2 p=(uv-.5)*vec2(aspect,1.);float t=time*.045;
        vec2 q=p*4.3+vec2(t,-t*.4);vec2 warp=vec2(fbm(q+vec2(1.7,9.2)),fbm(q+vec2(8.3,2.8)));
        float billow=fbm(q+warp*3.4),detail=fbm(q*2.4+warp*4.8),fold=fbm(q*7.+warp*7.);
        vec2 curls=vec2(fbm(q*4.+t),fbm(q*4.+vec2(5.2,8.1)-t));
        vec2 drift=((warp-.5)*.035+(curls-.5)*.025)/vec2(aspect,1.);
        float density=texture2D(inkMask,uv+drift).a;
        float cover=smoothstep(.025,.7,density)*smoothstep(.015,.12,density);
        float hue=uv.x+(billow-.5)*.38;
        vec3 blue=vec3(.035,.055,.59),purple=vec3(.39,.015,.60),pink=vec3(.96,.005,.37),orange=vec3(1.,.34,.005);
        vec3 pigment=mix(blue,purple,smoothstep(.22,.44,hue));pigment=mix(pigment,pink,smoothstep(.40,.59,hue));pigment=mix(pigment,orange,smoothstep(.65,.81,hue));
        float ridge=pow(abs(sin(detail*21.+billow*3.)),6.);
        pigment*=.60+detail*.95+ridge*.36; pigment=mix(pigment,vec3(.065,.025,.13),pow(clamp((.5-billow)*3.,0.,1.),2.)*.8);
        pigment=mix(pigment,vec3(1.,.57,.76),smoothstep(.6,.83,fold)*.34);
        vec3 paper=vec3(.9608,.9569,.9373);float grain=(hash(gl_FragCoord.xy)-.5)*.018;
        vec3 color=mix(paper,pigment+grain,cover);
        vec3 lettering=mix(vec3(.035,.039,.043),vec3(.99,.985,.97),cover);color=mix(color,lettering,texture2D(titleMask,uv).a);
        gl_FragColor=vec4(color,1.);
      }`;
    function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);throw new Error('Shader fallback')}return s}
    const program=gl.createProgram(),vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Shader fallback');gl.deleteShader(vs);gl.deleteShader(fs);gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    const res=gl.getUniformLocation(program,'resolution'),time=gl.getUniformLocation(program,'time');canvas.dataset.renderer='webgl';
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.uniform1i(gl.getUniformLocation(program,'titleMask'),0);
    const inkTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,inkTexture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.uniform1i(gl.getUniformLocation(program,'inkMask'),1);
    return{resize(w,h){gl.viewport(0,0,w,h);gl.uniform2f(res,w,h);const mask=titleCanvas(w,h);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,mask)},draw(t,trail){gl.uniform1f(time,t);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,inkTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,trail);gl.drawArrays(gl.TRIANGLES,0,6)}};
  }
  function titleCanvas(w,h){
    const mask=document.createElement('canvas');mask.width=w;mask.height=h;const ctx=mask.getContext('2d'),title=$('#home-title'),style=getComputedStyle(title),box=title.getBoundingClientRect(),hero=$('.ink-hero').getBoundingClientRect(),ratio=w/hero.width;
    ctx.font=`${style.fontWeight} ${parseFloat(style.fontSize)*ratio}px ${style.fontFamily}`;ctx.fillStyle='white';ctx.textBaseline='alphabetic';const chars=[...title.textContent],spacing=parseFloat(style.letterSpacing)*ratio,widths=chars.map(c=>ctx.measureText(c).width),total=widths.reduce((a,b)=>a+b,0)+spacing*(chars.length-1),metrics=ctx.measureText(title.textContent);let x=(w-total)/2;const y=(box.top+box.height/2-hero.top)*ratio+(metrics.actualBoundingBoxAscent-metrics.actualBoundingBoxDescent)/2;chars.forEach((c,i)=>{ctx.fillText(c,x,y);x+=widths[i]+spacing});return mask;
  }
  function canvasInk(canvas){
    const ctx=canvas.getContext('2d');canvas.dataset.renderer='canvas';let w=1,h=1,mask,black;
    return{
      resize(width,height){w=width;h=height;mask=titleCanvas(w,h);black=document.createElement('canvas');black.width=w;black.height=h;const bc=black.getContext('2d');bc.drawImage(mask,0,0);bc.globalCompositeOperation='source-in';bc.fillStyle='#121314';bc.fillRect(0,0,w,h)},
      draw(t,trail){ctx.clearRect(0,0,w,h);const color=ctx.createLinearGradient(0,0,w,0);['#1825a8','#5322ba','#b31ab3','#f51379','#f5364b','#ff7722'].forEach((c,i)=>color.addColorStop(i/5,c));ctx.fillStyle=color;ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='destination-in';ctx.drawImage(trail,0,0,w,h);ctx.globalCompositeOperation='source-atop';ctx.drawImage(mask,0,0);ctx.globalCompositeOperation='destination-over';ctx.drawImage(black,0,0);ctx.fillStyle='#f5f4ef';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='source-over'}
    };
  }
  return{init,setVisible,render};
})();
