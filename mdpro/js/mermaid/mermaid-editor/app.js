// WebDAV keeps its existing ME availability; ENV messages may explicitly change it.
let mermaidAiFeatureEnabled = true;
const LIGHT_MERMAID_THEME_VARIABLES = {
  fontFamily: '"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo","Segoe UI",sans-serif',
  fontSize: '15px',
  primaryColor: '#ffffff',
  primaryTextColor: '#172033',
  primaryBorderColor: '#cbd5e1',
  lineColor: '#64748b',
  secondaryColor: '#f8fafc',
  tertiaryColor: '#eef6ff',
  background: '#ffffff',
  mainBkg: '#ffffff',
  secondBkg: '#f8fafc',
  tertiaryBkg: '#eef6ff',
  nodeBorder: '#cbd5e1',
  clusterBkg: '#f8fafc',
  clusterBorder: '#d7dee8',
  edgeLabelBackground: '#ffffff',
  textColor: '#172033',
  titleColor: '#0f172a',
  labelTextColor: '#172033',
  actorBkg: '#ffffff',
  actorBorder: '#cbd5e1',
  actorTextColor: '#172033',
  noteBkgColor: '#fff7ed',
  noteTextColor: '#3b2f20',
  noteBorderColor: '#fed7aa'
};

const DARK_MERMAID_THEME_VARIABLES = {
  fontFamily: '"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo","Segoe UI",sans-serif',
  fontSize: '15px',
  primaryColor: '#111827',
  primaryTextColor: '#e5edf7',
  primaryBorderColor: '#475569',
  lineColor: '#94a3b8',
  secondaryColor: '#172033',
  tertiaryColor: '#1e293b',
  background: '#0b1220',
  mainBkg: '#111827',
  secondBkg: '#172033',
  tertiaryBkg: '#1e293b',
  nodeBorder: '#475569',
  clusterBkg: '#0f172a',
  clusterBorder: '#334155',
  edgeLabelBackground: '#111827',
  textColor: '#e5edf7',
  titleColor: '#f8fafc',
  labelTextColor: '#e5edf7',
  actorBkg: '#111827',
  actorBorder: '#475569',
  actorTextColor: '#e5edf7',
  noteBkgColor: '#2d2418',
  noteTextColor: '#fdecc8',
  noteBorderColor: '#92400e'
};

mermaid.initialize({
  startOnLoad: false,
  suppressErrorRendering: true,
  securityLevel: 'loose',
  theme: 'default',
  flowchart: { useMaxWidth: true, htmlLabels: true },
  themeVariables: LIGHT_MERMAID_THEME_VARIABLES
});

const editor = document.getElementById('raw-code-editor');
const renderDiv = document.getElementById('render');
const renderWrapper = document.getElementById('render-wrapper');
const errorDiv = document.getElementById('error');
const editorScaleLabel = document.getElementById('editor-scale-label');
const previewScaleLabel = document.getElementById('preview-scale-label');
const paneDivider = document.getElementById('pane-divider');
const previewPane = document.getElementById('preview-pane');
const editorThemeToggleBtn = document.getElementById('editor-theme-toggle-btn');
const previewThemeToggleBtn = document.getElementById('preview-theme-toggle-btn');
const topBar = document.getElementById('top-bar');
const toolbarCollapseBtn = document.getElementById('toolbar-collapse-btn');
const toolbarFloatBtn = document.getElementById('toolbar-float-btn');
const uiThemeToggleBtn = document.getElementById('ui-theme-toggle-btn');
const toolbarDragHandle = document.getElementById('toolbar-drag-handle');
const exampleSelect = document.getElementById('example-select');
const collapsedExampleSelect = document.getElementById('collapsed-example-select');
const mermaidImageDropzone = document.getElementById('mermaid-image-dropzone');
const mermaidImageFile = document.getElementById('mermaid-image-file');
const mermaidImagePreview = document.getElementById('mermaid-image-preview');
const mermaidImageEmpty = document.getElementById('mermaid-image-empty');
const mermaidImageRemove = document.getElementById('mermaid-image-remove');
const mermaidImagePrompt = document.getElementById('mermaid-image-prompt');
const mermaidReferenceText = document.getElementById('mermaid-reference-text');
const revisionSource = document.getElementById('mermaid-code-revision-source');
const revisionPrompt = document.getElementById('mermaid-code-revision-prompt');
const revisionResult = document.getElementById('mermaid-code-revision-result');
const revisionRun = document.getElementById('mermaid-code-revision-run');
const revisionStop = document.getElementById('mermaid-code-revision-stop');
const revisionApply = document.getElementById('mermaid-code-revision-apply');
const revisionImport = document.getElementById('mermaid-code-import-current');
const revisionStatus = document.getElementById('mermaid-code-revision-status');
let mermaidCodeRevisionActive = false;
let mermaidCodeRevisionContext = null;
let revisionReadyCode = '';
function syncMermaidRevisionControls() {
  const busy = !!mermaidImageRequestId;
  revisionRun.disabled = !mermaidAiFeatureEnabled || busy || !revisionSource.value.trim() || !revisionPrompt.value.trim();
  revisionStop.disabled = !mermaidCodeRevisionActive || !busy;
  revisionImport.disabled = revisionSource.disabled = revisionPrompt.disabled = busy;
  revisionApply.disabled = busy || !revisionReadyCode;
}
revisionSource.addEventListener('input', syncMermaidRevisionControls);
revisionPrompt.addEventListener('input', syncMermaidRevisionControls);
revisionImport.addEventListener('click', function () {
  revisionSource.value = editor.value;
  revisionStatus.textContent = '현재 편집기의 코드를 가져왔습니다. 수정 지시를 입력하세요.';
  syncMermaidRevisionControls(); revisionPrompt.focus();
});
revisionRun.addEventListener('click', function () { requestMermaidFromImage('edit'); });
revisionStop.addEventListener('click', stopMermaidImageRequest);
revisionApply.addEventListener('click', async function () {
  if (!revisionReadyCode || mermaidImageRequestId || !mermaidAiFeatureEnabled) return;
  // The existing editor undo stack is the single source of undo for this application.
  pushEditorUndoState(); editor.value = revisionReadyCode; await render();
  if (errorDiv.style.display === 'block') return;
  saveMermaidHistoryRecord(revisionReadyCode, mermaidCodeRevisionContext);
  revisionStatus.textContent = '수정 결과를 코드 편집기에 적용했습니다. 되돌리기로 이전 코드로 복원할 수 있습니다.';
});

function hasMermaidReference() {
  return !!mermaidReferenceImage || !!mermaidReferenceText.value.trim();
}
function refreshMermaidGenerateButton() {
  mermaidImageGenerate.disabled = !!mermaidImageRequestId || !hasMermaidReference();
  syncMermaidRevisionControls();
}
mermaidReferenceText.addEventListener('input', refreshMermaidGenerateButton);
document.getElementById('mermaid-text-clear').addEventListener('click', function () {
  mermaidReferenceText.value = '';
  refreshMermaidGenerateButton();
  mermaidReferenceText.focus();
});
document.getElementById('mermaid-text-paste').addEventListener('click', async function () {
  try {
    const text = window.parent !== window ? await pasteMermaidTextFromParent() : await navigator.clipboard.readText();
    if (!text) return setMermaidImageStatus('클립보드에 텍스트가 없습니다.', true);
    mermaidReferenceText.setRangeText(text, mermaidReferenceText.selectionStart, mermaidReferenceText.selectionEnd, 'end');
    refreshMermaidGenerateButton();
    mermaidReferenceText.focus();
  } catch (_) {
    mermaidReferenceText.focus();
    setMermaidImageStatus('참고 텍스트 입력란에서 Ctrl+V로 붙여넣어 주세요.', true);
  }
});
const mermaidTextFile = document.getElementById('mermaid-text-file');
function pasteMermaidTextFromParent() {
  const requestId = 'text-paste-' + Date.now();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { window.removeEventListener('message', receive); reject(new Error('클립보드 시간 초과')); }, 15000);
    function receive(event) {
      const data = event.data || {};
      if (event.source !== window.parent || data.type !== 'mdv-mermaid-clipboard-text' || data.requestId !== requestId) return;
      clearTimeout(timer);
      window.removeEventListener('message', receive);
      if (!data.ok) reject(new Error(data.error));
      else resolve(String(data.text || ''));
    }
    window.addEventListener('message', receive);
    window.parent.postMessage({ type: 'mdv-paste-mermaid-text', requestId }, '*');
  });
}
document.getElementById('mermaid-text-import').addEventListener('click', function () { mermaidTextFile.click(); });
mermaidTextFile.addEventListener('change', async function () {
  const file = mermaidTextFile.files[0];
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error('텍스트 파일은 2MB 이하여야 합니다.');
    const text = await file.text();
    mermaidReferenceText.value = text;
    refreshMermaidGenerateButton();
    setMermaidImageStatus('참고 텍스트를 가져왔습니다: ' + file.name);
  } catch (error) { setMermaidImageStatus(error.message, true); }
  finally { mermaidTextFile.value = ''; }
});
document.getElementById('mermaid-text-selection').addEventListener('click', function () {
  if (window.parent === window) return setMermaidImageStatus('문서 창에서 선택한 뒤 가져와 주세요.', true);
  window.parent.postMessage({ type: 'mdv-request-document-selection', target: 'reference-text' }, '*');
});
const mermaidImageGenerate = document.getElementById('mermaid-image-generate');
const mermaidImagePaste = document.getElementById('mermaid-image-paste');
const mermaidImageLarge = document.getElementById('mermaid-image-large');
const referenceDialog = document.getElementById('mermaid-reference-dialog');
const referenceFull = document.getElementById('mermaid-reference-full');
let referenceZoom = 0;
function updateReferenceZoom(value) {
  referenceZoom = value;
  referenceFull.style.width = value ? Math.max(1, referenceFull.naturalWidth * value / 100) + 'px' : '';
  referenceFull.classList.toggle('is-zoomed', value > 0);
  document.getElementById('mermaid-reference-zoom').textContent = value ? value + '%' : '맞춤';
}
mermaidImageLarge.addEventListener('click', function () {
  if (!mermaidReferenceImage) return;
  referenceFull.src = mermaidReferenceImage.dataUrl;
  updateReferenceZoom(0);
  referenceDialog.showModal();
});
document.getElementById('mermaid-reference-close').addEventListener('click', function () { referenceDialog.close(); });
referenceDialog.addEventListener('close', function () { (mermaidImageLarge.disabled ? mermaidImageDropzone : mermaidImageLarge).focus(); });
referenceFull.addEventListener('load', function () { if (referenceZoom) updateReferenceZoom(referenceZoom); });
referenceDialog.querySelectorAll('[data-ref-zoom]').forEach(button => button.addEventListener('click', function () {
  const action = button.dataset.refZoom;
  updateReferenceZoom(action === 'fit' ? 0 : action === '100' ? 100 : Math.max(10, Math.min(400, (referenceZoom || 100) + (action === '+' ? 25 : -25))));
}));
document.getElementById('mermaid-image-select').addEventListener('click', function () { mermaidImageFile.click(); });
let mermaidImageRequestTimer = null;
let mermaidImagePreviousCode = '';
let mermaidMetricsTimer = null;
let mermaidMetricsStarted = 0;
let mermaidMetrics = { outputTokens: 0, reasoningTokens: 0, estimated: true };
function updateMermaidMetrics(metrics) {
  if (metrics) mermaidMetrics = Object.assign({}, mermaidMetrics, metrics);
  const output = document.getElementById('mermaid-image-metrics');
  output.hidden = false;
  const elapsed = (mermaidMetrics.elapsedMs != null ? mermaidMetrics.elapsedMs : Date.now() - mermaidMetricsStarted) / 1000;
  const approx = mermaidMetrics.estimated ? '약 ' : '';
  const reasoningApprox = mermaidMetrics.reasoningEstimated || mermaidMetrics.estimated ? '약 ' : '';
  output.textContent = '경과 ' + Math.max(0, elapsed).toFixed(1) + '초 · 생성 ' + approx + mermaidMetrics.outputTokens + ' tok' + (mermaidMetrics.reasoningTokens ? ' · 추론 ' + reasoningApprox + mermaidMetrics.reasoningTokens + ' tok' : '') + (mermaidMetrics.inputTokens != null ? ' · 입력 ' + mermaidMetrics.inputTokens + ' tok' : '');
}
function finishMermaidMetrics(metrics) {
  clearInterval(mermaidMetricsTimer);
  updateMermaidMetrics(Object.assign({ elapsedMs: Date.now() - mermaidMetricsStarted }, metrics || {}));
}
let mermaidImageProgress = 0;
function setMermaidProgress(percent) {
  mermaidImageProgress = Math.max(mermaidImageProgress, percent);
  document.getElementById('mermaid-image-progress-panel').hidden = false;
  document.getElementById('mermaid-image-progress').value = mermaidImageProgress;
  document.getElementById('mermaid-image-progress-label').textContent = '단계 진행률 ' + mermaidImageProgress + '%';
  if (percent === 100) document.getElementById('mermaid-image-stop').hidden = true;
}
function stopMermaidImageRequest() {
  const id = mermaidImageRequestId;
  mermaidImageRequestId = '';
  clearTimeout(mermaidImageRequestTimer);
  finishMermaidMetrics();
  if (mermaidImageTypingTimer) clearInterval(mermaidImageTypingTimer);
  window.parent.postMessage({ type: 'mdv-cancel-image-to-mermaid', requestId: id }, '*');
  mermaidImageGenerate.disabled = !hasMermaidReference();
  if (!mermaidCodeRevisionActive && !mermaidImageReceivedStream) editor.value = mermaidImagePreviousCode;
  if (mermaidCodeRevisionActive) revisionStatus.textContent = '코드 수정을 중지했습니다. 가져온 코드와 편집기는 유지됩니다.';
  mermaidCodeRevisionActive = false; syncMermaidRevisionControls();
  document.getElementById('mermaid-image-progress-panel').hidden = true;
  setMermaidImageStatus('생성을 중지했습니다. 다시 실행할 수 있습니다.');
}
const mermaidImageStatus = document.getElementById('mermaid-image-status');
const mermaidHistoryPanel = document.getElementById('mermaid-history-panel');
const mermaidHistorySearch = document.getElementById('mermaid-history-search');
const mermaidHistoryList = document.getElementById('mermaid-history-list');
const mermaidAiPanel = document.getElementById('image-to-mermaid');
const mermaidAiCollapseBtn = document.getElementById('mermaid-ai-collapse-btn');
const documentSelectionImportBtn = document.getElementById('document-selection-import-btn');

