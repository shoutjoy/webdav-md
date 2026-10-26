import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const exportSource = fs.readFileSync(
  new URL('../mdpro/js/extendFiles/docx-export.js', import.meta.url),
  'utf8'
);

function loadDocxExport() {
  const files = new Map();

  class FakeZipFolder {
    constructor(prefix = '') {
      this.prefix = prefix;
    }

    folder(name) {
      return new FakeZipFolder(this.prefix + name + '/');
    }

    file(name, value) {
      files.set(this.prefix + name, value);
      return this;
    }

    async generateAsync() {
      return new Blob(['docx']);
    }
  }

  const window = {
    Blob,
    JSZip: FakeZipFolder,
    TextEncoder,
    atob,
    console
  };
  vm.runInNewContext(exportSource, {
    window,
    Blob,
    TextEncoder,
    atob,
    console
  });
  return { api: window.DocxExport, files };
}

test('DOCX export embeds the rendered Mermaid image and keeps its reusable source code', async () => {
  const { api, files } = loadDocxExport();
  const mermaidCode = 'flowchart LR\nA --> B';
  const onePixelPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  await api.createBlob({
    content: '```mermaid\n' + mermaidCode + '\n```',
    mermaidImages: [{
      src: onePixelPng,
      alt: 'Mermaid diagram',
      mermaidSource: mermaidCode
    }]
  });

  const documentXml = files.get('word/document.xml');
  assert.equal(typeof documentXml, 'string');
  assert.ok(documentXml.includes('<w:drawing>'), 'rendered diagram image should be embedded');
  assert.ok(documentXml.includes('flowchart LR'));
  assert.ok(documentXml.includes('A --&gt; B'));
  assert.ok(files.has('word/media/image1.png'));
});

test('DOCX includes every diagram even when Mermaid labels contain HTML', async () => {
  const { api, files } = loadDocxExport();
  const sources = ['flowchart LR\nA["<div>인사관리</div>"] --> B', 'flowchart TD\nC --> D'];
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  await api.createBlob({
    content: '설명\n\n' + sources.map(source => '```mermaid\n' + source + '\n```').join('\n\n'),
    mermaidImages: sources.slice().reverse().map(source => ({src: png, mermaidSource: source})),
    requireMermaidImages: true
  });
  const xml = files.get('word/document.xml');
  assert.equal((xml.match(/<w:drawing>/g) || []).length, 2);
  assert.ok(xml.includes('&lt;div&gt;인사관리&lt;/div&gt;'));
  assert.ok(xml.indexOf('flowchart LR') < xml.indexOf('flowchart TD'));
  assert.ok(files.has('word/media/image1.png'));
  assert.ok(files.has('word/media/image2.png'));
});

test('DOCX supports tilde fences and does not close long fences with short backticks', async () => {
  const { api, files } = loadDocxExport();
  const code = 'flowchart LR\nA --> B';
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  await api.createBlob({
    content: '````text\n```mermaid\nexample\n```\n````\n\n~~~mermaid\n' + code + '\n~~~',
    mermaidImages: [{src: png, mermaidSource: code}], requireMermaidImages: true
  });
  const xml = files.get('word/document.xml');
  assert.equal((xml.match(/<w:drawing>/g) || []).length, 1);
  assert.ok(xml.includes('```mermaid'));
});

test('DOCX refuses to silently omit a missing or invalid required Mermaid image', async () => {
  const code = 'flowchart LR\nA --> B';
  for (const images of [[], [{src: 'data:image/png;base64,%%%', mermaidSource: code}]]) {
    const { api, files } = loadDocxExport();
    await assert.rejects(api.createBlob({
      content: '```mermaid\n' + code + '\n```',
      mermaidImages: images, requireMermaidImages: true
    }));
    assert.equal(files.has('word/document.xml'), false);
  }
});

