import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {initSync,HwpDocument} from '../mdpro/rHwp/vendor/core/rhwp.js';
import {checkInput,serialize} from '../mdpro/rHwp/rhwp-loader.mjs';
import {validateTokens} from '../mdpro/rHwp/hwpx-export.mjs';
const require = createRequire(import.meta.url);
const runtime = {};
vm.runInNewContext(fs.readFileSync(new URL('../mdpro/vendor/marked/marked.umd.js',import.meta.url),'utf8'),runtime);
const {marked} = runtime;
initSync({module:fs.readFileSync(new URL('../mdpro/rHwp/vendor/core/rhwp_bg.wasm',import.meta.url))});
test('real native HWP and HWPX serialization preserves Korean and table cells', () => {
    const doc=HwpDocument.createEmpty();
    try {
        doc.createBlankDocument();
        doc.pasteHtml(0,0,0,'<p>한글 &amp; &lt;특수문자&gt; 😀</p><table><tr><td>첫 셀</td><td>마지막 셀</td></tr></table>');
        const text=doc.getTextFileText();
        for(const format of ['hwp','hwpx']) {
            const bytes=serialize(doc,format); checkInput(bytes,'test.'+format);
            const read=new HwpDocument(bytes);
            try { assert.equal(read.getTextFileText(),text); assert(read.renderPageSvg(0).includes('<svg')); } finally {read.free();}
            assert.throws(()=>checkInput(bytes,'test.'+(format==='hwp'?'hwpx':'hwp')));
        }
    } finally {doc.free();}
});
test('empty, truncated and unrelated inputs fail before parsing',()=>{
    for(const bytes of [new Uint8Array(),new Uint8Array([80,75,3,4]),new TextEncoder().encode('markdown')]) assert.throws(()=>checkInput(bytes,'test.hwpx'));
});
test('Unicode extraction preserves bullets, emoji and literal entity text distinctly',()=>{
    const doc=HwpDocument.createEmpty();
    try {
        doc.createBlankDocument();
        doc.pasteHtml(0,0,0,'<p>• 개인 수준 © 😀 &amp;#8226;</p>');
        const expected='• 개인 수준 © 😀 &#8226;';
        assert.equal(JSON.parse(doc.getTextFileUnicode()),expected);
        assert.notEqual(JSON.parse(doc.getTextFileText()),expected,'CP949 TEXT is not a Unicode comparison source');
        for(const format of ['hwp','hwpx']) {
            const read=new HwpDocument(serialize(doc,format));
            try {assert.equal(JSON.parse(read.getTextFileUnicode()),expected);} finally {read.free();}
        }
    } finally {doc.free();}
});
test('loss report blocks bytes and frees native export object',()=>{
    let freed=false,taken=false;
    assert.throws(()=>serialize({exportHwpxWithReport:()=>({contentLoss:()=>'{"count":1,"losses":[{}]}',takeBytes:()=>{taken=true;},free:()=>{freed=true;}})}),/손실/);
    assert(freed);assert(!taken);
});
test('unsupported math, HTML and diagram tokens fail explicitly; dollar code survives',()=>{
    for(const content of ['$x$','\\(x\\)','```mermaid\ngraph TD; A-->B\n```','<iframe>차단</iframe>','- [x] 작업']) assert.throws(()=>validateTokens(marked.lexer(content),marked),content);
    for(const content of ['`result$points`','```js\nconst x = "$";\n```','# 제목\n\n본문 **강조**\n\n|가|나|\n|--|--|\n|다|라|']) validateTokens(marked.lexer(content),marked);
});
test('all local entry points route binary inputs before text/native fallback',()=>{
    const app=fs.readFileSync(new URL('../mdpro/js/app.js',import.meta.url),'utf8');
    for(const name of ['openDroppedDocumentFile','handleFileSelect','openFileFromLocalFolderExplorer','refreshCurrentLocalFileFromDisk','readFile']) {
        const start=app.indexOf('async function '+name+'(');
        const end=app.indexOf('\nasync function ',start+1);
        assert(app.slice(start,end<0?undefined:end).includes('isHwpFile(file)'),name);
    }
    const branch=app.slice(app.indexOf("if (choice === 'hwpx'"),app.indexOf("if (choice === 'github'",app.indexOf("if (choice === 'hwpx'")));
    assert(!branch.includes('markPersistedState'));
});

test('HWP equation protection preserves matrix row breaks without changing the default renderer',()=>{
    const window = {};
    vm.runInNewContext(fs.readFileSync(new URL('../mdpro/js/math_render/math_render.js',import.meta.url),'utf8'),{window});
    const input = String.raw`$\begin{pmatrix}a&b\\c&d\end{pmatrix}$`;
    const protectedMath=window.MathRender.protectMathSegments(input,{preserveStructuralRows:true});
    assert.equal(protectedMath.restoreHtml(protectedMath.text),input.replaceAll('&','&amp;'));
});
