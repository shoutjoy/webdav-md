# 2026-11-12 Macro 실제 Dock · Viewer형 Jena Tidy · 표 메뉴 앵커

- 변경 ID: MDPRO-20261112-WORKSPACE-UI
- 구현 저장소: C:/CusorApps/Webdav_md/webdav-md (미커밋)
- 참고 저장소: C:/CusorApps/md-viewerVscode/md_viewer (읽기만, 런타임 미수정)
- 작성/검증: 2026-11-12. 기존 다수 미커밋 변경을 보존하면서 적용.
- 상태: WebDAV 구현·Chrome 검증·웹 빌드 완료. 상대 앱 수정·Tauri frontend/native/설치 검증 미실행.

## 요청과 완료 기준

1. Macro 기록 창의 우측이동을 문서 옆 실제 분할 Dock / Popup으로 변경한다.
2. Jena Tidy가 너무 크고 가려지는 문제를 해결하고 Viewer의 3열 UI·기능으로 구성한다. 코드에 구문 색상을 넣는다.
3. 표 메뉴는 버튼 바로 아래에서 열려야 하며 이전 위치에 고정되면 안 된다.

## 구현 코드와 변경 이유

### Macro

- mdpro/trt/macro-menu-dock.js, macro-menu-dock.css 추가. main-workspace에 order:6 슬롯을 만들고 기존 macro-menu-panel DOM을 이동한다. Popup 복귀는 앵커 위치와 기존 인라인 스타일을 복원한다. Dock 너비는 webdav_macro_menu_dock_width_v1에 저장한다.
- macro.js의 dockMacroMenuRight는 MacroMenuDock.apply를 호출한다. openMacroMenuPanel은 popup을 body로 꺼내 툴바의 숨김/overflow 영향을 피한다. 닫기는 detach 후 기존 기록 상태 갱신을 유지하며 재열면 세션의 Dock 선택을 복구한다. Dock 중 applyMacroMenuLayout·헤더 이동·popup resize는 실행하지 않는다.
- 좌측 splitter 포인터 캡처·방향키, Escape 닫기, 모바일 하단 분할을 지원한다. 기존 목록 열·SET/x/JS/Run은 유지하고 좁은 Dock에서는 목록을 가로 스크롤한다.

### Jena Tidy

- tidy-script-manager.js의 openManager: 기본 1180px/94vw × 82vh, z-index:200. 기존 1800px/96vw × 94vh보다 줄이고 메인 헤더가 창을 가리지 않도록 한다. 기존 resize 핸들은 유지한다.
- tidy-script-manager.html: 제목 Jena Tidy, code-field에 textarea와 pre 미러를 추가한다. 원래 inDB·SQLite·GitHub 브리지와 파일 업로드/등록/삭제 로직은 유지한다.
- tidy-workspace.js: 기존 DOM과 이벤트를 재사용해 기능등록/히스토리/접기, 중앙 편집·JS 다운로드, 우측 Jena Tidy/JS 탭, 전체화면, 실시간 작성 OFF/ON, 기본 프롬프트 복원, 코드 스냅샷 저장을 구성한다. Jena Tidy는 기존 기능 수정, Jena JS는 새 기능 생성 지시를 보낸다. 기존 선택 코드 수정·되돌리기·응답 적용·테스트 실행은 details에서 접근 가능하다.
- tidy-workspace.css: Viewer 실제 3열 디자인·splitter 규칙을 읽고 WebDAV의 기존 DOM 구조에 맞게 적용했다. tidy-workspace.js의 splitter 부분은 Viewer 동작을 적응 이식했으며 포인터 캡처 해제 재진입을 방지한다. 모바일은 세로 스크롤 배치다.
- tidy-manager-layout.css, tidy-code-colors.js: javascript-highlight.js의 기존 렉서 미러를 중앙 편집기와 AI 코드 초안에 연결한다. 원래 textarea value/선택/입력 이벤트를 유지하고 색상·스크롤·IME 조합·forced colors 대체 표시를 지원한다. 색상 미러에는 textContent를 사용한다.
- tidy-jena.js: 과도한 620/720px 고정 최소 높이와 경쟁하는 옛 레이아웃 주입을 제거한다. 실시간 작성은 요청 당시 코드·버전을 확인한 경우에만 갱신하며 실패/취소 시 자신의 마지막 초안만 원복한다. 완성본은 기존 validate/apply 절차를 거친다. 대화 추가 시 전체 화면이 튀지 않도록 chat 내부 scrollTop만 변경한다.
- 저장·Worker 10초 제한·AI Data Center 보관은 WebDAV 기존 구현을 유지한다. Viewer의 rewriteWithJena/postMessage 전용 브리지를 전체 복사하지 않는다.

### 표 메뉴

- table-menu-layout.js의 open은 이전 popupRect 좌표 대신 현재 btn-table-insert-picker의 bottom+6px과 left를 사용한다. 화면 우측에서는 폭에 맞게 left만 제한하며 아래쪽 내용은 maxHeight/내부 스크롤로 처리한다.
- anchored 플래그가 켜진 popup은 resize/Observer sync에서도 버튼을 따른다. 직접 드래그를 시작하면 플래그를 해제한다. Dock은 사용자가 Dock 버튼을 누를 때만 실행하며 기존 병합·캡션·크기 조절은 유지한다.
- index.html은 Macro 버튼 문구/aria 및 새 자산, 관련 JS 쿼리를 갱신한다. PWA CACHE_VERSION=20261112-tidy-workspace-anchor-2. 신규 패키지 의존성 없음.

