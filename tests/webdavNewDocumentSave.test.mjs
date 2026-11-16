import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../mdpro/js/webdav-host-bridge.js',import.meta.url),'utf8');
const code=src.slice(src.indexOf('    function saveToWebDav('),src.indexOf('    function openTocPopup('));
function fixture(host){const sent=[];const ctx=vm.createContext({window:{__webdavHostDocument:host,parent:{postMessage:(data,origin)=>sent.push({data,origin})}},location:{origin:'https://mdpro.example'},currentDocumentText:()=> '# 새 문서\n본문'});vm.runInContext(code,ctx);return {ctx,sent};}
test('MDpro-only document opens WebDAV save-as with full text and no invented source path',()=>{const {ctx,sent}=fixture(null);assert.equal(ctx.saveToWebDav(true),true);assert.equal(sent[0].data.type,'webdav-save-document-as');assert.equal(sent[0].data.path,'');assert.equal(sent[0].data.content,'# 새 문서\n본문');assert.equal(sent[0].origin,'https://mdpro.example');});
test('ordinary save on an unbound document also opens location selection',()=>{const {ctx,sent}=fixture(null);ctx.saveToWebDav(false);assert.equal(sent[0].data.type,'webdav-save-document-as');});
test('existing WebDAV document keeps original save and copy behavior',()=>{const {ctx,sent}=fixture({path:'/notes/a.md',fileName:'a.md'});ctx.saveToWebDav(false);ctx.saveToWebDav(true);assert.equal(sent[0].data.type,'webdav-save-document');assert.equal(sent[1].data.type,'webdav-save-document-as');assert.equal(sent[1].data.path,'/notes/a.md');});
