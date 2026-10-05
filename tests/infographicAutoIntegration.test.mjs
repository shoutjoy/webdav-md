import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const indexSource = readFileSync(new URL('../mdpro/index.html', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const infographicSource = readFileSync(
  new URL('../mdpro/Apps/inforgrapicAuto/imgbb.html', import.meta.url),
  'utf8'
);
const singleInfographicSource = readFileSync(
  new URL('../mdpro/Apps/ingrographicSingle/single_info_code_artifact.html', import.meta.url),
  'utf8'
);

test('ENV exposes the infographic feature without replacing existing feature controls', () => {
  assert.match(indexSource, /id="infographic-gemini-visible"/);
  assert.match(indexSource, /id="infographic-single-open-from-settings"/);
  assert.match(indexSource, /id="infographic-auto-visible"/);
  assert.match(indexSource, /id="infographic-auto-open-from-settings"/);
  assert.match(indexSource, /id="btn-infographic-gemini"/);
  assert.match(indexSource, /id="btn-infographic-auto"/);
  assert.match(indexSource, /id="infographic-single-panel"/);
  assert.match(indexSource, /id="infographic-single-frame"[^>]+data-src="\.\/Apps\/ingrographicSingle\/single_info_code_artifact\.html/);
  assert.match(indexSource, /id="infographic-auto-frame"/);
  assert.match(indexSource, /id="btn-infographic-gemini"[\s\S]*?<span>인포그래픽앱<\/span>/);
  assert.match(indexSource, /id="btn-infographic-auto"[\s\S]*?<span>문서일괄시각화<\/span>/);
  assert.match(indexSource, /id="btn-infographic-auto"[\s\S]*?data-lucide="workflow"/);
  assert.match(indexSource, /인포그래픽앱 버튼 보이기/);
  assert.match(indexSource, /문서일괄시각화 버튼 보이기/);
  assert.match(indexSource, /id="infographic-auto-frame"[^>]+data-src="\.\/Apps\/inforgrapicAuto\/imgbb\.html/);
  assert.match(infographicSource, /<title>문서일괄시각화<\/title>/);
  assert.match(appSource, /infographicGeminiVisible/);
  assert.match(appSource, /applyInfographicGeminiVisibility/);
  assert.match(appSource, /openInfographicGeminiApp/);
  assert.match(appSource, /function openInfographicGeminiApp\(\)\s*\{\s*openInfographicSinglePanel\(\);\s*\}/);
  assert.doesNotMatch(appSource, /gemini\.google\.com\/share/);
  assert.match(appSource, /infographicAutoVisible/);
  assert.match(appSource, /applyInfographicAutoVisibility/);
});

test('single infographic app opens internally and receives the protected Gemini key', () => {
  assert.match(appSource, /ensureLazyFrameLoaded\(frame\)/);
  assert.match(appSource, /singleFrame && event\.source === singleFrame\.contentWindow/);
  assert.match(singleInfographicSource, /type: "infographic-request-context"/);
  assert.match(singleInfographicSource, /data\.type === "mdpro-infographic-context"/);
  assert.match(singleInfographicSource, /state\.apiKey = String\(data\.apiKey/);
});

test('both infographic apps select a persisted Gemini image model with 3.1 Flash Lite as default', () => {
  for (const source of [singleInfographicSource, infographicSource]) {
    assert.match(source, /gemini-3\.1-flash-image/);
    assert.match(source, /gemini-3\.1-flash-lite-image/);
    assert.match(source, /gemini-3-pro-image/);
    assert.match(source, /gemini-2\.5-flash-image/);
    assert.match(source, /DEFAULT_IMAGE_MODEL\s*=\s*["']gemini-3\.1-flash-lite-image["']/);
    assert.match(source, /encodeURIComponent\(state\.imageModel \|\| DEFAULT_IMAGE_MODEL\)/);
  }
  assert.match(singleInfographicSource, /id="singleImageModelSelect"/);
  assert.match(infographicSource, /id="imageModelSelect"/);
  assert.doesNotMatch(singleInfographicSource, /gemini-2\.5-flash-image-preview:generateContent/);
});

test('both infographic apps can load account-visible Nano Banana models from AI Studio', () => {
  assert.match(singleInfographicSource, /id="btnLoadSingleNanoBananaModels"/);
  assert.match(singleInfographicSource, /function listSingleNanoBananaModels\(apiKey\)/);
  assert.match(singleInfographicSource, /function mergeSingleNanoBananaModelOptions\(select, models\)/);
  assert.match(infographicSource, /id="btnLoadNanoBananaModels"/);
  assert.match(infographicSource, /function listNanoBananaModels\(apiKey\)/);
  assert.match(infographicSource, /function mergeNanoBananaModelOptions\(select, models\)/);
  for (const source of [singleInfographicSource, infographicSource]) {
    assert.match(source, /generativelanguage\.googleapis\.com\/v1beta\/models\?/);
    assert.match(source, /nextPageToken/);
    assert.match(source, /supportedGenerationMethods/);
    assert.match(source, /nano\\s\*banana/i);
    assert.match(source, /저장된 Nano Banana 모델/);
  }
});

test('batch prompt settings persist and round-trip through Markdown files', () => {
  assert.match(infographicSource, /id="btnSaveBatchPrompt"/);
  assert.match(infographicSource, /id="btnDownloadBatchPromptMd"/);
  assert.match(infographicSource, /id="btnUploadBatchPromptMd"/);
  assert.match(infographicSource, /id="batchPromptFileInput"[^>]+accept="\.md,\.markdown,text\/markdown,text\/plain"/);
  assert.match(infographicSource, /BATCH_PROMPT_STORAGE_KEY/);
  assert.match(infographicSource, /function downloadBatchPromptMarkdown\(\)/);
  assert.match(infographicSource, /async function importBatchPromptMarkdown\(event\)/);
  assert.match(infographicSource, /MDPro 인포그래픽 일괄 생성 프롬프트/);
});

test('batch extraction displays complete slide text without nested result scrolling', () => {
  assert.match(infographicSource, /id="parsedResultsPanel"[^>]+min-h-\[calc\(100vh-100px\)\]/);
  assert.doesNotMatch(infographicSource, /id="parsedResultsPanel"[^>]+gap-4 h-\[calc\(100vh-100px\)\]/);
  assert.doesNotMatch(infographicSource, /id="parsedListContainer"[^>]+overflow-y-auto/);
  assert.match(infographicSource, /class="parsed-content-textarea[^>]+data-content-kind="instruction"/);
  assert.match(infographicSource, /class="parsed-content-textarea[^>]+data-content-kind="body"/);
  assert.match(infographicSource, /function expandParsedTextarea\(textarea\)/);
  assert.match(infographicSource, /textarea\.style\.height = `\$\{textarea\.scrollHeight\}px`/);
  assert.match(infographicSource, /querySelectorAll\('\.parsed-content-textarea'\)\.forEach\(bindExpandingParsedTextarea\)/);
});

test('batch extraction excludes annotation-only sections from images and restores them in markdown', () => {
  assert.match(infographicSource, /annotationContent:\s*""/);
  assert.match(infographicSource, /const ANNOTATION_TITLE_PATTERN/);
  assert.match(infographicSource, /function isAnnotationOnlyTitle\(value\)/);
  assert.match(infographicSource, /function splitTrailingAnnotationSection\(source\)/);
  assert.match(infographicSource, /if \(titleMatch && isAnnotationOnlyTitle\(slideTitle\)\)/);
  assert.match(infographicSource, /appendAnnotationContent\(chunk\)/);
  assert.match(infographicSource, /주석\/출처는 생성에서 제외하고 최종 문서에 보관합니다/);
  assert.match(infographicSource, /finalDoc \+= `\$\{state\.annotationContent\.trim\(\)\}\\n`/);
});

test('infographic panel has explicit viewport bounds independent of generated utility classes', () => {
  assert.match(indexSource, /#infographic-auto-panel\s*\{[\s\S]*?position:\s*fixed;/);
  assert.match(indexSource, /#infographic-auto-panel\s*\{[\s\S]*?top:\s*max\(12px, env\(safe-area-inset-top\)\);/);
  assert.match(indexSource, /#infographic-auto-panel\s*\{[\s\S]*?right:\s*max\(12px, env\(safe-area-inset-right\)\);/);
  assert.match(indexSource, /#infographic-auto-panel\s*\{[\s\S]*?bottom:\s*max\(12px, env\(safe-area-inset-bottom\)\);/);
  assert.match(indexSource, /#infographic-auto-panel\s*\{[\s\S]*?left:\s*max\(12px, env\(safe-area-inset-left\)\);/);
  assert.match(indexSource, /#infographic-auto-panel\s*\{[\s\S]*?z-index:\s*75;/);
});

test('infographic app receives protected AI Studio and imgBB settings through MDPro', () => {
  assert.match(appSource, /getProtectedAiCredential\('gemini', 'ss_gemini_api_key'\)/);
  assert.match(appSource, /getProtectedAiCredential\('imgbb', 'ss_imgbb_api_key'\)/);
  assert.match(infographicSource, /type: 'infographic-request-context'/);
  assert.match(infographicSource, /data\.type === 'mdpro-infographic-context'/);
  assert.match(infographicSource, /encodeURIComponent\(state\.apiKey\)/);
});

test('infographic app keeps file import and supports local and MDPro markdown export', () => {
  assert.match(infographicSource, /id="fileInput"[^>]+accept="\.txt,\.md,\.docx"/);
  assert.match(infographicSource, /id="btnImportMdproDocument"/);
  assert.match(infographicSource, /id="btnDownloadFinalDoc"/);
  assert.match(infographicSource, /id="btnSendFinalDocToMdpro"/);
  assert.match(infographicSource, /type: 'infographic-export-to-mdpro'/);
  assert.match(appSource, /data\.type === 'infographic-export-to-mdpro'/);
});