let renderTimer = null;
let renderSeq = 0;
let currentDirection = 'TD';
let editorScale = 1;
let editorDarkMode = false;
let previewScale = 1;
let previewDarkMode = false;
let flowNodeSeq = 1;
const editorUndoStack = [];
const MAX_EDITOR_UNDO = 300;
let applyingEditorUndo = false;
let mermaidReferenceImage = null;
let mermaidImageRequestId = '';
let mermaidImageStreamText = '';
let mermaidImageReceivedStream = false;
let mermaidImageTypingTimer = null;
let mermaidHistoryRecords = [];
const TOOLBAR_LAYOUT_KEY = 'mdv_mermaid_toolbar_layout_v1';
const MERMAID_AI_COLLAPSED_KEY = 'mdv_mermaid_ai_panel_collapsed_v1';


const MERMAID_UI_THEME_KEY = 'mdv_mermaid_ui_theme_v1';
function applyUiTheme(dark) {
  document.body.classList.toggle('ui-dark', !!dark);
  if (uiThemeToggleBtn) {
    uiThemeToggleBtn.textContent = dark ? 'UI Light' : 'UI Dark';
    uiThemeToggleBtn.setAttribute('aria-pressed', String(!!dark));
  }
}

function toggleUiTheme() {
  const dark = !document.body.classList.contains('ui-dark');
  applyUiTheme(dark);
  try { localStorage.setItem(MERMAID_UI_THEME_KEY, dark ? 'dark' : 'light'); } catch (_) {}
}

function initUiTheme() {
  let saved = '';
  try { saved = localStorage.getItem(MERMAID_UI_THEME_KEY) || ''; } catch (_) {}
  let dark = saved === 'dark';
  if (!saved) {
    try { dark = !!(window.parent && window.parent.document && window.parent.document.documentElement.classList.contains('dark')); }
    catch (_) { dark = false; }
  }
  applyUiTheme(dark);
}

function setDocumentSelectionImportButton(message, isError) {
  if (!documentSelectionImportBtn) return;
  documentSelectionImportBtn.disabled = false;
  documentSelectionImportBtn.textContent = String(message || '선택한 텍스트 가져오기');
  documentSelectionImportBtn.classList.toggle('is-error', !!isError);
  if (message) window.setTimeout(function () {
    documentSelectionImportBtn.textContent = '선택한 텍스트 가져오기';
    documentSelectionImportBtn.classList.remove('is-error');
  }, 1800);
}

function requestSelectedDocumentText() {
  if (!window.parent || window.parent === window) return setDocumentSelectionImportButton('문서 창에서만 사용 가능', true);
  documentSelectionImportBtn.disabled = true;
  documentSelectionImportBtn.textContent = '가져오는 중…';
  window.parent.postMessage({ type: 'mdv-request-document-selection' }, '*');
}

function applyMermaidAiPanelState(collapsed) {
  if (!mermaidAiPanel) return;
  mermaidAiPanel.classList.toggle('ai-collapsed', !!collapsed);
  if (mermaidAiCollapseBtn) {
    mermaidAiCollapseBtn.textContent = collapsed ? '▸ Jena ME 펼치기' : '▾ Jena ME 접기';
    mermaidAiCollapseBtn.title = collapsed ? 'Jena ME 입력 영역 펼치기' : 'Jena ME 입력 영역 접기';
    mermaidAiCollapseBtn.setAttribute('aria-expanded', String(!collapsed));
  }
}

function toggleMermaidAiPanel() {
  const collapsed = !(mermaidAiPanel && mermaidAiPanel.classList.contains('ai-collapsed'));
  applyMermaidAiPanelState(collapsed);
  try { localStorage.setItem(MERMAID_AI_COLLAPSED_KEY, collapsed ? 'true' : 'false'); } catch (error) {}
}

function initMermaidAiPanelState() {
  let collapsed = true;
  try {
    const saved = localStorage.getItem(MERMAID_AI_COLLAPSED_KEY);
    collapsed = saved === null ? true : saved === 'true';
  } catch (error) {}
  applyMermaidAiPanelState(collapsed);
}

function readToolbarLayout() {
  try {
    const saved = localStorage.getItem(TOOLBAR_LAYOUT_KEY);
    return saved ? (JSON.parse(saved) || {}) : { collapsed: true, floating: false };
  } catch (error) { return { collapsed: true, floating: false }; }
}

function saveToolbarLayout() {
  if (!topBar) return;
  const rect = topBar.getBoundingClientRect();
  const value = { collapsed: topBar.classList.contains('toolbar-collapsed'), floating: topBar.classList.contains('toolbar-floating') };
  if (value.floating && !value.collapsed) Object.assign(value, { width: Math.round(rect.width), height: Math.round(rect.height), left: Math.round(rect.left), top: Math.round(rect.top) });
  try { localStorage.setItem(TOOLBAR_LAYOUT_KEY, JSON.stringify(value)); } catch (error) {}
}

function updateToolbarLayoutUI() {
  if (!topBar) return;
  const collapsed = topBar.classList.contains('toolbar-collapsed');
  const floating = topBar.classList.contains('toolbar-floating');
  if (toolbarCollapseBtn) toolbarCollapseBtn.textContent = collapsed ? '메뉴 펼치기' : '메뉴 접기';
  if (toolbarFloatBtn) toolbarFloatBtn.textContent = floating ? '상단 가로형' : '세로 플로팅';
}

function toggleToolbarCollapsed() {
  if (!topBar) return;
  topBar.classList.toggle('toolbar-collapsed');
  updateToolbarLayoutUI();
  saveToolbarLayout();
}

function toggleToolbarFloating() {
  if (!topBar) return;
  const floating = topBar.classList.toggle('toolbar-floating');
  if (!floating) {
    topBar.style.width = '';
    topBar.style.height = '';
    topBar.style.left = '';
    topBar.style.top = '';
  }
  updateToolbarLayoutUI();
  saveToolbarLayout();
}

function initToolbarLayout() {
  if (!topBar) return;
  const saved = readToolbarLayout();
  topBar.classList.toggle('toolbar-collapsed', saved.collapsed === true);
  topBar.classList.toggle('toolbar-floating', saved.floating === true);
  if (saved.floating) {
    if (saved.width) topBar.style.width = Math.max(230, Number(saved.width)) + 'px';
    if (saved.height) topBar.style.height = Math.max(180, Number(saved.height)) + 'px';
    if (Number.isFinite(Number(saved.left))) topBar.style.left = Math.max(0, Number(saved.left)) + 'px';
    if (Number.isFinite(Number(saved.top))) topBar.style.top = Math.max(0, Number(saved.top)) + 'px';
  }
  updateToolbarLayoutUI();
  if (window.ResizeObserver) {
    let resizeTimer = null;
    new ResizeObserver(function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(saveToolbarLayout, 150); }).observe(topBar);
  }
  if (toolbarDragHandle) {
    toolbarDragHandle.addEventListener('mousedown', function (event) {
      if (!topBar.classList.contains('toolbar-floating') || event.button !== 0) return;
      const rect = topBar.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      function move(moveEvent) {
        const maxLeft = Math.max(0, window.innerWidth - topBar.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - 42);
        topBar.style.left = Math.max(0, Math.min(maxLeft, rect.left + moveEvent.clientX - startX)) + 'px';
        topBar.style.top = Math.max(0, Math.min(maxTop, rect.top + moveEvent.clientY - startY)) + 'px';
      }
      function stop() { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop); saveToolbarLayout(); }
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', stop);
      event.preventDefault();
    });
  }
}

function initCollapsedExampleSelect() {
  if (!exampleSelect || !collapsedExampleSelect) return;
  collapsedExampleSelect.replaceChildren(...Array.from(exampleSelect.options).map(function (option) { return option.cloneNode(true); }));
  collapsedExampleSelect.value = exampleSelect.value;
}

