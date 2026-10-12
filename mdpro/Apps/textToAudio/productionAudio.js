export function musicPlan(settings, totalDuration) {
  const nonnegative = value => Math.max(0, Number(value) || 0);
  const start = Math.min(totalDuration, nonnegative(settings.musicStart));
  const duration = Math.min(totalDuration - start, nonnegative(settings.musicDuration ?? totalDuration));
  let fadeIn = settings.musicFadeInEnabled === false ? 0 : nonnegative(settings.musicFadeIn ?? 1);
  let fadeOut = settings.musicFadeOutEnabled === false ? 0 : nonnegative(settings.musicFadeOut ?? 1);
  if (fadeIn + fadeOut > duration && fadeIn + fadeOut > 0) {
    const scale = duration / (fadeIn + fadeOut);
    fadeIn *= scale; fadeOut *= scale;
  }
  return { start, duration, fadeIn, fadeOut, offset: nonnegative(settings.musicOffset),
    volume: Math.min(1, nonnegative(settings.musicVolume ?? .2)) };
}

export function scheduleMusic(context, destination, buffer, settings, totalDuration, time) {
  if (!buffer || settings.musicEnabled === false) return null;
  const plan = musicPlan(settings, totalDuration);
  const loop = settings.musicLoop !== false;
  const offset = loop ? plan.offset % buffer.duration : Math.min(plan.offset, buffer.duration);
  const duration = loop ? plan.duration : Math.min(plan.duration, buffer.duration - offset);
  if (duration <= 0) return null;
  const adjusted = musicPlan({ ...settings, musicStart: 0, musicDuration: duration }, duration);
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  source.loop = loop;
  source.connect(gain).connect(destination);
  const start = time + plan.start, end = start + duration;
  gain.gain.setValueAtTime(adjusted.fadeIn ? 0 : plan.volume, start);
  if (adjusted.fadeIn) gain.gain.linearRampToValueAtTime(plan.volume, start + adjusted.fadeIn);
  gain.gain.setValueAtTime(plan.volume, end - adjusted.fadeOut);
  if (adjusted.fadeOut) gain.gain.linearRampToValueAtTime(0, end);
  source.start(start, offset);
  source.stop(end);
  return { source, gain };
}

export function pcmStereoToBuffer(bytes, sampleRate, duration, context) {
  const frames = Math.min(Math.floor(bytes.length / 4), Math.round(sampleRate * duration));
  if (!frames) throw new Error('음악 데이터가 비어 있습니다.');
  const buffer = context.createBuffer(2, frames, sampleRate);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let channel = 0; channel < 2; channel++) {
    const output = buffer.getChannelData(channel);
    for (let i = 0; i < frames; i++) output[i] = view.getInt16(i * 4 + channel * 2, true) / 32768;
  }
  return buffer;
}

