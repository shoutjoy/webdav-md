import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../mdpro/js/export/pdf-export.js', import.meta.url), 'utf8');

test('PDF preview exposes a mouse resize handle for selected images', () => {
  assert.match(source, /pdf-image-resize-handle/);
  assert.match(source, /드래그하여 PDF 이미지 크기 조절/);
  assert.match(source, /state\.pagesRoot\.addEventListener\('pointerdown'/);
  assert.match(source, /global\.addEventListener\('pointermove', handleImageResizeMove/);
});

test('resized image width is stored in object edits and repaginated', () => {
  assert.match(source, /image\.style\.width = widthPercent\.toFixed\(2\) \+ '%'/);
  assert.match(source, /state\.objectEdits\.set\(sourceIndex, unit\.outerHTML\)/);
  assert.match(source, /recordPaginationChange\(function \(\)/);
  assert.match(source, /queuePdfEditStateSave\(\)/);
});
