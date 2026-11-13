/* Reference-image viewer: all selection coordinates are stored in source pixels. */
function openMermaidReferenceCrop(image, applyImage) {
  const popup = window.open('', '_blank', 'popup=yes,width=1100,height=850,resizable=yes,scrollbars=yes');
  if (!popup) { alert('이미지 창을 열려면 팝업을 허용해 주세요.'); return; }
  const doc = popup.document;
  doc.title = '참고 이미지 · Crop';
  const style = doc.createElement('style');
  style.textContent = 'body{margin:0;background:#0f172a;color:#e2e8f0;font:14px sans-serif}header{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:12px;background:#1e293b}button{padding:8px 12px;background:#334155;color:#fff;border:1px solid #64748b;border-radius:7px;cursor:pointer}button:disabled{opacity:.45;cursor:default}main{height:calc(100vh - 140px);overflow:auto;padding:12px}canvas{display:block;cursor:crosshair;touch-action:none}p{margin:8px 12px}';
  doc.head.append(style);
  const toolbar = doc.createElement('header');
  const viewport = doc.createElement('main');
  const canvas = doc.createElement('canvas');
  canvas.setAttribute('aria-label', '이미지에서 드래그하여 자를 영역 선택');
  viewport.append(canvas);
  const status = doc.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent = '이미지 위에서 드래그하여 자를 영역을 선택하세요. 적용 전까지 참고 이미지는 유지됩니다.';
  doc.body.replaceChildren(toolbar, status, viewport);
  const context = canvas.getContext('2d');
  const source = doc.createElement('img');
  let selection = null, start = null, pointer = null, zoom = 0, loaded = false;
  const button = (text, action) => {
    const control = doc.createElement('button'); control.type = 'button'; control.textContent = text;
    control.onclick = action; toolbar.append(control); return control;
  };
  const draw = () => {
    if (!loaded) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0);
    if (selection) {
      const { x, y, width, height } = selection;
      context.fillStyle = '#14b8a633'; context.fillRect(x, y, width, height);
      context.strokeStyle = '#14b8a6'; context.lineWidth = Math.max(2, canvas.width / canvas.getBoundingClientRect().width * 2);
      context.strokeRect(x, y, width, height);
    }
    crop.disabled = !selection || selection.width < 1 || selection.height < 1;
  };
  const resize = () => {
    if (!loaded) return;
    const scale = zoom || Math.min(1, Math.max(1, viewport.clientWidth - 24) / canvas.width, Math.max(1, viewport.clientHeight - 24) / canvas.height);
    canvas.style.width = canvas.width * scale + 'px'; canvas.style.height = canvas.height * scale + 'px';
    draw();
  };
  button('−', () => { zoom = Math.max(.1, (zoom || canvas.getBoundingClientRect().width / canvas.width) - .25); resize(); });
  button('+', () => { zoom = Math.min(4, (zoom || canvas.getBoundingClientRect().width / canvas.width) + .25); resize(); });
  button('화면 맞춤', () => { zoom = 0; resize(); });
  button('100%', () => { zoom = 1; resize(); });
  const loadSource = url => {
    loaded = false; crop.disabled = apply.disabled = true;
    selection = start = null; pointer = null;
    source.src = url;
  };
  const crop = button('선택 영역 자르기', () => {
    if (!selection || crop.disabled) return;
    const output = doc.createElement('canvas'); output.width = selection.width; output.height = selection.height;
    output.getContext('2d').drawImage(source, selection.x, selection.y, selection.width, selection.height, 0, 0, output.width, output.height);
    loadSource(output.toDataURL('image/png'));
    status.textContent = '잘랐습니다. 참고 이미지에 적용하거나 원본 복원으로 되돌리세요.';
  });
  crop.disabled = true;
  button('선택 해제', () => { selection = null; draw(); });
  button('원본 복원', () => { loadSource(image.dataUrl); status.textContent = '원본을 복원했습니다. 참고 이미지에 적용하면 반영됩니다.'; });
  const apply = button('참고 이미지에 적용', () => {
    if (!loaded) return;
    // Export a clean canvas; selection decoration never enters the AI input.
    const output = doc.createElement('canvas'); output.width = source.naturalWidth; output.height = source.naturalHeight;
    output.getContext('2d').drawImage(source, 0, 0);
    output.toBlob(blob => {
      if (!blob) { status.textContent = '이미지를 만들지 못했습니다.'; return; }
      if (blob.size > 20 * 1024 * 1024) { status.textContent = '이미지는 20MB 이하여야 합니다. 더 작은 영역을 선택하세요.'; return; }
      status.textContent = applyImage(new File([blob], (image.name || 'reference').replace(/\.[^.]+$/, '') + '-crop.png', { type:'image/png' })) ? '참고 이미지에 적용했습니다.' : '참고 이미지가 변경되었습니다. 기존 창을 닫고 새 이미지에서 다시 열어 주세요.';
    }, 'image/png');
  });
  apply.disabled = true;
  button('닫기', () => popup.close());
  source.onload = () => { loaded = true; canvas.width = source.naturalWidth; canvas.height = source.naturalHeight; selection = null; apply.disabled = false; resize(); };
  source.onerror = () => { loaded = false; apply.disabled = crop.disabled = true; status.textContent = '이미지를 불러오지 못했습니다.'; };
  const point = event => {
    const rect = canvas.getBoundingClientRect();
    return { x:Math.max(0, Math.min(canvas.width, (event.clientX - rect.left) * canvas.width / rect.width)), y:Math.max(0, Math.min(canvas.height, (event.clientY - rect.top) * canvas.height / rect.height)) };
  };
  canvas.addEventListener('pointerdown', event => {
    if (!loaded || event.button !== 0 || event.isPrimary === false) return;
    pointer = event.pointerId; start = point(event); selection = null; canvas.setPointerCapture(pointer); event.preventDefault(); draw();
  });
  canvas.addEventListener('pointermove', event => {
    if (!start || pointer !== event.pointerId) return;
    const end = point(event);
    selection = { x:Math.floor(Math.min(start.x, end.x)), y:Math.floor(Math.min(start.y, end.y)), width:Math.floor(Math.abs(end.x - start.x)), height:Math.floor(Math.abs(end.y - start.y)) };
    draw();
  });
  const stop = event => { if (pointer !== event.pointerId) return; start = null; pointer = null; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); };
  canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop); canvas.addEventListener('lostpointercapture', stop);
  popup.addEventListener('resize', resize);
  loadSource(image.dataUrl);
  return popup;
}
