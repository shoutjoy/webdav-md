# 표 메뉴 상단 Jena Table·우측 Dock·행/열 병합

- 변경 ID: MDPRO-20261112-TABLE-DOCK-MERGE
- 작성·최종 확인: 2026-11-12 / WebDAV 미커밋 구현
- 저장소: C:\CusorApps\Webdav_md\webdav-md
- 참고 원본: C:\CusorApps\md-viewerVscode\md_viewer 실제 js/table-menu-layout.js, css/table-menu.css, js/app.js::editMarkdownTable 및 index.html 확인. Viewer는 이번 수정하지 않음.
- 증거: artifacts/table-menu-20261112/, tests/tableMenuMerge.test.mjs, tests/tableMenu.browser.cjs

## 요청·변경 이유

표 메뉴의 Jena Table이 크기 선택 아래에 있어 찾기 어렵고 우측 도킹이 없었다. 맨 위 헤더에 Jena Table / Dock / 닫기를 배치했다. 행/열 추가·삭제, 크기 선택, 캡션 삽입·정렬·번호 재정렬은 기존 ID/바인딩과 함께 유지했다. 별도 Jena Table AI 창의 배치는 변경하지 않았다.

표 안의 커서 기준으로 행은 아래/위, 열은 우측/좌측 병합을 추가했다. 이것은 Markdown 행/열의 내용을 합치고 한 행/열을 제거하는 기능이다. HTML rowspan/colspan 변경이 아니다. 행은 두 본문 행의 각 열을 합치며 제목/구분선과는 병합하지 않는다. 열은 제목과 본문을 포함한 표 전체에 적용한다.

## 실제 구현·WebDAV 차이

- mdpro/index.html: 기존 Jena 진입 버튼을 table-menu-heading으로 이동, Dock/닫기와 table-menu-body 추가. table-structure-actions에 네 방향 병합 및 두 구분자 입력 추가. 행 기본 구분자는 &lt;br&gt;, 열은 공백 한 칸이다. 입력 빈 값도 허용한다.
- mdpro/js/table-menu-layout.js: Viewer 전용 layout 모듈에서 위치/크기 조절과 우측 aside를 참고했다. 대상에 없는 table-caption-close-after 정책은 이식하지 않았다. 너비 저장 키는 webdav_table_menu_dock_width_v1로 분리했다. main-workspace의 order-2 문서 영역 옆에 Dock을 추가하고 드래그/키보드로 너비를 조절한다. Dock 해제·닫기는 aside를 제거해 공간을 복구한다. 팝업은 화면 범위 안으로 제한한다.
- mdpro/css/table-menu.css: 헤더 고정·본문 스크롤, 761px 이상 우측 배치. 760px 이하에서는 편집 공간을 남기는 하단 Dock으로 전환한다. 문서 빠른 이동 버튼도 문서 영역 안쪽으로 이동시켜 병합 버튼과 겹치지 않게 했다. 인쇄 시 표 도구는 제외한다. 인쇄/PDF 변환 파이프라인 변경 없음.
- mdpro/js/app.js::closeTableInsertPicker(force): 도킹 상태에서는 바깥 클릭·표 작업 후 자동 닫기를 생략한다. 명시 닫기/Escape는 force로 닫는다. toggleTableInsertPicker는 기존 grid 초기화 후 layout 모듈에 연결한다.
- editMarkdownTableStructure: 기존 WebDAV cursor context/newline/행·열 편집 경로에 병합 분기만 추가한다. 인접 경계와 readOnly/disabled를 검사하고, 짧은 행은 빈 칸으로 채운다. 구분자의 줄바꿈은 공백, 파이프는 &#124;로 변환해 표 구조를 보존한다. 구분선의 첫 열 정렬을 유지한다. 기존 replaceTextareaContentWithUndo로 하나의 편집을 기록하고 renderMarkdown/performAutoSave를 유지한다. Viewer 전용 history transaction은 복사하지 않았다.
- app URL tableMenu=20261112-1 및 새 CSS/JS 버전, PWA 캐시 20261112-table-dock-1 갱신. 새 외부 의존성 없음.

## 검증

- Node 43개 통과: 새 병합 동작 6개, 기존 AI Jena UI 및 표 캡션 회귀. 위·아래/좌·우 동등 결과, 본문 경계·제목 보호, 파이프/CRLF/빈 구분자·빈 셀, 읽기 전용과 Undo 경로 검사.
- 실제 Vite + Chrome 1440px/390px: 우측/하단 Dock, 바깥 클릭·병합 후 Dock 유지, 실제 행/열 병합과 Ctrl+Z 원문 복구, Jena AI 진입·캡션 입력 접근, 해제·닫기·Escape 확인. 페이지 오류 0. results.json과 스크린샷 참고.
- node --check app.js / table-menu-layout.js / AI_App/aiChat/ai-chat.js, git diff --check, npm run build 통과. 기존 Vite 500kB chunk 경고는 남음.
- 실제 NAS 재열기·OS 인쇄·설치 앱·다른 동시 Dock 조합 전체는 미검증. 상대 앱 런타임·frontend/native 빌드·배포·커밋/푸시 미실행.

## 상대 앱 대응표·Tauri

| Viewer | WebDAV | 상태 |
| --- | --- | --- |
| js/table-menu-layout.js / css/table-menu.css | mdpro 하위 새 layout/CSS | 대상 DOM·caption 정책·storage key 적응 |
| js/app.js::editMarkdownTable | editMarkdownTableStructure | target context/CRLF/Undo 경로 유지 |
| table-caption-close-after / 병합 외 추가 표 기능 | 기존 caption 계약 | 이번 복사하지 않음 |

Viewer에는 대응 기능이 이미 있다. 이번 WebDAV 변경을 그대로 덮어쓸 이유는 없다. WebDAV의 newline/읽기 전용·구분자 보호를 추가 역이식한다면 현재 원본을 먼저 비교한다. Viewer 자산 미수정이므로 이번 Tauri 빌드는 불필요·미실행, 설치 앱 확인도 미실행이다. 대기 목록에 같은 ID를 기록했다.

## 재명령 프롬프트

~~~text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md와
C:\CusorApps\Webdav_md\webdav-md\docs\mdpro-development\changes\2026-11-12-table-menu-dock-merge.md를 읽어줘.
현재 표 메뉴 layout/병합 구현과 비교해 필요한 차이만 적용해줘.
caption-close 정책·history·저장 키를 앱별로 보존하고 전체 파일을 덮지 마.
위/아래 행, 좌/우 열 병합·구분자·본문 경계·읽기 전용·Undo·Dock 해제·모바일 접근을 검증하고
문서/목록/Tauri 상태를 갱신해줘. 이번 명령에 native 빌드나 배포는 포함하지 않아.
~~~
