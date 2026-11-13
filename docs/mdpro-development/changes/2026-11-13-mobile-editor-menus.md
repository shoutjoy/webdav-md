# 2026-11-13 모바일 편집 메뉴 레이어와 우측 세로 Dock

- 변경 ID: MDPRO-20261113-MOBILE-EDITOR-MENUS
- 원본: C:\CusorApps\WebDav-MD\webdav-md (미커밋)
- 대상: C:\CusorApps\MDPRO\MDproViewer, 문서 사본 미작성·런타임 미이식
- 상태: WebDAV 구현/웹 빌드 완료, Chrome 390px 부분 검증, Viewer frontend/native/설치 미실행

## 요청과 구현

모바일에서 overflow 스크롤 조상에 잘린 편집 메뉴와 하단을 차지하는 Dock을 개선한다. 기존 버튼·ID·onclick·명령·저장 동작을 유지한다. 수식 파싱·typesetting·문서 출력은 변경하지 않는다.

- `mdpro/MobileUI/editor-menus.js`: DOMContentLoaded에서 11개 편집 메뉴를 등록한다. 클래스/hidden/data-docked 변경을 관찰하고 767px 이하의 열린 비도킹 메뉴에 manual Popover를 사용한다. 원래 DOM 위치를 유지하여 기존 outside-click/명령 바인딩을 보존한다. 모바일 닫기 버튼과 Escape를 제공한다. Dock 또는 데스크톱으로 전환하면 top layer를 해제한다. class 변경은 실제 상태가 다를 때만 수행하여 Observer 반복을 막는다.
- `mdpro/MobileUI/editor-menus.css`: 기존 스타일 뒤에서 로드한다. 팝업 좌우 8px, 최대 높이 62dvh, 내부 스크롤, 터치 버튼 44px. 세로 도구막대는 우측 76px 한 줄. TIDY/표/매크로 Dock은 하단 absolute 대신 우측 flex column에 폭 clamp(140px,40vw,200px)로 배치한다. TIDY action-grid를 한 열로 바꾸고 하단 내비게이션·줌바 공간을 확보한다. 표의 큰 그리드는 내부 스크롤을 유지한다.
- `mdpro/index.html`: head 끝에 위 CSS/JS v=20261113-1 추가. 기존 작업의 다른 변경은 보존.
- 기존 컨트롤 목록: 배치, 인쇄불가문자, BI, H, LIST, CODE, ME, 표, 텍스트→표, Link, 이미지, 표지, 매크로, MATH, TIDY, FIND, 각주/ID, userIn, miniPV. 조건부 설정 기능은 기존 조건 유지. 새 숨김 규칙은 모바일 닫기 버튼의 데스크톱 숨김 및 사용자가 선택한 도구 접기에만 적용한다. 기능 삭제/이름 변경 없음.

## 검증

- `node --check mdpro/MobileUI/editor-menus.js`, `node --check mdpro/AI_App/aiChat/ai-chat.js`: 통과.
- `node --test tests/aiJenaUiContract.test.mjs`: 29/29 통과.
- `npm run build`: 통과, 기존 500kB chunk 경고 있음.
- `git diff --check`: 통과.
- 로컬 Chrome http://localhost:5173/mdpro/index.html, 390×844: 실제 MATH 클릭 후 :popover-open, x=8/y=101/폭374px, 5개 수식 기능과 닫기 노출. 증거 `artifacts/mobile-editor-math-390.png`.
- TIDY는 최초 ref 클릭이 후속 스냅샷에서 실패하여 TidyActions.toggleMenu/도킹 API를 직접 실행해 배치 확인. Dock x234/폭156/높이789.8px, top layer 해제. 스크린샷 검토에서 두 열로 남는 실제 tidy-action-grid 선택자를 보완. 증거 `artifacts/mobile-editor-tidy-dock-390.png`.
- 표 open/toggleDock API: popup top layer true/폭374px, Dock x234/폭156px. 1280×900 전환 후 popover 0개/기존 Dock 폭359px 복원.
- 실제 휴대폰 터치·가상 키보드·iOS Safari, 전체 11개 메뉴 기능 실행, 표 삽입/변환 결과, 세로 도구 전환, 매크로 Dock 실제 UI는 미검증. 여러 Dock 동시 사용은 좁은 화면에 문서 공간을 줄일 수 있음. 이미지 넣기 별도 대화상자 Dock은 이번 변경 범위 밖.

## 상대 앱 대응과 Tauri

