# 2026-11-12 TIDY 메뉴 우측 도킹

- 변경 ID: `MDPRO-20261112-TIDY-MENU-DOCK`
- 원본: `C:/CusorApps/Webdav_md/webdav-md` / 비교 대상: `C:/CusorApps/md-viewerVscode/md_viewer`
- 작성·확인: 2026-11-12 / 미커밋. 기존 다수 미커밋 작업은 보존했다.
- 상태: WebDAV 구현·실제 로컬 Chrome 검증·웹 빌드 완료. Viewer 기존 구현을 읽어 비교했으며 이번 상대 런타임 수정·frontend/native 빌드·설치 앱 검증은 미실행.

## 요청과 완료 기준

TIDY 메뉴 하단에 `+ 기능 추가` 옆 `우측 Dock`을 추가한다. 클릭하면 기존 메뉴 DOM을 우측 분할 패널로 이동한다. 기본은 기존 팝업이며 도킹 여부는 새로고침 후 복원하지 않는다. 도킹 너비만 `webdav_tidy_menu_dock_width_v1`에 저장한다. 상단 `메뉴로 복귀`, `닫기`, Esc와 메뉴 하단 복귀 버튼을 제공한다. 기존 정리 10개·사용자 등록 버튼·기능 추가의 이벤트와 ID를 유지한다.

문서 클릭·정리 실행·TIDY 재클릭은 도킹을 해제하거나 숨기지 않는다. 왼쪽 경계 드래그와 좌우 방향키(20px)로 너비를 조절한다. 760px 이하에서는 하단 패널로 전환하고 기존 모바일 하단 메뉴 예약 높이를 피한다. 보기/PV/miniPV/내보내기·변환 알고리즘·문서 저장 계약은 변경하지 않는다.

## 실제 구현과 이유

- `mdpro/js/Tidy/tidy-menu-dock.js`: Viewer의 독립 메뉴 레이아웃 모듈만 적응. `dock()`은 `#main-workspace`에 `#tidy-menu-dock`을 생성하고 메뉴를 이동한다. `layout()`은 다른 flex 형제 점유폭을 차감해 문서 공간과 패널 너비를 조정하며 ResizeObserver/resize로 갱신한다. `undock(hide)`은 body 팝업으로 되돌린 뒤 포커스를 복원한다. 도킹 해제 시 DOM과 문서 우측 경계 변수를 정리한다.
- 드래그 `stop()`에서 먼저 drag 참조를 비워 pointer capture 해제 시 재진입을 방지했다. ResizeObserver가 없는 경우도 가드했다. 저장 키는 Viewer와 분리했다.
- `mdpro/js/Tidy/tidy-actions.js`: `closeMenu`, `positionMenu`, 바깥 클릭 dismiss에 `dataset.docked` 가드를 추가했다. 도킹 중 `toggleMenu`는 제목에 포커스만 준다. 기존 메뉴 전체를 복제하지 않아 사용자 추가 버튼과 이벤트를 유지한다.
- `mdpro/css/tidy-menu-dock.css`: 테마·분할 경계·스크롤·좁은 화면 전환. 모바일은 `--mobile-ui-dock-height`, `--mobile-ui-zoom-reserved-height`, `--mobile-ui-safe-bottom`을 합산해 하단 간섭을 줄인다. 데스크톱 문서 빠른 이동 버튼은 `--tidy-document-right`로 문서 경계를 따라가 TIDY 위에 겹치지 않는다.
- `mdpro/index.html`: 하단 Dock 버튼, 독립 CSS/JS 로드 추가, tidy-actions 버전 갱신.
- `mdpro/Apps/PWA/service-worker.js`: 기존 미커밋 cache version에서 `20261112-tidy-dock-1`로 갱신했다. 배포·기존 설치 PWA 갱신은 미검증.

핵심 보호 조건:

```javascript
if (panel && panel.dataset.docked !== 'true') panel.classList.add('hidden');
```

`tidy-docked` CSS는 팝업의 fixed 위치를 static으로 전환하고 폭/최대 높이 제한을 패널에 맞춘다. 기존 버튼을 숨기는 규칙은 추가하지 않았다. 모바일 분할 핸들만 숨기고 화면폭 전체 패널과 스크롤을 제공한다.

## 상대 앱 대응표와 이식 순서

