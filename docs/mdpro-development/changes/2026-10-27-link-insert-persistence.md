# 2026-10-27 링크 삽입 후 Alt+화살표 이동 시 원문 보존

- 변경 ID: `MDPRO-20261027-LINK-PERSIST`
- 원본: `C:\CusorApps\Webdav_md\webdav-md` / 대상: `C:\CusorApps\md-viewerVscode\md_viewer`
- 작성·확인: 2026-10-27 / 미커밋. 기존 다른 작업의 수정 사항은 보존했다.
- 상태: WebDAV 구현·48개 검사·웹 빌드 완료. 실제 Edge에서 링크 삽입 → WDsave 브리지 → 격리 HTTP 디스크 저장 → 새로고침 → 재열기 검증 완료(아래 추가 수정 참고). 사용자 NAS 서버 재열기 및 배포 반영은 미검증. Viewer 읽기 비교만 수행, 이식·네이티브 빌드·설치 앱 검증 미실행.

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

## 추가 수정: WDsave 후 새로고침 시 링크 유실 제보

사용자는 WDsave(원본 WebDAV 저장)를 사용한다고 확인했다. 앞선 모형 검사는 줄 이동만 확인했으며 실제 저장·새로고침 경로를 검증하지 못했다. 이번에는 다음을 보강하고 실제 브라우저 증거를 남겼다.

### 확인한 사실과 원인 범위

- 열려 있던 GitHub Pages 배포 탭의 iframe DOM에서 `link-image-modal.js?v=20260811-new-window-1`을 확인했다. 로컬은 앞선 수정 `20261027-persistent-insert-1`을 사용했다. 따라서 열린 배포 탭에는 앞선 수정조차 로드되지 않았다. 이것이 사용자가 제보한 모든 유실의 유일한 원인임을 단정하지 않는다. 배포 서버 파일이나 사용자 NAS 원본을 수정하지 않았다.
- `LinkImageModal.confirm`의 프로그램식 삽입은 브라우저 `input` 이벤트를 발생시키지 않았다. CodeMirror는 보통 120ms 뒤 알림을 보내지만 일반 textarea는 알림이 없었고, WebDAV 호스트 변경 보고·A4 동기화는 이벤트나 300ms 폴링에 의존했다.
- `performAutoSave`는 편집기 원문을 재조회하지 않고 `currentMarkdown`으로 snapshot을 만들었다.
- 일반 Markdown 링크는 공백을 포함한 URL을 그대로 `[label](file name.pdf)`로 생성해, 저장 원문을 Markdown-it으로 다시 해석하면 링크가 아니라 일반 문자열이었다. 이는 실제 Markdown-it 재파싱으로 확인했다. HTML 새 창 링크와는 별개의 경로다.
- WebDAV 호스트의 `currentDocumentText()`는 textarea 원문을 읽으며, 부모 `handleSaveFile`은 `saveFileVerified`로 PUT 후 GET 일치를 검사한다. 검사한 코드에는 HTML 링크를 일부러 제거하는 처리가 없다.

### 추가 구현

- `LinkImageModal.confirm`: `onInserted`와 커서 복원 이후 `editorTextarea.dispatchEvent(new Event('input', { bubbles: true }))`를 즉시 발생시킨다. 저장·호스트 알림·A4 편집기가 동일 원문을 보도록 한다. CodeMirror의 후속 지연 알림은 기존 중복 검사에 맡긴다.
- 일반 링크의 목적지에서 공백·`<`·`>`를 `url.replace(/[\s<>]/g, encodeURIComponent)`로 처리한다. 표시 문자열은 유지하고 새 창 HTML 링크 생성 형식도 유지한다. 이미지 생성 경로는 변경하지 않았다.
- `performAutoSave`: 함수 시작에서 `syncCurrentMarkdownFromEditor()`를 호출해 debounce 전에도 최신 편집기 원문으로 저장 snapshot을 생성한다.
- 캐시 식별: 모달 `20261027-save-persistence-2`, app `linkInsert=20261027-2`.

### 실제 브라우저와 디스크 왕복 검증

- `scripts/verify-link-save-server.mjs`는 `127.0.0.1` 임시 포트에만 바인딩하고 실제 앱 자산 및 실제 `webdav-host-bridge.js`를 사용한다. 호스트 역할의 작은 fixture가 WDsave 메시지를 받아 `artifacts/link-save-browser/saved.md`에 HTTP PUT으로 저장하고 GET으로 일치를 검사한다. 인증정보나 사용자 WebDAV 문서를 읽지 않는다.
- Edge에서 실제 편집기 및 링크 모달로 공백·한글 PDF 파일명을 삽입했다. WDsave 버튼을 눌러 디스크 저장 성공을 확인하고 브라우저 전체를 새로고침했다. 다시 로드된 편집기 원문과 보기 DOM의 href/target/label을 검사했다. 새 창 링크와 일반 링크를 각각 저장·재열기했다.
- 증거: [저장 원문](../../../artifacts/link-save-browser/saved.md), [재열기 화면](../../../artifacts/link-save-browser/after-reload.jpg).
- 이 환경의 저장 서버는 격리된 로컬 HTTP fixture이며 사용자 NAS 서버는 아니다. 초기 실제 WebDAV 탭에서도 별도로 생성한 빈 `/test/새 문서.md`에 새 창 링크를 삽입해 WDsave를 눌렀지만, 새로고침 후 로그인 세션이 없어 사용자 NAS 재열기 검증을 완료하지 못했다. 기존 사용자 문서는 변경하지 않았다. 최종 성공 증거는 위 격리 fixture 결과다.
- `node --test tests/linkModalPersistence.test.mjs tests/editorCopyLineDown.test.mjs tests/webdavAutosave.test.mjs tests/webdavCrud.test.mjs`: **48/48 통과**. 즉시 입력 알림·실제 저장 함수와 UTF-8 왕복·HTML/일반 링크 재파싱·debounce 이전 snapshot을 추가 확인했다.
- `node --check`로 app/모달/검증 서버 구문 확인, `git diff --check`, `npm run build`: 성공. 기존 chunk 크기 경고는 유지된다.

### 상대 앱·배포 상태와 추가 이식 명령

Viewer의 모달은 여전히 native `execCommand` 경로이고 `performAutoSave`도 원문 재조회 없이 시작함을 다시 읽기 확인했다. 대상 웹 이식, Tauri 프런트엔드 준비·빌드·설치 검증은 모두 미실행이다. 현재 배포 탭의 구버전 문제는 로컬 수정이나 웹 빌드만으로 해결되지 않으며, 최신 자산 배포 및 재로딩이 필요하다. 커밋·푸시·배포는 실행하지 않았다.

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 위 이식 명령과 함께 이 문서의 '추가 수정'도 적용해줘. 삽입 직후 bubbling input 알림, 저장 snapshot 전 원문 재조회, 공백 파일명의 Markdown URL 보존을 이식하고 실제 저장·새로고침·재열기까지 검증해줘. 검증 서버는 사용자 NAS와 분리하고 구분해서 보고해줘. 대상 문서·목록·Tauri 대기 상태를 갱신하되 Tauri 빌드나 배포는 하지 않아.
```