export async function generateLyriaMusic({ apiKey, prompt, duration, context, signal, onProgress = () => {}, Socket = WebSocket }) {
  if (!apiKey) throw new Error('ENV의 AI Studio API 키를 연결해주세요.');
  if (!prompt.trim()) throw new Error('음악 분위기와 악기를 입력해주세요.');
  if (!(duration > 0 && duration <= 600)) throw new Error('음악 길이는 0초 초과, 600초 이하로 설정해주세요.');
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('취소됨', 'AbortError')); return; }
    const socket = new Socket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateMusic?key=${encodeURIComponent(apiKey)}`);
    const chunks = [];
    let size = 0, sampleRate = 48000, settled = false, timer, chain = Promise.resolve();
    const finish = (error) => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      socket.close();
      if (error) { reject(error); return; }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      try { resolve(pcmStereoToBuffer(bytes, sampleRate, duration, context)); } catch (error) { reject(error); }
    };
    const abort = () => finish(new DOMException('취소됨', 'AbortError'));
    const resetTimeout = () => {
      clearTimeout(timer);
      timer = setTimeout(() => finish(new Error('Lyria 응답 시간이 초과되었습니다. 키와 모델 접근 권한을 확인해주세요.')), 60000);
    };
    signal?.addEventListener('abort', abort, { once: true });
    resetTimeout();
    socket.onopen = () => socket.send(JSON.stringify({ setup: { model: 'models/lyria-realtime-exp' } }));
    socket.onmessage = event => {
      chain = chain.then(async () => {
        if (settled) return;
        const data = JSON.parse(typeof event.data === 'string' ? event.data : await event.data.text());
        if (data.error) throw new Error(data.error.message || 'Lyria 음악 생성 오류');
        if (data.filteredPrompt || data.filtered_prompt) throw new Error('음악 프롬프트가 거부되었습니다. 내용을 수정해주세요.');
        if (data.setupComplete || data.setup_complete) {
          socket.send(JSON.stringify({ clientContent: { weightedPrompts: [{ text: prompt, weight: 1 }] } }));
          socket.send(JSON.stringify({ playbackControl: 'PLAY' }));
        }
        for (const chunk of (data.serverContent || data.server_content)?.audioChunks || (data.server_content?.audio_chunks || [])) {
          if (!chunk.data) continue;
          const rate = (chunk.mimeType || chunk.mime_type || '').match(/rate=(\d+)/);
          if (rate) sampleRate = Number(rate[1]);
          const binary = atob(chunk.data);
          const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
          chunks.push(bytes); size += bytes.length;
          const seconds = size / (sampleRate * 4);
          onProgress(Math.min(seconds, duration));
          if (seconds >= duration) { finish(); return; }
        }
        resetTimeout();
      }).catch(finish);
    };
    socket.onerror = () => finish(new Error('Lyria 연결에 실패했습니다. AI Studio 키와 모델 접근 권한을 확인해주세요.'));
    socket.onclose = () => { if (!settled) finish(new Error('지정한 길이에 도달하기 전에 Lyria 연결이 종료되었습니다.')); };
  });
}

const waitForPoll = signal => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(new DOMException('취소됨', 'AbortError')); return; }
  const abort = () => { clearTimeout(timer); reject(new DOMException('취소됨', 'AbortError')); };
  const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, 10000);
  signal?.addEventListener('abort', abort, { once: true });
});

export async function generateVeoVideo({ apiKey, model, prompt, duration, aspectRatio, signal, onProgress = () => {} }) {
  if (!apiKey) throw new Error('ENV의 AI Studio API 키를 연결해주세요.');
  if (!/^veo-[a-zA-Z0-9._-]+$/.test(model)) throw new Error('올바른 Veo 모델을 선택해주세요.');
  if (!prompt.trim()) throw new Error('비디오 프롬프트를 입력해주세요.');
  const base = 'https://generativelanguage.googleapis.com/v1beta';
  const headers = { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' };
  const read = async response => {
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(result.error?.message || `Veo 오류 (${response.status})`);
    return result;
  };
  const operation = await read(await fetch(`${base}/models/${model}:predictLongRunning`, {
    method: 'POST', headers, signal,
    body: JSON.stringify({ instances: [{ prompt }], parameters: { durationSeconds: duration, aspectRatio, sampleCount: 1 } }),
  }));
  if (!/^models\/[\w.-]+\/operations\/[\w.-]+$|^operations\/[\w.-]+$/.test(operation.name || '')) throw new Error('Veo 작업 ID가 올바르지 않습니다.');
  for (let poll = 0; poll < 120; poll++) {
    onProgress('Veo 비디오 생성 대기 중…');
    await waitForPoll(signal);
    const result = await read(await fetch(`${base}/${operation.name}`, { headers, signal }));
    if (!result.done) continue;
    const uri = result.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
    if (!uri) throw new Error('비디오가 반환되지 않았습니다. 프롬프트와 모델 접근 권한을 확인해주세요.');
    const url = new URL(uri);
    if (url.protocol !== 'https:' || url.hostname !== 'generativelanguage.googleapis.com') throw new Error('비디오 다운로드 주소가 올바르지 않습니다.');
    onProgress('생성 비디오를 불러오는 중…');
    const response = await fetch(url, { headers: { 'x-goog-api-key': apiKey }, signal });
    if (!response.ok) throw new Error(`생성 비디오 다운로드 오류 (${response.status})`);
    return await response.blob();
  }
  throw new Error('Veo 생성 대기 시간이 초과되었습니다.');
}
