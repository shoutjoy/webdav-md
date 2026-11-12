(() => {
  'use strict';
  const KEY = 'mdpro_jena_slide_dock_v1', app = document.querySelector('.app');
  const dock = document.createElement('aside'); dock.className = 'jsl-preview-dock'; dock.setAttribute('aria-label','슬라이드 미리보기 Dock');
  dock.innerHTML = '<div class="jsl-dock-resize" role="separator" aria-label="Jena Slide 사이드바 너비" tabindex="0"></div><header><strong>Jena Slide</strong><button class="btn tiny" id="jsl-dock-toggle">접기</button></header><div id="jsl-dock-tools"></div><section class="jsl-dock-preview"><strong>페이지 미리보기</strong><div class="jsl-row"><button class="btn tiny active" data-dock="slides">슬라이드</button><button class="btn tiny" data-dock="drafts">생성 결과</button></div><div id="jsl-dock-pages"></div></section>';
  app.appendChild(dock);
  const tools = dock.querySelector('#jsl-dock-tools'), settings = document.querySelector('.jsl-model-menu'); settings.open = true; tools.appendChild(settings);
  const generation = document.createElement('details'); generation.id='jsl-generation-tools'; generation.open=true; generation.innerHTML='<summary>슬라이드 생성</summary><div class="jsl-generation-body"></div>'; tools.appendChild(generation);
  document.querySelectorAll('.jsl-workspace > .jsl-row:not(.jsl-page-nav)').forEach(el=>generation.lastElementChild.appendChild(el));
  document.querySelectorAll('#jsl-status, #jsl-stream-wrap').forEach(el=>tools.appendChild(el));
  let mode = 'slides', width = 330, collapsed = false, timer; const observers = [];
  try { const saved = JSON.parse(localStorage.getItem(KEY)||'{}'); width = saved.width || width; collapsed = !!saved.collapsed; generation.open=saved.generationOpen!==false; settings.open=saved.modelOpen!==false; } catch (_) {}
  function layout(save) {
    width = Math.max(280, Math.min(460,width)); app.style.setProperty('--jsl-dock-width', (collapsed ? 44 : width)+'px'); dock.classList.toggle('collapsed',collapsed);
    dock.querySelector('#jsl-dock-toggle').textContent = collapsed ? '«' : '접기';
    if (save) try { localStorage.setItem(KEY,JSON.stringify({width,collapsed,generationOpen:generation.open,modelOpen:settings.open})); } catch (_) {}
  }
  function refresh() {
    observers.splice(0).forEach(o=>o.disconnect());
    const list = dock.querySelector('#jsl-dock-pages'); list.replaceChildren();
    const items = mode === 'slides' ? slides.map((s,i)=>({html:s.html,title:'슬라이드 '+(i+1),index:i})) : window.JenaSlide.draftPages().filter(p=>p.html);
    if (!items.length) list.textContent = '생성한 페이지가 여기에 표시됩니다.';
    items.forEach(item=>{
      const button = document.createElement('button'); button.type='button'; button.className='jsl-thumb'; button.title=(item.title || '슬라이드').slice(0,100); button.setAttribute('aria-label',`${mode === 'slides' ? '슬라이드' : '생성 결과'} ${item.index+1} 보기`);
      const label = document.createElement('span'); label.textContent=`${item.index+1}. ${item.title || '슬라이드'}`.slice(0,65);
      const canvas = document.createElement('div'); canvas.className='jsl-thumb-canvas'; const frame = document.createElement('iframe'); frame.sandbox='';frame.tabIndex=-1;frame.title=label.textContent;frame.loading='lazy';frame.srcdoc=window.JenaSlide.sanitize(item.html);
      canvas.appendChild(frame); button.append(canvas,label); list.appendChild(button);
      const fit=()=>{const available=canvas.clientWidth; const w=Number(slideWidth)||1280,h=Number(slideHeight)||720; frame.style.width=w+'px';frame.style.height=h+'px';frame.style.transform=`scale(${available/w})`;canvas.style.height=(available*h/w)+'px';};
      const observer = new ResizeObserver(fit); observer.observe(canvas); observers.push(observer); requestAnimationFrame(fit);
      button.onclick=()=>{if(mode==='drafts')window.JenaSlide.selectPage(item.index);else{cur=item.index;loadCurrent();document.getElementById('jsl-editor').click();}};
    });
  }
  dock.querySelectorAll('[data-dock]').forEach(b=>b.onclick=()=>{mode=b.dataset.dock;dock.querySelectorAll('[data-dock]').forEach(x=>x.classList.toggle('active',x===b));refresh();});
  dock.querySelector('#jsl-dock-toggle').onclick=()=>{collapsed=!collapsed;layout(true);};
  generation.addEventListener('toggle',()=>layout(true));settings.addEventListener('toggle',()=>layout(true));
  const handle=dock.querySelector('.jsl-dock-resize');
  handle.onpointerdown=e=>{if(e.button!==0||collapsed)return;e.preventDefault();const start=e.clientX,initial=width;handle.setPointerCapture(e.pointerId);const move=ev=>{width=initial+start-ev.clientX;layout(false);};const stop=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',stop);handle.removeEventListener('pointercancel',stop);handle.removeEventListener('lostpointercapture',stop);layout(true);};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',stop);handle.addEventListener('pointercancel',stop);handle.addEventListener('lostpointercapture',stop);};
  handle.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();width+=e.key==='ArrowLeft'?10:-10;layout(true);};
  window.JenaSlideDock={refresh,open:()=>{collapsed=false;layout(true);settings.open=true;},schedule:()=>{clearTimeout(timer);timer=setTimeout(refresh,60);}};layout(false);refresh();
})();