Viewer `css/table-menu.css`의 동일 floating panel 구조와 `css/tidy-menu-dock.css`의 기존 모바일 하단35vh/260px CSS를 읽어 비교했다. Viewer는 WebDAV의 mobile-ui bottom reservation과 다른 vh 기반 배치를 사용한다. 대상 전체 메뉴/초기화/Popover 지원은 추가 확인 필요. 전체 파일 복사 금지. WebDAV의 JS app.js를 덮어쓰지 말고 Viewer 고유 이벤트/닫기 정책과 대상 11개 ID를 확인해서 별도 adapter를 연결한다.

이식 시 대상 CSS/JS asset을 실제 HTML 로드 순서에 등록하고 기존 mobile 스타일 뒤에 둔다. 웹 화면 검증 후 Docs/mdpro-development/TAURI_BUILD.md에 따라 frontend 자산 포함을 확인한다. 현재 Viewer 원본 미수정이므로 native 빌드/설치 미실행. 빌드 대기 ID는 위 변경 ID와 같다.

## 복사할 구현 명령

```text
C:\CusorApps\MDPRO\MDproViewer에서 AGENTS.md와 WebDAV의 docs/mdpro-development/changes/2026-11-13-mobile-editor-menus.md를 읽고 모바일 편집 메뉴 개선을 대상 구조에 맞춰 이식해줘. 실제 메뉴 ID/초기화/닫기 이벤트와 모바일 하단 예약 변수를 먼저 비교해줘. 원본 전체 파일을 덮어쓰지 말고 Popover top layer·닫기·Escape·모바일 우측 세로 Dock·TIDY 한 열·44px 터치를 필요한 부분에 적응해줘. 390px 메뉴 실제 클릭/내부 스크롤/닫기/도킹/복귀, 1280px 복원, 기존 전체 버튼 보존과 휴대폰 키보드 영향을 검증하고 문서·목록·Tauri 대기를 갱신해줘. Tauri 빌드와 설치는 이번 명령에 포함하지 않으며 미검증을 구분해서 보고해줘.
```

## 후속 수정: 표 크기 입력·모바일 기본 Dock (2026-11-13)

사용자가 첨부한 화면에서 격자가 세로 한 줄로 늘어남을 확인했다. 이전 `#table-menu-body > .grid` 규칙이 10열 표 크기 격자에도 적용된 것이 원인이다. 기존 부분 검증에서는 열 수를 확인하지 못했다. 이 절의 검증이 이전 표 검증을 보완한다.

- `MobileUI/editor-menus.css`: 일반 1열 규칙에서 `#table-insert-grid`를 제외하고 모바일 표 격자는 명시적으로 `repeat(10,minmax(0,1fr))`, gap 2px, 버튼 aspect-ratio 1로 지정한다. 기존 셀은 모두 유지한다. 작은 셀 터치 대신 숫자 입력을 우선 제공한다.
- `js/table-menu-layout.js/init`: 표 크기 라벨 뒤에 `.table-size-inputs` form을 한 번 생성한다. 행/열 각각 required number·inputmode numeric·min1/max10/step1·기본3. 입력 범위는 기존 insertMarkdownTableBySize 제한과 같다. submit은 reportValidity 후 기존 `selectTableInsertSize`를 호출하여 기존 삽입/undo/저장/도킹 유지 경로를 사용한다. 새 저장 설정은 없고 열려 있는 세션 내 입력값은 유지한다.
- `open`: 767px 이하에서는 hidden 해제 후 slot이 없을 때만 toggleDock을 실행하고 sync/focus 후 반환한다. 앱 시작 시 자동으로 패널을 띄우는 것이 아니라 사용자가 표 메뉴를 열 때 기본 도킹한다. Dock 해제로 팝업 전환·닫기·재열기 가능. 768px 이상은 기존 앵커 팝업 유지.
- `index.html`: editor-menus CSS 캐시 v20261113-2, table-menu-layout JS v20261113-mobile-size-1.
- 기존 Jena Table·Dock 해제·닫기·100개 크기 셀·행열 추가삭제·병합 구분자/작업·캡션을 보존했다. 신규 숨김/클리핑 규칙 없음.

### 후속 검증 증거