function loadTemplateFromCollapsedMenu(type) {
  if (exampleSelect) exampleSelect.value = type;
  loadTemplate(type);
}
const EXAMPLE_LIBRARY = {
  shopping: `%%{init: {"flowchart": {"useMaxWidth": true, "htmlLabels": true}}}%%
flowchart LR
  A[Start] --> B{Decision}
  B -->|Yes| C[Process]
  B -->|No| D[Stop]`,
  'sankey-basic': `sankey-beta
p, a, 60
q, a, 40
a, b, 30
a, c, 30
a, s, 40`,
  'sankey-family': `sankey-beta
\uBD80\uBAA8, \uCCAB\uC9F8, 30
\uBD80\uBAA8, \uB458\uC9F8, 30
\uBD80\uBAA8, \uC14B\uC9F8, 40`,
  'sankey-config': `---
config:
  sankey:
    showValues: false
---
sankey-beta
Website,Sign Up,40
Website,Bounce,60
Sign Up,Free Trial,30
Sign Up,Paid Plan,10
Free Trial,Convert,20
Free Trial,Churn,10`,
  state: `stateDiagram-v2
    [*] --> Idle
    Idle --> Running: start
    Running --> Paused: pause
    Paused --> Running: resume
    Running --> [*]: stop`,
  class: `classDiagram
    class User {
      +String id
      +String name
      +login()
      +logout()
    }
    class Session {
      +String token
      +Date expiresAt
    }
    User "1" -- "many" Session : creates`,
  sequence: `sequenceDiagram
    participant Client
    participant API
    participant DB
    Client->>API: GET /users
    API->>DB: query users
    DB-->>API: rows
    API-->>Client: JSON`,
  kanban:`---
config:
  kanban:
    ticketBaseUrl: https://github.com/mermaid-js/mermaid/issues/#TICKET#
  theme: dark
---
kanban
  Todo
    [Create Documentation]
    docs[Create Blog about the new diagram]
  [In progress]
    id6[Create renderer so that it works in all cases. We also add some extra text here for testing purposes. And some more just for the extra flare.]
  id9[Ready for deploy]
    id8[Design grammar]@{ assigned: 'knsv' }
  id10[Ready for test]
    id4[Create parsing tests]@{ ticket: 2038, assigned: 'K.Sveidqvist', priority: 'High' }
    id66[last item]@{ priority: 'Very Low', assigned: 'knsv' }
  id11[Done]
    id5[define getData]
    id2[Title of diagram is more than 100 chars when user duplicates diagram with 100 char]@{ ticket: 2036, priority: 'Very High'}
    id3[Update DB function]@{ ticket: 2037, assigned: knsv, priority: 'High' }

  id12[Can't reproduce]
    id13[Weird flickering in Firefox]
  `,
  er: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    CUSTOMER }|..|{ DELIVERY_ADDRESS : uses
    PRODUCT ||--o{ LINE_ITEM : includes`,
  journey: `journey
    title Checkout Journey
    section Browse
      User: 4: Visit store
      User: 3: View product
    section Purchase
      User: 3: Add to cart
      User: 2: Checkout
    section Post-purchase
      User: 4: Receive email`,
  mindmap: `mindmap
  root((Project Plan))
    Design
      Wireframes
      Prototypes
      User Research
    Development
      Frontend
      Backend
      Database
    Testing
      Unit Tests
      Integration
      UAT`,
  pie: `pie title Tech Stack Usage
    "JavaScript" : 40
    "TypeScript" : 30
    "Python" : 15
    "Go" : 10
    "Other" : 5`,
  timeline: `timeline
    title Product Launch Timeline
    2024-Q1 : Research
             : User interviews
    2024-Q2 : Design
             : Prototyping
    2024-Q3 : Development
             : Testing
    2024-Q4 : Launch
             : Marketing`,
  quadrant: `quadrantChart
    title Feature Prioritization
    x-axis Low Effort --> High Effort
    y-axis Low Impact --> High Impact
    quadrant-1 Plan
    quadrant-2 Do First
    quadrant-3 Delegate
    quadrant-4 Eliminate
    Auth System: [0.3, 0.9]
    Dark Mode: [0.1, 0.3]
    API v2: [0.8, 0.8]
    Logo Update: [0.2, 0.1]
    Search: [0.6, 0.7]`,
  xychart: `xychart-beta
    title "Monthly Revenue"
    x-axis [Jan, Feb, Mar, Apr, May, Jun]
    y-axis "Revenue (USD)" 0 --> 10000
    bar [5000, 6200, 7800, 5500, 8900, 9200]
    line [5000, 6200, 7800, 5500, 8900, 9200]`,
  block: `block-beta
columns 3
  Frontend:3
  columns 3
  App["Mobile App"] Web["Web App"] API["API Gateway"]
  columns 3
  Auth["Auth Service"] Users["User Service"] Data["Data Service"]
  columns 3
  DB[("Database")]:3`,
  'kanban-advanced': `---
config:
  kanban:
    ticketBaseUrl: 'https://github.com/mermaid-js/mermaid/issues/#TICKET#'
---
kanban
  Todo
    [Create Documentation]
    docs[Create Blog about the new diagram]
  [In progress]
    id6[Create renderer so that it works in all cases. We also add some extra text here for testing purposes. And some more just for the extra flare.]
  id9[Ready for deploy]
    id8[Design grammar]@{ assigned: 'knsv' }
  id10[Ready for test]
    id4[Create parsing tests]@{ ticket: 2038, assigned: 'K.Sveidqvist', priority: 'High' }
    id66[last item]@{ priority: 'Very Low', assigned: 'knsv' }
  id11[Done]
    id5[define getData]
    id2[Title of diagram is more than 100 chars when user duplicates diagram with 100 char]@{ ticket: 2036, priority: 'Very High'}
    id3[Update DB function]@{ ticket: 2037, assigned: knsv, priority: 'High' }
  id12[Can't reproduce]
    id13[Weird flickering in Firefox]`,
  treemap: `treemap-beta
"Section 1"
    "Leaf 1.1": 12
    "Section 1.2"
      "Leaf 1.2.1": 12
"Section 2"
    "Leaf 2.1": 20
    "Leaf 2.2": 25`,
  requirement: `requirementDiagram
    requirement test_req {
    id: 1
    text: the test text.
    risk: high
    verifymethod: test
    }
    element test_entity {
    type: simulation
    }
    test_entity - satisfies -> test_req`,
  gantt: `gantt
    title A Gantt Diagram
    dateFormat  YYYY-MM-DD
    section Section
    A task           :a1, 2014-01-01, 30d
    Another task     :after a1  , 20d
    section Another
    Task in sec      :2014-01-12  , 12d
    another task      : 24d`,
  'architecture-basic': `architecture-beta
    group api(cloud)[API]

    service db(database)[Database] in api
    service disk1(disk)[Storage] in api
    service disk2(disk)[Storage] in api
    service server(server)[Server] in api

    db:L -- R:server
    disk1:T -- B:server
    disk2:T -- B:db`,
  'block-stack': `block-beta
columns 1
  db(("DB"))
  blockArrowId6<["&nbsp;&nbsp;&nbsp;"]>(down)
  block:ID
    A
    B["A wide one in the middle"]
    C
  end
  space
  D
  ID --> D
  C --> D
  style B fill:#969,stroke:#333,stroke-width:4px`,
  'block-columns': `block-beta
  columns 3
  a b c d`,
  'radar-grades': `---
title: "Grades"
---
radar-beta
  axis m["Math"], s["Science"], e["English"]
  axis h["History"], g["Geography"], a["Art"]
  curve a["Alice"]{85, 90, 80, 70, 75, 90}
  curve b["Bob"]{70, 75, 85, 80, 90, 85}
  max 100
  min 0`,
  'radar-restaurant': `radar-beta
  title Restaurant Comparison
  axis food["Food Quality"], service["Service"], price["Price"]
  axis ambiance["Ambiance"]
  curve a["Restaurant A"]{4, 3, 2, 4}
  curve b["Restaurant B"]{3, 4, 3, 3}
  curve c["Restaurant C"]{2, 3, 4, 2}
  curve d["Restaurant D"]{2, 2, 4, 3}
  graticule polygon
  max 5`,
  'venn-team': `venn-beta
  title "Team overlap"
  set Frontend
  set Backend
  union Frontend,Backend["APIs"]`,
  'venn-ab': `venn-beta
  set A["Alpha"]:20
  set B["Beta"]:12
  union A,B["AB"]:3`,
  'venn-nested': `venn-beta
  set A["Frontend"]
    text A1["React"]
    text A2["Design Systems"]
  set B["Backend"]
    text B1["API"]
  union A,B["Shared"]
    text AB1["OpenAPI"]`,
  'venn-styled': `venn-beta
  set A["Alpha"]:20
    text A1["React"]
    text A2["Design Systems"]
  set B["Beta"]:12
  union A,B["AB"]:3
  style A fill:#ff6b6b
  style A,B color:#333
  style A1 color:red`,
  'ishikawa-photo': `ishikawa-beta
    Blurry Photo
    Process
        Out of focus
        Shutter speed too slow
        Protective film not removed
        Beautification filter applied
    User
        Shaky hands
    Equipment
        LENS
            Inappropriate lens
            Damaged lens
            Dirty lens
        SENSOR
            Damaged sensor
            Dirty sensor
    Environment
        Subject moved too quickly
        Too dark`,
  'treeview-basic': `treeView-beta
    "packages"
        "mermaid"
            "src"
        "parser"`,
  'treeview-config': `---
config:
    treeView:
        rowIndent: 80
        lineThickness: 3
    themeVariables:
        treeView:
            labelFontSize: '20px'
            labelColor: '#FF0000'
            lineColor: '#00FF00'
---
treeView-beta
    "packages"
        "mermaid"
            "src"
        "parser"`,
  'gitgraph-basic': `gitGraph:
    commit "Ashish"
    branch newbranch
    checkout newbranch
    commit id:"1111"
    commit tag:"test"
    checkout main
    commit type: HIGHLIGHT
    commit
    merge newbranch
    commit
    branch b2
    commit`,
  'sequence-loop': `sequenceDiagram
    loop Daily query
        Alice->>Bob: Hello Bob, how are you?
        alt is sick
            Bob->>Alice: Not so good :(
        else is well
            Bob->>Alice: Feeling fresh like a daisy
        end
        opt Extra response
            Bob->>Alice: Thanks for asking
        end
    end`,
  'flowchart-lr': `graph LR
    A[Square Rect] -- Link text --> B((Circle))
    A --> C(Round Rect)
    B --> D{Rhombus}
    C --> D`
};

const CONFIG_TEMPLATE_LIBRARY = {
  'theme-default': `%%{init: { "theme": "default" }}%%`,
  'theme-dark': `%%{init: { "theme": "dark" }}%%`,
  'theme-neutral': `%%{init: { "theme": "neutral" }}%%`,
  'theme-forest': `%%{init: { "theme": "forest" }}%%`,
  'theme-base': `%%{init: { "theme": "base" }}%%`,
  'curve-linear': `%%{init: { "flowchart": { "curve": "linear" } }}%%`,
  'curve-basis': `%%{init: { "flowchart": { "curve": "basis" } }}%%`,
  'curve-step': `%%{init: { "flowchart": { "curve": "stepAfter" } }}%%`,
  'spacing-wide': `%%{init: { "flowchart": { "rankSpacing": 80, "nodeSpacing": 80 } }}%%`,
  'html-labels': `%%{init: { "flowchart": { "htmlLabels": true } }}%%`,
  'brand-primary': `%%{init: { "themeVariables": { "primaryColor": "#4f46e5" } }}%%`,
  'brand-line': `%%{init: { "themeVariables": { "lineColor": "#111827" } }}%%`,
  'brand-font-family': `%%{init: { "themeVariables": { "fontFamily": "Pretendard" } }}%%`,
  'brand-font-size': `%%{init: { "themeVariables": { "fontSize": "16px" } }}%%`,
  'brand-cluster': `%%{init: { "themeVariables": { "clusterBkg": "#f0f0f0" } }}%%`,
  'kanban-ticket': `%%{init: { "kanban": { "ticketBaseUrl": "https://github.com/mermaid-js/mermaid/issues/#TICKET#" } }}%%`,
  'sequence-align': `%%{init: { "sequence": { "messageAlign": "center", "mirrorActors": true } }}%%`,
  'gantt-compact': `%%{init: { "gantt": { "displayMode": "compact" } }}%%`,
  'mindmap-width': `%%{init: { "mindmap": { "maxNodeWidth": 200 } }}%%`
};

function openSyntaxTutorial() {
  window.open('https://mermaid.ai/open-source/syntax/flowchart.html', '_blank', 'noopener,noreferrer');
}

function captureEditorState() {
  return {
    value: String(editor.value || ''),
    start: editor.selectionStart || 0,
    end: editor.selectionEnd || 0
  };
}

function pushEditorUndoState() {
  if (applyingEditorUndo) return;
  const state = captureEditorState();
  const last = editorUndoStack[editorUndoStack.length - 1];
  if (last && last.value === state.value && last.start === state.start && last.end === state.end) return;
  editorUndoStack.push(state);
  if (editorUndoStack.length > MAX_EDITOR_UNDO) editorUndoStack.shift();
}

function restoreEditorState(state) {
  if (!state) return;
  applyingEditorUndo = true;
  editor.value = String(state.value || '');
  const end = editor.value.length;
  const s = Math.max(0, Math.min(state.start || 0, end));
  const e = Math.max(0, Math.min(state.end || 0, end));
  editor.focus();
  editor.setSelectionRange(s, e);
  applyingEditorUndo = false;
  render();
}

function undoEditorChange() {
  if (!editorUndoStack.length) return false;
  const prev = editorUndoStack.pop();
  restoreEditorState(prev);
  return true;
}

function splitFrontMatter(text) {
  const src = String(text || '');
  if (!src.startsWith('---')) return null;
  const m = src.match(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(\r?\n|$)/);
  if (!m) return null;
  const front = m[0].trim();
  const body = src.slice(m[0].length);
  return { front, body };
}

function splitInitDirective(text) {
  const src = String(text || '');
  const m = src.match(/^%%\{init:\s*[\s\S]*?\}%%\s*(\r?\n|$)/);
  if (!m) return null;
  const init = m[0].trim();
  const body = src.slice(m[0].length);
  return { init, body };
}

function insertConfigTemplate(templateKey) {
  const key = String(templateKey || '').trim();
  if (!key || !CONFIG_TEMPLATE_LIBRARY[key]) return;
  const cfg = String(CONFIG_TEMPLATE_LIBRARY[key] || '').trim();
  if (!cfg) return;

  const current = String(editor.value || '');
  const initParsed = splitInitDirective(current);
  const parsed = splitFrontMatter(current);
  pushEditorUndoState();
  if (initParsed) {
    editor.value = cfg + '\n' + String(initParsed.body || '').replace(/^\s+/, '');
  } else if (parsed) {
    editor.value = cfg + '\n' + String(parsed.body || '').replace(/^\s+/, '');
  } else {
    editor.value = cfg + '\n' + current.replace(/^\s+/, '');
  }
  render();
}

function insertConfigTemplateFromSelect() {
  const sel = document.getElementById('config-template-select');
  if (!sel) return;
  const key = String(sel.value || '').trim();
  if (!key) return;
  insertConfigTemplate(key);
}
// Initial template
editor.value = EXAMPLE_LIBRARY.shopping;

function setDirection(dir) {
  currentDirection = dir;
  document.getElementById('dir-TD').classList.toggle('active', dir === 'TD');
  document.getElementById('dir-LR').classList.toggle('active', dir === 'LR');

  const lines = editor.value.split('\n');
  if (lines.length > 0 && /^\s*(flowchart|graph)\s+(TD|LR|TB|BT|RL)/i.test(lines[0])) {
    pushEditorUndoState();
    lines[0] = lines[0].replace(/\b(TD|LR|TB|BT|RL)\b/i, dir);
    editor.value = lines.join('\n');
    render();
  }
}

function debounceRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 300);
}

