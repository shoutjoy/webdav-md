# miniPV 왼쪽 사이드바 도킹 기술문서

문서 버전: 1.0  
기준 구현: WebDAV MDPRO (`mdpro`)  
적용 대상: MDPRO, MDPRO 파생 앱, Markdown 편집기, iframe 기반 문서 앱

## 1. 목적

이 문서는 떠 있는 miniPV 패널을 새로 복제하지 않고 기존 왼쪽 사이드바 안으로 이동해 표시하는 기능의 필수 계약을 정의한다.

사용자는 왼쪽 사이드바의 `목차 팝업 열기` 오른쪽에 있는 miniPV 버튼을 눌러 현재 문서 미리보기를 사이드바에서 볼 수 있어야 한다. 버튼을 다시 누르거나 `파일`/`목차` 탭을 선택하면 도킹 전 사이드바 상태가 복원되어야 한다.

핵심 원칙은 다음과 같다.

1. 미리보기 렌더러를 두 개 만들지 않는다.
2. 기존 `#mini-preview-panel` DOM을 도킹 호스트로 이동한다.
3. 도킹 전 활성 탭과 miniPV 열림 상태를 보존한다.
4. 파일, 목차, 검색, 저장소 기능을 삭제하지 않고 일시적으로 숨긴다.
5. 일반 miniPV와 사이드바 miniPV가 동일한 본문, 확대/축소, 렌더링 파이프라인을 사용한다.

## 2. 현재 MDPRO 구현 위치

| 역할 | 파일 | 주요 항목 |
|---|---|---|
| 왼쪽 사이드바 UI | `mdpro/sidebar_left/sidebar-left.js` | `#mdpro-sidebar-minipv-button`, `#sidebar-mini-preview-host` |
| miniPV 상태와 렌더링 | `mdpro/js/UI_PV/minipv.js` | `toggleMiniPreviewSidebarDock`, `undockMiniPreviewFromSidebar` |
| miniPV 원본 마크업 | `mdpro/js/UI_PV/minipv.html` | `#mini-preview-panel`, `#mini-preview-content` |
| 스크립트 캐시 버전 | `mdpro/index.html` | `sidebar-left.js`, `minipv.js` 쿼리 버전 |
| WebDAV iframe 캐시 버전 | `src/components/MdproEditor.jsx` | `sidebarMiniPv` 쿼리 키 |
| 회귀 테스트 | `tests/miniPreviewLayout.test.mjs` | 사이드바 도킹 계약 검사 |

## 3. 필수 DOM 계약

다른 앱에 적용할 때 ID를 바꿀 수 있지만, 아래 역할은 모두 존재해야 한다.

```html
<aside id="sidebar">
  <header>
    <button id="tab-files" type="button">파일</button>
    <button id="tab-toc" type="button">목차</button>
    <button id="toc-popup-button" type="button" title="목차 팝업 열기">목차 팝업</button>
    <button
      id="mdpro-sidebar-minipv-button"
      type="button"
      aria-label="왼쪽 사이드바에서 miniPV 열기"
      aria-pressed="false"
    >miniPV</button>
  </header>

  <div id="file-list"></div>
  <div id="toc-list" hidden></div>
  <div id="sidebar-mini-preview-host" hidden></div>
</aside>

<div id="mini-preview-panel" hidden>
  <div id="mini-preview-header">miniPV 도구</div>
  <div id="mini-preview-content"></div>
</div>
```

필수 조건:

- miniPV 버튼은 목차 팝업 버튼 바로 오른쪽에 배치한다.
- `aria-pressed`는 도킹 상태와 일치해야 한다.
- 도킹 호스트는 사이드바의 남은 높이를 차지할 수 있어야 한다.
- miniPV 패널은 한 개만 존재해야 한다.
- 사이드바가 동적으로 생성되는 앱은 버튼과 호스트를 사이드바 초기화 함수에서 함께 생성한다.