- Chrome 390×844 실제 표 삽입 버튼 클릭: isDocked true, 격자 10열(각12.5px), 초기 높이42px. 숫자 입력 행4/열2와 표 넣기 버튼 클릭 후 `viewer-edit-ta`에 헤더2개·구분선·본문3행 생성, Dock 유지. `artifacts/mobile-table-size-390.png` 화면도 직접 검토.
- 767px에서 10열·높이55px. 1280px에서 닫은 뒤 재열기: isDocked false, 10열 유지.
- `node --test tests/tableMenuMerge.test.mjs`: 6/6, AI Jena UI 계약29/29, table-menu-layout/ai-chat 문법 검사, npm run build, git diff --check 통과. 기존 chunk 크기 경고 유지.
- 실제 휴대폰 키보드·iOS Safari 미검증. 숫자 입력은 16px로 지정하여 모바일 입력 시 확대 영향을 줄였다. 문서 수식·인쇄·출력 코드 미변경.

### Viewer 대응과 추가 구현 명령

실제 `C:\CusorApps\MDPRO\MDproViewer\js\table-menu-layout.js`의 init/open을 읽었다. 동일 floating panel 생성이 있지만 WebDAV의 anchored dataset 분기와 차이가 있어 전체 파일 복사 금지. Viewer 원본은 미수정. 웹 이식·frontend/native·설치 검증 모두 대기이며 빌드 요청 없음.

```text
C:\CusorApps\MDPRO\MDproViewer에서 AGENTS.md와 이 문서의 후속 수정 절을 읽고 표 크기 격자가 모바일에서도 10열로 표시되게 수정해줘. 기존 모바일 메뉴 adapter 적용 여부를 먼저 확인하고 table-menu-body의 1열 규칙이 크기 격자에 적용되지 않게 해줘. 행/열 1~10 숫자 입력과 기존 삽입 함수로 연결된 표 넣기 버튼을 추가하고 767px 이하에서는 표 메뉴를 열 때 기본 우측 Dock으로 열어줘. Jena Table·Dock 해제·닫기·격자·행열 편집·병합·캡션을 보존하며 전체 파일 덮어쓰기는 하지 마. 390/767px 실제 클릭과 4행2열 삽입 결과, 닫고 재열기, 1280px 기본 팝업을 검증해줘. 문서/목록/Tauri 대기를 갱신하고 이번에는 Tauri 빌드·설치를 실행하지 마.
```

## 후속 수정: 크기 선택·표 편집 접기 (2026-11-13)

- 요청: 모바일 Dock에서 크기 선택과 표 편집을 각각 접어 공간을 확보한다.
- `js/table-menu-layout.js/init`의 `foldSection`: 기존 크기 라벨/입력 form/100개 격자 셀을 `details#table-size-section`으로, 기존 `.table-structure-actions` 전체를 `details#table-edit-section`으로 이동한다. native summary 제목은 각각 `크기 선택`, `표 편집 (표 안에 커서)`이다. 기존 ID·바인딩·병합·행열 편집·캡션과 입력값은 보존한다. 기존 노드를 이동하므로 전체 파일 덮어쓰기나 명령 재구현이 없다.
- 모바일 767px 이하 초기 접힘, 데스크톱 초기 펼침. 열려 있는 앱에서 사용자의 접힘 상태는 유지되며 모바일/데스크톱 경계를 넘으면 해당 화면 기본값으로 재설정한다. localStorage 변경 없음.
- `MobileUI/editor-menus.css`: 44px summary 터치 영역과 키보드 focus outline, 테두리/간격 추가. 접힌 details의 콘텐츠는 native 동작으로 숨겨지고 summary로 다시 접근 가능하다. 기존 기능 삭제 없음. 수식·출력 코드 미변경.
- `index.html`: CSS v20261113-3 / layout JS v20261113-mobile-fold-1로 캐시 갱신.
- 실제 Chrome 390×844에서 표 메뉴 API로 열기: 두 details.open false. 각 summary를 실제 클릭해 true/true 확인, 두 숫자 입력과 10열 격자 유지 확인. 다시 각각 클릭해 접힘 확인, 증거 `artifacts/mobile-table-fold-390.png`. 1280×900 전환 후 true/true 확인. 실제 휴대폰/가상 키보드 미검증.
- 표 편집 회귀6개, JS 문법 검사, npm run build, git diff --check 통과. 기존 chunk 크기 경고 유지. AI Jena 코드 이번 수정 없음.
- Viewer 대상의 이전 확인된 init/표 구조를 기준으로 해당 기존 노드를 대상으로 적응 필요. 이번 추가 접기 UI의 대상 실행은 미검증·미이식. Viewer frontend/native/설치 미실행, Tauri 대기 ID 동일.