function applyEditorScale() {
  editor.style.fontSize = `${Math.round(14 * editorScale)}px`;
  if (editorScaleLabel) editorScaleLabel.textContent = `${Math.round(editorScale * 100)}%`;
}
// code editor and preview pane
function adjustEditorScale(delta) {
  editorScale = Math.max(0.7, Math.min(2.2, editorScale + delta));
  applyEditorScale();
}

function resetEditorScale() {
  editorScale = 1;
  applyEditorScale();
}

function applyEditorThemeUI() {
  if (!editorThemeToggleBtn) return;
  editorThemeToggleBtn.textContent = editorDarkMode ? 'Light' : 'Dark';
  editor.classList.toggle('editor-dark', editorDarkMode);
}

function toggleEditorTheme() {
  editorDarkMode = !editorDarkMode;
  applyEditorThemeUI();
}

function applyPreviewScale() {
  renderDiv.style.transform = `scale(${previewScale})`;
  if (previewScaleLabel) previewScaleLabel.textContent = `${Math.round(previewScale * 100)}%`;
}

function adjustPreviewScale(delta) {
  previewScale = Math.max(0.4, Math.min(2.5, previewScale + delta));
  applyPreviewScale();
}

function resetPreviewScale() {
  previewScale = 1;
  applyPreviewScale();
}

function initPreviewWheelZoom() {
  if (!renderWrapper) return;
  renderWrapper.addEventListener('wheel', function (e) {
    if (!e.deltaY) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    adjustPreviewScale(delta);
  }, { passive: false });
}

function applyPreviewThemeUI() {
  if (previewPane) previewPane.classList.toggle('preview-dark', previewDarkMode);
  if (previewThemeToggleBtn) previewThemeToggleBtn.textContent = previewDarkMode ? 'Light' : 'Dark';
}

function applyMermaidPreviewTheme() {
  mermaid.initialize({
    startOnLoad: false,
    suppressErrorRendering: true,
    securityLevel: 'loose',
    theme: previewDarkMode ? 'dark' : 'default',
    flowchart: { useMaxWidth: true, htmlLabels: true },
    themeVariables: previewDarkMode ? DARK_MERMAID_THEME_VARIABLES : LIGHT_MERMAID_THEME_VARIABLES
  });
}

function togglePreviewTheme() {
  previewDarkMode = !previewDarkMode;
  applyPreviewThemeUI();
  render();
}

function getMermaidErrorMessage(err, fallback) {
  const raw = err && (err.str || err.message || err.msg || err.description || err.error);
  const text = String(raw || fallback || '').trim();
  return text || 'Unknown Mermaid error';
}

function extractSvgErrorText(svg) {
  try {
    const src = String(svg || '');
    const m = src.match(/<text[^>]*>([\s\S]*?)<\/text>/i);
    if (m && m[1]) return m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  } catch (e) {}
  return '';
}

function normalizeMermaidDiagramType(source) {
  const src = String(source || '');
  // Accept both "treeView" and "treeview" and normalize to the beta keyword.
  return src.replace(/(^\s*)(treeview|treeView)(?!-beta)(?=\s|$)/im, '$1treeView-beta');
}

