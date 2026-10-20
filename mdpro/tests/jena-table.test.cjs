const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');

test('table picker exposes the Jena Table image and text workflow', () => {
    assert.match(html, /onclick="openJenaTablePopup\(\)"/);
    assert.match(html, /id="jena-table-file"[^>]+accept="image\/\*"/);
    assert.match(html, /id="jena-table-source-text"/);
    assert.match(html, /id="jena-table-import-selection"[^>]+>선택 텍스트 가져오기<\/button>/);
    assert.match(html, /id="jena-table-model-select"[^>]+aria-label="Jena Table 인공지능 모델 선택"/);
    assert.match(html, /AI Jena로 표 인식 실행/);
    assert.match(html, /id="jena-table-result"/);
    assert.match(html, /id="jena-table-render"/);
    assert.match(html, /문서 커서 위치에 표 삽입/);
    assert.match(html, /id="jena-table-fullscreen"[^>]+onclick="toggleJenaTableFullscreen\(\)"/);
    assert.match(html, /id="jena-table-preview-popup"/);
    assert.match(html, /id="jena-table-preview-large"/);
    for (const direction of ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw']) {
        assert.match(html, new RegExp(`data-jena-table-resize="${direction}"`));
    }
    for (const action of ['add-row', 'add-column', 'delete-row', 'delete-column']) {
        assert.match(html, new RegExp(`editMarkdownTableStructure\\('${action}'\\)`));
    }
});

test('Jena Table routes image or text through the shared AI provider bridge', () => {
    assert.match(app, /function generateJenaTable\(\)/);
    assert.match(app, /AIToolProviders\.read\('jena-table'\)/);
    assert.match(app, /AIToolProviders\.mount\(container, 'jena-table'/);
    assert.match(app, /if \(!jenaTableImage && !sourceText\)/);
    assert.match(app, /const attachments = jenaTableImage \? \[\{ kind: 'image'/);
    assert.match(app, /AIChatBridge\.complete/);
    assert.match(app, /table OCR and structuring engine/);
    assert.match(app, /function cleanJenaTableMarkdown\(value\)/);
    assert.match(app, /function renderJenaTablePreview\(\)/);
    assert.match(app, /function insertJenaTableResult\(\)/);
    assert.match(app, /function toggleJenaTableFullscreen\(\)/);
    assert.match(app, /function openJenaTablePreviewPopup\(\)/);
    assert.match(app, /function closeJenaTablePreviewPopup\(\)/);
    assert.match(app, /document\.getElementById\('jena-table-render'\)\.onclick = openJenaTablePreviewPopup/);
    assert.match(app, /window\.openJenaTablePopup = openJenaTablePopup/);
});

test('Jena Table cleans fenced or JSON-wrapped Markdown without dropping table rows', () => {
    const match = app.match(/function cleanJenaTableMarkdown\(value\) \{([\s\S]*?)\n\}/);
    assert.ok(match, 'cleanJenaTableMarkdown should exist');
    const clean = new Function('value', match[1]);
    const table = '| 이름 | 점수 |\n| --- | ---: |\n| 김제나 | 98 |';
    assert.equal(clean('```markdown\n' + table + '\n```'), table);
    assert.equal(clean(JSON.stringify({ markdown: table })), table);
    assert.equal(clean('설명입니다.\n' + table + '\n완료'), table);
});

test('Jena Table keeps the Img2Math visual pattern and adds a table preview', () => {
    assert.match(html, /id="jena-table-popup" class="img2math-modal/);
    assert.match(html, /class="img2math-dialog jena-table-dialog"/);
    assert.match(css, /#jena-table-popup\.img2math-modal/);
    assert.match(css, /\.jena-table-render table/);
    assert.match(css, /#jena-table-image-preview/);
    assert.match(css, /\.jena-table-dialog\.is-maximized/);
    assert.match(css, /\.jena-table-preview-modal/);
    assert.match(css, /\.jena-table-render-large/);
});

test('table structure actions locate the Markdown table and current column', () => {
    const split = app.match(/function splitJenaTableRow\(line\) \{[\s\S]*?\n\}/);
    const divider = app.match(/function isJenaTableDivider\(line\) \{[\s\S]*?\n\}/);
    const context = app.match(/function getMarkdownTableStructureAtCursor\(text, cursor\) \{[\s\S]*?\n\}/);
    assert.ok(split && divider && context);
    const getContext = new Function(`${split[0]}\n${divider[0]}\n${context[0]}\nreturn getMarkdownTableStructureAtCursor;`)();
    const markdown = '앞 문장\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n뒤 문장';
    const result = getContext(markdown, markdown.indexOf('2'));
    assert.equal(result.start, 2);
    assert.equal(result.end, 4);
    assert.equal(result.lineIndex, 4);
    assert.equal(result.columnIndex, 1);
    assert.equal(result.columnCount, 2);
    assert.match(app, /function editMarkdownTableStructure\(action\)/);
    assert.match(app, /action === 'add-row'/);
    assert.match(app, /action === 'delete-row'/);
    assert.match(app, /action === 'add-column'/);
    assert.match(app, /action === 'delete-column'/);
    assert.match(app, /window\.editMarkdownTableStructure = editMarkdownTableStructure/);
});
