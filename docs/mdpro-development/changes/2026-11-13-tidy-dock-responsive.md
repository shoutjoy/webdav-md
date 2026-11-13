# TIDY Dock 너비에 따른 1열 전환

- ID: MDPRO-20261113-TIDY-DOCK-RESPONSIVE
- 날짜: 2026-11-13. 원본 미커밋: C:/CusorApps/WebDav-MD/webdav-md. 대상: C:/CusorApps/MDPRO/MDproViewer.
- 상태: WebDAV 구현·빌드 완료. 실제 UI 미검증. Viewer 읽기 비교만, 이식/frontend/native/설치 검증 미실행.

## 요청과 실제 구현

우측 TIDY Dock를 줄이면 버튼을 1열로 전환한다. `mdpro/css/tidy-menu-dock.css`에서 #tidy-menu-dock에 이름 있는 inline-size container를 지정하고 @container tidy-dock (max-width:300px)에서 .tidy-action-grid를 1열, .tidy-feature-manager-row를 세로로 배치한다. 300px 초과에서는 기존 2열로 복귀한다. Dock heading은 flex-wrap, 작업 버튼은 white-space:normal/overflow:visible/overflow-wrap:anywhere로 긴 이름을 보존한다. Dock 밖 팝업은 변경하지 않는다. index.html CSS 캐시는 20261113-responsive-1.

변경 전 컨트롤 목록: 엔터정리, 수식정리, HTML정리, MD2HTML, Inline2Ref 주석/인라인, HTML2MD, base64ToUrl, Url2base64, noteCover, 사용자 추가 스크립트, 기능 추가, 메뉴로 복귀, Dock 헤더 복귀/닫기, 너비 조절. 모두 기존 DOM·ID·이벤트를 보존하며 삭제/비활성화 없음. 저장 정책/변환 로직/보기/PV/내보내기 변경 없음. 신규 의존성 없음.

## 대상 적응

Viewer css/tidy-menu-dock.css 실제 읽기 확인: 동일 Dock/패널/heading/manager 선택자가 존재하나 모바일은 하단 Dock 높이/위치 정책이 WebDAV와 다르다. 대상 고유 모바일 정책을 유지하고 container query와 긴 이름 처리를 선택 추가한다. 전체 CSS/index.html 덮어쓰기 금지. 대상 로딩 순서와 캐시 키는 별도 확인 필요.

## 검증

- npm run build 통과, 기존 chunk 크기 경고.
- git diff --check 및 node --check mdpro/AI_App/aiChat/ai-chat.js 통과.
- node tests/tidyMenuDock.browser.cjs 실행 실패: 지정된 playwright-core 경로가 없어 MODULE_NOT_FOUND. 브라우저 열기 전 실패했으므로 실제 UI 검증 아님.
- 최종 CSS diff 검토: 새 숨김/클리핑/overflow:hidden 없음. 기존 패널 세로 스크롤 유지.
- 실제 360→300→240→180→360px 드래그/키보드, 긴 사용자 버튼, 모바일, 양 테마, 복귀/닫기는 미검증. 기대 결과: 300px 이하 한 열, 초과 두 열(기존 모바일 한 열 규칙 유지), 모든 명령 도달 가능.

## Tauri 대기

큐 ID MDPRO-20261113-TIDY-DOCK-RESPONSIVE. Viewer 웹 이식/실화면 검증 후 대상 Docs/mdpro-development/TAURI_BUILD.md를 따라 CSS와 캐시 자산을 Tauri/dist에서 확인하고 설치 앱의 Dock 너비 전환을 검증한다. 이번 빌드 요청 없음, native/설치 미실행.

## 다른 앱에서 실행할 명령

```text
C:/CusorApps/MDPRO/MDproViewer에서 AGENTS.md와 C:/CusorApps/WebDav-MD/webdav-md/docs/mdpro-development/changes/2026-11-13-tidy-dock-responsive.md를 읽고, TIDY 우측 Dock의 실제 너비 300px 이하에서 작업 버튼을 1열로 전환해줘. 대상 css/tidy-menu-dock.css와 로딩 순서를 확인하고 container query·긴 이름 줄바꿈·하단 관리 버튼 세로 배치를 선택 이식하되 모든 기존 버튼/이벤트와 독립 모바일 Dock 정책을 보존해줘. 전체 파일을 덮어쓰지 말고 180/240/300/360px·키보드/드래그·추가 스크립트·복귀/닫기를 검증해줘. 문서/목록/Tauri 큐를 갱신하고 이번에는 Tauri 빌드하지 말아줘. 미검증 항목을 구분해줘.
```