## 4. 상태 모델

권장 상태는 다음과 같다.

```js
let miniPreviewEnabled = false;
let miniPreviewDockedToSidebar = false;
let miniPreviewSidebarPreviousTab = 'files';
let miniPreviewWasEnabledBeforeDock = false;
```

상태 의미:

- `miniPreviewEnabled`: miniPV 렌더링과 표시가 활성화되었는지 나타낸다.
- `miniPreviewDockedToSidebar`: 패널이 플로팅 위치가 아니라 사이드바 호스트에 있는지 나타낸다.
- `miniPreviewSidebarPreviousTab`: 도킹 해제 후 복원할 `files` 또는 `toc` 탭이다.
- `miniPreviewWasEnabledBeforeDock`: 도킹 전 플로팅 miniPV가 열려 있었는지 기록한다.

### 상태 전환표

| 사용자 동작 | 이전 상태 | 결과 |
|---|---|---|
| 사이드바 miniPV 버튼 클릭 | miniPV 닫힘 | miniPV 활성화 후 사이드바 도킹 |
| 사이드바 miniPV 버튼 클릭 | 플로팅 miniPV 열림 | 동일 패널을 사이드바로 이동 |
| 활성 miniPV 버튼 다시 클릭 | 사이드바 도킹 | 이전 탭 복원, 이전 열림 상태 복원 |
| `파일` 또는 `목차` 클릭 | 사이드바 도킹 | 도킹 해제 후 선택한 탭 표시 |
| miniPV `닫기` 클릭 | 사이드바 도킹 | 도킹 해제와 miniPV 비활성화 |
| miniPV `전체` 클릭 | 사이드바 도킹 | 도킹 해제 후 플로팅 전체화면 전환 |

## 5. 도킹 알고리즘

### 5.1 도킹

```js
function dockMiniPreviewToSidebar() {
  const panel = document.getElementById('mini-preview-panel');
  const host = document.getElementById('sidebar-mini-preview-host');
  if (!panel || !host) return false;

  miniPreviewWasEnabledBeforeDock = miniPreviewEnabled;
  miniPreviewSidebarPreviousTab = getActiveSidebarTab();
  miniPreviewDockedToSidebar = true;
  miniPreviewEnabled = true;

  hideSidebarContentsAndRememberState();
  host.hidden = false;
  panel.classList.add('mini-preview-sidebar-docked');
  host.appendChild(panel);
  panel.hidden = false;

  renderMiniPreviewContent();
  updateMiniPreviewButtons();
  return true;
}
```

`appendChild`는 기존 노드를 복사하지 않고 부모만 변경한다. 따라서 이벤트 리스너, 확대/축소 상태, 렌더링 컨텍스트가 유지된다.

### 5.2 도킹 해제

```js
function undockMiniPreviewFromSidebar({ keepEnabled = false } = {}) {
  if (!miniPreviewDockedToSidebar) return false;

  const panel = document.getElementById('mini-preview-panel');
  const host = document.getElementById('sidebar-mini-preview-host');

  miniPreviewDockedToSidebar = false;
  host.hidden = true;
  panel.classList.remove('mini-preview-sidebar-docked');
  document.body.appendChild(panel);

  restoreSidebarContents();
  showSidebarTab(miniPreviewSidebarPreviousTab);

  miniPreviewEnabled = keepEnabled || miniPreviewWasEnabledBeforeDock;
  applyMiniPreviewVisibility();
  updateMiniPreviewButtons();
  return true;
}
```

도킹 해제 시 패널을 `document.body` 또는 앱이 정한 플로팅 레이어로 되돌려야 한다. 복원 위치를 생략하면 이후 위치 계산과 드래그가 사이드바 기준으로 동작할 수 있다.

## 6. 다른 앱에서 사용할 수 있는 어댑터

다음 함수는 앱 고유 ID와 콜백을 주입받아 같은 패턴을 적용하는 최소 어댑터 예제다.