function preprocessMermaidSourceForRender(source) {
  let src = normalizeMermaidDiagramType(source).trim();
  if (!/^sankey-beta\b/i.test(src) &&
      window.MermaidLabelSanitizer &&
      typeof window.MermaidLabelSanitizer.preprocess === 'function') {
    src = window.MermaidLabelSanitizer.preprocess(src);
  }
  if (!/^sankey-beta\b/i.test(src)) return { source: src, labelMap: null };

  const lines = src.split(/\r?\n/);
  const out = [];
  const labelMap = {};
  const reverseMap = {};
  let seq = 0;
  let started = false;

  function isQuoted(value) {
    const v = String(value || '').trim();
    return (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"));
  }
  function unquote(value) {
    const v = String(value || '').trim();
    if (isQuoted(v)) return v.slice(1, -1);
    return v;
  }
  function quoteIfNeeded(value) {
    const v = String(value || '').trim();
    if (!v) return '""';
    if (isQuoted(v)) return v;
    if (/[^\x00-\x7F]/.test(v) || /\s/.test(v) || /[,:;]/.test(v)) return '"' + v.replace(/"/g, '\\"') + '"';
    return v;
  }
  function toAlias(label) {
    const key = String(label || '');
    if (reverseMap[key]) return reverseMap[key];
    const alias = 'kr_node_' + (seq++);
    reverseMap[key] = alias;
    labelMap[alias] = key;
    return alias;
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = String(raw || '').trim();
    if (!started) {
      out.push(raw);
      if (/^sankey-beta\b/i.test(trimmed)) started = true;
      continue;
    }
    if (!trimmed || /^%%/.test(trimmed)) {
      out.push(raw);
      continue;
    }

    const noSemi = trimmed.replace(/;+\s*$/, '');
    const m = noSemi.match(/^(.*?),(.*?),(.*)$/);
    if (!m) {
      out.push(raw);
      continue;
    }
    const fromRaw = unquote(m[1]);
    const toRaw = unquote(m[2]);
    const from = /[^\x00-\x7F]/.test(fromRaw) ? toAlias(fromRaw) : quoteIfNeeded(m[1]);
    const to = /[^\x00-\x7F]/.test(toRaw) ? toAlias(toRaw) : quoteIfNeeded(m[2]);
    const value = String(m[3] || '').trim();
    out.push(from + ', ' + to + ', ' + value);
  }

  return { source: out.join('\n'), labelMap: Object.keys(labelMap).length ? labelMap : null };
}

let autoFixStatusTimer = null;

function setAutoFixButtonStatus(message) {
  const button = document.getElementById('auto-fix-mermaid-btn');
  if (!button) return;
  if (autoFixStatusTimer) clearTimeout(autoFixStatusTimer);
  button.textContent = message;
  autoFixStatusTimer = setTimeout(function () {
    button.textContent = '오류 자동수정';
    autoFixStatusTimer = null;
  }, 1800);
}

async function autoFixMermaidCode() {
  const original = String(editor.value || '');
  let fixed = MermaidAIQuality.normalize(normalizeMermaidDiagramType(original));

  if (window.MermaidLabelSanitizer &&
      typeof window.MermaidLabelSanitizer.preprocess === 'function') {
    fixed = window.MermaidLabelSanitizer.preprocess(fixed);
  } else {
    setAutoFixButtonStatus('수정 기능 로드 실패');
    return;
  }

  if (fixed === original) {
    setAutoFixButtonStatus('수정 사항 없음');
    await render();
    return;
  }

  pushEditorUndoState();
  const selectionStart = editor.selectionStart;
  const selectionEnd = editor.selectionEnd;
  editor.value = fixed;
  editor.setSelectionRange(
    Math.min(selectionStart, fixed.length),
    Math.min(selectionEnd, fixed.length)
  );
  setAutoFixButtonStatus('수정 완료');
  await render();
  editor.focus();
}

function restoreSankeyAliasLabels(labelMap) {
  if (!labelMap || !renderDiv) return;
  const svg = renderDiv.querySelector('svg');
  if (!svg) return;
  const textNodes = svg.querySelectorAll('text, tspan');
  function escapeRegExp(text) {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  for (let i = 0; i < textNodes.length; i++) {
    const el = textNodes[i];
    let next = String(el.textContent || '');
    for (const alias in labelMap) {
      if (!Object.prototype.hasOwnProperty.call(labelMap, alias)) continue;
      next = next.replace(new RegExp('\\b' + escapeRegExp(alias) + '\\b', 'g'), String(labelMap[alias] || ''));
    }
    el.textContent = next;
  }
}

function polishRenderedMermaidSvg() {
  if (!renderDiv) return;
  const svg = renderDiv.querySelector('svg');
  if (!svg || svg.querySelector('style[data-mdv-mermaid-polish="1"]')) return;
  svg.style.display = 'block';
  svg.style.marginLeft = 'auto';
  svg.style.marginRight = 'auto';
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.setAttribute('data-mdv-mermaid-polish', '1');
  style.textContent = [
    // Do not override classDef/linkStyle or add effects absent from the source.
    '.nodeLabel,.edgeLabel{letter-spacing:normal;}'
  ].join('\n');
  svg.insertBefore(style, svg.firstChild);
}

async function render() {
  const snapshot = editor.value;
  const repair = await MermaidAIQuality.repairSyntax(snapshot, source => mermaid.parse(source, { suppressErrors: true }));
  // A user may keep typing while Mermaid's asynchronous parser is running.
  if (editor.value !== snapshot) return;
  if (repair.changed) {
    pushEditorUndoState();
    const start = editor.selectionStart, end = editor.selectionEnd, scroll = editor.scrollTop;
    editor.value = repair.code;
    editor.setSelectionRange(Math.min(start, repair.code.length), Math.min(end, repair.code.length));
    editor.scrollTop = scroll;
    setMermaidImageStatus('라벨 인용부호 오류를 자동으로 수정했습니다.');
  }
  const code = editor.value.trim();
  const prepared = preprocessMermaidSourceForRender(code);
  const renderCode = String(prepared && prepared.source ? prepared.source : code);
  removeMermaidErrorArtifacts();

  if (!code) {
    renderDiv.innerHTML = '';
    showError('\uCF54\uB4DC\uAC00 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.');
    return;
  }

  try {
    applyMermaidPreviewTheme();
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
    renderDiv.innerHTML = '';

    const id = 'mermaid-' + Date.now() + '-' + (++renderSeq);
    const { svg } = await mermaid.render(id, renderCode);

    if (isErrorSvg(svg)) {
      renderDiv.innerHTML = '';
      const svgErr = extractSvgErrorText(svg);
      showError('\uB80C\uB354\uB9C1 \uC624\uB958\n[render] ' + (svgErr || 'Mermaid returned an error SVG.'));
      removeMermaidErrorArtifacts();
      return;
    }

    renderDiv.innerHTML = svg;
    restoreSankeyAliasLabels(prepared && prepared.labelMap ? prepared.labelMap : null);
    polishRenderedMermaidSvg();

    // Safety net: Mermaid may still emit an error-like SVG in some versions.
    const renderedText = (renderDiv.textContent || '').toLowerCase();
    const hasInlineErrorIcon = !!renderDiv.querySelector('.error-icon, g.error-icon');
    if (hasInlineErrorIcon || renderedText.includes('syntax error in text')) {
      renderDiv.innerHTML = '';
      showError('\uB80C\uB354\uB9C1 \uC624\uB958\n[render] Mermaid emitted an inline error marker.');
      removeMermaidErrorArtifacts();
      return;
    }

    applyPreviewScale();
    removeMermaidErrorArtifacts();
  } catch (e) {
    // Fallback path: some Mermaid versions fail in render() but succeed in run().
    try {
      renderDiv.innerHTML = '';
      const block = document.createElement('div');
      block.className = 'mermaid';
      block.textContent = renderCode;
      renderDiv.appendChild(block);
      await mermaid.run({ nodes: [block] });
      const renderedText = (renderDiv.textContent || '').toLowerCase();
      const hasInlineErrorIcon = !!renderDiv.querySelector('.error-icon, g.error-icon, svg[aria-roledescription="error"]');
      if (hasInlineErrorIcon || renderedText.includes('syntax error in text')) {
        throw (e || new Error('Mermaid fallback render failed.'));
      }
      restoreSankeyAliasLabels(prepared && prepared.labelMap ? prepared.labelMap : null);
      polishRenderedMermaidSvg();
      errorDiv.style.display = 'none';
      errorDiv.textContent = '';
      applyPreviewScale();
      removeMermaidErrorArtifacts();
      return;
    } catch (fallbackErr) {
      renderDiv.innerHTML = '';
      const primary = getMermaidErrorMessage(e, '');
      const secondary = getMermaidErrorMessage(fallbackErr, '');
      const detail = secondary || primary || 'Unknown Mermaid error';
      showError('\uB80C\uB354\uB9C1 \uC624\uB958\n[run] ' + detail + (primary && secondary && primary !== secondary ? '\n[render] ' + primary : ''));
      removeMermaidErrorArtifacts();
    }
  }
}

function isErrorSvg(svg) {
  if (!svg) return false;
  const source = String(svg || '');
  const normalized = source.toLowerCase();
  if (normalized.includes('syntax error in text') || normalized.includes('parse error')) return true;

  // Mermaid valid outputs may contain generic "error-icon" class names in defs/styles.
  // Treat as error only when the root SVG (or contained SVG) explicitly marks error role.
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(source, 'image/svg+xml');
    const root = doc && doc.documentElement ? doc.documentElement : null;
    if (!root) return false;
    const role = String(root.getAttribute('aria-roledescription') || '').toLowerCase();
    if (role === 'error') return true;
    const markedErrorSvg = root.querySelector && root.querySelector('svg[aria-roledescription="error"]');
    if (markedErrorSvg) return true;
  } catch (e) {}
  return false;
}

function showError(message) {
  errorDiv.style.display = 'block';
  errorDiv.textContent = message;
}

async function renderWithStartupRecovery() {
  await render();
  if (!errorDiv || errorDiv.style.display !== 'block') return;
  const startupFallback = `%%{init: {"flowchart": {"useMaxWidth": true, "htmlLabels": true}}}%%
flowchart LR
  A[Start] --> B[Process]
  B --> C[End]`;
  editor.value = startupFallback;
  await render();
}

function removeMermaidErrorArtifacts() {
  if (!renderDiv) return;
  try {
    const renderedText = String(renderDiv.textContent || '').toLowerCase();
    const hasErrorSvg = !!renderDiv.querySelector('svg[aria-roledescription="error"], .error-icon, g.error-icon');
    if (hasErrorSvg || renderedText.includes('syntax error in text') || renderedText.includes('mermaid version')) {
      renderDiv.innerHTML = '';
    }
  } catch (e) {}
}

function insertSnippet(type) {
  let snippet = '';
  if (type === 'node') {
    snippet = 'A[\uB178\uB4DC]';
  } else if (type === 'decision') {
    const shapeEl = document.getElementById('node-shape');
    const selectedShape = shapeEl ? shapeEl.value : 'diamond';
    const logicShapes = new Set(['diamond', 'hexagon', 'asymmetric']);
    const shape = logicShapes.has(selectedShape) ? selectedShape : 'diamond';
    const nodeId = 'N' + flowNodeSeq++;
    snippet = buildNodeSyntax(shape, nodeId, '\uC870\uAC74', true);
  } else if (type === 'arrow') {
    snippet = 'A --> B';
  }
  if (!snippet) return;

  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const before = editor.value.slice(0, start);
  const after = editor.value.slice(end);
  const insertText = (before && !before.endsWith('\n') ? '\n' : '') + snippet;
  pushEditorUndoState();
  editor.value = before + insertText + after;
  const caret = (before + insertText).length;
  editor.focus();
  editor.setSelectionRange(caret, caret);
  render();
}

function loadTemplate(type) {
  const key = String(type || '').trim();
  if (!key || !EXAMPLE_LIBRARY[key]) return;
  pushEditorUndoState();
  editor.value = String(EXAMPLE_LIBRARY[key] || '');
  if (collapsedExampleSelect) collapsedExampleSelect.value = key;
  render();
}

function buildNodeSyntax(shape, id, label, includeId) {
  const text = String(label || '\uB178\uB4DC');
  const prefix = includeId ? id : '';
  if (shape === 'round') return `${prefix}(${text})`;
  if (shape === 'stadium') return `${prefix}([${text}])`;
  if (shape === 'subroutine') return `${prefix}[[${text}]]`;
  if (shape === 'diamond') return `${prefix}{${text}}`;
  if (shape === 'hexagon') return `${prefix}{{${text}}}`;
  if (shape === 'asymmetric') return `${prefix}>${text}]`;
  if (shape === 'cylinder') return `${prefix}[(${text})]`;
  if (shape === 'parallelogram') return `${prefix}[/${text}/]`;
  if (shape === 'trapezoid') return `${prefix}[/${text}\\]`;
  if (shape === 'circle') return `${prefix}((${text}))`;
  if (shape === 'double-circle') return `${prefix}(((${text})))`;
  return `${prefix}[${text}]`;
}

function onNodeModeChange(mode) {
  const allEl = document.getElementById('node-mode-all');
  const attrEl = document.getElementById('node-mode-attr');
  if (!allEl || !attrEl) return;
  if (mode === 'all' && allEl.checked) attrEl.checked = false;
  if (mode === 'attr' && attrEl.checked) allEl.checked = false;
  if (!allEl.checked && !attrEl.checked) allEl.checked = true;
}

function onEdgeModeChange(mode) {
  const arrowEl = document.getElementById('edge-mode-arrow');
  const arrowLabelEl = document.getElementById('edge-mode-arrow-label');
  const labelOnlyEl = document.getElementById('edge-mode-label-only');
  if (!arrowEl || !arrowLabelEl || !labelOnlyEl) return;

  if (mode === 'arrow' && arrowEl.checked) {
    arrowLabelEl.checked = false;
    labelOnlyEl.checked = false;
  }
  if (mode === 'arrow-label' && arrowLabelEl.checked) {
    arrowEl.checked = false;
    labelOnlyEl.checked = false;
  }
  if (mode === 'label-only' && labelOnlyEl.checked) {
    arrowEl.checked = false;
    arrowLabelEl.checked = false;
  }
  if (!arrowEl.checked && !arrowLabelEl.checked && !labelOnlyEl.checked) arrowEl.checked = true;
}

function insertNodeByShape(mode) {
  const shapeEl = document.getElementById('node-shape');
  const labelEl = document.getElementById('node-label');
  const allEl = document.getElementById('node-mode-all');
  const attrEl = document.getElementById('node-mode-attr');
  const shape = shapeEl ? shapeEl.value : 'rect';
  let insertMode = mode === 'attr' ? 'attr' : (mode === 'all' ? 'all' : '');
  if (!insertMode) insertMode = attrEl && attrEl.checked ? 'attr' : 'all';
  const includeId = insertMode === 'all';
  if (allEl && attrEl && !allEl.checked && !attrEl.checked) allEl.checked = true;
  const label = labelEl && labelEl.value ? labelEl.value.trim() : '';
  const seq = flowNodeSeq;
  const nodeId = 'N' + seq;
  const nodeSyntax = buildNodeSyntax(shape, nodeId, label || ('Node ' + seq), includeId);
  if (includeId) flowNodeSeq += 1;

  const start = editor.selectionStart;
  const before = editor.value.slice(0, start);
  const insertText = (before && !before.endsWith('\n') ? '\n' : '') + '    ' + nodeSyntax;
  pushEditorUndoState();
  editor.value = before + insertText + editor.value.slice(start);
  const caret = (before + insertText).length;
  editor.focus();
  editor.setSelectionRange(caret, caret);
  render();
}
// mermaid edge valuew
function buildEdgeSyntax(type) {
  const edgeType = String(type || 'solid');
  if (edgeType === 'thick') return 'A ==> B';
  if (edgeType === 'dashed') return 'A -.-> B';
  if (edgeType === 'reverse') return 'A <-- B';
  if (edgeType === 'both') return 'A <--> B';
  if (edgeType === 'circle-end') return 'A --o B';
  if (edgeType === 'circle-both') return 'A o--o B';
  if (edgeType === 'x-end') return 'A --x B';
  if (edgeType === 'x-both') return 'A x--x B';
  if (edgeType === 'normal-link') return 'A --- B';
  if (edgeType === 'thick-link') return 'A === B';
  if (edgeType === 'dashed-link') return 'A -.- B';
  if (edgeType === 'invisible-link') return 'A ~~~ B';
  if (edgeType === 'solid-text-static') return 'A -->|condition| B';
  if (edgeType === 'thick-text-static') return 'A == important ==> B';
  if (edgeType === 'dashed-text-static') return 'A -. note .-> B';
  if (edgeType === 'no-arrow-text') return 'A -- text --- B';
  if (edgeType === 'one-to-many') return 'A --> B & C & D';
  if (edgeType === 'many-to-one') return 'B & C & D --> E';
  if (edgeType === 'chaining') return 'A --> B --> C --> D';
  if (edgeType === 'complex-chaining') return 'A --> B & C --> D';
  return 'A --> B';
}

function insertEdgeByType() {
  const edgeEl = document.getElementById('edge-type');
  const edgeLabelEl = document.getElementById('edge-label');
  const arrowEl = document.getElementById('edge-mode-arrow');
  const arrowLabelEl = document.getElementById('edge-mode-arrow-label');
  const labelOnlyEl = document.getElementById('edge-mode-label-only');
  const edgeTypeRaw = edgeEl ? String(edgeEl.value || '').trim() : '';
  const edgeType = edgeTypeRaw || 'solid';
  const edgeLabel = edgeLabelEl && edgeLabelEl.value ? edgeLabelEl.value.trim() : '';
  const baseSnippet = buildEdgeSyntax(edgeType);
  const dynamicLabelTypes = new Set([
    'solid', 'thick', 'dashed', 'reverse', 'both', 'circle-end', 'circle-both',
    'x-end', 'x-both', 'normal-link', 'thick-link', 'dashed-link'
  ]);
  const parts = baseSnippet.split(' ');
  const arrowToken = parts.length >= 3 ? parts[1] : '-->';
  const mode = labelOnlyEl && labelOnlyEl.checked
    ? 'label-only'
    : (arrowLabelEl && arrowLabelEl.checked ? 'arrow-label' : (arrowEl && arrowEl.checked ? 'arrow' : 'arrow'));
  let snippet = '';
  if (mode === 'label-only') {
    snippet = edgeLabel ? `|${edgeLabel}|` : '|value|';
  } else if (mode === 'arrow-label') {
    if (!dynamicLabelTypes.has(edgeType)) {
      snippet = baseSnippet;
    } else {
      const labelText = edgeLabel || 'value';
      snippet = `A ${arrowToken}|${labelText}| B`;
    }
  } else {
    snippet = baseSnippet;
  }
  if (!snippet) return;

  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const before = editor.value.slice(0, start);
  const after = editor.value.slice(end);
  const insertText = (before && !before.endsWith('\n') ? '\n' : '') + snippet;
  pushEditorUndoState();
  editor.value = before + insertText + after;
  const caret = (before + insertText).length;
  editor.focus();
  editor.setSelectionRange(caret, caret);
  render();
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(editor.value);
    alert('\uCF54\uB4DC\uAC00 \uBCF5\uC0AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.');
  } catch {
    alert('\uBCF5\uC0AC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.');
  }
}

function insertIntoDocument() {
  const code = String(editor.value || '').trim();
  if (!code) {
    alert('\uC0BD\uC785\uD560 \uCF54\uB4DC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.');
    return;
  }
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({
      type: 'mdv-insert-mermaid',
      code: code
    }, '*');
  }
}

function insertIntoDocumentAndClose() {
  const code = String(editor.value || '').trim();
  if (!code) {
    alert('문서에 삽입할 Mermaid 코드가 없습니다.');
    return;
  }
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'mdv-insert-mermaid', code: code, closeEditor: true }, '*');
  }
}

