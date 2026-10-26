# 2026-10-27 링크 삽입 후 Alt+화살표 이동 시 원문 보존

- 변경 ID: `MDPRO-20261027-LINK-PERSIST`
- 원본: `C:\CusorApps\Webdav_md\webdav-md` / 대상: `C:\CusorApps\md-viewerVscode\md_viewer`
- 작성·확인: 2026-10-27 / 미커밋. 기존 다른 작업의 수정 사항은 보존했다.
- 상태: WebDAV 구현·자동 검사·웹 빌드 완료, 실제 브라우저 미검증. Viewer 읽기 비교만 수행, 이식·네이티브 빌드·설치 앱 검증 미실행.

## 요청과 원인

링크 삽입 직후에는 `<a href="kge_분석요청 241120_arrange_report_v5.2.pdf" target="_blank">…</a>`가 보이지만 Alt+위/아래로 줄을 이동하면 사라지는 문제다. 삽입 모달은 `document.execCommand('insertText')`로 CodeMirror의 contenteditable DOM에 직접 입력했다. 이 경로는 CodeMirror 문서 transaction을 거치지 않아 문서 값과 화면이 달라질 수 있고, 줄 이동 등 재그리기 시 삽입물이 유실될 수 있다.

## 구현과 호출 순서

1. `mdpro/js/app.js`의 `confirmModalInsert()`가 기존 `replaceEditorSelectionText`를 `replaceSelectionText` 의존성으로 전달한다.
2. `mdpro/js/Imagetool/link-image-modal.js`의 `confirm()`은 선택 범위에 대해 이 공통 함수를 호출한다. CodeMirror에서는 `changes: {from, to, insert}` transaction과 `userEvent: 'input'`으로 실제 문서 및 실행 취소 기록에 반영한다.
3. 의존성 없이 모달을 사용하는 경우에도 CodeMirror view가 있으면 같은 transaction을 보내고, 일반 textarea이면 `setRangeText`로 교체한다. native DOM `execCommand` 삽입은 제거했다.
4. 기존 `onInserted` → `currentMarkdown` 동기화 → `performAutoSave()` 흐름과 커서·스크롤 복원을 보존했다. 링크의 URL, 공백·한글, 표시 문자열, `_blank` 설정을 변경하지 않았다. 이미지·ID 삽입도 같은 문서 갱신 경로를 사용한다.
5. `mdpro/index.html`의 모달 버전을 `20261027-persistent-insert-1`로, app 쿼리를 `linkInsert=20261027-1`로 갱신했다. 새 의존성은 없다.

## 상대 앱 대응과 이식 순서

| WebDAV | Viewer 실제 확인 | 차이·조치 | 상태 |
| --- | --- | --- | --- |
| `mdpro/js/Imagetool/link-image-modal.js` `confirm` | `js/Imagetool/link-image-modal.js` `confirm`, native `execCommand` 사용 | 대상도 직접 DOM 삽입 경로 존재. 대상 editor 연결을 확인해 transaction/textarea 분기 이식 | 미이식 |
| `mdpro/js/app.js` `confirmModalInsert`, `replaceEditorSelectionText` | `js/app.js` `confirmModalInsert` 존재, 여러 삽입 함수에서 native `execCommand` 사용 | 원본 공통 함수의 존재를 가정하지 말고 대상 CodeMirror 브리지를 확인해 필요한 범위만 추가 | 미이식 |
| `mdpro/index.html` 캐시 쿼리 | 대상 별도 `index.html` | 대상 기존 버전과 브리지 보존, 변경 자산만 캐시 갱신 | 미이식 |

전체 파일을 복사하지 않는다. 저장·프록시·AI 등 앱별 독립 코드를 보존한다. 이번 변경은 메인 편집기 삽입만 대상으로 하며 PV/miniPV/수식/인쇄/내보내기 구현은 변경하지 않았다.

## 검증

- `node --test tests/linkModalPersistence.test.mjs tests/editorCopyLineDown.test.mjs`: 14/14 통과.
- 새 8개 검사: 공통 삽입/독립 모달 × CodeMirror/textarea에서 HTML 링크를 선택 영역에 삽입하고 위아래 이동을 4회 반복한 뒤 원문·currentMarkdown 보존 확인. Markdown 링크·이미지·ID 삽입 및 커서, 스크롤도 확인.
- CodeMirror 검사는 transaction을 적용하는 VM 모형을 사용했다. 실제 CodeMirror 브라우저·렌더링·실행 취소 UI·WebDAV 서버 저장은 미검증이다.
- 기존 줄 복사 테스트가 Windows CRLF에서 함수 추출 경계를 찾지 못해 `window is not defined`로 실패했다. 테스트 입력 소스만 LF로 정규화해 해결했다. 앱 줄 복사 동작 변경은 없다.
- `node --check mdpro/js/Imagetool/link-image-modal.js`, `node --check mdpro/js/app.js`, `git diff --check`: 통과.
- `npm run build`: 성공. 기존 500 kB 초과 chunk 경고 있음.
- 실제 UI 완료 기준: 새 창 링크와 일반 링크 삽입 → Alt+위/아래로 링크 줄 또는 인접 줄 이동 → 편집/보기 전환 및 저장·재열기 후 href/target/표시 문자열 유지 → 실행 취소/다시 실행 확인.

## Tauri 반영 계획

대기 항목 `MDPRO-20261027-LINK-PERSIST`. 대상 웹 자산 `js/Imagetool/link-image-modal.js`, `js/app.js`, `index.html`에 선택적으로 이식하고 검사한 뒤, 사용자 빌드 요청 시 대상 `Docs/mdpro-development/TAURI_BUILD.md` 절차를 따른다. `Tauri/dist` 자산의 새 캐시 버전과 transaction 삽입 코드를 확인하고 설치 앱에서 위 UI 시나리오를 반복한다. 이번에는 대상 자산을 수정하거나 Tauri 빌드하지 않았다.

## 다른 앱에서 다시 실행할 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md와 C:\CusorApps\Webdav_md\webdav-md\docs\mdpro-development\changes\2026-10-27-link-insert-persistence.md를 읽고, 링크 삽입 후 Alt+위/아래 이동 때 링크가 사라지는 문제를 이식 수정해줘. 대상 CodeMirror 브리지와 confirmModalInsert를 먼저 확인하고, 모달의 execCommand 직접 삽입을 문서 transaction 및 일반 textarea 교체로 바꿔줘. 전체 파일을 덮어쓰지 말고 새 창 링크·공백/한글 파일명·일반 링크·이미지·ID 삽입, 줄 이동, 저장 복원, 실행 취소를 검증해줘. 기술문서·목록·Tauri 대기 상태를 갱신하고 실제 UI 미검증을 구분해줘. Tauri 빌드는 이번 명령에 포함하지 않아.
```
