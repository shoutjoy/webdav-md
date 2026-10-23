// PV_MERMAID_ENGINE points to the exact Mermaid bundle used by the app.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const MarkdownIt = require('markdown-it');

(async () => {
  const engine = fs.readFileSync(process.env.PV_MERMAID_ENGINE, 'utf8');
  const browser = await chromium.launch({ headless:true, ...(process.env.PV_TEST_BROWSER ? {executablePath:process.env.PV_TEST_BROWSER} : {}) });
  try {
    const context = await browser.newContext({viewport:{width:1200,height:1100}});
    const css = fs.readFileSync(path.join(__dirname,'../mdpro/css/style.css'),'utf8').replace(/^@import[^;]+;/gm,'');
    await context.route('**/*', route => {
      const url = route.request().url();
      return route.fulfill({contentType:url.includes('.js') ? 'text/javascript' : 'text/html',body:url.includes('mermaid.min.js') ? engine : url.includes('.js') ? '' : '<!doctype html><body></body>'});
    });
    const parent = await context.newPage();
    parent.on('pageerror', error => console.log('Parent error:',error.message));
    await parent.goto('http://pv-mermaid.test/');
    await parent.addScriptTag({content:`
      var previewPopupWindow=null, previewPopupScale=1, previewPopupWidthScale=1, previewPopupFontSize=16;
      var previewPopupRenderToken=0, previewPopupMermaidLoadPromise=null, previewInternalImageObjectUrls=[];
      var fixtureMarkdown='', fixtureHtml='';
      function revokeObjectUrls() {}
      function prepareMarkdownRenderSnapshot(raw) { return {renderSource:raw, features:{hasMermaid:raw.includes('\x60\x60\x60mermaid'),hasMath:false,hasInternalImages:false}}; }
      function renderMarkdownSnapshotToHtml() { return Promise.resolve(fixtureHtml); }
      function isMarkdownRenderSnapshotCurrent(snapshot) { return snapshot.renderSource === fixtureMarkdown; }
    `});
    await parent.addScriptTag({path:path.join(__dirname,'../mdpro/js/UI_PV/editpv.js')});
    const app = fs.readFileSync(path.join(__dirname,'../mdpro/js/app.js'),'utf8');
    await parent.addScriptTag({content:app.slice(app.indexOf('function applyMarkdownImageSizeHints('),app.indexOf('window.applyMarkdownImageSizeHints ='))});
    await parent.evaluate(() => {
      getPreviewPopupSourceMarkdown = function () {return fixtureMarkdown;};
      // Main editor settings are outside this isolated PV fixture.
      syncPreviewPopupHeaderSettingsUi = function () {};
      syncPreviewPopupEditorUi = function () {};
    });
    const popupHtml = await parent.evaluate(() => getPreviewPopupDocumentHtml());
    const popupEvent = parent.waitForEvent('popup');
    await parent.evaluate(() => {previewPopupWindow=window.open('','mermaid-pv-test');});
    const popup = await popupEvent;
    popup.on('pageerror', error => console.log('PV error:',error.message));
    await popup.setContent(popupHtml.replace(/<script[^>]*src=[^>]*><\/script>/g,''));
    await popup.addStyleTag({content:css});
    // Load the exact production engine locally so this regression is independent
    // of CDN connectivity. Keep the real PV configuration and rendering path.
    await popup.addScriptTag({content:engine});
    await popup.evaluate(() => {
      const marker=document.createElement('script'); marker.dataset.pvMermaid='1'; document.head.appendChild(marker);
    });
    const md = new MarkdownIt({html:true});
    const diagram = `flowchart TD
  subgraph V["중요도(가치)"]
    V1["인사관리"]
    V2["parn"]
    V3["운영관리"]
    V4["업무관리"]
    V5["resp"]
  end
  subgraph U["긴급도(수행)"]
    U1["인사관리"]
    U2["parn"]
    U3["운영관리"]
    U4["업무관리"]
    U5["resp"]
  end
  V --> L["통합 잠재프로파일 분석 LPA"]
  U --> L
  L --> M["1~5집단 모형 비교"]
  M --> C["이론적 4유형 검증"]
  C --> C1["가치 높음 · 긴급도 높음"]
  C --> C2["가치 높음 · 긴급도 낮음"]
  C --> C3["가치 낮음 · 긴급도 높음"]
  C --> C4["가치 낮음 · 긴급도 낮음"]`;
    for (const lang of ['', 'mermaid']) {
      const markdown = ('긴 문서 페이지 경계 검증\n\n문서 앞부분의 일반 문단입니다.\n\n').repeat(100)
        + '# LPA 도표\n\n\x60\x60\x60'+lang+'\n'+diagram+'\n\x60\x60\x60\n\n\x60\x60\x60js\nconsole.log("ordinary code");\n\x60\x60\x60';
      await parent.evaluate(async ({markdown,html}) => {
        fixtureMarkdown=markdown; fixtureHtml=html;
        await updatePreviewPopupContent();
      }, {markdown,html:md.render(markdown)});
      const result = await popup.evaluate(() => {
        const root=document.getElementById('pv-pages');
        const svg=root.querySelector('.trt-mermaid-wrapper svg');
        const rect=svg && svg.getBoundingClientRect();
        return {count:root.querySelectorAll('.trt-mermaid-wrapper svg').length,errors:root.querySelectorAll('.trt-mermaid-error').length,
          labels:svg && svg.textContent, width:rect && rect.width,height:rect && rect.height,
          rawCode:root.querySelectorAll('pre code.language-mermaid').length, normalCode:root.textContent.includes('ordinary code'),
          fits:!!svg && rect.right <= svg.closest('.pv-page-content').getBoundingClientRect().right + 1,
          controls:root.querySelectorAll('.trt-pv-mermaid-controls').length,
          pages:root.querySelectorAll('.pv-page').length};
      });
      assert.equal(result.count,1, 'Expected one SVG for '+(lang||'untagged')+' code');
      assert.equal(result.errors,0);
      assert.equal(result.rawCode,0);
      assert.ok(result.width>300 && result.height>300, 'Hidden-source rendering must not collapse the SVG');
      for (const label of ['중요도(가치)','긴급도(수행)','통합 잠재프로파일 분석 LPA','이론적 4유형 검증']) assert.ok(result.labels.includes(label),label);
      assert.ok(result.normalCode);
      assert.ok(result.fits && result.pages > 5);
      assert.equal(result.controls,0,'Output copies must not retain stale 100% controls');
      console.log('Actual PV Mermaid passed:',lang||'untagged',JSON.stringify({width:result.width,height:result.height}));
    }
    const supplied = `flowchart TD
      A["자료 점검: 123명 × 40변수"] --> B["중요도 i / 실행도 p 대응 확인"]
      B --> C["결측값 및 척도 범위 검토"]
      C --> D["문항별·영역별 기술통계"]
      D --> E["대응표본 t 검정 / Wilcoxon"]
      E --> F["격차 및 효과크기 분석"]
      F --> G["IPA 사분면 분석"]
      G --> H["영역별 개선 우선순위"]
      H --> I["경영전략 및 논문 결과 보고"]`;
    const imageUrl = 'https://i.ibb.co/k6KQL7Ch/mermaid-view-1792724231478.png';
    // Deterministic image pixels; the remote host is outside this layout test.
    const imageFixture='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="620" height="1800"><rect width="620" height="1800" fill="#cbd5e1"/></svg>').toString('base64');
    await popup.addStyleTag({content:'img,video{max-width:100%;height:auto}'});
    for (const width of [310,155]) {
      const markdown = '### 분석절차\n\n```mermaid\n'+supplied+'\n```\n\n<img src="'+imageUrl+'" border="0" width="'+width+'" height="'+(width*1060/310)+'"/>';
      await parent.evaluate(async ({markdown,html}) => {
        fixtureMarkdown=markdown;fixtureHtml=html;
        await Promise.race([updatePreviewPopupContent(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Render timed out: '+JSON.stringify(Array.from(previewPopupWindow.document.querySelectorAll('img'),i=>({src:i.src,complete:i.complete,naturalWidth:i.naturalWidth}))))),15000))]);
      },{markdown,html:md.render(markdown).replace(imageUrl,imageFixture)});
      const result = await popup.evaluate(() => {
        const root=document.getElementById('pv-pages');
        const svg=root.querySelector('.trt-mermaid-wrapper svg');
        const image=root.querySelector('img');
        const fits = element => {
          const rect=element.getBoundingClientRect(),page=element.closest('.pv-page-content').getBoundingClientRect();
          return rect.top>=page.top-1 && rect.bottom<=page.bottom+1 && rect.right<=page.right+1;
        };
        return {fits:fits(svg)&&fits(image),width:image.getBoundingClientRect().width,
          height:image.getBoundingClientRect().height,labels:Array.from(svg.querySelectorAll('.nodeLabel'),node=>node.textContent).join('|'),
          markers:Array.from(svg.querySelectorAll('[marker-end]'),node=>{
            const id=node.getAttribute('marker-end').match(/#([^)"]+)/)[1];
            return document.getElementById(id)?.closest('svg')===svg;
          }),
          wrappers:root.querySelectorAll('.trt-mermaid-wrapper').length,
          overflow:Array.from(root.querySelectorAll('.pv-page-content')).map(p=>p.scrollHeight-p.clientHeight),
          source:document.getElementById('pv-content').querySelector('img').getAttribute('width')};
      });
      assert.ok(result.fits,JSON.stringify(result));
      assert.equal(result.wrappers,1,'The Mermaid must remain one intact object');
      assert.ok(result.labels.includes('경영전략 및 논문 결과 보고'));
      assert.ok(result.width<=width+.5 && result.width>width*.85,JSON.stringify(result));
      assert.ok(Math.abs(result.height/result.width-1060/310)<.01);
      assert.ok(result.overflow.every(value=>value<=2));
      assert.ok(result.markers.length===8 && result.markers.every(Boolean),'Visible output must own all arrowhead references');
      assert.equal(result.source,String(width));
      console.log('Supplied vertical diagram and HTML size passed:',JSON.stringify(result));
    }
    if (process.env.PV_PROOF_DIR) {
      fs.mkdirSync(process.env.PV_PROOF_DIR,{recursive:true});
      await popup.locator('#pv-pages .trt-mermaid-wrapper').screenshot({path:path.join(process.env.PV_PROOF_DIR,'vertical-diagram.png')});
      await popup.locator('#pv-pages .trt-mermaid-wrapper').evaluate(element => element.scrollIntoView());
      await popup.screenshot({path:path.join(process.env.PV_PROOF_DIR,'pv-mermaid-long-document.png')});
    }
    await context.close();
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
