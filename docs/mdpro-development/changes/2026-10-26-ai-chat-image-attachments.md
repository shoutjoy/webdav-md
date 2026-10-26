# 2026-10-26 AI Jena 이미지 입력과 질문 첨부 복원

- 변경 ID: `MDPRO-20261026-AI-IMAGES`
- 원본: `C:\CusorApps\Webdav_md\webdav-md`, 대상: `C:\CusorApps\md-viewerVscode\md_viewer`
- 작성·확인: 2026-10-26 (Asia/Seoul), 원본 미커밋. 상대 문서 사본은 작성하지 않음.
- 상태: WebDAV 구현·자동 검사·웹 빌드 완료. 실제 브라우저 조작·모델 시각 인식 미검증. 상대 코드 읽기 비교만 수행, 이식·Tauri 준비·네이티브 빌드·설치 앱 검증 미실행.

## 요청과 완료 기준

첨부한 인물 사진을 설명해 달라는 질문에 로고 설명이 반환되었고, 질문 편집 시 사진이 입력창에 복원되지 않았다. 화면상의 사진 표시는 모델에 이미지가 전달되었다는 증거가 아니다. 실제 요청 본문에 이미지 바이트를 넣고, 편집과 다시 질문에서 원래 첨부를 복원해야 한다. 모델 자체의 정확도는 이미지 지원 모델을 통한 별도 실사용 확인이 필요하다.

## 실제 구현

1. `mdpro/js/app.js`의 `aiChatMessagesWithImageContent(messages)`를 추가했다. 내부 `{role, content, attachments}`를 API용 `{role, content: [{type:'text',text}, {type:'image_url',image_url:{url:dataUrl}}]}`로 변환한다. 이미지가 없는 메시지는 문자열 content를 유지한다. 이미지 데이터가 없거나 base64 data URL 형식이 아니면 재첨부 오류를 내며 텍스트 요청으로 진행하지 않는다.
2. `AIChatBridge.complete`의 Lemonade/OpenAI 호환 분기에서 기존 컨텍스트 조정 **후** 위 변환을 적용한다. 이전에는 사용자 첨부 메타데이터를 그대로 messages에 넣어 모델이 이미지 없이 질문과 파일명만 받을 수 있었다. 스트리밍/JSON 양쪽이 같은 requestBody를 사용하므로 둘 다 수정된다. 모델 선택, thinking, 토큰 설정과 이미지 생성 모델의 generateLemonadeImage 분기는 유지한다.
3. 같은 complete 진입점에서 첨부 이미지가 있는 LM Studio/Ollama/NPU/LiteRT-LM 요청은 기존 `completeLocalImageToolRequest`의 이미지 입력 경로로 보낸다. Ollama는 images 배열의 base64, 다른 로컬 공급자는 image_url을 사용한다. DeepSeek는 기존 이미지 미지원 오류를 표시한다. OpenAI와 Gemini는 기존 이미지 처리를 유지한다. 로컬 공용 이미지 도구 경로는 기존 비스트리밍 요청과 최대 2048 토큰 설정을 사용한다. 텍스트 전용 채팅은 기존 경로를 유지한다.
4. `clipAIChatHistoryMessage`는 `{role,content}`만 새로 만들던 두 반환을 `Object.assign({}, message, {content})`로 바꿔 보존된 과거 턴을 자를 때 첨부 바이트가 유실되지 않게 했다. 컨텍스트 한도에 의해 턴 전체가 제외되는 기존 정책은 유지한다.
5. `mdpro/AI_App/aiChat/ai-chat.js`의 `putQuestionInComposer(message,sendImmediately)`는 질문 객체를 받아 attachments를 얕은 복사하고 pendingAttachments를 교체한 뒤 `renderPendingAttachments`를 호출한다. 편집/다시 질문 두 버튼 모두 문자열 대신 메시지를 전달한다. 첨부 로딩 중에는 복원하지 않으며, 사진을 ×로 제거하거나 추가한 후 전송할 수 있다. 이미지와 문서 첨부 모두 복원되며 원본 대화 객체는 수정하지 않는다. 텍스트 전용 질문 편집은 이전 입력창의 첨부를 비운다.
6. `mdpro/index.html`의 app.js 쿼리와 app.js의 AI Jena 지연 로딩 버전을 갱신했다. 테스트의 두 캐시 버전 기대값도 갱신했다. CSS·기존 컨트롤·ID·문서/PV/내보내기 동작은 수정하지 않았다. 신규 의존성 없음.

## 상대 앱 대응표와 이식 순서

2026-10-26 대상 파일을 실제로 읽어 확인했다. 상대 런타임 수정은 요청 범위에 포함하지 않았다.

