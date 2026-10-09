import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const imageInsertSource = readFileSync(
    new URL('../mdpro/imageDB/image_insert.js', import.meta.url),
    'utf8'
);
const gallerySource = readFileSync(
    new URL('../mdpro/imageDB/image-gallery.html', import.meta.url),
    'utf8'
);
const indexSource = readFileSync(new URL('../mdpro/index.html', import.meta.url), 'utf8');

test('successful IMG imgBB uploads are retained in a local gallery catalog', () => {
    assert.match(imageInsertSource, /IMAGE_INSERT_IMGBB_CATALOG_KEY/);
    assert.match(imageInsertSource, /saveImageInsertImgbbCatalogItem\(data, imageInsertCurrentFileName\)/);
    assert.match(imageInsertSource, /imgbbRecords:\s*getImageInsertImgbbCatalog\(\)/);
});

test('gallery preserves inDB browsing and adds an imgBB source tab', () => {
    assert.match(gallerySource, /id="source-indb"/);
    assert.match(gallerySource, /id="source-imgbb"/);
    assert.match(gallerySource, /state\.source === 'imgbb'/);
    assert.match(gallerySource, /source:\s*state\.source/);
    assert.match(gallerySource, /type:\s*'image-gallery-select'/);
});

test('selecting an imgBB catalog image returns its direct URL to the IMG insert field', () => {
    assert.match(imageInsertSource, /event\.data\.source === 'imgbb'/);
    assert.match(imageInsertSource, /input\.value = imageUrl/);
    assert.match(imageInsertSource, /setImageInsertPreview\(String\(event\.data\.previewUrl \|\| imageUrl\)\)/);
    assert.match(indexSource, /image_insert\.js\?v=20261009-imgbb-gallery-1/);
});
