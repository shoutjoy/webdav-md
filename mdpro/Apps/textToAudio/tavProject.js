const SLOT_FIELDS = ['text', 'ttsMode', 'voice', 'browserVoice', 'format', 'backgroundImages', 'backgroundImage',
  'selectedImageId', 'imageTimingMode', 'generatedImage', 'imagePrompt', 'isCustom', 'speed', 'pitch', 'isGenerated',
  'musicEnabled', 'musicStart', 'musicDuration', 'musicOffset', 'musicVolume', 'musicLoop', 'musicFadeInEnabled',
  'musicFadeOutEnabled', 'musicFadeIn', 'musicFadeOut', 'musicPrompt', 'originalMuted', 'originalVolume',
  'veoPrompt', 'veoModel', 'veoDuration', 'veoAspect'];

function encodeBytes(bytes) {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 32768) binary += String.fromCharCode(...bytes.subarray(start, start + 32768));
  return btoa(binary);
}
function decodeBytes(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('프로젝트 미디어 데이터가 올바르지 않습니다.');
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}
export function serializeAudio(buffer) {
  if (!buffer) return null;
  const channels = [];
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel), bytes = new Uint8Array(data.length * 4), view = new DataView(bytes.buffer);
    for (let i = 0; i < data.length; i++) view.setFloat32(i * 4, data[i], true);
    channels.push(encodeBytes(bytes));
  }
  return { encoding: 'float32-le', sampleRate: buffer.sampleRate, channels };
}
export function restoreAudio(data, context) {
  if (!data) return null;
  if (data.encoding !== 'float32-le' || !Number.isInteger(data.sampleRate) || data.sampleRate < 3000 || data.sampleRate > 384000 ||
      !Array.isArray(data.channels) || !data.channels.length || data.channels.length > 8) throw new Error('프로젝트 오디오 형식이 올바르지 않습니다.');
  const channels = data.channels.map(decodeBytes), length = channels[0].length / 4;
  if (!Number.isInteger(length) || length <= 0 || channels.some(bytes => bytes.length !== length * 4)) throw new Error('프로젝트 오디오 길이가 올바르지 않습니다.');
  const buffer = context.createBuffer(channels.length, length, data.sampleRate);
  channels.forEach((bytes, channel) => {
    const view = new DataView(bytes.buffer), output = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const value = view.getFloat32(i * 4, true);
      if (!Number.isFinite(value)) throw new Error('프로젝트 오디오 샘플이 올바르지 않습니다.');
      output[i] = value;
    }
  });
  return buffer;
}

export async function createTavProject({ id, name, slots, settings }) {
  const savedSlots = await Promise.all(slots.map(async slot => {
    const saved = {};
    for (const field of SLOT_FIELDS) if (slot[field] !== undefined) saved[field] = slot[field];
    saved.audio = serializeAudio(slot.audioBuffer);
    saved.music = serializeAudio(slot.musicBuffer);
    if (slot.backgroundVideo) {
      const response = await fetch(slot.backgroundVideo);
      if (!response.ok) throw new Error('배경 비디오를 프로젝트에 저장하지 못했습니다.');
      const blob = await response.blob();
      saved.video = { mimeType: blob.type, data: encodeBytes(new Uint8Array(await blob.arrayBuffer())) };
    }
    if (slot.videoResult?.url) {
      const blob = await (await fetch(slot.videoResult.url)).blob();
      saved.outputVideo = { mimeType: blob.type, data: encodeBytes(new Uint8Array(await blob.arrayBuffer())), filename: slot.videoResult.filename, ext: slot.videoResult.ext };
    }
    return saved;
  }));
  return { type: 'TTS2AudioProject', version: 1, id: id || crypto.randomUUID(), name: name.trim() || 'TTS2Audio 프로젝트',
    updatedAt: new Date().toISOString(), settings, slots: savedSlots };
}

export function restoreTavProject(project, context) {
  if (!project || project.type !== 'TTS2AudioProject' || project.version !== 1 || !Array.isArray(project.slots)) throw new Error('지원하는 .tav 프로젝트 파일이 아닙니다.');
  const urls = [];
  try {
    const slots = project.slots.map(saved => {
      if (!saved || typeof saved !== 'object') throw new Error('프로젝트 슬롯이 올바르지 않습니다.');
      const slot = { id: crypto.randomUUID(), text: '', ttsMode: 'ai', voice: 'Kore', format: 'mp3', speed: 1, pitch: 1 };
      for (const field of SLOT_FIELDS) if (saved[field] !== undefined) slot[field] = saved[field];
      const validImage = image => typeof image === 'string' && /^data:image\//.test(image);
      if (slot.backgroundImages && (!Array.isArray(slot.backgroundImages) || slot.backgroundImages.some(image => !image || !validImage(image.src)))) throw new Error('프로젝트 이미지가 올바르지 않습니다.');
      for (const field of ['backgroundImage', 'generatedImage']) if (slot[field] && !validImage(slot[field])) throw new Error('프로젝트 이미지가 올바르지 않습니다.');
      slot.audioBuffer = restoreAudio(saved.audio, context);
      slot.musicBuffer = restoreAudio(saved.music, context);
      slot.isGenerated = saved.isGenerated === true && (!!slot.audioBuffer || slot.ttsMode === 'browser');
      if (saved.video) {
        if (!/^video\/[a-z0-9.+-]+(?:;.*)?$/i.test(saved.video.mimeType || '')) throw new Error('프로젝트 비디오 형식이 올바르지 않습니다.');
        slot.backgroundVideo = URL.createObjectURL(new Blob([decodeBytes(saved.video.data)], { type: saved.video.mimeType }));
        urls.push(slot.backgroundVideo);
      }
      if (saved.outputVideo) {
        if (!/^video\/[a-z0-9.+-]+(?:;.*)?$/i.test(saved.outputVideo.mimeType || '')) throw new Error('프로젝트 출력 영상 형식이 올바르지 않습니다.');
        const url = URL.createObjectURL(new Blob([decodeBytes(saved.outputVideo.data)], { type: saved.outputVideo.mimeType }));
        urls.push(url);
        slot.videoResult = { url, filename: String(saved.outputVideo.filename || 'video.mp4'), ext: saved.outputVideo.ext === 'webm' ? 'webm' : 'mp4' };
      }
      return slot;
    });
    return { slots, name: String(project.name || 'TTS2Audio 프로젝트'), id: String(project.id || crypto.randomUUID()), settings: project.settings || {} };
  } catch (error) { urls.forEach(url => URL.revokeObjectURL(url)); throw error; }
}

async function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TTS2AudioProjects', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('프로젝트 저장소가 다른 창에서 사용 중입니다.'));
  });
}
async function transact(mode, action) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('projects', mode), request = action(transaction.objectStore('projects'));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error || request.error);
      transaction.onabort = () => reject(transaction.error || new Error('프로젝트 저장이 취소되었습니다.'));
    });
  } finally { db.close(); }
}
export const saveTavProject = project => transact('readwrite', store => store.put(project));
export const readTavProject = id => transact('readonly', store => store.get(id));
export const listTavProjects = async () => (await transact('readonly', store => store.getAll()))
  .map(({ id, name, updatedAt, slots }) => ({ id, name, updatedAt, slotCount: slots.length }))
  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