## 상대 앱 차이·이식 순서

| 영역 | Viewer 실제 소스 | WebDAV 차이/상태 |
| --- | --- | --- |
| Macro Dock | trt/macro.js의 macroDocked/dockHost | Viewer는 content-viewport를 감싼다. WebDAV는 main-workspace flex 슬롯을 사용. Viewer 미수정 |
| Tidy UI | js/Tidy/tidy-script-manager.html, tidy-workspace.js | Viewer 통합 UI/브리지와 WebDAV tidy-jena.js/Worker 저장 브리지를 비교. UI·열 조절만 적응, 저장/AI 전체 파일 덮어쓰기 안 함 |
| JavaScript 색상 | js/editor/javascript-highlight.js | WebDAV 기존 공통 모듈 재사용, 신규 tidy 미러 연결 |
| 표 메뉴 | WebDAV table-menu-layout.js | 현재 버튼 기준 앵커를 재계산하는 WebDAV 수정. Viewer 같은 오류 존재 여부 미검증 |

Viewer 고유 브리지의 구현 방식과 WebDAV 결과를 동일하다고 주장하지 않는다. JS Jena는 WebDAV의 transform 함수/Worker 계약을 유지한다. 양방향 이식 시 기존 저장 데이터와 실행 계약을 우선 비교해야 한다.

## 검증 결과와 한계

- tests/macroMenuDock.browser.cjs: Chrome 1440/800/390px, 11개 버튼 유지, 실제 등록한 매크로 Run 실행, 문서와 경계 분리, 데스크톱 키보드·포인터 splitter, Popup/닫기/재열기/Escape, 양 테마 스크린샷. pageerror 없음. 최초 검사는 popup이 툴바 숨김 영향을 받아 실패했고 body 배치로 수정 후 재통과했다.
- tests/tidyWorkspace.browser.cjs: Chrome 1440/1000/390px. code-highlight 키워드/문자열 확인, 기능 등록 inDB, Worker ABC 변환, 히스토리 전환, 열 분리/키보드 너비, 전체화면/복귀, 모의 streaming delta/완성본 반영, 닫기. pageerror 없음. 초기 DOM 이동 오류 수정 후 통과. AIChat의 frozen 메서드에 덮어쓰기하던 테스트 fixture는 객체 대체로 수정해 모의 공급자를 검증했다.
- 같은 Tidy 검사에서 1440px 표 메뉴 최초/재열기 top=button.bottom+6을 검증했다.
- artifacts/macro-dock-20261112/, artifacts/tidy-workspace-20261112/의 JSON·PNG. Tidy 1440 및390 스크린샷을 직접 검토하고 라이트 테마 대비·대화 후 화면 점프를 추가 수정했다.
- node --check: macro.js, macro-menu-dock.js, tidy-script-manager.js, tidy-jena.js, tidy-workspace.js, table-menu-layout.js 통과. git diff --check 통과. npm run build 통과, 기존 500kB chunk 경고 있음.
- 실제 AI 공급자 응답 품질, NAS/SQLite/GitHub 실서비스 저장 왕복, 모바일 실기기, 복수 Dock 동시 사용은 미검증. 모의 AI/로컬 inDB/Worker 검증과 구분한다. Tauri 빌드·설치 앱 검증·배포 미실행.
- 수식·PV·miniPV·인쇄·내보내기 파이프라인은 변경하지 않았다.

## Tauri 반영 계획

TAURI_BUILD_QUEUE.md의 MDPRO-20261112-WORKSPACE-UI 항목 참조. 이번 WebDAV 전용 자산은 Viewer에 자동 적용되지 않는다. 역이식 요청 시 Viewer 자체 Dock/Tidy 구현과 차이를 먼저 확인한 후 선택 이식하고 Docs/mdpro-development/TAURI_BUILD.md에 따라 별도 빌드한다. Tauri/dist 자산 포함 및 설치 앱에서 전체화면·코드 색상·저장·도킹을 확인해야 한다.

## 재명령용 프롬프트

```text
C:/CusorApps/md-viewerVscode/md_viewer의 AGENTS.md와
C:/CusorApps/Webdav_md/webdav-md/docs/mdpro-development/changes/2026-11-12-macro-dock-tidy-workspace-table-anchor.md를 읽고,
Macro 실제 Dock·Jena Tidy 창 크기/3열/구문 색상·표 메뉴 버튼 아래 앵커 수정 중
대상 앱에 필요한 차이만 이식해줘. 기존 Viewer Dock/Tidy 브리지를 전체 덮어쓰지 말고,
등록·선택 코드 수정·스트리밍·히스토리·테스트·다운로드·전체화면과 모바일 레이아웃을 보존해줘.
1440/1000/390px, 양 테마, Macro 실제 실행, 표 메뉴 최초/재열기 위치를 검증하고 문서와 목록을 갱신해줘.
Tauri 빌드와 배포는 이번 명령에 포함하지 않아. 실제 공급자/저장 서비스 미검증은 구분해줘.
```
