# 2026-11-12 이미지 넣기 분할 Dock

- 변경 ID: MDPRO-20261112-IMAGE-INSERT-DOCK
- 구현: C:/CusorApps/Webdav_md/webdav-md, 참고: C:/CusorApps/md-viewerVscode/md_viewer
- 작성·확인: 2026-11-12, 미커밋. 기존 다수 변경과 공존하는 좁은 추가 구현.
- 상태: WebDAV 구현·Chrome 웹 검증·웹 빌드 완료. Viewer 읽기 비교만 수행, 런타임 수정·Tauri 빌드·설치 검증 미실행.

## 요청과 완료 기준

이미지 넣기 창을 첨부 Macro 예시처럼 문서와 나란히 도킹한다. 기존 ≫는 오른쪽 정렬만 했으므로 Dock / Popup 전환으로 확장했다. 기본은 Popup이며 닫고 재열면 현재 세션의 Dock 선택을 유지한다. Dock 너비만 localStorage(webdav_image_insert_dock_width_v1)에 보관한다. 선택 이미지·URL·갤러리·캡션 DOM을 복제하거나 초기화하지 않는다. 닫을 때 기존 갤러리 정리 절차는 유지한다.

## 실제 구현

- mdpro/imageDB/image-insert-dock.js: ImageInsertDock.apply/detach/layout. 원래 위치에 주석 앵커를 남기고 modal 전체를 main-workspace의 order:5 슬롯에 이동한다. Popup 복귀 때 원위치·인라인 스타일을 복원한다. closeImageInsertModal은 detach 후 기존 닫기 절차를 실행한다.
- image_insert.js: applyImageInsertPanelLayout이 새 모듈로 위임. Dock 중 헤더 이동·Popup 전용 5방향 resize 시작을 막아 좌표 충돌을 방지한다. 업로드·캡처·inDB·imgBB·문서 삽입 로직은 유지한다.
- image-insert-dock.css: 오른쪽 flex 공간 확보, 내부 스크롤·sticky 헤더, 좌측 splitter. 포인터 캡처와 방향키 20px 조절, 취소 처리. 화면 760px 이하에서는 모바일 하단 도구 공간 위 40dvh 패널로 문서와 분할한다.
- index.html: 기존 버튼 ID 추가·Dock 문구/aria-pressed, 새 JS/CSS, image_insert 캐시 쿼리 갱신. service-worker CACHE_VERSION=20261112-image-dock-1. 신규 의존성 없음.
- 숨기는 항목은 도킹 시 Popup 전용 resize 핸들, 모바일의 수평 splitter, 인쇄 시 no-print Dock뿐이다. 기능 버튼 25개 유지.

## 상대 앱 대응표와 이식 순서

| WebDAV | Viewer 확인 소스 | 차이·상태 |
| --- | --- | --- |
| imageDB/image_insert.js의 applyImageInsertPanelLayout/toggleImageInsertDockRight | imageDB/image_insert.js의 같은 함수 | Viewer도 우측 정렬만 수행. 이번 신규 split Dock은 미적용 |
| bindImageInsertResize | Viewer openImageInsertModal에는 같은 호출 없음 | WebDAV 고유 scroll wrapper·5방향 resize 유지 |
| mdpro/index.html 및 새 imageDB 자산 | 루트 index.html, imageDB | 전체 파일 복사 금지. Viewer workspace·세로 툴바·다른 Dock 계산 방식에 맞춰 적응 필요 |

참고 앱의 이미지 넣기 동작과 제공된 Macro 배치 예시를 비교하여 WebDAV에 독립 구현했다. 업로드·저장 구조와 상대 앱 자체 변경을 덮어쓰지 않는다. 상대 문서 사본은 요청 범위 밖이다.

## 회귀 예제와 검증

- node --check mdpro/imageDB/image_insert.js 및 image-insert-dock.js 통과.
- node tests/imageInsertDock.browser.cjs: 실제 Chrome headless에서 Vite /mdpro/index.html?webdav=1 접속. 1440/800/390px 각각 25개 컨트롤 유지, 양 테마, Dock/Popup·URL 보존·Markdown 실제 편집기 삽입·닫기/재열기·Escape, 데스크톱 키보드/포인터 너비 조절 통과. pageerror 없음. 문서와 Dock 경계가 겹치지 않는지 검사.
- 최초 sandbox 실행은 ERR_NETWORK_ACCESS_DENIED. 승인된 실행에서 재검사 성공.
- artifacts/image-dock-20261112/results.json 및 dock-{width}-{dark|light}.png. 390px 다크 스크린샷 직접 확인: 하단 메뉴 위 배치·내부 스크롤.
- npm run build 통과. 기존 500kB chunk 경고 있음. git diff --check 결과는 최종 검사 참고.
- NAS/실제 imgBB 업로드·OS 캡처·모바일 실기기·복수 Dock 동시 레이아웃·배포 미검증. 기존 업로드 기능의 실서비스 검증을 뜻하지 않는다.
- 보기/PV/miniPV/내보내기 로직 미수정. 문서 이미지 삽입은 기존 경로를 유지한다.

## Tauri 반영 계획

TAURI_BUILD_QUEUE.md의 같은 ID 참조. Viewer 적용을 요청받으면 새 imageDB JS/CSS·index.html·이미지 창 레이아웃 연결을 대상 구조에 맞춰 이식하고 웹 검증 후 Docs/mdpro-development/TAURI_BUILD.md를 따른다. Tauri/dist에 신규 자산 포함 여부와 설치 앱 Dock/Popup·파일 업로드·문서 편집을 별도 확인한다. 이번은 WebDAV 웹 빌드만 실행했다.

## 다른 앱에서 다시 실행할 명령

```text
C:/CusorApps/md-viewerVscode/md_viewer에서 AGENTS.md와
C:/CusorApps/Webdav_md/webdav-md/docs/mdpro-development/changes/2026-11-12-image-insert-dock.md를 읽고,
이미지 넣기 Dock/Popup 분할 기능을 대상 workspace 구조에 맞춰 구현해줘.
imageDB/image_insert.js의 기존 업로드·저장·캡션·창 이동을 보존하고 전체 파일 덮어쓰기 없이
DOM 재배치·너비 조절·닫기 후 공간 반환·재열기·모바일 하단 분할을 검증해줘.
25개 버튼 보존, URL/이미지 상태 보존, Markdown/HTML 삽입과 기존 Dock 공존을 확인하고
이식 문서·목록·Tauri 대기 상태를 갱신해줘. Tauri 빌드는 이번 명령에 포함하지 않아.
```
