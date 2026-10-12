export async function generateTtsAudio(slot, apiKey, context, signal) {
  if (!apiKey) throw new Error('ENV에서 AI Studio API 키를 먼저 연결해주세요.');
  let text = slot.text;
  if (slot.isCustom) {
    const instructions = [];
    if (slot.speed > 1) instructions.push('빠르게'); else if (slot.speed < 1) instructions.push('느리게');
    if (slot.pitch > 1) instructions.push('높은 톤으로'); else if (slot.pitch < 1) instructions.push('낮은 톤으로');
    if (instructions.length) text = `[${instructions.join(', ')} 읽어주세요] ${text}`;
  }
  await context.resume();
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: {
      responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: slot.voice } } },
    } }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || `API 오류 (${response.status})`);
  const data = result.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.mimeType?.startsWith('audio/'))?.inlineData;
  if (!data?.data) throw new Error('오디오가 반환되지 않았습니다.');
  const binary = atob(data.data), bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  if (!bytes.length || bytes.length % 2) throw new Error('오디오 데이터 길이가 올바르지 않습니다.');
  const sampleRate = Number(data.mimeType.match(/rate=(\d+)/)?.[1] || 24000);
  const buffer = context.createBuffer(1, bytes.length / 2, sampleRate), output = buffer.getChannelData(0), view = new DataView(bytes.buffer);
  for (let i = 0; i < output.length; i++) output[i] = view.getInt16(i * 2, true) / 32768;
  return buffer;
}

export async function runAudioBatch(slots, generate, { signal, onProgress = () => {} } = {}) {
  const result = { success: 0, skipped: [], failed: [], cancelled: false };
  for (let index = 0; index < slots.length; index++) {
    if (signal?.aborted) { result.cancelled = true; break; }
    const slot = slots[index];
    onProgress({ index, total: slots.length, slotId: slot.id });
    if (!slot.text?.trim() || slot.ttsMode === 'browser') {
      result.skipped.push({ index: index + 1, reason: slot.ttsMode === 'browser' ? '브라우저 모드는 파일 생성 미지원' : '대본 없음' });
      continue;
    }
    try { await generate(slot, signal); result.success++; }
    catch (error) {
      if (signal?.aborted || error.name === 'AbortError') { result.cancelled = true; break; }
      result.failed.push({ index: index + 1, reason: error.message });
    }
  }
  return result;
}