```text
C:\CusorApps\MDPRO\MDproViewer에서 AGENTS.md와 이 문서의 '크기 선택·표 편집 접기' 절을 읽고 모바일 표 Dock의 두 영역을 독립 details/summary로 접히게 해줘. 기존 숫자 입력/10열 격자 이식 상태를 먼저 확인하고 기존 노드와 ID·이벤트를 유지해줘. 모바일 초기 접힘·데스크톱 펼침·44px summary 터치·키보드 토글을 적용해줘. 실제 390px에서 각각 열기/닫기와 모든 기존 기능 도달, 1280px 전환을 검증하고 문서/색인/Tauri 대기를 갱신해줘. 전체 파일 복사, Tauri 빌드·설치는 하지 마.
```

## 후속 수정: Mermaid Ref 모바일 압축·기본 도킹 (2026-11-13)

- 요청: `이미지 → Mermaid Ref` 제목을 `Mermaid Ref`로 변경, 모바일 내부 버튼 축소, 우측 Dock 최소 너비 축소, 모바일 기본 도킹.
- `mdpro/index.html`: 제목 변경. app.js mobileMermaid=20261113-1, iframe mobileCompact=20261113-1, editor-menus.css v20261113-4 캐시 갱신.
- `mdpro/js/app.js/openMermaidEditorModal`: 767px 이하에서 열 때 applyMermaidEditorDockRight(true) 호출. Dock 해제·전체화면·닫기 기능은 유지. 앱 실행 시 강제 오픈하지 않음.
- `syncMermaidEditorDockLayout`: 모바일 최소160px(극소 화면은 작업공간 절반), 최대 작업공간 폭-120px, 기본 절반. 데스크톱 최소280px 유지. 기존 왼쪽 resize handle/키보드 ArrowRight로 좁히기 가능. 동기화 시 minWidth/left:auto/right:0를 갱신하여 리사이즈 후 우측 경계에 유지한다. 저장 설정 변경 없음.
- `MobileUI/editor-menus.css`: 모바일 host 제목12px/버튼10px·30px 높이, 헤더 간격 축소, 왼쪽 경계 터치 폭12px 유지. Dock 하단 내비게이션/줌바 예약 padding과 iframe min-height0/flex1 적용.
- `js/mermaid/mermaid-editor/style.css`: iframe viewport 767px 이하의 top-bar·툴바·탭·코드 제목 도구·줌 버튼을 높이30px·글자10~11px·간격4px로 축소. Jena ME 접기 버튼도30px. 입력 필드/AI 설정/모든 기존 도구와 ID는 보존. 좁은 desktop Dock iframe에도 압축 규칙 적용됨.
- `js/mermaid/mermaid-editor/index.html`: CSS mobileCompact 캐시 키 추가. 기존 테스트가 CSS 첫 query 키 v를 요구하여 초기 실패 후 query 순서를 v 먼저로 정리, 재검사 통과.
- 문서 렌더러/수식/인쇄/내보내기 파이프라인은 변경하지 않았다. SVG/PNG/코드 문서삽입, 테마, 메뉴 펼치기, 코드 편집/미리보기/함께보기, 선택텍스트 가져오기, 줌/Reset 컨트롤 유지.

### 검증과 대상 적응

Chrome 390×844에서 openMermaidEditorModal 실행 시 기본 Dock true/내부폭193px. iframe topbar/줌 버튼 실제 높이30px, 내부 scrollWidth=viewport=193px로 가로 넘침 없음. 왼쪽 separator focus 후 ArrowRight 2회로 패널 폭160px, right390/x230 확인. 증거 `artifacts/mobile-mermaid-ref-compact-390.png` 직접 검토. 휴대폰 터치 드래그·iOS/키보드 및 실제 SVG/PNG 생성 미검증. 최소 폭에서는 라벨이 여러 줄로 표시되므로 필요시 Dock을 넓히거나 전체화면 사용 가능.

AI Jena UI29+Mermaid collapse/bridge7=36개 통과, app.js/ai-chat 문법 검사·웹 빌드 통과. 기존 chunk 경고 유지. git diff --check 초기 CRLF 혼합 경고 후 LF 정리하여 통과. 후속 하단 여백 CSS는 실화면 재검증하지 않음.

실제 Viewer `C:\CusorApps\MDPRO\MDproViewer\js\app.js`에서 openMermaidEditorModal과 Dock 최소280 상수를 읽어 대응 확인. 대상 초기화/iframe CSS와 독립 구현을 보존하면서 해당 함수만 적응 필요. Viewer 미이식·frontend/native/설치 미실행. Tauri 대기 ID 동일.

