import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync('mdpro/js/app.js', 'utf8');
const chat = readFileSync('mdpro/AI_App/aiChat/ai-chat.js', 'utf8');
const context = vm.createContext({});
vm.runInContext(chat.slice(chat.indexOf('  function imageIdentityMessages('), chat.indexOf('  function isGeminiTtsModel(')), context);
const portrait = { kind: 'image', name: 'face.png', dataUrl: 'data:image/png;base64,aGVsbG8=' };

test('identity prompt protects faces while allowing requested pose changes without mutating history', () => {
  const rows = [{ role: 'user', content: '팔을 들고 서 있게 해줘', attachments: [portrait] }];
  const result = context.imageIdentityMessages(rows, true);
  assert.match(result[0].content, /FIRST reference image as the identity anchor/);
  assert.match(result[0].content, /preserve facial structure/);
  assert.match(result[0].content, /body pose and expression/);
  assert.match(result[0].content, /팔을 들고 서 있게 해줘/);
  assert.equal(rows[0].content, '팔을 들고 서 있게 해줘');
  assert.equal(result[0].attachments[0].dataUrl, portrait.dataUrl);
  assert.equal(context.imageIdentityMessages(rows, false), rows);
  const textOnly = [{ role: 'user', content: 'hello' }];
  assert.equal(context.imageIdentityMessages(textOnly, true), textOnly);
  const followup = [...rows, { role: 'user', content: 'new image' }];
  assert.equal(context.imageIdentityMessages(followup, true), followup);
});

function transport() {
  const calls = [];
  const store = new Map();
  const scope = vm.createContext({ FormData, Blob, Uint8Array, atob,
    localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
    findCachedLemonadeModel: () => ({}), LEMONADE_DEFAULT_MODEL: 'Flux-2-Klein-4B',
    openAICompatibleHeaders: () => ({ 'Content-Type': 'application/json' }),
    openAICompatibleRequestUrl: (_connection, path) => path,
    fetch: async (url, request) => {
      calls.push({ url, request });
      return { ok: true, json: async () => ({ data: [{ b64_json: 'cmVzdWx0' }] }) };
    }, readOpenAICompatibleError: async () => 'server error'
  });
  vm.runInContext(app.slice(app.indexOf('function getLemonadeImageSettings('), app.indexOf('function lemonadeImageSizeForRatio(')), scope);
  return { scope, calls };
}

for (const count of [1, 2]) {
  test(`Lemonade edit uploads ${count} actual image file(s), ordered identity then scene`, async () => {
    const { scope, calls } = transport();
    const attachments = count === 1 ? [portrait] : [portrait, { ...portrait, name: 'scene.png', dataUrl: 'data:image/png;base64,d29ybGQ=' }];
    const rows = context.imageIdentityMessages([{ role: 'user', content: 'change pose', attachments }], true);
    await scope.generateLemonadeImage({ apiKey: 'lemonade' }, 'Flux-2-Klein-4B', rows);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'images/edits');
    const body = calls[0].request.body;
    assert.match(body.get('prompt'), /identity anchor/);
    const images = body.getAll(count === 1 ? 'image' : 'image[]');
    assert.equal(images.length, count);
    assert.equal(await images[0].text(), 'hello');
    if (count === 2) assert.equal(await images[1].text(), 'world');
    assert.equal(calls[0].request.headers['Content-Type'], undefined);
  });
}

test('missing reference bytes abort instead of silently generating a new face from text', async () => {
  const { scope, calls } = transport();
  await assert.rejects(scope.generateLemonadeImage({}, 'Flux-2-Klein-4B', [{ role: 'user', content: 'pose', attachments: [{ kind: 'image' }] }]), /다시 첨부/);
  assert.equal(calls.length, 0);
});

test('text-only image generation still uses generations endpoint', async () => {
  const { scope, calls } = transport();
  await scope.generateLemonadeImage({}, 'Flux-2-Klein-4B', [{ role: 'user', content: 'landscape' }]);
  assert.equal(calls[0].url, 'images/generations');
  assert.equal(JSON.parse(calls[0].request.body).prompt, 'landscape');
});

test('successive image edits retain the original identity reference and latest scene', async () => {
  const nodes = [];
  function node(tag) {
    const value = { tag, children: [], handlers: {}, value: '', append(...items) { this.children.push(...items); },
      appendChild(item) { this.children.push(item); }, setAttribute() {}, addEventListener(event, handler) { this.handlers[event] = handler; },
      showModal() {}, focus() {}, close() {}, remove() {} };
    nodes.push(value);
    return value;
  }
  const requests = [];
  const scope = vm.createContext({
    document: { getElementById: () => null, createElement: node, createTextNode: text => text, body: node('body') },
    state: { provider: 'lemonade', lemonadeModel: 'Flux-2-Klein-4B', preserveImageIdentity: true, messages: [] },
    generationStopRevision: 0, isLemonadeImageModel: () => true,
    setRunning() {}, renderMessages() {}, saveHistory() {},
    getBridge: () => ({ complete: async request => { requests.push(request); return { images: [{ data: 'result-' + requests.length, mimeType: 'image/png' }] }; } })
  });
  vm.runInContext(chat.slice(chat.indexOf('  function imageIdentityMessages('), chat.indexOf('  function isGeminiTtsModel(')) +
    chat.slice(chat.indexOf('  function openGeneratedImageEditor('), chat.indexOf('  async function sendMessage(')), scope);
  scope.openGeneratedImageEditor({ data: 'current-scene', identityReference: { data: 'original-face', mimeType: 'image/png' } }, 0);
  const prompt = nodes.find(item => item.id === 'ai-chat-image-edit-prompt');
  const run = nodes.find(item => item.textContent === '편집 실행');
  prompt.value = 'raise arm';
  await run.handlers.click();
  prompt.value = 'sit down';
  await run.handlers.click();
  const attachments = requests[1].messages[0].attachments;
  assert.match(attachments[0].dataUrl, /original-face$/);
  assert.match(attachments[1].dataUrl, /result-1$/);
  assert.match(requests[1].messages[0].content, /sit down/);
  assert.equal(scope.state.messages[1].images[0].identityReference.data, 'original-face');
  nodes.find(item => item.id === 'ai-chat-image-edit-preserve-identity').checked = false;
  prompt.value = 'change face';
  await run.handlers.click();
  assert.equal(requests[2].messages[0].attachments.length, 1);
  assert.doesNotMatch(requests[2].messages[0].content, /identity anchor/);
});