function setMermaidImageStatus(message, isError) {
  if (!mermaidImageStatus) return;
  mermaidImageStatus.textContent = String(message || '');
  mermaidImageStatus.title = String(message || '');
  mermaidImageStatus.classList.toggle('error', !!isError);
}

function clearMermaidReferenceImage() {
  if (mermaidImageRequestId && mermaidImageGenerate.disabled) stopMermaidImageRequest();
  mermaidReferenceImage = null;
  if (mermaidImagePreview) { mermaidImagePreview.hidden = true; mermaidImagePreview.removeAttribute('src'); }
  if (mermaidImageEmpty) mermaidImageEmpty.hidden = false;
  if (mermaidImageRemove) mermaidImageRemove.hidden = true;
  if (mermaidImageGenerate) refreshMermaidGenerateButton();
  mermaidImageLarge.disabled = true;
  document.getElementById('mermaid-image-progress-panel').hidden = true;
  document.getElementById('mermaid-image-metrics').hidden = true;
  if (referenceDialog.open) referenceDialog.close();
  if (mermaidImageFile) mermaidImageFile.value = '';
  setMermaidImageStatus('');
}

function loadMermaidReferenceFile(file) {
  if (mermaidImageRequestId && mermaidImageGenerate.disabled) stopMermaidImageRequest();
  if (!file || !/^image\//i.test(String(file.type || ''))) return setMermaidImageStatus('이미지 파일만 사용할 수 있습니다.', true);
  if (file.size > 20 * 1024 * 1024) return setMermaidImageStatus('이미지는 20MB 이하여야 합니다.', true);
  const reader = new FileReader();
  reader.onload = function () {
    mermaidReferenceImage = { dataUrl: String(reader.result || ''), name: file.name || 'clipboard-image.png', type: file.type || 'image/png', size: file.size || 0 };
    if (mermaidImagePreview) { mermaidImagePreview.src = mermaidReferenceImage.dataUrl; mermaidImagePreview.hidden = false; }
    if (mermaidImageEmpty) mermaidImageEmpty.hidden = true;
    if (mermaidImageRemove) mermaidImageRemove.hidden = false;
    if (mermaidImageGenerate) mermaidImageGenerate.disabled = false;
    mermaidImageLarge.disabled = false;
    setMermaidImageStatus('이미지가 준비되었습니다. 프롬프트를 확인한 뒤 코드를 생성하세요.');
  };
  reader.onerror = function () { setMermaidImageStatus('이미지를 읽지 못했습니다.', true); };
  reader.readAsDataURL(file);
}

function pasteMermaidImageFromParent() {
  const requestId = 'paste-' + Date.now();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { window.removeEventListener('message', receive); reject(new Error('클립보드 읽기 시간이 초과됐습니다. 권한을 확인하거나 Ctrl+V를 사용하세요.')); }, 15000);
    function receive(event) {
      const data = event.data || {};
      if (event.source !== window.parent || data.type !== 'mdv-mermaid-clipboard-image' || data.requestId !== requestId) return;
      clearTimeout(timer); window.removeEventListener('message', receive);
      if (!data.ok) return reject(new Error(data.error || '이미지를 읽지 못했습니다.'));
      const image = data.image || {};
      if (!/^data:image\//i.test(image.dataUrl || '')) return reject(new Error('이미지 데이터가 없습니다.'));
      if (mermaidImageRequestId && mermaidImageGenerate.disabled) stopMermaidImageRequest();
      mermaidReferenceImage = image;
      mermaidImagePreview.src = image.dataUrl; mermaidImagePreview.hidden = false;
      mermaidImageEmpty.hidden = true; mermaidImageRemove.hidden = false;
      mermaidImageGenerate.disabled = false;
      mermaidImageLarge.disabled = false;
      setMermaidImageStatus('클립보드 이미지가 준비되었습니다. Jena ME 실행을 눌러 주세요.');
      resolve();
    }
    window.addEventListener('message', receive);
    window.parent.postMessage({ type: 'mdv-paste-mermaid-image', requestId }, '*');
  });
}

function extractMermaidCodeFromAI(value) {
  const text = String(value || '').trim();
  const fenced = text.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
  return String(fenced ? fenced[1] : text).replace(/^\s*(?:\[ANSWER\]|Mermaid(?:\s+code)?\s*:)\s*/i, '').replace(/\[\/ANSWER\]\s*$/i, '').trim();
}

function extractPartialMermaidCode(value) {
  return String(value || '').replace(/^\s*```(?:mermaid)?\s*/i, '').replace(/^\s*(?:\[ANSWER\]|Mermaid(?:\s+code)?\s*:)\s*/i, '').replace(/```\s*$/i, '').replace(/\[\/ANSWER\]\s*$/i, '');
}

function showStreamingMermaidCode(rawText) {
  const code = extractPartialMermaidCode(rawText);
  if (mermaidCodeRevisionActive) { revisionResult.value = code; revisionResult.scrollTop = revisionResult.scrollHeight; revisionStatus.textContent = '코드 수정 응답 수신 중… ' + code.length + '자'; return; }
  editor.value = code;
  editor.scrollTop = editor.scrollHeight;
  // Incomplete source stays in the editor; render the finished diagram once.
  setMermaidImageStatus('Mermaid 코드를 생성하는 중… ' + code.length + '자');
}

async function finishGeneratedMermaid(code) {
  clearTimeout(renderTimer);
  code = MermaidAIQuality.normalize(code);
  editor.value = code;
  await render();
  if (errorDiv.style.display === 'block' || !renderDiv.querySelector('svg')) {
    document.getElementById('mermaid-image-stop').hidden = true;
    setMermaidImageStatus('응답은 받았지만 Mermaid 구문을 확인해야 합니다. 코드 편집기의 오류를 수정해 주세요.', true);
    return;
  }
  setMermaidProgress(100);
  setMermaidImageStatus('코드 생성을 완료했습니다. 왼쪽 코드를 수정하면 미리보기에 반영됩니다.');
  saveMermaidHistoryRecord(code);
}

function typeMermaidCode(code) {
  if (mermaidImageTypingTimer) clearInterval(mermaidImageTypingTimer);
  let position = 0;
  editor.value = '';
  const step = Math.max(1, Math.ceil(code.length / 90));
  mermaidImageTypingTimer = setInterval(function () {
    position = Math.min(code.length, position + step);
    editor.value = code.slice(0, position);
    editor.scrollTop = editor.scrollHeight;
    setMermaidImageStatus('Mermaid 코드를 표시하는 중… ' + position + ' / ' + code.length + '자');
    if (position >= code.length) {
      clearInterval(mermaidImageTypingTimer);
      mermaidImageTypingTimer = null;
      finishGeneratedMermaid(code);
    }
  }, 18);
}

function saveMermaidHistoryRecord(code, revision) {
  if (!code || !window.parent || window.parent === window) return;
  window.parent.postMessage({
    type: 'mdv-mermaid-history-save',
    record: {
      id: 'mermaid-ref-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      code: String(code), prompt: String(revision ? revision.prompt : mermaidImagePrompt && mermaidImagePrompt.value || ''),
      imageName: revision ? '코드 수정' : String(mermaidReferenceImage && mermaidReferenceImage.name || ''),
      imageDataUrl: revision ? '' : String(mermaidReferenceImage && mermaidReferenceImage.dataUrl || ''), createdAt: Date.now()
    }
  }, '*');
}

function requestMermaidHistory() {
  if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'mdv-mermaid-history-list' }, '*');
}

function toggleMermaidHistory(forceOpen) {
  if (!mermaidHistoryPanel) return;
  const open = forceOpen === true || (forceOpen !== false && mermaidHistoryPanel.hidden);
  mermaidHistoryPanel.hidden = !open;
  if (open) requestMermaidHistory();
}

function renderMermaidHistory() {
  if (!mermaidHistoryList) return;
  const query = String(mermaidHistorySearch && mermaidHistorySearch.value || '').trim().toLowerCase();
  const records = mermaidHistoryRecords.filter(function (item) {
    return !query || [item.code, item.prompt, item.imageName].some(function (value) { return String(value || '').toLowerCase().includes(query); });
  });
  mermaidHistoryList.replaceChildren();
  if (!records.length) {
    const empty = document.createElement('p'); empty.className = 'history-empty'; empty.textContent = query ? '검색 결과가 없습니다.' : '저장된 Mermaid 생성 기록이 없습니다.'; mermaidHistoryList.appendChild(empty); return;
  }
  records.forEach(function (item) {
    const card = document.createElement('article'); card.className = 'history-item';
    const title = document.createElement('h4'); title.textContent = item.imageName || 'Mermaid 다이어그램';
    const time = document.createElement('time'); time.textContent = new Date(Number(item.createdAt) || Date.now()).toLocaleString();
    const prompt = document.createElement('p'); prompt.textContent = String(item.prompt || '').slice(0, 120);
    const code = document.createElement('pre'); code.className = 'history-code'; code.textContent = String(item.code || '');
    const actions = document.createElement('div'); actions.className = 'history-actions';
    const load = document.createElement('button'); load.type = 'button'; load.textContent = '코드 불러오기'; load.addEventListener('click', function () { pushEditorUndoState(); editor.value = String(item.code || ''); render(); toggleMermaidHistory(false); setMermaidImageStatus('inDB 저장 기록을 불러왔습니다.'); });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'danger'; remove.textContent = '삭제'; remove.addEventListener('click', function () { if (confirm('이 Mermaid 저장 기록을 삭제할까요?')) window.parent.postMessage({ type: 'mdv-mermaid-history-delete', id: item.id }, '*'); });
    actions.append(load, remove); card.append(title, time, prompt, code, actions); mermaidHistoryList.appendChild(card);
  });
}

if (mermaidHistorySearch) mermaidHistorySearch.addEventListener('input', renderMermaidHistory);

function requestMermaidFromImage(mode) {
  const editing = mode === 'edit';
  if (!mermaidAiFeatureEnabled || mermaidImageRequestId) return;
  if (!window.parent || window.parent === window) return setMermaidImageStatus('메인 앱의 Mermaid Ref에서 실행해 주세요.', true);
  if (editing ? !revisionSource.value.trim() || !revisionPrompt.value.trim() : !hasMermaidReference() || mermaidImageGenerate.disabled) return;
  const selection = mermaidTaskPicker.selection();
  if (selection.provider && !selection.model && selection.provider !== 'lmstudio') return setMermaidImageStatus('AI 모델을 선택하거나 모델 ID를 입력해 주세요.', true);
  mermaidCodeRevisionActive = editing;
  if (editing) { mermaidCodeRevisionContext = { source: revisionSource.value, prompt: revisionPrompt.value.trim() }; revisionReadyCode = ''; revisionResult.value = ''; revisionStatus.textContent = '코드 수정 요청 중…'; }
  mermaidImageRequestId = 'mermaid-image-' + Date.now();
  syncMermaidRevisionControls();
  mermaidMetricsStarted = Date.now();
  mermaidMetrics = { outputTokens: 0, reasoningTokens: 0, estimated: true };
  clearInterval(mermaidMetricsTimer);
  updateMermaidMetrics();
  mermaidMetricsTimer = setInterval(function () { updateMermaidMetrics(); }, 250);
  mermaidImageProgress = 0;
  document.getElementById('mermaid-image-stop').disabled = false;
  document.getElementById('mermaid-image-stop').hidden = false;
  setMermaidProgress(10);
  mermaidImageStreamText = '';
  mermaidImageReceivedStream = false;
  if (mermaidImageTypingTimer) { clearInterval(mermaidImageTypingTimer); mermaidImageTypingTimer = null; }
  mermaidImagePreviousCode = editor.value;
  if (!editing) { pushEditorUndoState(); editor.value = ''; }
  mermaidImageGenerate.disabled = true;
  errorDiv.style.display = 'none';
  errorDiv.textContent = '';
  setMermaidImageStatus(editing ? 'AI가 가져온 코드를 수정하고 있습니다…' : 'AI가 참고 자료의 구조를 분석하고 있습니다…');
  clearTimeout(mermaidImageRequestTimer);
  mermaidImageRequestTimer = setTimeout(function () {
    window.parent.postMessage({ type: 'mdv-cancel-image-to-mermaid', requestId: mermaidImageRequestId }, '*');
    mermaidImageRequestId = '';
    finishMermaidMetrics();
    mermaidImageGenerate.disabled = !hasMermaidReference();
    document.getElementById('mermaid-image-stop').disabled = true;
    if (!mermaidCodeRevisionActive && !mermaidImageReceivedStream) editor.value = mermaidImagePreviousCode;
    if (mermaidCodeRevisionActive) revisionStatus.textContent = '코드 수정 응답 제한 시간을 초과했습니다.';
    mermaidCodeRevisionActive = false; syncMermaidRevisionControls();
    setMermaidImageStatus('AI 응답 제한 시간을 초과했습니다. 연결과 모델을 확인한 뒤 다시 실행해 주세요.', true);
    mermaidTaskPicker.setConnection('응답 시간 초과 · 재연결 필요', 'failed');
  }, 185000);
  window.parent.postMessage({ type: 'mdv-analyze-image-to-mermaid', requestId: mermaidImageRequestId, mode: editing ? 'edit' : 'reference', sourceCode: editing ? mermaidCodeRevisionContext.source : '', image: editing ? null : mermaidReferenceImage, referenceText: editing ? '' : mermaidReferenceText.value, selection: selection, prompt: editing ? mermaidCodeRevisionContext.prompt : String(mermaidImagePrompt && mermaidImagePrompt.value || '').trim() }, '*');
}

