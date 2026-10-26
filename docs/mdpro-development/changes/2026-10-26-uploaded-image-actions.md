# 2026-10-26 업로드 이미지 도구와 접기/펼치기

- 변경 ID: MDPRO-20261026-UPLOAD-ACTIONS
- 원본: `C:/CusorApps/Webdav_md/webdav-md`; 대상: `C:/CusorApps/md-viewerVscode/md_viewer`
- 작성·확인: 2026-10-26 (Asia/Seoul), 미커밋. 기존 미커밋 작업을 유지한 추가 변경.
- 원본 구현 완료 / 상대 런타임·문서 사본 미적용 / 실제 브라우저·외부 서비스 미검증 / Tauri 준비·네이티브 빌드·설치 앱 미실행.

## 요청과 완료 기준

AI Jena 질문에 업로드한 이미지에도 생성 이미지와 같은 7개 버튼(이미지 저장, 문서삽입, 업로드 문서삽입, 이미지 편집, 이미지 복사, 크게 보기, FMA 보기)을 제공한다. 이미지와 파일명 아래 `이미지 도구 · 펼치기/접기`를 둔다. 업로드 이미지는 기본 접힘, 기존 생성 이미지는 기존 접근성을 위해 기본 펼침이며 둘 다 접을 수 있다. 이미지 자체 클릭으로 FMA를 여는 기존 동작과 문서/CSV 첨부를 보존한다. 전송 전 첨부 칩은 기존 동작을 유지한다.

## 실제 구현

- `mdpro/AI_App/aiChat/ai-chat.js`: 생성 이미지 렌더링의 기존 7개 버튼 코드를 `createImageActionDetails(image, imageIndex, initiallyOpen)`로 추출. 기본 HTML `details/summary`를 사용해 키보드 조작을 지원하고 toggle에서 `_imageActionsExpanded`와 문구를 갱신한다. 기존 생성 이미지 카드와 `appendUserAttachmentGallery`가 공통 함수를 호출한다.
- `attachmentImageActionSource(attachment)`는 업로드 파일의 base64 data URL을 기존 생성 이미지 함수의 `{mimeType, data}` 형태로 변환한다. `documentUrl`, `imgbbUrl`, `_documentInsertBusy`, `_imageActionsExpanded`는 getter/setter로 원본 첨부에 연결한다. 이로써 문서삽입 후 재렌더링에서도 URL 재사용, 중복 작업 방지 및 펼침 상태를 유지하며, 첨부 이력에 base64 사본을 추가 저장하지 않는다. 원본 `dataUrl`은 변경하지 않는다.
- 저장·삽입·업로드·편집·복사·미리보기·FMA 핸들러는 기존 함수를 그대로 사용한다. 이미지 편집은 기존 별도 편집 창과 선택 공급자 경로를 따른다.
- `mdpro/AI_App/aiChat/ai-chat.css`: summary 및 포커스 표시 추가, 기존 3/2/2 버튼 그리드와 스타일을 업로드 이미지에도 적용. 요청한 details 접기 이외의 기존 컨트롤 숨김/삭제 없음.
- `mdpro/js/app.js` AI Chat 스크립트 및 `mdpro/index.html` CSS 캐시 버전을 `20261026-image-actions-1`로 갱신. 기존 UI 계약의 버전 검사도 동기화. 신규 의존성 없음.

## 상대 앱 대응표와 이식 순서

| 원본 | 대상 실제 코드 | 차이·선행 조건 | 상태 |
| --- | --- | --- | --- |
| `mdpro/AI_App/aiChat/ai-chat.js` 공통 도구와 업로드 갤러리 | `AI_App/aiChat/ai-chat.js`의 `appendUserAttachmentGallery` 및 생성 이미지 actions | 대상도 업로드 이미지는 img/figcaption만 있음. CSV는 대상의 `openCsvAttachmentViewer` 경로를 유지해야 함 | 읽기 확인, 미이식 |
| `mdpro/AI_App/aiChat/ai-chat.css`, `mdpro/index.html`, `mdpro/js/app.js` | 대상 `AI_App/aiChat/ai-chat.css`, `index.html`, `js/app.js` | 대상 로더·캐시 버전과 CSS 위치를 확인한 뒤 국소 이식 | 미이식 |

대상 공급자·비전·FMA 브리지는 독립 구현이다. 전체 파일 복사 금지. 대상의 기존 7개 핸들러, 내부 저장/업로드 반환값, data URL 첨부 형식을 먼저 확인하고 공통 도구 추출 → 첨부 어댑터 → CSS/버전 → 회귀 검사 순서로 적용한다. 다른 앱의 수정과 빌드는 이번 요청에 포함되지 않는다.

## 회귀 예제와 검증

- `tests/aiChatImageActions.test.mjs`: 업로드 JPEG의 7개 실제 클릭 핸들러와 삽입 방식 인자, base64/MIME 전달, 원본 보존, 접기/펼치기 및 재렌더링 상태, 저장 URL 재사용, busy 비활성, 혼합 문서 첨부, 생성 이미지 기본 펼침 검사.
- `node --test tests/aiJenaUiContract.test.mjs tests/aiChatImageActions.test.mjs tests/aiChatImageAttachments.test.mjs tests/aiImageIdentity.test.mjs`: 46개 통과, 실패 0. 초기 캐시 버전 기대값 불일치 2개는 새 버전으로 갱신 후 재검사 통과.
- `node --check mdpro/AI_App/aiChat/ai-chat.js`, `git diff --check`: 통과.
- `npm run build`: 종료 코드 0, 성공. Vite 플러그인 소요시간 및 500kB 초과 chunk 경고가 남음.
- 실제 브라우저 화면, 다운로드·OS 클립보드·실문서 삽입·imgBB 업로드·편집 모델·FMA 실행은 미검증. 자동 검사는 DOM 모형 및 핸들러 연결 증거이며 외부 작업 성공 증거가 아니다.

## Tauri 반영 계획

빌드 대기 ID `MDPRO-20261026-UPLOAD-ACTIONS`. 대상 웹 이식 후 JS/CSS 및 로더·HTML 자산을 대상 빌드 절차에 따라 준비해야 한다. 빌드 요청 시 대상 `Docs/mdpro-development/TAURI_BUILD.md`를 읽고 frontend 검사, `Tauri/dist` 반영 확인, 네이티브 빌드, 설치 앱에서 업로드 이미지 도구 및 각 동작 검증을 각각 기록한다. 이번 작업에서는 실행하지 않았다.

## 다른 앱에서 다시 실행할 명령

```text
C:/CusorApps/md-viewerVscode/md_viewer에서 작업해줘. AGENTS.md와 C:/CusorApps/Webdav_md/webdav-md/docs/mdpro-development/changes/2026-10-26-uploaded-image-actions.md를 읽고 AI Jena 업로드 이미지에 저장, 내부 문서삽입, 업로드 문서삽입, 편집, 복사, 크게 보기, FMA 보기와 접기/펼치기를 구현해줘. 업로드는 기본 접힘, 기존 생성 이미지는 기본 펼침으로 하고 재렌더링 상태·저장 URL·원본 첨부·CSV 경로를 보존해줘. 기존 핸들러와 data URL 형식을 먼저 확인하고 전체 파일을 덮어쓰지 말아줘. 버튼 인자·상태 보존 회귀 검사를 실행하고 이식 문서·목록·Tauri 대기 상태를 갱신해줘. Tauri 빌드는 실행하지 말고 실제 UI 및 외부 서비스 미검증 항목을 구분해서 보고해줘.
```