```js
export function createMiniPreviewSidebarDock(options) {
  const {
    panel,
    host,
    button,
    floatingParent = document.body,
    getActiveTab = () => 'files',
    hideSidebarContent,
    restoreSidebarContent,
    render,
    onEnabledChange = () => {},
  } = options;

  if (!panel || !host || !button) {
    throw new Error('miniPV panel, sidebar host, and toggle button are required.');
  }

  let docked = false;
  let previousTab = 'files';

  function updateButton() {
    button.setAttribute('aria-pressed', String(docked));
    button.title = docked
      ? '사이드바 miniPV 닫기'
      : '왼쪽 사이드바에서 miniPV 열기';
  }

  function dock() {
    if (docked) return;
    previousTab = getActiveTab();
    docked = true;
    hideSidebarContent();
    host.hidden = false;
    panel.classList.add('mini-preview-sidebar-docked');
    host.appendChild(panel);
    panel.hidden = false;
    onEnabledChange(true);
    render();
    updateButton();
  }

  function undock({ keepEnabled = false } = {}) {
    if (!docked) return;
    docked = false;
    host.hidden = true;
    panel.classList.remove('mini-preview-sidebar-docked');
    floatingParent.appendChild(panel);
    restoreSidebarContent(previousTab);
    onEnabledChange(keepEnabled);
    panel.hidden = !keepEnabled;
    updateButton();
  }

  function toggle() {
    if (docked) undock();
    else dock();
  }

  button.addEventListener('click', toggle);
  updateButton();

  return {
    dock,
    undock,
    toggle,
    isDocked: () => docked,
  };
}
```

React/Vue/Svelte 앱에서도 핵심은 동일하다. 패널을 조건부로 새로 렌더링하기보다 portal/teleport 대상만 사이드바 호스트와 플로팅 레이어 사이에서 전환하면 렌더러 상태를 유지하기 쉽다.

## 7. 필수 CSS

```css
#sidebar-mini-preview-host:not([hidden]) {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

#mini-preview-panel.mini-preview-sidebar-docked {
  position: relative !important;
  inset: auto !important;
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  max-width: none !important;
  border-width: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  z-index: auto !important;
}

#mini-preview-panel.mini-preview-sidebar-docked .mini-preview-resize-handle {
  display: none !important;
}

#mini-preview-panel.mini-preview-sidebar-docked #mini-preview-header {
  cursor: default;
}

#mini-preview-panel.mini-preview-sidebar-docked #mini-preview-content {
  height: calc(100% - 34px);
  overflow: auto;
}
```

사이드바와 모든 부모 flex 컨테이너에는 필요한 위치에 `min-height: 0`이 있어야 한다. 이 설정이 없으면 miniPV 콘텐츠가 사이드바 높이를 밀어내거나 스크롤 영역이 생기지 않을 수 있다.

## 8. miniPV 렌더러 계약

도킹 기능은 렌더러와 분리되어야 한다. 렌더러는 최소한 다음 API를 제공하는 것이 좋다.

```js
window.MiniPreviewUI = {
  ensure(),
  render(),
  setEnabled(enabled),
  applyVisibility(),
  undockSidebar(options),
};
```

MDPRO 현재 구현은 `window.toggleMiniPreviewSidebarDock()`과 `window.MiniPreviewUI.undockSidebar()`를 공개한다. 다른 앱에서는 전역 함수 대신 ES module export나 앱 서비스 객체를 사용해도 된다.

본문 소스 우선순위는 다음을 권장한다.

1. 현재 활성 편집기의 실시간 값
2. CodeMirror/Monaco 등의 문서 모델 값
3. 마지막으로 저장된 Markdown 상태

도킹 전후에 렌더 소스가 바뀌면 안 된다.

## 9. iframe 또는 호스트 앱 연결