test('DOCX export collects rendered Mermaid SVGs from the live preview', () => {
  const { api } = loadDocxExport();
  const attributes = new Map([
    ['viewBox', '0 0 800 400']
  ]);
  const svg = {
    style: {},
    cloneNode() {
      return this;
    },
    getAttribute(name) {
      return attributes.get(name) || '';
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    get outerHTML() {
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="800" height="400"><text>diagram</text></svg>';
    }
  };
  const wrapper = {
    querySelector(selector) {
      return selector === 'svg' ? svg : null;
    },
    getAttribute(name) {
      return name === 'data-mermaid-original-source' ? 'flowchart LR\nA --> B' : '';
    }
  };
  const root = {
    querySelectorAll(selector) {
      return selector === '.trt-mermaid-wrapper' ? [wrapper] : [];
    }
  };

  const images = api.collectMermaidImages(root);
  assert.equal(images.length, 1);
  assert.equal(images[0].mermaidSource, 'flowchart LR\nA --> B');
  assert.equal(images[0].width, 800);
  assert.equal(images[0].height, 400);
  assert.match(images[0].src, /^data:image\/svg\+xml/);
});

test('DOCX export writes LaTeX as native Word OMML in paragraphs, lists, and tables', async () => {
  const { api, files } = loadDocxExport();
  await api.createBlob({
    content: [
      'AVE는 \\(\\frac{\\sum \\lambda_i^2}{\\sum \\lambda_i^2 + \\sum \\theta_i}\\) 로 계산한다.',
      '',
      '- 판정: \\(\\sqrt{\\text{AVE}} \\ge .50\\)',
      '',
      '| 변수 | 기준 |',
      '| --- | --- |',
      '| 직원경험 | \\(\\beta = .693\\) |',
      '',
      '\\[\\text{AVE} = \\frac{2.7069}{4} = \\mathbf{0.677}\\]'
    ].join('\n')
  });

  const documentXml = files.get('word/document.xml');
  assert.match(documentXml, /xmlns:m="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/math"/);
  assert.match(documentXml, /<m:oMath>/);
  assert.match(documentXml, /<m:f><m:num>/);
  assert.match(documentXml, /<m:rad>/);
  assert.match(documentXml, /<m:sSub>/);
  assert.match(documentXml, />β(?:<|\s)/);
  assert.match(documentXml, />[^<]*≥[^<]*</);
  assert.doesNotMatch(documentXml, /\\frac|\\sqrt|\\beta|\\\(|\\\)|\\\[|\\\]/);
  assert.doesNotMatch(documentXml, /\\/, 'double-escaped math must not leave a visible backslash before the Word equation');
});

test('DOCX export consumes both slashes around double-escaped equations', async () => {
  const { api, files } = loadDocxExport();
  await api.createBlob({
    content: [
      String.raw`- 하위차원 적재치(\\(\\beta\\)): 조직몰입(\\(\\beta = .952\\))`,
      String.raw`- 적재치 제곱합 (\\(\\sum \\beta^2\\)):`,
      String.raw`\\(0.952^2 + 0.864^2 = 1.6525\\)`,
      String.raw`\\(\\text{AVE} = \\frac{2.7069}{4} = 0.677\\)`
    ].join('\n')
  });

  const documentXml = files.get('word/document.xml');
  assert.match(documentXml, /<m:oMath>/);
  assert.match(documentXml, />β(?:<|\s)/);
  assert.match(documentXml, />∑(?:<|\s)/);
  assert.match(documentXml, /<m:f><m:num>/);
  assert.doesNotMatch(documentXml, /\\|₩/);
});

test('DOCX export removes broken image and backslash prefixes from relationship arrows', async () => {
  const { api, files } = loadDocxExport();
  await api.createBlob({
    content: [
      '- 직원경험(독립) \\image직원몰입(매개) \\image직무배태성(종속)',
      '- 직원경험(독립) \\rightarrow 직원몰입(매개) \\to 직무배태성(종속)',
      '- 직원경험(독립) \\→직원몰입(매개) ₩→직무배태성(종속)'
    ].join('\n')
  });

  const documentXml = files.get('word/document.xml');
  assert.equal((documentXml.match(/→/g) || []).length, 6);
  assert.doesNotMatch(documentXml, /\\image|\\rightarrow|\\to|\\→|₩→/);
  assert.match(documentXml, /직원경험\(독립\).*→.*직원몰입\(매개\).*→.*직무배태성\(종속\)/);
});

test('DOCX export removes the Markdown escape before numbered heading dots', async () => {
  const { api, files } = loadDocxExport();
  await api.createBlob({
    content: String.raw`### 1\. 교육산업의 존재론적 질문: 무엇이 교육을 교육답게 만드는가?`
  });

  const documentXml = files.get('word/document.xml');
  assert.match(documentXml, /1\. 교육산업의 존재론적 질문/);
  assert.doesNotMatch(documentXml, /1\\\. 교육산업의 존재론적 질문/);
});

test('DOCX export converts Markdown bold markers around special characters into bold Word runs', async () => {
  const { api, files } = loadDocxExport();
  await api.createBlob({
    content: [
      '일반 **특수문자 → ± ≥ & (중요)** 일반',
      '- **기호: ★ / ※ / ①**',
      '| 항목 | 값 |',
      '| --- | --- |',
      '| 상태 | **완료 ✓** |'
    ].join('\n')
  });

  const documentXml = files.get('word/document.xml');
  assert.match(documentXml, /<w:r><w:rPr><w:b\/><\/w:rPr><w:t[^>]*>특수문자 → ± ≥ &amp; \(중요\)<\/w:t><\/w:r>/);
  assert.match(documentXml, /<w:r><w:rPr><w:b\/><\/w:rPr><w:t[^>]*>기호: ★ \/ ※ \/ ①<\/w:t><\/w:r>/);
  assert.match(documentXml, /<w:r><w:rPr><w:b\/><\/w:rPr><w:t[^>]*>완료 ✓<\/w:t><\/w:r>/);
  assert.doesNotMatch(documentXml, /\*\*/);
});

test('DOCX export does not leave bold markers split around an inline equation', async () => {
  const { api, files } = loadDocxExport();
  await api.createBlob({
    content: String.raw`결과는 **\(\beta \ge .50\)** 이다.`
  });

  const documentXml = files.get('word/document.xml');
  assert.match(documentXml, /<m:oMath>/);
  assert.match(documentXml, />β(?:<|\s)/);
  assert.match(documentXml, />[^<]*≥[^<]*</);
  assert.doesNotMatch(documentXml, /\*\*/);
});
