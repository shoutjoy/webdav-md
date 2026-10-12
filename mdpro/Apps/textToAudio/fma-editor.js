const frame = document.getElementById('editor');
const status = document.getElementById('status');
let pending, ready = false, ttsConnected = false;
const origin = location.origin;
const validImage = value => /^data:image\/[a-z0-9.+-]+;base64,/i.test(String(value || ''));

async function loadImage() {
  if (!pending || !ready) return;
  const blob = await (await fetch(pending.image)).blob();
  const extension = ({ 'image/jpeg': 'jpg', 'image/svg+xml': 'svg' })[blob.type] || blob.type.split('/')[1] || 'png';
  frame.contentWindow.postMessage({ type: 'fmaviewer-open-files', files: [new File([blob], `tts-thumbnail.${extension}`, { type: blob.type })], importMode: 'replace' }, origin);
  pending = null;
  status.textContent = 'FMA에서 편집을 적용한 뒤 썸네일로 가져오기를 누르세요.';
}

async function returnImage(type, payload) {
  try {
    if (!ttsConnected) throw new Error('TTS2Audio에서 전달된 이미지가 없습니다.');
    const image = payload || frame.contentWindow.FMAMdViewerBridge?.currentImagePayload();
    if (!image?.src) throw new Error('편집할 이미지를 선택해주세요.');
    let dataUrl = image.src;
    if (!validImage(dataUrl)) {
      if (!dataUrl.startsWith('blob:')) throw new Error('이미지 파일만 가져올 수 있습니다.');
      const blob = await (await fetch(dataUrl)).blob();
      dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
      });
    }
    if (!validImage(dataUrl)) throw new Error('이미지 파일만 가져올 수 있습니다.');
    if (!window.opener || window.opener.closed) throw new Error('TTS2Audio 창이 닫혀 있습니다.');
    window.opener.postMessage({ type, dataUrl, name: image.name || 'fma-edited.png' }, origin);
    status.textContent = type === 'tts-fma-thumbnail' ? '편집한 이미지를 슬롯 썸네일로 보냈습니다.' : '문서 이미지 삽입 창으로 보냈습니다.';
  } catch (error) { status.textContent = error.message || '이미지를 가져오지 못했습니다.'; }
}

window.addEventListener('message', event => {
  if (event.origin !== origin) return;
  if (event.source === window.opener && event.data?.type === 'tts-fma-open' && validImage(event.data.image)) {
    ttsConnected = true;
    document.getElementById('return-thumbnail').hidden = false;
    document.getElementById('insert-document').hidden = false;
    pending = event.data; loadImage().catch(error => { status.textContent = error.message; });
  }
  if (event.source !== frame.contentWindow) return;
  if (event.data?.type === 'fmaviewer-ready') { ready = true; loadImage().catch(error => { status.textContent = error.message; }); }
  if (ttsConnected && event.data?.type === 'fmaviewer-send-to-mdpro-img') returnImage('tts-fma-document', event.data.image);
});
document.getElementById('return-thumbnail').onclick = () => returnImage('tts-fma-thumbnail');
document.getElementById('insert-document').onclick = () => returnImage('tts-fma-document');
window.opener?.postMessage({ type: 'tts-fma-ready' }, origin);
