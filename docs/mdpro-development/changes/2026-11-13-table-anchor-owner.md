# 2026-11-13 표 버튼 아래 팝업 위치 보존

- 변경 ID: MDPRO-20261113-TABLE-ANCHOR-OWNER
- 원본: C:\CusorApps\WebDav-MD\webdav-md, 대상: C:\CusorApps\md-viewerVscode\md_viewer (Test-Path=False)
- 작성·확인: 2026-11-13, 미커밋
- 상태: WebDAV 구현·웹 검증·빌드 완료 / Viewer 대상 확인 필요·미이식 / Tauri 준비·네이티브 빌드·설치 앱 미실행

## 요청과 완료 기준

표 컨트롤을 도구 모음의 표 버튼 아래에 연다. 크기 선택, Jena Table, Dock/해제, 닫기, 행·열 추가/삭제, 네 방향 병합과 구분자, 표 캡션 및 기존 드래그·리사이즈를 유지한다. 열기 기본값은 기존처럼 팝업이며 Dock은 명시 클릭으로만 실행한다.

## 원인과 실제 구현

mdpro/js/table-menu-layout.js::open/sync는 버튼 bottom+6 좌표를 지정하지만, mdpro/js/app.js::registerEssentialEditorCommands의 문서 click 리스너가 setTimeout으로 positionOpenEditorToolbarPanels를 실행한다. 가로 도구 모음 분기는 표 메뉴의 top/left를 제거해 body로 이동된 fixed 팝업이 (0,0)으로 이동했다. 기존 브라우저 테스트는 JS 함수를 직접 호출하여 click 리스너 충돌을 놓쳤다.

- mdpro/js/app.js::positionOpenEditorToolbarPanels: `if (id === 'table-insert-picker' && window.TableMenuLayout) return;` 추가. 표 어댑터가 있을 때만 공통 배치/좌표 초기화에서 제외한다. 어댑터 없는 fallback, 다른 메뉴는 기존 처리 유지. 어댑터의 resize, Dock, 드래그는 그대로 유지한다.
- mdpro/index.html: app.js tableMenu 쿼리를 20261113-anchor-owner-1로 변경.
- mdpro/Apps/PWA/service-worker.js: CACHE_VERSION=20261113-table-anchor-owner-1.
- tests/tableMenu.browser.cjs: desktop 최초 열기를 실제 click으로 변경하고 지연 처리 후 버튼 아래·뷰포트 경계를 검증. 모바일은 기존 직접 호출 유지. 새 의존성 없음.
- UI ID/바인딩·CSS 변경이나 컨트롤 제거 없음. 수식·인쇄·PDF 파이프라인 변경 없음.

## 상대 앱 대응표와 이식 순서

| 원본 | 대상 | 적응·선행 조건 | 상태 |
| --- | --- | --- | --- |
| js/app.js positionOpenEditorToolbarPanels | Viewer js/app.js 대응 확인 필요 | 공통 클릭·resize 배치 함수와 TableMenuLayout 존재 여부 실제 비교 | 대상 확인 필요·미이식 |
| js/table-menu-layout.js open/sync | Viewer 대응 모듈 확인 필요 | 원본 함수 덮어쓰기 금지, 독립 Dock·저장·초기화 유지 | 미검증 |

## 회귀와 검증

- 실제 로컬 Vite http://127.0.0.1:5214/mdpro/index.html?webdav=1 + agent-browser 격리 Chrome.
- 수정 전 실제 클릭 2회 후 panel=(0,0), top/left 인라인 값 제거 확인. 직접 함수 호출로는 정상이라 차이 확인.
- 수정 후 1440×1000: button.bottom=105, panel.top=111. 행/열·병합 등 onclick 13개 보존, Dock 및 해제, 닫고 재열기 확인.
- 390×1000: 모바일 도구 모음을 펼친 뒤 실제 표 버튼 클릭. button.bottom=190.484375, panel.top=196.484375, left=10.390625, right=370.390625. Escape 닫기 true. 최초 접힌 도구 모음에서 클릭 시도는 입력 sink가 가려 실패했으며 정상 펼치기 후 통과.
- 스크린샷: C:/Users/User/.codex/visualizations/2026/11/12/01a1cee5-e028-7c62-83a2-d8a024a74fe0/table-anchor-desktop.png 및 table-anchor-mobile.png.
- `node --test tests/tableMenuMerge.test.mjs tests/tableCaptionAlignment.test.mjs tests/tableCaptionRenumber.test.mjs tests/aiJenaUiContract.test.mjs`: 43개 통과.
- `node --check mdpro/js/app.js`, `node --check mdpro/js/table-menu-layout.js`, `node --check mdpro/AI_App/aiChat/ai-chat.js`, `git diff --check`: 통과.
- `npm run build`: 통과, 기존 큰 청크 경고. tests/tableMenu.browser.cjs 전체 자동 실행은 Playwright 미설치로 미실행; 위 실제 Chrome 검증으로 위치와 Dock을 별도 확인. 기존 모든 병합/Undo/UI의 전체 브라우저 재검사는 미실행.
- 실제 NAS·배포 UI·Viewer·Tauri 설치 앱은 미검증.

## Tauri 반영 계획

큐 MDPRO-20261113-TABLE-ANCHOR-OWNER. Viewer 대응 함수 조사·필요한 가드만 적응 후 js/app.js와 로더 캐시를 프런트엔드에 반영한다. native 요청 시 대상 Docs/mdpro-development/TAURI_BUILD.md를 읽고 dist/설치 앱에서 실제 클릭 후 좌표를 확인한다. 이번 자동 이식·빌드·배포 없음.

## 다른 앱에서 다시 실행할 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md와 C:\CusorApps\WebDav-MD\webdav-md\docs\mdpro-development\changes\2026-11-13-table-anchor-owner.md를 읽어줘. 표 메뉴 전용 어댑터와 공통 도구 모음 배치 코드가 충돌하는지 실제 비교하고, 필요할 때만 공통 좌표 초기화에서 표 어댑터를 제외해 표 버튼 아래에 열리도록 수정해줘. 전체 파일 복사 없이 기존 Dock·드래그·크기/병합/캡션·설정과 다른 메뉴를 보존해줘. 실제 클릭과 비동기 배치 후 최초/재열기·resize·Dock/해제·Escape·1440/390px를 검증하고 인계 문서·인덱스·Tauri 큐를 갱신해줘. native 빌드·배포는 포함하지 마. 미검증 항목은 명시해줘.
```
