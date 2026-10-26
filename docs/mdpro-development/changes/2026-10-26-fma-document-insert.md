# 2026-10-26 내부 FMA에서 문서 IMG로 보내기

- ID: `MDPRO-20261026-FMA-INSERT`
- 원본: `C:\CusorApps\Webdav_md\webdav-md` / 대상: `C:\CusorApps\md-viewerVscode\md_viewer`
- 확인일: 2026-10-26 (Asia/Seoul). 원본 미커밋. 상대 앱 수정·문서 사본·Tauri 빌드·설치 검증 미실행.

## 요청과 완료 기준

AI Jena의 첨부 사진을 FMA로 연 뒤 사진 상단의 문서 추가 아이콘을 눌러도 문서 이미지 삽입창에 사진이 들어오지 않았다. 버튼 클릭으로 FMA가 닫히고 편집 모드의 기존 IMG 창이 열리며, 선택 사진과 파일명이 미리보기/URL 입력에 채워져야 한다. 이후 사용자가 기존 저장·삽입 기능을 선택하는 흐름을 유지한다.

## 실제 구현과 원인

- `mdpro/Apps/fmaviewer/js/gallery/preview.js`의 documentInsertBtn은 `FMAMdViewerBridge.sendAction('fmaviewer-send-to-mdpro-img', idx)`를 호출한다. child의 `mdViewerBridge.js`는 해당 인덱스 사진의 src/path/name을 부모로 보낸다.
- WebDAV 외부 FMA 창은 React `src/components/MdproEditor.jsx`를 통해 이 메시지가 처리되지만, 채팅에서 연 **내부** FMA는 `mdpro/js/internal-image-app.js`의 handleMessage가 직접 받는다. 이 수신기는 구형 `fmaviewer-open-image-insert`만 처리하여 새 메시지를 무시했다.
- handleMessage의 기존 분기에 `|| data.type === 'fmaviewer-send-to-mdpro-img'`를 추가했다. 두 이름 모두 기존 openImageInsertFromViewer(image)로 연결한다. iframe source 검사는 그대로 유지한다.
- 처리 순서: imageToDataUrl → close → ensureEditMode → openImageInsertModal → applyImageInsertDataUrl → 준비 상태 안내. data URL과 blob URL 모두 기존 변환 경로를 사용한다. IMG 기능이 없으면 FMA를 닫기 전에 오류를 표시한다.
- `mdpro/index.html`의 internal-image-app.js 캐시 버전을 `20261026-document-insert-1`로 갱신했다. 버튼·CSS·저장 방식·기존 구형 메시지·외부 React FMA 라우팅은 수정하지 않았다. 신규 의존성 없음.
- 이전 작업의 AI 이미지 전송·편집 첨부 복원 변경은 그대로 보존했다. 이번 작업은 대화 모델 요청을 변경하지 않는다.

## 상대 앱 대응과 이식

대상 `js/internal-image-app.js`를 읽어 handleMessage가 구형 `fmaviewer-open-image-insert`만 처리하는 것을 확인했다. 대상 `Apps/fmaviewer/js/gallery/preview.js`의 버튼은 구형 `fmaviewer-open-image-insert`를 전송하여 수신기와 일치한다. 따라서 이번 WebDAV의 메시지 불일치가 대상에도 있다고 단정하지 않는다. 대상의 실제 버튼/도구 메뉴와 iframe 송신 코드를 확인한 뒤 새 이름 별칭이 필요한 경우에만 추가한다. 대상의 독립 창·Electron/Tauri 브리지와 파일 읽기 코드는 보존하며 전체 파일을 덮어쓰지 않는다.

| 원본 | 대상 | 이식 상태 |
| --- | --- | --- |
| mdpro/js/internal-image-app.js의 handleMessage | js/internal-image-app.js의 동명 함수 | 구형 수신 확인, 미수정 |
| mdpro/Apps/fmaviewer/js/gallery/preview.js의 버튼 | Apps/fmaviewer/js/gallery/preview.js 및 실제 송신 도구 | 구형 메시지 송신 확인, 기존 수신기와 일치 |
| mdpro/index.html 캐시 키 | index.html 실제 script 참조 | 대상 변경 시 갱신 필요 |

## 검증

- 신규 `tests/fmaDocumentInsert.test.mjs` 5개 통과: 실제 버튼 메시지 이름을 읽어 child sendAction → host handleMessage → 실제 applyImageInsertDataUrl 함수까지 모의 실행. 현재 인덱스와 다른 선택 인덱스의 사진, 채팅 data URL, blob 변환, 파일명·URL 입력값, 창 닫기/편집/IMG 열기 순서를 확인했다. 구형 메시지 호환, 다른 iframe 메시지 무시, IMG API 누락 시 오류도 확인했다.
- 관련 검사: `node --test tests/fmaDocumentInsert.test.mjs tests/aiChatImageAttachments.test.mjs tests/aiJenaUiContract.test.mjs` 통과(43개).
- `node --check mdpro/js/internal-image-app.js`, `git diff --check` 통과.
- `npm run build` 성공. 큰 청크 안내는 기존 상태다.
- 실제 브라우저에서 버튼 클릭, 이미지 내부 저장 후 Markdown/HTML 최종 삽입, 원격 imgBB 업로드, 배포 앱 동작은 미검증. 위 검사는 실제 DOM 전체·iframe 브라우저 검증이 아닌 VM 기반 브리지 회귀 검사다.

## Tauri 대기

빌드 대기 ID `MDPRO-20261026-FMA-INSERT`. 대상 메시지 계약 확인 후 필요한 경우 js/internal-image-app.js 및 엔트리 캐시 키를 수정하고 대상 웹에서 채팅 → FMA → IMG를 확인한다. 네이티브 빌드 요청이 있을 때만 대상 Docs/mdpro-development/TAURI_BUILD.md에 따라 자산 포함·빌드·설치 검증한다. 현재 대상 웹 적용, 프런트엔드 준비, 네이티브 빌드, 설치 검증은 모두 미실행이다.

## 재명령 프롬프트

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md와 Docs/mdpro-development/README.md,
C:\CusorApps\Webdav_md\webdav-md\docs\mdpro-development\changes\2026-10-26-fma-document-insert.md를 읽어줘.
채팅 이미지를 내부 FMA에서 열고 문서 IMG로 보내는 버튼의 실제 송신 이름을 확인해줘.
필요하면 js/internal-image-app.js에 fmaviewer-send-to-mdpro-img와 구형 fmaviewer-open-image-insert를
동일 삽입 경로로 연결해줘. 선택 사진/파일명·data URL/blob 변환·source 검사·기존 메뉴를 보존해줘.
전체 파일 덮어쓰기 없이 테스트와 실제 웹 동작을 확인하고 이식 목록·Tauri 대기를 갱신해줘.
Tauri 빌드와 배포는 하지 말고 미검증 항목을 구분해줘.
```