if (mermaidImagePaste) mermaidImagePaste.addEventListener('click', async function (event) {
  event.preventDefault();
  event.stopPropagation();
  mermaidImagePaste.disabled = true;
  try {
    if (window.parent !== window) { await pasteMermaidImageFromParent(); return; }
    if (!navigator.clipboard || !navigator.clipboard.read) throw new Error('이 브라우저에서는 버튼 붙여넣기를 지원하지 않습니다. 업로드 영역에서 Ctrl+V를 사용하세요.');
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find(type => /^image\//i.test(type));
      if (!type) continue;
      const blob = await item.getType(type);
      loadMermaidReferenceFile(new File([blob], 'clipboard-image.' + (type.split('/')[1] || 'png'), { type: type }));
      return;
    }
    throw new Error('클립보드에 이미지가 없습니다. 이미지를 복사한 뒤 다시 눌러 주세요.');
  } catch (error) {
    setMermaidImageStatus(error.name === 'NotAllowedError' ? '클립보드 권한을 허용하거나 업로드 영역에서 Ctrl+V를 사용하세요.' : error.message, true);
  } finally { mermaidImagePaste.disabled = false; }
});
document.getElementById('mermaid-image-stop').addEventListener('click', stopMermaidImageRequest);

async function sendRenderedSvgToImageInsert() {
  await render();
  const svg = renderDiv.querySelector('svg');
  if (!svg) return alert('먼저 Mermaid 코드를 정상적으로 렌더링해 주세요.');
  try {
    await document.fonts.ready;
    const serialized = serializeRenderedSvg(svg);
    const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(serialized)));
    window.parent.postMessage({ type: 'mdv-open-mermaid-svg-in-image-insert', dataUrl: dataUrl, fileName: 'mermaid-diagram-' + Date.now() + '.svg' }, '*');
  } catch (error) {
    console.error('SVG image insert failed:', error);
    alert('SVG 이미지를 만들지 못했습니다: ' + error.message);
  }
}

async function sendRenderedPngToImageInsert() {
  await render();
  const svg = renderDiv.querySelector('svg');
  if (!svg) return alert('먼저 Mermaid 코드를 정상적으로 렌더링해 주세요.');
  try {
    const pngBlob = await createRenderedPngBlob(svg);
    const dataUrl = await blobToDataUrl(pngBlob);
    window.parent.postMessage({
      type: 'mdv-open-mermaid-png-in-image-insert',
      dataUrl: dataUrl,
      fileName: 'mermaid-diagram-' + Date.now() + '.png'
    }, '*');
  } catch (error) {
    console.error('PNG image insert failed:', error);
    alert('PNG 이미지를 만들지 못했습니다.');
  }
}

function getMermaidSvgForConverter() {
  const svg = renderDiv.querySelector('svg');
  if (!svg) return '';
  return serializeRenderedSvg(svg);
}

function openSvgToPngConverterWindow() {
  const converterUrl = new URL('../../../Apps/svg2png/lossless_svg_to_png_converter.html', window.location.href);
  const availableWidth = Number(window.screen && window.screen.availWidth) || 1440;
  const availableHeight = Number(window.screen && window.screen.availHeight) || 900;
  const width = Math.min(1440, Math.max(960, Math.round(availableWidth * 0.82)));
  const height = Math.min(960, Math.max(700, Math.round(availableHeight * 0.86)));
  const left = Math.max(0, Math.round((availableWidth - width) / 2));
  const top = Math.max(0, Math.round((availableHeight - height) / 2));
  const features = [
    'popup=yes',
    'width=' + width,
    'height=' + height,
    'left=' + left,
    'top=' + top,
    'resizable=yes',
    'scrollbars=yes',
    'toolbar=no',
    'menubar=no',
    'location=no',
    'status=no'
  ].join(',');

  // Create the window synchronously from the click so it opens as a popup,
  // then reuse and focus the same independent converter window next time.
  const converterWindow = window.open('', 'mdv_svg_to_png_converter_window', features);
  if (!converterWindow) {
    alert('SVG→PNG 변환기 창을 열지 못했습니다. 팝업 허용 여부를 확인해 주세요.');
    return;
  }
  try {
    if (converterWindow.location.href !== converterUrl.href) converterWindow.location.replace(converterUrl.href);
    if (typeof converterWindow.loadSvgText === 'function') {
      const source = getMermaidSvgForConverter();
      if (source) converterWindow.loadSvgText(source, 'mermaid-diagram.svg');
    }
    converterWindow.focus();
  } catch (error) {
    converterWindow.location.href = converterUrl.href;
  }
}

if (mermaidImageDropzone) {
  mermaidImageDropzone.addEventListener('click', function (event) { if (event.target !== mermaidImageRemove) mermaidImageFile.click(); });
  mermaidImageDropzone.addEventListener('keydown', function (event) { if (event.target === mermaidImageDropzone && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); mermaidImageFile.click(); } });
  mermaidImageDropzone.addEventListener('dragover', function (event) { event.preventDefault(); mermaidImageDropzone.classList.add('dragover'); });
  mermaidImageDropzone.addEventListener('dragleave', function () { mermaidImageDropzone.classList.remove('dragover'); });
  mermaidImageDropzone.addEventListener('drop', function (event) { event.preventDefault(); mermaidImageDropzone.classList.remove('dragover'); loadMermaidReferenceFile(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]); });
}
if (mermaidImageFile) mermaidImageFile.addEventListener('change', function () { loadMermaidReferenceFile(mermaidImageFile.files && mermaidImageFile.files[0]); });
if (mermaidImageRemove) mermaidImageRemove.addEventListener('click', function (event) { event.stopPropagation(); clearMermaidReferenceImage(); });
if (mermaidImageGenerate) mermaidImageGenerate.addEventListener('click', requestMermaidFromImage);
document.addEventListener('paste', function (event) {
  const imageItem = Array.from(event.clipboardData && event.clipboardData.items || []).find(function (item) { return /^image\//i.test(String(item.type || '')); });
  if (imageItem) { event.preventDefault(); loadMermaidReferenceFile(imageItem.getAsFile()); }
});
window.addEventListener('message', async function (event) {
  const data = event && event.data || {};
  if (event.source !== window.parent) return;
  if (data.type === 'mdv-load-document-selection' && event.source === window.parent) {
    if (data.target === 'reference-text') {
      mermaidReferenceText.value = String(data.code || '');
      refreshMermaidGenerateButton();
      mermaidReferenceText.focus();
      setMermaidImageStatus('문서 선택 영역을 참고 텍스트로 가져왔습니다. Jena ME 실행으로 변환하세요.');
      return;
    }
    const selectedCode = extractMermaidCodeFromAI(data.code) || String(data.code || '').trim();
    if (!selectedCode) return;
    pushEditorUndoState();
    editor.value = selectedCode;
    editor.focus();
    editor.setSelectionRange(0, editor.value.length);
    render();
    setDocumentSelectionImportButton('가져오기 완료', false);
    setMermaidImageStatus('문서에서 선택한 영역을 코드 편집기로 가져왔습니다.');
    return;
  }
  if (data.type === 'mdv-document-selection-unavailable' && event.source === window.parent) {
    setDocumentSelectionImportButton('텍스트를 먼저 선택하세요', true);
    setMermaidImageStatus('문서에서 가져올 텍스트를 먼저 선택하세요.', true);
    return;
  }
  if (data.type === 'mdv-mermaid-history-records') {
    mermaidHistoryRecords = Array.isArray(data.records) ? data.records.slice().sort(function (a, b) { return Number(b.createdAt) - Number(a.createdAt); }) : [];
    renderMermaidHistory();
    return;
  }
  if (data.type === 'mdv-mermaid-history-saved') {
    if (data.ok === false) setMermaidImageStatus('코드는 생성했지만 inDB 저장에 실패했습니다: ' + String(data.error || ''), true);
    else setMermaidImageStatus('코드 생성 완료 · inDB에 자동 저장했습니다.');
    if (!mermaidHistoryPanel.hidden) requestMermaidHistory();
    return;
  }
  if (data.type === 'mdv-image-to-mermaid-stream' && data.requestId === mermaidImageRequestId) {
    mermaidImageReceivedStream = true;
    mermaidImageStreamText += String(data.delta || '');
    showStreamingMermaidCode(mermaidImageStreamText);
    return;
  }
  if (data.type === 'mdv-image-to-mermaid-progress' && data.requestId === mermaidImageRequestId) {
    setMermaidProgress(Number(data.percent) || 0);
    return;
  }
  if (data.type === 'mdv-image-to-mermaid-metrics' && data.requestId === mermaidImageRequestId) {
    updateMermaidMetrics(data);
    if (data.reasoningTokens) setMermaidImageStatus(mermaidCodeRevisionActive ? '모델이 코드 수정을 검토하고 있습니다…' : '모델이 이미지 구조를 추론하고 있습니다…');
    return;
  }
  if (data.type !== 'mdv-image-to-mermaid-result' || data.requestId !== mermaidImageRequestId) return;
  const wasRevision = mermaidCodeRevisionActive;
  mermaidCodeRevisionActive = false;
  clearTimeout(mermaidImageRequestTimer);
  mermaidImageRequestId = '';
  finishMermaidMetrics(data.metrics);
  syncMermaidRevisionControls();
  mermaidImageGenerate.disabled = !hasMermaidReference();
  document.getElementById('mermaid-image-stop').disabled = true;
  if (!data.ok) {
    document.getElementById('mermaid-image-stop').hidden = true;
    if (!wasRevision && !mermaidImageReceivedStream) editor.value = mermaidImagePreviousCode;
    if (wasRevision) revisionStatus.textContent = data.error || '코드 수정에 실패했습니다.';
    mermaidTaskPicker.setConnection('요청 실패 · ' + (data.error || '연결 확인 필요'), 'failed');
    return setMermaidImageStatus(data.error || 'Mermaid 코드 생성에 실패했습니다.', true);
  }
  setMermaidProgress(95);
  mermaidTaskPicker.setConnection((data.provider === 'aistudio' ? 'AI Studio' : (data.provider || 'Jena ME')) + ' · 연결됨 · ' + (data.model || ''), 'connected');
  const code = extractMermaidCodeFromAI(data.code);
  if (!code) { if (wasRevision) revisionStatus.textContent = 'AI가 유효한 Mermaid 코드를 반환하지 않았습니다.'; return setMermaidImageStatus('AI가 유효한 Mermaid 코드를 반환하지 않았습니다.', true); }
  if (wasRevision) {
    revisionResult.value = code;
    const context = mermaidCodeRevisionContext;
    try {
      if (!code.trim()) throw new Error('빈 코드가 반환되었습니다.');
      await mermaid.parse(code);
      if (mermaidImageRequestId || context !== mermaidCodeRevisionContext) return;
      revisionReadyCode = code; revisionStatus.textContent = '수정 완료 · 결과를 확인한 뒤 수정 결과 적용을 누르세요.';
      setMermaidProgress(100); setMermaidImageStatus('코드 수정 완료 · 결과를 검토한 뒤 적용하세요.'); syncMermaidRevisionControls();
    } catch (error) { revisionReadyCode = ''; revisionStatus.textContent = '수정 결과 구문 확인 실패: ' + error.message; document.getElementById('mermaid-image-stop').hidden = true; setMermaidImageStatus('수정 결과의 구문을 확인할 수 없어 적용하지 않았습니다.', true); syncMermaidRevisionControls(); }
    return;
  }
  if (mermaidImageReceivedStream) {
    editor.value = code;
    await finishGeneratedMermaid(code);
  } else {
    typeMermaidCode(code);
  }
});

async function downloadSVG() {
  await render();
  const svg = renderDiv.querySelector('svg');
  if (!svg) {
    alert('\uB80C\uB354\uB9C1\uB41C SVG\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.');
    return;
  }
  try {
    await document.fonts.ready;
    const blob = new Blob([serializeRenderedSvg(svg)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'diagram.svg', true);
  } catch (error) {
    console.error('SVG export failed:', error);
    alert('SVG 저장에 실패했습니다: ' + error.message);
  }
}

function triggerDownload(url, fileName, revokeObjectUrl) {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revokeObjectUrl) {
    // Keep the Blob URL alive until the browser has accepted the download.
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
}

function getSvgExportSize(svgEl) {
  const rect = svgEl.getBoundingClientRect();
  const viewBox = svgEl.viewBox && svgEl.viewBox.baseVal;
  let width = viewBox && viewBox.width;
  let height = viewBox && viewBox.height;

  if (!(width > 0)) width = rect.width;
  if (!(height > 0)) height = rect.height;
  if (!(width > 0)) width = 1200;
  if (!(height > 0)) height = 800;

  return { width: Math.ceil(width), height: Math.ceil(height) };
}

// Shared by SVG download, PNG rasterization and both image-insert actions.
function serializeRenderedSvg(svgEl) {
  return window.MermaidEditorExport.serialize(svgEl, previewDarkMode ? '#0b1220' : '#ffffff');
}

async function createRenderedPngBlob(svgEl) {
  let svgUrl = '';
  try {
    const size = getSvgExportSize(svgEl);
    await document.fonts.ready;
    const svgText = serializeRenderedSvg(svgEl);
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    svgUrl = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.decoding = 'async';
    img.src = svgUrl;
    if (typeof img.decode === 'function') await img.decode();
    else await new Promise(function (resolve, reject) { img.onload = resolve; img.onerror = reject; });

    // Use the shared export quality target, with a safe canvas dimension cap.
    const exportScale = Math.min(Math.max(8, window.devicePixelRatio || 1), 8192 / Math.max(size.width, size.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(size.width * exportScale));
    canvas.height = Math.max(1, Math.round(size.height * exportScale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is unavailable.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = previewDarkMode ? '#0b1220' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return await new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('Canvas could not create a PNG Blob.'));
      }, 'image/png');
    });
  } finally {
    if (svgUrl) URL.revokeObjectURL(svgUrl);
  }
}

function blobToDataUrl(blob) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () { resolve(String(reader.result || '')); };
    reader.onerror = function () { reject(reader.error || new Error('Blob data URL conversion failed.')); };
    reader.readAsDataURL(blob);
  });
}