| 원본 | 대상 실제 코드 | 확인된 차이·선행 조건 | 상태 |
| --- | --- | --- | --- |
| `mdpro/AI_App/aiChat/ai-chat.js`의 putQuestionInComposer | `AI_App/aiChat/ai-chat.js`의 동명 함수 | 대상은 이미 객체·첨부 복원과 로딩 가드를 구현함. 대상은 requestSendMessage/입력 스크롤 처리도 있으므로 원본 함수를 덮어쓰지 말 것 | 동등 복원 경로 확인, UI 미검증 |
| `mdpro/js/app.js`의 AIChatBridge.complete | `js/app.js`의 complete, completeTaskVision | 대상은 hasTaskImages에서 completeTaskVision으로 라우팅함. 원본의 이미지 누락과 동일 상태라고 판정할 수 없음. 대상에는 별도 큐·공급자 선택 구조가 있음 | 전송 형식·공급자별 지원 재검증 필요 |
| 이미지 컨텍스트 보존·검증 | 대상 normalizeAIChatMessages 및 이미지 전송 경로 | 보존된 턴 clipping과 잘못된 dataUrl 처리까지 추가 확인하고 필요한 부분만 이식 | 대상 확인 필요 |

전체 app.js/ai-chat.js를 복사하지 않는다. 대상의 AGENTS와 개발 문서를 먼저 읽고 모델별 라우팅, 큐 전송, 스트리밍, 저장소 구조를 유지한다.

## 회귀 예제와 검증

- `tests/aiChatImageAttachments.test.mjs` 신규 9개: Lemonade/OpenAI 호환 각각 JSON·스트리밍의 image_url 바이트, 누락 데이터 오류, 로컬 공급자 이미지 라우팅과 텍스트 경로, 편집·재질문 첨부 복원/원본 보존/기존 첨부 비우기, 과거 턴 clipping 시 이미지 보존.
- `node --test tests/aiChatImageAttachments.test.mjs tests/aiToolProviders.test.mjs tests/aiJenaUiContract.test.mjs tests/aiGeneralAnswerMode.test.mjs`: 51개 통과. API 요청 검증은 실제 서비스 대신 요청을 캡처하는 VM/fetch 모의 검사이다.
- `node --check mdpro/AI_App/aiChat/ai-chat.js`, `node --check mdpro/js/app.js`, `git diff --check`: 통과.
- `npm run build`: 성공, 기존 큰 청크 안내 발생.
- 확대 검사 `aiCompatibleContext.test.mjs` 7개와 `aiOllamaGenerationSettings.test.mjs` 5개는 실패. 변경 전 HEAD 소스를 임시 테스트에 주입한 비교에서도 각각 동일하게 7/7, 5/5 실패: 이전 컨텍스트 함수가 없고 Ollama 테스트 localStorage.setItem 모의 구현이 빠져 있음. 이번 이미지 수정 범위에서 해당 기존 검사는 고치지 않았다.
- 로컬 기본 주소 `http://localhost:8000/api/v1/models` 읽기는 연결 거부. 실제 인물 사진 인식 결과와 실제 UI 클릭·IndexedDB 재시작 복원은 검증하지 못했다. Playwright도 현재 프로젝트에서 찾을 수 없었다. 배포/커밋/푸시 미실행.
- 수동 완료 기준: 이미지 지원 모델에서 구별 가능한 사진 두 장을 각각 첨부하여 설명 확인, 편집 시 같은 썸네일 확인, 수정 후 재전송 요청의 image_url/images 확인, 다시 질문/× 제거/사진 교체/대화 재열기 후 복원 확인. 생성 모델은 기존 생성 기능을 유지해야 한다.

## Tauri 반영 계획

빌드 대기 ID `MDPRO-20261026-AI-IMAGES`. 대상은 일부 동등 기능이 이미 있으므로 먼저 실제 요청과 편집 UI를 검증한 뒤 필요한 차이만 적용한다. 변경이 필요하면 `js/app.js`, `AI_App/aiChat/ai-chat.js`, 실제 엔트리의 캐시 키와 관련 테스트가 자산 대상이다. 대상 웹 검증과 `Docs/mdpro-development/TAURI_BUILD.md`에 따른 준비·dist 확인·네이티브 빌드·설치 앱 검증은 별도 요청 때 수행한다.

## 다른 앱에서 다시 실행할 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 작업해줘. AGENTS.md와 Docs/mdpro-development/README.md,
C:\CusorApps\Webdav_md\webdav-md\docs\mdpro-development\changes\2026-10-26-ai-chat-image-attachments.md를 읽어줘.
대상에는 putQuestionInComposer 첨부 복원과 completeTaskVision 경로가 이미 있으므로 실제 구현부터 비교해줘.
이미지 설명 요청의 실제 image_url/images 바이트, 편집·재질문 첨부 복원, clipping 후 첨부 보존,
누락 이미지 오류 처리를 검증하고 필요한 차이만 구현해줘. 큐·모델 선택·기존 이미지 생성과 텍스트 채팅을 보존해줘.
전체 파일 덮어쓰기 없이 회귀 검사를 실행하고 이식 문서·목록·Tauri 대기를 갱신해줘.
Tauri 빌드와 배포는 실행하지 말고 실제 모델/UI 미검증 항목을 구분해 보고해줘.
```
