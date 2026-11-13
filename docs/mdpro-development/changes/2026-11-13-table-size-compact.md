# 표 숫자 입력 기본 접기·격자 한 줄 시작

- 변경 ID: MDPRO-20261113-TABLE-SIZE-COMPACT
- 작성: 2026-11-13, 원본 미커밋. WebDAV `C:/CusorApps/WebDav-MD/webdav-md`, 대상 `C:/CusorApps/MDPRO/MDproViewer`.
- 상태: 원본 구현/웹 빌드 완료. 실제 브라우저 UI 미검증. Viewer 읽기 비교만 수행, 이식·frontend·native·설치 검증 미실행.

## 요청과 구현

숫자 행/열 입력과 표 넣기 버튼을 기본 접힌 `행·열 직접 입력` details로 이동한다. 기존 크기 선택/표 편집 접기, 10열/최대 10행, Jena Table/Dock/닫기/구조 편집/캡션 기능과 기존 ID·이벤트를 보존한다. 저장 정책 변경 없음.

- `mdpro/js/table-menu-layout.js` init: 기존 foldSection으로 `table-size-numeric-section`을 생성하고 `numericSection.open = false` 적용. 폼과 입력/submit 핸들러를 그대로 이동한다. 후속 요청의 시작 화면에 맞춰 크기 선택/표 편집 모두 화면 폭과 무관하게 기본 접는다. breakpoint change에서 자동으로 펼치던 처리를 제거하여 사용자의 펼침 상태를 크기 변경에도 유지한다. Jena Table/Dock/닫기와 표 캡션 넣기는 기존 위치를 유지한다.
- `mdpro/js/app.js`: ensureTableInsertPickerBuilt/resetTableInsertGridRows의 초기 visibleRows와 표시 기준을 3에서 1로 변경. previewTableInsertSize는 최소 1행, 선택 행 + 1행으로 늘어나 최대 10행까지 접근 가능하다. 닫고 다시 열면 한 줄로 초기화한다.
- `mdpro/index.html`: 배치 스크립트 캐시 키를 `20261113-table-default-fold-3`로 갱신.
- 보기/PV/miniPV/AI/내보내기 렌더링은 수정하지 않음. 신규 의존성 없음.

## 대상 비교와 적응

Viewer `js/app.js` ensureTableInsertPickerBuilt/previewTableInsertSize 실제 확인: 초기 3행이며 table-insert-grid-cell, is-selected, aria-pressed 등 고유 스타일/접근성 처리가 있다. 이 처리를 보존하면서 초기값과 확장 하한만 조정해야 한다. 대상 숫자 폼/배치 어댑터는 추가 확인 필요. WebDAV 전체 app.js/index.html을 덮어쓰지 않는다.

## 검증

- node --check mdpro/js/table-menu-layout.js / mdpro/js/app.js 통과.
- node --test tests/tableMenuMerge.test.mjs: 6개 통과.
- git diff --check 통과.
- npm run build 통과 (기존 대형 chunk 경고).
- 최종 diff: 의도한 격자 표시 기준 외 컨트롤 제거/추가 clipping·overflow·visibility 변경 없음. 기존 작업 변경분 보존.
- 실제 화면의 접기/펼치기, 마우스/키보드 10행 확장, 모바일 터치 삽입은 미검증. 자동 검사로 UI 검증을 대신하지 않는다.

## Tauri 반영 계획

빌드 큐 MDPRO-20261113-TABLE-SIZE-COMPACT. Viewer 웹 이식·실제 UI 확인 후 대상 Docs/mdpro-development/TAURI_BUILD.md에 따라 자산 포함과 Tauri/dist를 확인하고 설치 앱에서 접기/확장/삽입을 검증한다. 이번 요청은 WebDAV UI 수정이며 Viewer 빌드·설치 요청 없음.

## 다른 앱에서 실행할 명령

```text
C:/CusorApps/MDPRO/MDproViewer에서 AGENTS.md와 WebDAV의 docs/mdpro-development/changes/2026-11-13-table-size-compact.md를 읽고 표 크기 선택·표 편집·숫자 행열 입력을 모두 기본 접기, 선택 격자를 초기 한 줄로 구현해줘. 화면 폭 변경으로 자동 펼치지 말아줘. 대상 숫자 입력/배치 구조를 먼저 확인하고 고유 클래스·aria-pressed·모든 버튼·10행 확장을 보존해줘. 전체 파일 덮어쓰기 없이 대상 구조에 맞춰 수정하고 desktop/mobile 접기·펼치기·재열기·10행 선택·삽입을 검증해줘. 문서/목록/Tauri 큐를 갱신하고 이번에는 Tauri 빌드하지 말아줘. 미검증은 구분해줘.
```
