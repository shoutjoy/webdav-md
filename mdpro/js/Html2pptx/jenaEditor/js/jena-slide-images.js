(() => {
  'use strict';
  window.GenSlideImages = { mount(container, options) {
    const root=document.createElement('div');root.className='jsl-page-image';
    root.innerHTML='<div class="jsl-row"><button type="button" class="btn tiny" data-image="load">이미지 불러오기</button><button type="button" class="btn tiny" data-image="paste">이미지 붙여넣기</button><button type="button" class="btn tiny" data-image="remove" hidden>이미지 제거</button></div><input type="file" accept="image/png,image/jpeg,image/webp" hidden><div class="jsl-image-paste" tabindex="0" aria-label="이미지 붙여넣기 영역">Ctrl+V로 이미지 붙여넣기</div><img alt="슬라이드 변환 원본 이미지" hidden><small role="status"></small>';
    container.appendChild(root);const file=root.querySelector('input'),img=root.querySelector('img'),status=root.querySelector('small'),remove=root.querySelector('[data-image=remove]');
    function display(image){if(image&&!/^data:image\/(png|jpeg|webp);base64,/i.test(image.dataUrl||''))image=null;img.hidden=!image;img.src=image?.dataUrl||'';remove.hidden=!image;status.textContent=image?image.name+' · 이미지에서 슬라이드 HTML 생성 가능':'';}
    async function read(blob,name){const context=options.context?.();try{if(!/^image\/(png|jpeg|webp)$/.test(blob.type))throw Error('PNG, JPEG, WebP 이미지를 선택하세요.');if(blob.size>10*1024*1024)throw Error('10MB 이하의 이미지를 선택하세요.');const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});if(!root.isConnected)return;const image={kind:'image',name:name||'붙여넣은 이미지.png',type:blob.type,size:blob.size,dataUrl};display(image);options.onChange(image,context);}catch(error){status.textContent=error.message||'이미지 읽기 실패';}}
    root.querySelector('[data-image=load]').onclick=()=>file.click();file.onchange=()=>{if(file.files[0])read(file.files[0],file.files[0].name);file.value='';};
    root.querySelector('[data-image=paste]').onclick=async()=>{try{if(!navigator.clipboard?.read)throw Error('붙여넣기 영역을 선택하고 Ctrl+V를 누르세요.');const items=await navigator.clipboard.read();for(const item of items){const type=item.types.find(t=>/^image\/(png|jpeg|webp)$/.test(t));if(type){await read(await item.getType(type),'붙여넣은 이미지.png');return;}}throw Error('클립보드에 이미지가 없습니다.');}catch(error){status.textContent=error.name==='NotAllowedError'?'붙여넣기 영역을 선택하고 Ctrl+V를 누르세요.':error.message;}};
    function paste(e){const item=Array.from(e.clipboardData?.items||[]).find(i=>i.kind==='file'&&i.type.startsWith('image/'));if(item){e.preventDefault();e.stopPropagation();read(item.getAsFile(),'붙여넣은 이미지.png');}}
    root.addEventListener('paste',paste);options.pasteTarget?.addEventListener('paste',paste);
    remove.onclick=()=>{options.onChange(null,options.context?.());display(null);};display(options.image);
    return {set:display,element:root};
  }};
})();
