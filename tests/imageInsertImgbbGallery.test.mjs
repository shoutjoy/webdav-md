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
    assert.match(imageInsertSource, /setImageInsertPreview\(String\(source\.previewUrl \|\| imageUrl\)\)/);
    assert.match(indexSource, /image_insert\.js\?v=20261010-imgbb-html-input-1/);
});

test('gallery can open imgBB for manual browsing and import a copied direct URL', () => {
    assert.match(gallerySource, /id="open-imgbb-site"/);
    assert.match(gallerySource, /id="imgbb-manual-url"/);
    assert.match(gallerySource, /id="paste-imgbb-url"/);
    assert.match(gallerySource, /type:\s*'image-gallery-add-imgbb-url'/);
    assert.match(gallerySource, /id="copy-url"/);
    assert.match(gallerySource, /https:\/\/jh-park9\.imgbb\.com\//);
    assert.match(imageInsertSource, /event\.data\.type === 'image-gallery-add-imgbb-url'/);
    assert.match(imageInsertSource, /type:\s*'image-gallery-imgbb-url-added'/);
    assert.match(imageInsertSource, /https:\/\/jh-park9\.imgbb\.com\//);
});

test('manual import accepts either a direct URL or img HTML and HTML copy keeps the full tag', () => {
    assert.match(imageInsertSource, /function extractImageUrlFromCopiedValue/);
    assert.match(gallerySource, /function extractImageUrl\(value\)/);
    assert.match(gallerySource, /<img\\b\[\^>\]\*\\bsrc/);
    assert.match(gallerySource, />HTML 복사<\/button>/);
    assert.match(gallerySource, /const html = '<img src="'/);
    assert.match(gallerySource, /alt="' \+ escapeHtmlAttribute\(alt\) \+ '" border="0">'/);
});
