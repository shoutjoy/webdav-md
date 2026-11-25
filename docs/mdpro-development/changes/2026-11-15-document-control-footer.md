# 2026-11-15 문서 조절기 하단 바 배치

- 변경 ID: MDPRO-20261115-DOCUMENT-CONTROL-FOOTER
- 원본: C:/CusorApps/WebDav-MD/webdav-md (미커밋)
- 대상: C:/CusorApps/MDPRO/MDproViewer (읽기 비교만 수행, 수정 없음)
- 상태: WebDAV 구현. 실제 브라우저 UI 및 Viewer 이식/프런트엔드/네이티브 빌드/설치 앱 검증 미실행.

## 요청과 구현

기존 문서 조절기 전환 버튼을 세로 플로팅 → 가로 플로팅 → 하단 바 → 세로 플로팅 순환으로 확장했다. 최초 세로 기본값과 저장된 가로 선호를 보존한다. 하단 배치는 가로 한 줄이다.

- `mdpro/js/app.js`의 `initEditorShiftFloat`: 기존 `md-editor-shift-float-v1` 설정에 layout을 추가한다. footer이면 horizontal로 렌더링한다. 다음 목적지에 맞춰 아이콘/title/aria-label을 갱신하며, 하단 배치에서는 드래그를 시작하지 않는다.
- `syncEditorShiftFloatPosition`: 초기화 후 layout을 판정하여 동일 DOM을 `editor-shift-footer-slot` 또는 `drop-zone`으로 이동한다. footer에서는 좌표 스타일을 비우며, 플로팅 복귀 시 기존 x/y를 복원한다. 버튼과 이벤트를 복제하거나 재등록하지 않는다.
- `mdpro/index.html`: 파일 정보와 확대 컨트롤 사이에 하단 슬롯 추가, app.js 쿼리 캐시 버전 갱신.
- `mdpro/css/style.css`: 기존 footer 스타일 활용, 슬롯 가로 스크롤 및 하단 행 줄바꿈 허용. 빈 슬롯만 접는다.
- 보존 목록: 이동 손잡이, L/C/R, 긴/가/세, +P, 전환 버튼, 파일명/경로/용량/생성일, 헤더 확대/축소 및 기존 확대·배경·테마 컨트롤. 기존 페이지 추가 비활성 조건도 보존한다. 수식/인쇄/내보내기 파이프라인 변경 없음.

## 대상 적응과 Tauri

Viewer `js/app.js`에서 `applyEditorShiftFloatOrientation`, `toggleEditorShiftFloatOrientation`, 별도 위치 저장 함수 및 `.editor-shift-orientation-toggle`을 확인했다. WebDAV의 `.editor-shift-orientation`과 설정 구조가 다르다. 대상 초기화·저장 함수를 유지하면서 세 번째 상태와 실제 footer 슬롯을 추가해야 한다. 전체 파일 복사 금지. 대상 CSS/HTML 실제 배치 검증은 미실행이다.

대기 항목 MDPRO-20261115-DOCUMENT-CONTROL-FOOTER. 대상 웹 이식 후 JS/CSS/HTML을 프런트엔드 자산에 반영하고 실제 하단/플로팅 왕복을 검증한다. Tauri 빌드는 요청되지 않아 실행하지 않았다. 요청 시 대상 `Docs/mdpro-development/TAURI_BUILD.md`를 따른다.

## 검증

- `node --test tests/editorShiftOrientation.test.mjs`: 1개 통과. 세로 → 가로 → 하단 → 세로 상태와 접근성 라벨 확인.
- `node --check mdpro/js/app.js`: 통과.
- `git diff --check`: 줄바꿈 정리 후 통과.
- `npm run build`: 통과 (기존 500 kB 청크 크기 경고).
- 실제 브라우저에서 버튼 클릭/새로고침 저장 복원/좁은 폭 스크롤/기존 조절 동작은 미검증. 자동 검사를 실제 UI 증거로 간주하지 않는다.

## 다른 앱에서 다시 실행할 명령

```text
C:/CusorApps/MDPRO/MDproViewer에서 AGENTS.md와 WebDAV의 docs/mdpro-development/changes/2026-11-15-document-control-footer.md를 읽어줘. 문서 조절기의 기존 전환 버튼에 세로 플로팅 → 가로 플로팅 → 하단 바 순환 및 저장 복원을 추가해줘. 기존 applyEditorShiftFloatOrientation/위치 저장 구조와 대상 footer를 확인하고 전체 파일 덮어쓰기 없이 적응해줘. L/C/R·긴/가/세·+P·드래그와 기존 footer 컨트롤을 보존하고 넓은/좁은 화면, 새로고침, 플로팅 좌표 복원을 검증해줘. 변경 문서/인덱스/Tauri 대기 목록을 갱신하되 이번에는 Tauri 빌드하지 말고 미검증을 구분해 보고해줘.
```