miniPV가 iframe 안에 있고 버튼이 부모 앱에 있을 경우 `postMessage` 브리지를 사용한다.

부모 앱:

```js
iframe.contentWindow.postMessage(
  { type: 'app-toggle-sidebar-minipv' },
  window.location.origin,
);
```

iframe 앱:

```js
window.addEventListener('message', (event) => {
  if (event.source !== window.parent) return;
  if (event.origin !== window.location.origin) return;
  if (event.data?.type === 'app-toggle-sidebar-minipv') {
    window.toggleMiniPreviewSidebarDock?.();
  }
});
```

보안 요구사항:

- `event.source`와 `event.origin`을 모두 검사한다.
- `'*'` 대상 origin을 사용하지 않는다.
- 메시지의 HTML이나 스크립트를 직접 실행하지 않는다.
- 문서 본문은 기존 렌더러의 정화·보안 정책을 그대로 통과시킨다.

## 10. 접근성 계약

- 토글 버튼은 `button` 요소를 사용한다.
- `aria-label`에 위치와 기능을 함께 명시한다.
- `aria-pressed="true"`는 사이드바 도킹 중일 때만 사용한다.
- 키보드로 버튼에 접근하고 Enter/Space로 실행할 수 있어야 한다.
- 도킹 후 콘텐츠가 스크린리더 탐색 순서상 사이드바 안에 위치해야 한다.
- 닫기 후 초점을 miniPV 토글 버튼 또는 이전 탭으로 되돌리는 것을 권장한다.
- 아이콘만 있는 버튼은 `title`만으로 끝내지 말고 `aria-label`도 제공한다.

## 11. 유지해야 하는 기존 기능

다른 앱으로 이식할 때 다음 기능을 삭제하거나 대체하면 안 된다.

- 파일 탭과 파일 목록
- 목차 탭과 제목 이동
- 목차 팝업
- 검색과 저장소 선택
- miniPV 플로팅 열기/닫기
- miniPV 확대/축소
- 편집기 → miniPV 동기화
- miniPV → 편집기 위치 이동
- miniPV 전체화면
- 테마와 Markdown 렌더링 스타일

도킹은 새 표시 위치를 추가하는 기능이며 기존 표시 경로를 제거하는 기능이 아니다.

## 12. 캐시와 배포

정적 파일을 직접 제공하거나 서비스 워커가 있는 앱에서는 구현 후 반드시 캐시 버전을 변경한다.

MDPRO 예:

```html
<script src="./sidebar_left/sidebar-left.js?v=YYYYMMDD-sidebar-minipv-1"></script>
<script src="./js/UI_PV/minipv.js?v=YYYYMMDD-sidebar-dock-1"></script>
```

iframe URL도 브라우저가 오래된 문서를 재사용하지 않도록 별도 버전 키를 갖는 것이 좋다.

```js
const MDPRO_URL = '/mdpro/index.html?sidebarMiniPv=YYYYMMDD-1';
```

배포 후에는 서비스 워커 상태, 실제 제공 포트, iframe URL, 개발 체크아웃과 배포 체크아웃이 같은지 확인한다.

## 13. 테스트 계약

### 13.1 정적·단위 테스트

최소 확인 항목:

- miniPV 버튼이 목차 팝업 버튼 다음에 존재한다.
- `#sidebar-mini-preview-host`가 존재한다.
- 도킹 시 `host.appendChild(panel)`이 실행된다.
- 도킹 클래스가 추가·제거된다.
- `aria-pressed`가 상태와 일치한다.
- `파일`/`목차` 전환 시 `undockSidebar()`가 호출된다.
- 도킹 전 활성 탭과 miniPV 열림 상태가 복원된다.
- 도킹 중 드래그와 리사이즈가 비활성화된다.
- 전체화면 전환 전 도킹이 해제된다.

MDPRO 검증 명령:

```powershell
node --check mdpro\sidebar_left\sidebar-left.js
node --check mdpro\js\UI_PV\minipv.js
node --test tests\miniPreviewLayout.test.mjs tests\sidebarActionButtons.test.mjs tests\webdavMiniPreviewButton.test.mjs
git diff --check
npm run build
```

### 13.2 실제 브라우저 확인

정적 테스트와 빌드 성공만으로 UI 동작이 증명되지는 않는다. 실제 배포와 동일한 URL에서 다음 순서로 확인한다.

1. Markdown 제목, 표, 코드, Mermaid, 수식을 포함한 문서를 연다.
2. 왼쪽 사이드바에서 miniPV 버튼이 목차 팝업 오른쪽에 보이는지 확인한다.
3. 버튼을 클릭한다.
4. 파일/목차 목록 대신 miniPV 본문이 왼쪽 사이드바에 표시되는지 확인한다.
5. 편집기 내용을 수정하고 miniPV가 갱신되는지 확인한다.
6. 확대/축소와 ToC/본문 전환을 확인한다.
7. `파일`을 클릭해 파일 목록이 복원되는지 확인한다.
8. 다시 도킹한 뒤 `목차`를 클릭해 목차가 복원되는지 확인한다.
9. 도킹 중 `전체`를 눌러 플로팅 전체화면으로 정상 전환되는지 확인한다.
10. 새로고침 후 오래된 JS가 아닌 변경된 버전이 로드되는지 확인한다.

## 14. 흔한 실패와 해결법

### 버튼은 보이지만 눌러도 변화가 없음

- inline handler 또는 이벤트 바인딩 시점보다 miniPV 스크립트 로드가 늦을 수 있다.
- `window.toggleMiniPreviewSidebarDock`이 실제로 공개되었는지 확인한다.
- 동적 사이드바를 다시 생성하면서 이벤트가 사라지는지 확인한다.

### miniPV가 잠깐 사이드바에 나타났다가 body로 이동함

- miniPV 초기화 함수가 항상 `document.body.appendChild(panel)`을 실행하는지 확인한다.
- 도킹 중에는 body 재부착을 건너뛰어야 한다.

```js
if (!miniPreviewDockedToSidebar && panel.parentElement !== document.body) {
  document.body.appendChild(panel);
}
```

### 사이드바에서 높이가 0이거나 스크롤이 안 됨

- 도킹 호스트와 부모 flex 컨테이너에 `min-height: 0`을 적용한다.
- 호스트에 `flex: 1`과 `overflow: hidden`을 적용한다.
- 실제 스크롤 요소인 `#mini-preview-content`에 `overflow: auto`를 적용한다.

### 파일/목차로 돌아가면 검색 또는 저장소 탭이 사라짐

- 단순히 모든 요소의 `hidden`을 제거하지 않는다.
- 도킹 전 각 요소의 숨김 상태를 저장하고 정확히 복원한다.

### 플로팅 위치가 깨짐

- 도킹 해제 후 패널을 플로팅 부모로 되돌린 다음 저장된 레이아웃을 적용한다.
- 도킹 중에는 플로팅 레이아웃 계산을 실행하지 않는다.

## 15. 완료 기준

아래 조건을 모두 만족해야 다른 MDPRO 또는 다른 앱에 적용 완료된 것으로 본다.

- 기존 miniPV 패널을 재사용한다.
- 목차 팝업 오른쪽에 접근 가능한 miniPV 버튼이 있다.
- 클릭 시 왼쪽 사이드바가 miniPV 콘텐츠 영역으로 전환된다.
- 파일/목차/검색/저장소 상태가 손실 없이 복원된다.
- 플로팅 miniPV와 도킹 miniPV의 렌더 결과가 같다.
- 캐시 버전을 갱신했다.
- 정적 검사, 단위 테스트, 빌드가 통과했다.
- 실제 브라우저에서 버튼 클릭과 화면 전환을 확인했다.