async function downloadPNG() {
  await render();
  const svgEl = renderDiv.querySelector('svg');
  if (!svgEl) {
    alert('\uB80C\uB354\uB9C1\uB41C \uB2E4\uC774\uC5B4\uADF8\uB7A8\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.');
    return;
  }
  try {
    const pngBlob = await createRenderedPngBlob(svgEl);
    triggerDownload(URL.createObjectURL(pngBlob), 'diagram.png', true);
  } catch (error) {
    console.error('PNG export failed:', error);
    alert('PNG \uBCC0\uD658\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.');
  }
}

function getCurrentLineContext(ed) {
  const s = ed.selectionStart;
  const v = ed.value;
  const ls = v.lastIndexOf('\n', s - 1) + 1;
  let le = v.indexOf('\n', s);
  if (le === -1) le = v.length;
  return { ls, le, text: v.substring(ls, le) };
}

function duplicateLine() {
  const ed = editor;
  pushEditorUndoState();
  const s = ed.selectionStart;
  const e = ed.selectionEnd;
  if (s !== e) {
    const sel = ed.value.substring(s, e);
    const insert = '\n' + sel;
    ed.value = ed.value.substring(0, e) + insert + ed.value.substring(e);
    ed.setSelectionRange(e + 1, e + 1 + sel.length);
  } else {
    const c = getCurrentLineContext(ed);
    ed.value = ed.value.substring(0, c.le) + '\n' + c.text + ed.value.substring(c.le);
    const pos = c.le + 1;
    ed.setSelectionRange(pos, pos + c.text.length);
  }
  render();
}

function moveCurrentLine(dir) {
  const ed = editor;
  pushEditorUndoState();
  const v = ed.value;
  const s = ed.selectionStart;
  const e = ed.selectionEnd;
  let blockStart = v.lastIndexOf('\n', s - 1) + 1;
  let blockEnd = v.indexOf('\n', e);
  if (blockEnd === -1) blockEnd = v.length;
  const lines = v.split('\n');
  const startLine = v.substring(0, blockStart).split('\n').length - 1;
  const endLine = v.substring(0, blockEnd).split('\n').length - 1;
  const target = dir < 0 ? startLine - 1 : endLine + 1;
  if (target < 0 || target >= lines.length) return;
  const blockLineCount = endLine - startLine + 1;
  let newStartLine = startLine;

  if (dir < 0) {
    const moved = lines.splice(startLine, endLine - startLine + 1);
    lines.splice(startLine - 1, 0, ...moved);
    newStartLine = startLine - 1;
  } else {
    const moved = lines.splice(startLine, endLine - startLine + 1);
    lines.splice(startLine + 1, 0, ...moved);
    newStartLine = startLine + 1;
  }
  const newEndLine = newStartLine + blockLineCount - 1;
  const newValue = lines.join('\n');
  let newSelStart = 0;
  for (let i = 0; i < newStartLine; i++) newSelStart += lines[i].length + 1;
  let newSelEnd = 0;
  for (let i = 0; i < newEndLine; i++) newSelEnd += lines[i].length + 1;
  newSelEnd += lines[newEndLine].length;

  ed.value = newValue;
  ed.focus();
  ed.setSelectionRange(newSelStart, newSelEnd);
  render();
}

function toggleMermaidComment() {
  const ed = editor;
  pushEditorUndoState();
  const v = ed.value;
  const s = ed.selectionStart;
  const e = ed.selectionEnd;
  const blockStart = v.lastIndexOf('\n', s - 1) + 1;
  let blockEnd = v.indexOf('\n', e);
  if (blockEnd === -1) blockEnd = v.length;

  const block = v.slice(blockStart, blockEnd);
  const lines = block.split('\n');
  const nonEmptyLines = lines.filter(function (line) { return line.trim() !== ''; });
  const allCommented = nonEmptyLines.length > 0 && nonEmptyLines.every(function (line) {
    return /^\s*%%\s?/.test(line);
  });

  const nextLines = lines.map(function (line) {
    if (line.trim() === '') return line;
    if (allCommented) return line.replace(/^(\s*)%%\s?/, '$1');
    return `%% ${line}`;
  });

  const nextBlock = nextLines.join('\n');
  ed.value = v.slice(0, blockStart) + nextBlock + v.slice(blockEnd);
  ed.focus();
  ed.setSelectionRange(blockStart, blockStart + nextBlock.length);
  render();
}

function initPaneDivider() {
  if (!paneDivider) return;
  let dragging = false;
  paneDivider.addEventListener('mousedown', function (e) {
    dragging = true;
    e.preventDefault();
  });
  window.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    const main = document.getElementById('main');
    if (!main) return;
    const rect = main.getBoundingClientRect();
    const stacked = window.getComputedStyle(main).flexDirection === 'column';
    if (stacked) {
      const y = e.clientY - rect.top;
      const min = 180;
      const max = rect.height - 180 - 10;
      const clamped = Math.max(min, Math.min(max, y));
      const percent = (clamped / rect.height) * 100;
      document.documentElement.style.setProperty('--pane-top', percent + '%');
      return;
    }
    const x = e.clientX - rect.left;
    const min = 260;
    const max = rect.width - 260 - 10;
    const clamped = Math.max(min, Math.min(max, x));
    const percent = (clamped / rect.width) * 100;
    document.documentElement.style.setProperty('--pane-left', percent + '%');
  });
  window.addEventListener('mouseup', function () { dragging = false; });
}

function removeEditorMarkdownFences() {
  const original = editor.value;
  const clean = MermaidAIQuality.stripFences(original);
  if (clean === original) return;
  const prefix = original.indexOf(clean);
  const start = editor.selectionStart, end = editor.selectionEnd;
  const direction = editor.selectionDirection;
  editor.value = clean;
  editor.setSelectionRange(Math.max(0, Math.min(clean.length, start - Math.max(0, prefix))), Math.max(0, Math.min(clean.length, end - Math.max(0, prefix))), direction);
}
editor.addEventListener('paste', function (event) {
  if (Array.from(event.clipboardData && event.clipboardData.items || []).some(item => /^image\//i.test(item.type))) return;
  const text = event.clipboardData && event.clipboardData.getData('text/plain');
  if (!text) return;
  const clean = MermaidAIQuality.stripFences(text);
  if (clean === text) return;
  event.preventDefault();
  pushEditorUndoState();
  editor.setRangeText(clean, editor.selectionStart, editor.selectionEnd, 'end');
  editor.dispatchEvent(new Event('input', { bubbles: true }));
});
editor.addEventListener('input', function () { removeEditorMarkdownFences(); debounceRender(); });
editor.addEventListener('beforeinput', function (event) {
  pushEditorUndoState();
  // Handle text insertion rather than physical keys so keyboard layouts agree.
  if (event.defaultPrevented || !event.cancelable || event.isComposing ||
      event.inputType !== 'insertText' || editor.readOnly || editor.disabled) return;
  const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
  if (!Object.prototype.hasOwnProperty.call(pairs, event.data)) return;
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  if (start === end) return;
  const direction = editor.selectionDirection;
  const scrollTop = editor.scrollTop, scrollLeft = editor.scrollLeft;
  event.preventDefault();
  editor.setRangeText(event.data + editor.value.slice(start, end) + pairs[event.data], start, end, 'select');
  editor.setSelectionRange(start + 1, end + 1, direction);
  editor.scrollTop = scrollTop;
  editor.scrollLeft = scrollLeft;
  editor.dispatchEvent(new Event('input', { bubbles: true }));
});

// Shortcut bindings
editor.addEventListener('keydown', function (e) {
  const lines = this.value.split('\n');
  const start = this.selectionStart;
  const beforeCursor = this.value.substring(0, start);
  const lineIdx = beforeCursor.split('\n').length - 1;

  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
    if (undoEditorChange()) {
      e.preventDefault();
      return;
    }
  }

  if ((e.ctrlKey && e.altKey && e.key === 'ArrowDown') || (e.altKey && e.shiftKey && e.key === 'ArrowDown')) {
    e.preventDefault();
    duplicateLine();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === '/' || e.key === '?' || e.code === 'Slash')) {
    e.preventDefault();
    toggleMermaidComment();
    return;
  }

  if (e.altKey && !e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    moveCurrentLine(e.key === 'ArrowUp' ? -1 : 1);
  }
});

initPaneDivider();
initUiTheme();
initToolbarLayout();
initCollapsedExampleSelect();
initMermaidAiPanelState();
initPreviewWheelZoom();
applyEditorThemeUI();
applyEditorScale();
applyPreviewThemeUI();
applyPreviewScale();
renderWithStartupRecovery();

const mermaidTaskPicker = window.mountAITaskPicker(document.getElementById('mermaid-ai-provider-picker'), 'mdv_mermaid_ai_selection_v1');

const mermaidModelSettings = document.getElementById('mermaid-ai-model-settings');
mermaidModelSettings.addEventListener('toggle', function () {
  document.getElementById('mermaid-ai-provider-toggle-btn').setAttribute('aria-expanded', String(mermaidModelSettings.open));
  try { localStorage.setItem('mdv_mermaid_ai_provider_collapsed_v1', String(!mermaidModelSettings.open)); } catch (_) {}
});
try { mermaidModelSettings.open = localStorage.getItem('mdv_mermaid_ai_provider_collapsed_v1') === 'false'; } catch (_) {}
