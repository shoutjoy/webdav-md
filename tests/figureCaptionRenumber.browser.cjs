const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const root = path.join(__dirname, '../mdpro');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const panel = html.slice(html.indexOf('<div id="figure-caption-panel"'), html.indexOf('<div id="sites-panel-slot"'));
  const browser = await chromium.launch({headless:true,...(process.env.PV_TEST_BROWSER ? {executablePath:process.env.PV_TEST_BROWSER} : {})});
  try {
    const page = await browser.newPage({viewport:{width:900,height:850}});
    await page.setContent('<html class="dark"><body style="padding:24px;background:#0f172a;color:white"><textarea id="fixture-source" style="width:100%;height:180px"></textarea><div style="width:370px">'+panel+'</body></html>');
    await page.addStyleTag({content:fs.readFileSync(path.join(root,'css/tailwind-static.css'),'utf8')});
    await page.addStyleTag({content:fs.readFileSync(path.join(root,'css/style.css'),'utf8').replace(/^@import[^;]+;/gm,'')});
    await page.addScriptTag({content:`
      var editorTextarea=document.getElementById('fixture-source'),isEditMode=true,currentMarkdown='',activeSidebarTab='';
      var saves=0;
      function syncEditModeStateFromDom() {}
      function renderMarkdown() {}
      function performAutoSave() {saves++;}
      function showToast(message) {document.body.dataset.toast=message;}
    `});
    await page.addScriptTag({content:app.slice(app.indexOf('const captionInsertState ='),app.indexOf('function getBulletMarkerByIndent('))});
    const before='<span class="tbl-caption">[그림 8] 첫 번째 2026</span>\n\n<span class="tbl-caption tbl-caption-align-center">Fig 3. Second</span>\n\n[Figure 9] Third\n\n본문 [그림 8] 참조\n\n<span class="tbl-caption"><표 9> 유지</span>';
    await page.locator('#fixture-source').fill(before);
    await page.evaluate(() => {
      renderCaptionFormatButtons('figure');
      document.getElementById('figure-caption-text-input').value='다음 그림 설명';
      updateCaptionInsertPreview('figure');
    });
    await page.getByRole('button',{name:'전체 그림번호 재정렬',exact:true}).click();
    const result=await page.evaluate(()=>({source:editorTextarea.value,saves,number:document.getElementById('figure-caption-number-input').value,preview:document.getElementById('figure-caption-preview').textContent,toast:document.body.dataset.toast}));
    assert.equal(result.source,before.replace('[그림 8] 첫','[그림 1] 첫').replace('Fig 3.','Fig 2.').replace('[Figure 9]','[Figure 3]'));
    assert.equal(result.saves,1);
    assert.equal(result.number,'4');
    assert.equal(result.preview,'[그림 4] 다음 그림 설명');
    await page.getByRole('button',{name:'전체 그림번호 재정렬',exact:true}).click();
    assert.equal(await page.evaluate(()=>saves),1,'An already sorted document must not create an extra edit/save');
    if(process.env.PV_PROOF_DIR) {
      fs.mkdirSync(process.env.PV_PROOF_DIR,{recursive:true});
      await page.screenshot({path:path.join(process.env.PV_PROOF_DIR,'figure-caption-renumber.png')});
    }
    console.log('Figure caption panel click passed: source order, preserved references/table caption, next number, repeat click.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