| WebDAV | 실제 읽은 Viewer 대응 | 차이·상태 |
| --- | --- | --- |
| `mdpro/js/Tidy/tidy-menu-dock.js` | `js/Tidy/tidy-menu-dock.js` | 원본에 동일 기능 존재. WebDAV 별도 저장키, pointer capture 재진입 방지, Observer 가드, 문서 경계 변수 추가 |
| `mdpro/js/Tidy/tidy-actions.js` | `js/Tidy/tidy-actions.js` | Viewer의 팝업 코드도 실제 확인. 이번 가드는 WebDAV에 국소 추가, 상대 수정 없음 |
| `mdpro/css/tidy-menu-dock.css` | `css/tidy-menu-dock.css` | WebDAV 모바일 예약 높이 적용. 상대 모바일/빠른 이동 구현을 그대로 덮어쓰지 말 것 |
| `mdpro/index.html`, PWA 캐시 | 상대 `index.html`, PWA 구성은 추가 확인 필요 | 상대 로더·캐시 정책에 따라 선택 적용. 전체 파일 복사 금지 |

WebDAV 자체 table dock 등 다른 도킹은 별도 구현이다. desktop은 다른 flex 형제의 폭을 반영하지만 여러 하단 도킹의 동시 표시와 실기기 키보드 조합은 이번 검증 범위 밖이다. 사용자 등록 함수 실행·등록 저장은 기존 bridge에 맡겼고 이번 브라우저에서는 신규 사용자 함수를 저장하지 않았다.

## 회귀와 검증

- `node --check mdpro/js/Tidy/tidy-menu-dock.js`, `node --check mdpro/js/Tidy/tidy-actions.js`, `node --check mdpro/AI_App/aiChat/ai-chat.js`: 성공. AI Jena 코드는 이번 작업에서 수정하지 않았다.
- `node --test tests/tidyJena.test.mjs`: 5/5 통과(등록 저장/재로드·잘못된 코드 거부 등 기존 회귀).
- `git diff --check`: 성공.
- `npm run build`: 성공. 기존 500kB 초과 chunk 경고 존재.
- `node tests/tidyMenuDock.browser.cjs`: 실제 Vite `http://127.0.0.1:5198/mdpro/index.html?webdav=1`, Chrome headless 1440/800/390 × 라이트/다크. 기존 정리 10개+기능추가+Dock 총 12개 버튼 유지. noteCover 실제 편집 변환, 외부 클릭/resize/TIDY 재클릭 유지, 메뉴 복귀·닫기·Esc, desktop 키보드/포인터 폭 조절·드래그 종료, 빠른 이동 버튼 비겹침, 화면내 패널 확인. pageerror 0.
- 증거: `artifacts/tidy-dock-20261112/results.json`, `dock-{1440,800,390}-{light,dark}.png`.
- 첫 브라우저 실행은 샌드박스의 loopback 네트워크 거부로 중단되어 승인된 실행으로 재검증했다. 보완 후 실행과 빌드가 겹쳐 Vite 재로딩으로 1회 중단된 검사는 빌드 완료 후 단독 실행하여 전체 통과했다.
- NAS·배포 앱·실기기·native·OS 출력은 미검증. 이미지 첨부는 UI 요구 참고이며 별도 명령으로 취급하지 않았다.

## Tauri 반영 계획

빌드 대기 ID `MDPRO-20261112-TIDY-MENU-DOCK`. Viewer에는 메뉴 Dock 원본이 이미 있으므로 새 기능 전체 이식보다 WebDAV 보완점의 필요성부터 확인한다. 채택한다면 `js/Tidy/tidy-menu-dock.js`, `css/tidy-menu-dock.css` 및 로드 버전만 국소 수정하고 대상 절차에 따라 프런트엔드 준비 후 `Tauri/dist` 자산과 설치 앱에서 도킹/해제/폭 조절/모바일 동작을 확인한다. 이번 요청은 WebDAV 기능 추가이며 Tauri 빌드는 실행하지 않았다.

## 다른 앱에서 다시 실행할 명령

```text
C:/CusorApps/md-viewerVscode/md_viewer에서 작업해줘. AGENTS.md와 C:/CusorApps/Webdav_md/webdav-md/docs/mdpro-development/changes/2026-11-12-tidy-menu-right-dock.md를 읽어줘. 기존 TIDY 메뉴 Dock 구현을 보존하면서 WebDAV의 pointer capture 해제 재진입 방지와 ResizeObserver 가드가 필요한지 비교하고 필요한 부분만 반영해줘. 모바일 하단 예약 높이와 문서 빠른 이동 버튼은 Viewer의 기존 구현을 먼저 확인하고 전체 파일 덮어쓰기 없이 적응해줘. 정리 실행 후 도킹 유지, 모든 기존/사용자 버튼, 복귀·닫기·Esc, 폭 조절, 1440/800/390 화면을 검증하고 문서·목록·Tauri 대기 상태를 갱신해줘. Tauri 빌드와 배포는 이번 명령에 포함하지 말고 미검증 상태를 구분해줘.
```
