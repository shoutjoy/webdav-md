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

test('DOCX export places a rendered Mermaid image before its original code', async () => {
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
  assert.ok(
    documentXml.indexOf('<w:drawing>') < documentXml.indexOf('flowchart LR'),
    'diagram image should appear before the Mermaid source code'
  );
  assert.ok(files.has('word/media/image1.png'));
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