```text
C:\CusorApps\MDPRO\MDproViewer에서 AGENTS.md와 이 문서의 Mermaid Ref 모바일 압축 절을 읽고 제목 Mermaid Ref, 모바일 열 때 기본 우측 Dock, 최소160px까지 축소, iframe 내부 topbar/코드 도구/줌 버튼30px 압축을 구현해줘. 대상의 기존 함수·브리지·CSS를 비교하고 전체 파일 복사 없이 필요한 부분만 적응해줘. 기존 메뉴 펼치기·삽입·SVG/PNG·테마·탭·줌/Reset·AI 설정 기능을 보존하고 390px 기본 도킹/경계 축소/내부 가로넘침/하단 내비 여백, 데스크톱280px 최소 유지·도킹해제·전체화면을 검증해줘. 문서·색인·Tauri 대기를 갱신하되 Tauri 빌드와 설치는 실행하지 마.
```

## 후속 수정: 샘플 선택 압축·모바일 전체화면 (2026-11-13)

- `js/mermaid/mermaid-editor/style.css`: 모바일 #collapsed-example-select/#example-select/#config-template-select 높이30px·글자12px·작은 padding. 접힌 메뉴의 샘플 선택은 flex 0 1 145px로 이전 전체 줄 점유를 해제한다. 기존 option/선택/템플릿 로딩 이벤트 전부 유지. preview-pane 버튼도30px로 보완.
- `MobileUI/editor-menus.css`: 모바일 fullscreen 패널은 fixed inset0/width100%/height100dvh/min-width0/min-height0/max100%로 기존760px 제한을 해제한다. safe-area padding, 헤더 고정 공간, iframe flex가 연결된다. fullscreen modal z-index200으로 모바일 내비게이션 위에서 조작 가능. Dock 상태의 하단 예약 padding은 fullscreen에는 적용하지 않는다.
- `js/app.js/toggleMermaidEditorFullscreen`: 버튼 `원래 크기`/`전체화면`과 aria-pressed 갱신. 모바일 fullscreen 종료 시 applyMermaidEditorDockRight(true)로 복귀한다. applyMermaidEditorDockRight도 fullscreen 버튼 상태를 초기화한다. desktop 기존 창 복귀 정책 유지.
- `index.html`: 기존 fullscreen 버튼에 id=mermaid-editor-fullscreen-btn/aria-pressed 추가, 이벤트 보존. app mobileMermaid2/iframe mobileCompact2/CSS v20261113-5로 캐시 갱신. iframe index CSS도 mobileCompact2.
- Chrome 390×844: 최초 전체화면 실제 클릭은 초기 sidebar overlay에 가려 실패. 별도 세션에서 open/fullscreen API로 진입, rect x0/y0/390×844/minWidth0 확인, screenshot `artifacts/mobile-mermaid-fullscreen-390.png` 직접 검토하여 작은 샘플 선택과 헤더/본문 화면 내 배치 확인. iframe 가로폭388/scrollWidth388. 실제 `원래 크기` 버튼 클릭 후 dock true/full false 확인. 샘플 select 치수 조회는 iframe 로드 전이라 미측정, 화면으로만 확인. 실제 휴대폰 native 선택 목록/가상 키보드/회전 미검증.
- Mermaid collapse/bridge7개·app/ai-chat 문법·웹 빌드·git diff --check 통과, 기존 chunk 경고 유지. 렌더링/인쇄/수식/문서 출력 코드 미변경.
- Viewer의 이전 확인된 modal/동일Dock 코드를 기준으로 적응 필요. 이번 fullscreen 함수·CSS의 대상 검증/이식은 미실행. Tauri frontend/native/설치 대기, 이번 빌드 요청 없음.

```text
C:\CusorApps\MDPRO\MDproViewer에서 AGENTS.md와 이 문서의 샘플 선택 압축·모바일 전체화면 절을 읽고 대상 구조에 맞춰 구현해줘. 샘플 select의 모든 옵션/이벤트는 보존하면서 모바일30px/145px 선택창으로 줄이고, fullscreen의 기존 최소760px 제한을 모바일에서 풀어 safe-area와100dvh에 맞춰줘. 전체화면 버튼의 원래 크기/aria-pressed 상태와 모바일 Dock 복귀를 연결해줘. 기존 독립 코드를 전체 복사하지 말고 390px 전체화면 경계/헤더/스크롤/실제 복귀 클릭/샘플 선택, 데스크톱 복귀와 모바일 회전을 검증해줘. 문서·색인·Tauri 대기를 갱신하고 Tauri 빌드·설치는 실행하지 마.
```
