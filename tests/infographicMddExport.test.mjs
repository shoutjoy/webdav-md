import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const infographicSource = readFileSync(
  new URL('../mdpro/Apps/inforgrapicAuto/imgbb.html', import.meta.url),
  'utf8'
);

test('batch infographic export keeps ImgBB upload and adds an MDD internal-image download', () => {
  assert.match(infographicSource, /id="btnBatchUploadImgbb"/);
  assert.match(infographicSource, /id="btnDownloadMdd"/);
  assert.match(infographicSource, /btnDownloadMdd\.addEventListener\('click', downloadMddDocument\)/);
  assert.match(infographicSource, /전체 이미지 문서 내부 저장 \(\.mdd\)/);
});

test('MDD download uses the MDPro image bundle contract and internal links', () => {
  assert.match(infographicSource, /function downloadMddDocument\(\)/);
  assert.match(infographicSource, /format: 'mdlive\/mdd'/);
  assert.match(infographicSource, /version: 1/);
  assert.match(infographicSource, /return `indb:\$\{id\}`/);
  assert.match(infographicSource, /mime: 'image\/png'/);
  assert.match(infographicSource, /base64: slide\.rawBase64/);
  assert.match(infographicSource, /application\/json;charset=utf-8/);
  assert.match(infographicSource, /a\.download = `\$\{baseName\}_infographic\.mdd`/);
});

test('regular markdown export still defaults to ImgBB URLs', () => {
  assert.match(infographicSource, /function buildFinalDocument\(imageLinkForSlide\)/);
  assert.match(infographicSource, /: slide\.imgbbUrl;/);
  assert.match(infographicSource, /function downloadFinalDocument\(\) \{[\s\S]*?buildFinalDocument\(\)/);
});
