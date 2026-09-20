import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const indexHtml = readFileSync(new URL('../mdpro/index.html', import.meta.url), 'utf8');
const imageInsertJs = readFileSync(new URL('../mdpro/imageDB/image_insert.js', import.meta.url), 'utf8');

test('image insert exposes a screen capture tool next to the gallery action', () => {
    assert.match(indexHtml, /id="img-insert-gallery-toggle"[\s\S]*id="img-insert-screen-capture"/);
    assert.match(indexHtml, /onclick="captureScreenForImageInsert\(\)"[\s\S]*>캡쳐도구<\/button>/);
});

test('screen capture imports one display frame and always stops sharing', () => {
    assert.match(imageInsertJs, /navigator\.mediaDevices\.getDisplayMedia\(\{ video: true, audio: false \}\)/);
    assert.match(imageInsertJs, /context\.drawImage\(video, 0, 0, width, height\)/);
    assert.match(imageInsertJs, /applyImageInsertDataUrl\(selectedCapture\.dataUrl, 'screen-capture-'/);
    assert.match(imageInsertJs, /finally \{[\s\S]*stream\.getTracks\(\)\.forEach\(function \(track\) \{ track\.stop\(\); \}\)/);
});

test('tab, window and full-screen captures continue to an area selector', () => {
    assert.match(imageInsertJs, /function selectImageInsertCaptureArea\(dataUrl\)/);
    assert.match(imageInsertJs, /가져올 영역을 마우스로 드래그하세요\. 탭·창·전체 화면 모두 영역을 선택할 수 있습니다\./);
    assert.match(imageInsertJs, /await selectImageInsertCaptureArea\(dataUrl\)/);
    assert.match(imageInsertJs, /croppedCanvas\.getContext\('2d'\)\.drawImage\(canvas, sx, sy, sw, sh, 0, 0, sw, sh\)/);
    assert.match(imageInsertJs, /선택 영역 가져오기/);
    assert.match(imageInsertJs, /전체 이미지 가져오기/);
});

test('unsupported capture explains the Windows snipping fallback', () => {
    assert.match(imageInsertJs, /Win\+Shift\+S/);
    assert.match(imageInsertJs, /window\.captureScreenForImageInsert = captureScreenForImageInsert/);
});
