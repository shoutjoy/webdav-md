import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const chat = readFileSync('mdpro/AI_App/aiChat/ai-chat.js', 'utf8');
const source = chat.slice(chat.indexOf('  function createImageActionDetails('), chat.indexOf('  function needsConversationContext('));

function setup(running = false) {
  const calls = [];
  const element = tag => ({ tag, children: [], events: {}, classList: { add() {} },
    appendChild(child) { this.children.push(child); },
    addEventListener(name, callback) { this.events[name] = callback; } });
  const context = vm.createContext({ state: { running }, document: { createElement: element },
    isCsvAttachment: () => false,
    ...Object.fromEntries(['saveGeneratedImage', 'insertGeneratedImageIntoDocument', 'openGeneratedImageEditor',
      'copyGeneratedImage', 'openGeneratedImagePreview', 'openGeneratedImageInFma', 'confirmAndOpenImageInFma']
      .map(name => [name, (...args) => calls.push({ name, args })])) });
  vm.runInContext(source, context);
  return { context, calls, element };
}

test('uploaded image exposes all seven working actions and retains the original attachment', () => {
  const { context, calls, element } = setup();
  const attachment = { kind: 'image', name: 'portrait.jpg', dataUrl: 'data:image/jpeg;base64,aGVsbG8=' };
  const item = element('article');
  context.appendUserAttachmentGallery(item, { attachments: [attachment, { kind: 'document', name: 'notes.txt' }] });
  const gallery = item.children[0];
  assert.equal(gallery.children.length, 2);
  const figure = gallery.children[0];
  assert.equal(figure.children[0].src, attachment.dataUrl);
  const details = figure.children[2];
  assert.equal(details.open, false);
  const buttons = details.children[1].children;
  assert.deepEqual(buttons.map(button => button.textContent),
    ['이미지 1 저장', '문서삽입', '업로드 문서삽입', '이미지 편집', '이미지 복사', '크게 보기', 'FMA 보기']);
  buttons.forEach(button => button.events.click());
  assert.deepEqual(calls.map(call => call.name), ['saveGeneratedImage', 'insertGeneratedImageIntoDocument',
    'insertGeneratedImageIntoDocument', 'openGeneratedImageEditor', 'copyGeneratedImage', 'openGeneratedImagePreview', 'openGeneratedImageInFma']);
  assert.equal(calls[1].args[2], false);
  assert.equal(calls[2].args[2], true);
  assert.equal(calls[0].args[0].mimeType, 'image/jpeg');
  assert.equal(calls[0].args[0].data, 'aGVsbG8=');
  details.open = true;
  details.events.toggle();
  assert.match(details.children[0].textContent, /접기/);
  const image = context.attachmentImageActionSource(attachment);
  image.documentUrl = 'idb://saved';
  image.imgbbUrl = 'https://example.test/image.jpg';
  image._documentInsertBusy = true;
  const next = context.createImageActionDetails(context.attachmentImageActionSource(attachment), 0, false);
  assert.equal(next.open, true);
  assert.equal(next.children[1].children[1].disabled, true);
  assert.equal(attachment.documentUrl, 'idb://saved');
  assert.match(next.children[1].children[2].textContent, /업로드 주소/);
  assert.equal(attachment.data, undefined);
  assert.equal(attachment.dataUrl, 'data:image/jpeg;base64,aGVsbG8=');
});

test('generated controls remain initially expanded and can collapse; busy actions stay disabled', () => {
  const { context } = setup(true);
  const image = { mimeType: 'image/png', data: 'aGVsbG8=' };
  const details = context.createImageActionDetails(image, 1, true);
  assert.equal(details.open, true);
  for (const index of [0, 1, 2, 3]) assert.equal(details.children[1].children[index].disabled, true);
  details.open = false;
  details.events.toggle();
  assert.match(details.children[0].textContent, /펼치기/);
  assert.equal(context.createImageActionDetails(image, 1, true).open, false);
  assert.equal(context.attachmentImageActionSource({ dataUrl: 'invalid' }), null);
});
