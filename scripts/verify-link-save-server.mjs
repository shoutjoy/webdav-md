// Isolated browser fixture: real MDpro + WebDAV bridge + local HTTP disk storage.
// Never reads WebDAV credentials or writes a user's document.
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const evidence = path.join(root, 'artifacts/link-save-browser');
await mkdir(evidence, { recursive: true });
const savedPath = path.join(evidence, 'saved.md');
try { await readFile(savedPath); }
catch { await writeFile(savedPath, '링크 저장·재열기 브라우저 검증\n\n', 'utf8'); }
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>링크 저장·새로고침 검증</title>
<style>body{font:16px sans-serif;margin:0}header{padding:10px;background:#e2e8f0}pre{margin:0;padding:8px;white-space:pre-wrap;max-height:120px;overflow:auto}iframe{width:100%;height:75vh;border:0}</style>
<header><strong>링크 저장·새로고침 검증 — 로컬 HTTP 파일 저장소</strong> <button id="reopen">저장본 다시 열기</button> <span id="status">준비 중</span></header>
<pre id="saved"></pre><iframe title="검증 MDpro 편집기" src="/mdpro/index.html?webdav=1&editor=cm6&linkSave=20261027-2"></iframe>
<script>
const frame = document.querySelector('iframe'), status = document.querySelector('#status'), output = document.querySelector('#saved');
async function reopen() {
 const content = await fetch('/saved.md', {cache:'no-store'}).then(r=>r.text());
 output.textContent = content;
 frame.contentWindow.postMessage({type:'webdav-open-document',path:'/link-save-test.md',fileName:'link-save-test.md',content},location.origin);
 status.textContent='디스크 저장본을 다시 열었습니다';
}
frame.onload = () => {
 const script = frame.contentDocument.createElement('script');
 script.src='/mdpro/js/webdav-host-bridge.js?v=20261027-link-save';
 frame.contentDocument.body.appendChild(script);
};
window.addEventListener('message', async event => {
 if(event.source !== frame.contentWindow || event.origin !== location.origin) return;
 if(event.data.type === 'mdpro-ready') await reopen();
 if(event.data.type === 'webdav-save-document') {
  const content=event.data.content;
  const put=await fetch('/saved.md',{method:'PUT',body:content});
  const actual=await fetch('/saved.md',{cache:'no-store'}).then(r=>r.text());
  if(!put.ok || actual!==content) {status.textContent='저장 검증 실패';return;}
  output.textContent=actual; status.textContent='저장 완료 · 디스크 재조회 원문 일치';
  frame.contentWindow.postMessage({type:'webdav-document-saved',path:'/link-save-test.md',content:actual},location.origin);
 }
});
document.querySelector('#reopen').onclick=reopen;
</script></html>`;
const types = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    res.setHeader('Cache-Control', 'no-store');
    if (pathname === '/saved.md') {
      if (req.method === 'PUT') {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        await writeFile(savedPath, Buffer.concat(chunks));
        res.writeHead(204).end(); return;
      }
      res.setHeader('Content-Type','text/plain; charset=utf-8');
      res.end(await readFile(savedPath)); return;
    }
    if (pathname === '/') { res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(html); return; }
    const target = path.resolve(root, '.' + pathname);
    if (!target.startsWith(root)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', (types[path.extname(target)] || 'application/octet-stream') + '; charset=utf-8');
    res.end(await readFile(target));
  } catch { res.writeHead(404).end(); }
});
server.listen(0, '127.0.0.1', () => console.log(`http://127.0.0.1:${server.address().port}/`));
