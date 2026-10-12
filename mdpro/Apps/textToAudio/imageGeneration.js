export async function listImageModels(apiKey, signal) {
  if (!apiKey) throw new Error('ENV에서 AI Studio API 키를 먼저 연결해주세요.');
  const models = new Map();
  let pageToken = '';
  do {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers: { 'x-goog-api-key': apiKey }, signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || `모델 목록 오류 (${response.status})`);
    for (const model of result.models || []) {
      const id = normalizeImageModel(model.name);
      const methods = model.supportedGenerationMethods || [];
      if ((/^(gemini-.*image|gemini-.*nano-banana)/i.test(id) && methods.includes('generateContent')) ||
          (/^imagen-.*generate/i.test(id) && methods.includes('predict'))) {
        models.set(id, id);
      }
    }
    pageToken = result.nextPageToken || '';
  } while (pageToken);
  return [...models.values()].sort();
}

export function normalizeImageModel(value) {
  const model = String(value || '').trim().replace(/^models\//, '');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model)) {
    throw new Error('올바른 Gemini 모델 ID를 입력해주세요.');
  }
  return model;
}

export async function requestGemini(apiKey, model, text, image = false, signal) {
  if (!apiKey) throw new Error('ENV에서 AI Studio API 키를 먼저 연결해주세요.');
  const id = normalizeImageModel(model);
  const imagen = image && id.startsWith('imagen-');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${id}:${imagen ? 'predict' : 'generateContent'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    signal,
    body: JSON.stringify(imagen ? { instances: [{ prompt: text }], parameters: { sampleCount: 1 } } : {
      contents: [{ parts: [{ text }] }],
      ...(image ? { generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } } : {}),
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || `API 오류 (${response.status})`);
  if (imagen) {
    const prediction = result.predictions?.find(item => item.bytesBase64Encoded);
    if (!prediction || !/^image\/(png|jpeg|webp)$/.test(prediction.mimeType || '')) throw new Error('이미지가 반환되지 않았습니다. 프롬프트와 모델 접근 권한을 확인해주세요.');
    return `data:${prediction.mimeType};base64,${prediction.bytesBase64Encoded}`;
  }
  const parts = result.candidates?.[0]?.content?.parts || [];
  if (image) {
    const data = parts.find(part => !part.thought && /^image\/(png|jpeg|webp)$/.test(part.inlineData?.mimeType || ''))?.inlineData;
    if (!data?.data) throw new Error('이미지가 반환되지 않았습니다. 프롬프트와 모델의 이미지 생성 지원 여부를 확인해주세요.');
    return `data:${data.mimeType};base64,${data.data}`;
  }
  const output = parts.filter(part => !part.thought && part.text).map(part => part.text).join('\n').trim();
  if (!output) throw new Error('프롬프트가 반환되지 않았습니다.');
  return output;
}
