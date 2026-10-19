const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');

test('img2Math removes outer dollar delimiter runs from imported text', () => {
    const match = app.match(/function cleanImg2MathSourceText\(value\) \{([\s\S]*?)\n\}/);
    assert.ok(match, 'cleanImg2MathSourceText should exist');
    const clean = new Function('value', match[1]);
    assert.equal(clean('$$\\frac{a}{b}$$'), '\\frac{a}{b}');
    assert.equal(clean('$$$$\n x + y \n$$$$'), 'x + y');
    assert.equal(clean('$$\n$$$$z$$$$\n$$'), 'z');
});

test('MATH menu exposes the img2Math workflow', () => {
    assert.match(html, /onclick="openImg2MathPopup\(\)"/);
    assert.match(html, /id="img2math-file"[^>]+accept="image\/\*"/);
    assert.match(html, /id="img2math-clear"[^>]+>이미지 지우기<\/button>/);
    for (const direction of ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw']) {
        assert.match(html, new RegExp(`data-img2math-resize="${direction}"`));
    }
    assert.match(html, /AI Jena로 수식 인식 실행/);
    assert.match(html, /id="img2math-ai-model"/);
    assert.match(html, /id="img2math-model-select"[^>]+aria-label="Img2Math 인공지능 모델 선택"/);
    assert.match(html, /id="img2math-import-selection"[^>]+>선택 텍스트 가져오기<\/button>/);
    assert.match(html, /id="img2math-source-text"[^>]+placeholder="예: x의 제곱/);
    assert.match(html, /id="img2math-result"/);
    assert.match(html, /문서 커서 위치에 삽입/);
    assert.match(html, /id="img2math-insert-image"[^>]+>이미지로 삽입<\/button>/);
});

test('img2Math sends an image or source text to the existing AI bridge and inserts display LaTeX', () => {
    assert.match(app, /function generateImg2Math\(\)/);
    assert.match(app, /getMermaidVisionProviderSelection\(\)/);
    assert.match(app, /function populateImg2MathModelSelect\(\)/);
    assert.match(app, /getImg2MathProviderSelection\(\)/);
    assert.match(app, /async function generateImg2Math\(\)[\s\S]*?const selected = getImg2MathProviderSelection\(\)/);
    assert.match(app, /async function analyzeImageToMermaidForEditor\([\s\S]*?const selected = getMermaidVisionProviderSelection\(\)/);
    assert.match(app, /getCachedGeminiModels/);
    assert.match(app, /getCachedOpenAIModels/);
    assert.match(app, /IMG2MATH_MODEL_SELECTION_KEY/);
    assert.match(app, /AIChatBridge\.complete/);
    assert.match(app, /const sourceText = String\(sourceTextInput/);
    assert.match(app, /if \(!img2MathImage && !sourceText\)/);
    assert.match(app, /const attachments = img2MathImage \? \[\{ kind: 'image'/);
    assert.match(app, /변환할 텍스트:\\n/);
    assert.match(app, /function cleanImg2MathLatex\(value\)/);
    assert.match(app, /function clearImg2MathImage\(\)/);
    assert.match(app, /function bindImg2MathFloatingWindow\(\)/);
    assert.match(app, /function constrainImg2MathFloatingWindow\(initialize\)/);
    assert.match(app, /function importSelectedTextIntoImg2Math\(\)/);
    assert.match(app, /function cleanImg2MathSourceText\(value\)/);
    assert.match(app, /const sourceText = cleanImg2MathSourceText\(sourceTextInput && sourceTextInput\.value\)/);
    assert.match(app, /sourceTextInput\.value = cleanedSelection/);
    assert.match(app, /async function insertImg2MathPreviewAsImage\(\)/);
    assert.match(app, /window\.html2canvas\(preview/);
    assert.match(app, /window\.applyImageInsertDataUrl\(dataUrl, 'img2math-formula-'/);
    assert.match(app, /clearButton\.classList\.remove\('hidden'\)/);
    assert.match(app, /const block = '\$\$\\n' \+ latex \+ '\\n\$\$'/);
    assert.match(app, /ensureMdMathEngineLoaded\(\)/);
});

