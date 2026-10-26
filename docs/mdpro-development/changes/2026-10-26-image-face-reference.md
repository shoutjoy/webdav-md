# 2026-10-26 AI Jena 얼굴 참조를 유지하는 이미지 재생성

- 변경 ID: MDPRO-20261026-FACE-REFERENCE
- 원본: `C:\CusorApps\Webdav_md\webdav-md`, 대상: `C:\CusorApps\md-viewerVscode\md_viewer`
- 작성·확인일: 2026-10-26. 미커밋. 기존 첨부 이미지·설치 모델 목록 작업을 보존한 추가 수정.
- 상태: WebDAV 구현·자동 검사·빌드·로컬 옵션 UI 확인 완료. 실제 인물 생성 품질 미검증. 상대 앱 읽기 비교만 수행, 이식·프런트엔드 준비·네이티브 빌드·설치 앱 확인 미실행.

## 요청과 완료 기준

인물 사진을 첨부하고 동작·자세를 바꿀 때 실제 이미지 파일을 참조로 전송하고, 얼굴 특징을 유지하도록 지시한다. 얼굴 고정 알고리즘이나 학습 LoRA를 추가한 것은 아니므로 같은 얼굴을 완벽히 보장하지 않는다.

AI Jena 입력창 아래에 `얼굴 유지` 체크박스와 `이미지 생성 · 첫 사진이 얼굴 기준` 안내를 추가했다. 기본 켜짐, `ss_ai_chat_preserve_image_identity`에 저장. 일반 텍스트 대화에는 지시를 추가하지 않는다. 이미지 생성 모델에서 참조 사진이 있는 최신 사용자 요청에만 적용한다. 끄면 얼굴 유지 지시 없이 기존 편집 요청을 전달한다. 기존 ImgG/첨부/실시간 문서 작성/전송/중지 컨트롤을 보존하며 버튼 행의 공간을 줄이지 않도록 별도 행에 배치했다.

사용 순서: Lemonade의 Flux-2-Klein-4B 선택 → 인물 사진을 첫 번째로 첨부 → 얼굴 유지 켜기 → “이 인물이 오른팔을 들고 인사하는 자세로 바꿔줘” → 전송. 결과의 이미지 편집 창에서도 얼굴 유지 옵션을 사용할 수 있다. 여러 참조일 때 첫 사진은 얼굴 기준, 마지막 사진은 현재 장면 기준이다. 얼굴 자체를 바꾸려면 옵션을 끈다.

## 실제 구현

### `mdpro/AI_App/aiChat/ai-chat.js`

- `imageIdentityMessages(messages, enabled)`: 최신 사용자 메시지를 복제하고, 이미지 첨부가 있으면 첫 참조를 identity anchor로 지정하는 영문 편집 프롬프트를 추가한다. 눈 모양·간격, 코, 입술, 턱선, 피부색, 나이, 헤어라인 등 개인 특징 보존, 얼굴 미화·재설계 금지, 요청한 동작·자세·표정 변경, 요청하지 않은 의상·배경 유지 지시를 넣는다. 원래 질문·첨부·대화 기록은 변경하지 않는다.
- `sendMessage`: 활성 이미지 모델에 한해 위 함수를 실제 `baseRequest.messages`에 적용한다. 생성 결과 이미지에는 첫 입력 사진의 원본 바이트를 `identityReference: { mimeType, data }`로 보존하여 다음 이미지 편집 때 다시 사용한다. 이미지마다 원본 바이트 사본이 있으므로 대화 저장 용량은 늘 수 있다.
- `openGeneratedImageEditor`: 별도 `얼굴 유지 · 처음 참조한 인물 유지` 체크박스 추가. `image.identityReference || image`를 초기 얼굴 기준으로 삼고, 이어 편집할 때 `[처음 얼굴 참조, 현재 결과]` 순서로 전송한다(같은 이미지면 한 장). 결과에도 처음 얼굴 참조를 전달하여 편집 창 재개방과 이어 편집에서 기준을 보존한다. 옵션을 끄면 현재 결과 한 장만 편집한다. 기존 미리보기·저장·문서삽입·FMA·닫기 동작을 보존했다.
- 전역 옵션은 초기화 시 localStorage에서 읽으며 기본값은 `true`이다. 편집 창의 체크박스는 해당 편집에만 적용한다.

### `mdpro/js/app.js`

`generateLemonadeImage`는 이전에 첫 번째 유효 이미지 한 장만 골랐다. 이제 최신 요청의 모든 이미지 첨부를 모아 파일로 전송한다. 한 장이면 기존 `image`, 여러 장이면 순서대로 반복 `image[]`를 사용한다. 직접 Content-Type을 설정하지 않아 브라우저가 multipart boundary를 생성한다. 이미지 데이터가 없거나 형식이 잘못되면 요청 전에 오류를 내며 `images/generations`로 조용히 대체하지 않는다. 서버가 편집을 지원하지 않으면 기존 HTTP 오류를 표시한다. 새 이미지 생성 요청에 사진이 없으면 기존 JSON `images/generations`를 유지한다.

계약 확인: [Lemonade 공식 OpenAI 호환 API 문서](https://github.com/lemonade-sdk/lemonade/blob/main/docs/api/openai.md)의 `images/edits`는 multipart `image` 또는 반복 `image[]` 입력을 지원한다. 실제 설치된 Lemonade 버전의 복수 참조 지원·모델별 허용 개수는 별도 실행 확인이 필요하다.

캐시: app.js의 지연 로더 aiChat 버전은 `20261026-face-reference-3`, `mdpro/index.html`의 app.js URL에는 `aiJenaIdentity=20261026-reference-1` 추가. 이전 모델 목록 수정과 이미지 첨부 수정은 함께 보존한다. 신규 라이브러리·모델 다운로드·이미지 재인코딩 없음.

## 상대 앱 대응표와 이식 순서

| 원본 | 대상 실제 함수·경로 | 차이와 선행 조건 | 상태 |
| --- | --- | --- | --- |
| `mdpro/js/app.js` / `generateLemonadeImage` | `js/app.js` / `generateLemonadeChatImage(request, signal)` | 대상은 OpenAI 호환 공급자로 Lemonade를 구분하고 이미 모든 이미지/반복 image[]를 전송하며 이미지 누락을 검사한다. 이를 중복 구현하지 말고 얼굴 지시와 원본 참조 보존을 연결한다 | 읽기 확인·미수정 |
| `mdpro/AI_App/aiChat/ai-chat.js` / `imageIdentityMessages`, `sendMessage`, 이미지 편집 창 | `AI_App/aiChat/ai-chat.js` | 대상의 독립 공급자·생성 결과·편집 창·대화 저장 경로에 맞춰 옵션과 원본 얼굴 참조 메타데이터를 추가한다. UI 경로 상세 대조 필요 | 대상 app.js 비교 완료, UI 추가 확인 필요·미수정 |
| `mdpro/index.html`, 지연 로더 URL | 대상 `index.html`, 대상 선택 로더 | 별도 자산 버전 체계 사용. 전체 파일 덮어쓰기 금지 | 미수정 |

순서: 대상 지침·대화/이미지 저장 경로 확인 → 기존 복수 이미지 전송을 보존 → 얼굴 지시 helper와 옵션 연결 → 첫 참조 메타데이터 저장/복원 및 이어 편집 검증 → 캐시 버전 갱신 → 문서/목록/대기 목록 갱신.

## 회귀와 검증

- `tests/aiImageIdentity.test.mjs`: 얼굴 지시와 사용자 동작 요청 동시 보존, 기록 불변, 옵션 해제 및 텍스트 대화 무변경, 단일/복수 이미지 실제 Blob 바이트·순서·multipart 키, 누락 이미지 시 요청 금지, 사진 없는 신규 생성, 연속 편집의 처음 얼굴+직전 장면 참조 및 옵션 해제 검증.
- `node --test tests/aiImageIdentity.test.mjs tests/aiJenaConnection.test.mjs tests/aiJenaUiContract.test.mjs tests/aiChatImageAttachments.test.mjs`: 60개 통과.
- `node --check mdpro/AI_App/aiChat/ai-chat.js`, `node --check mdpro/js/app.js`, `git diff --check`: 통과.
- `npm run build`: 통과. 500 kB 초과 청크 경고 있음.
- 실제 Edge `http://localhost:5174/mdpro/index.html`에서 옵션 표시·기본 체크와 기존 첨부·ImgG·전송 컨트롤 확인. [검증 화면](evidence/2026-10-26-face-reference.png).
- 실제 Flux 얼굴 이미지 재생성, 얼굴 유사도 평가, 서버의 복수 참조 수용, Gemini 이미지 편집 품질, 모바일/Alt+4 배치, 온라인 배포는 미검증/미실행. 요청 전송 자동 검증은 fetch 모의 응답을 사용했으며 실제 생성 성공을 의미하지 않는다.

## Tauri 반영 계획

대기 ID: MDPRO-20261026-FACE-REFERENCE. 대상 웹 이식 후 `AI_App/aiChat/ai-chat.js`, `js/app.js`, `index.html` 자산 포함과 원본 참조의 IndexedDB 복원을 검사한다. 빌드 요청 시 대상 `Docs/mdpro-development/TAURI_BUILD.md`를 따라 프런트엔드·네이티브 빌드를 수행하고 설치 앱에서 실제 인물 자세 변경을 검증한다. 이번에는 대상 수정·Tauri 빌드를 실행하지 않았다.

## 다른 앱에서 다시 실행할 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md와 C:\CusorApps\Webdav_md\webdav-md\docs\mdpro-development\changes\2026-10-26-image-face-reference.md를 읽고 AI Jena의 얼굴 유지 옵션을 이식해줘. 기존 generateLemonadeChatImage의 복수 참조 업로드를 보존하고, 이미지 생성에서만 얼굴 보존 프롬프트를 적용해줘. 첫 인물 원본을 결과의 identityReference로 보존하여 이어 편집 시 원본 얼굴과 현재 장면을 순서대로 보내고, 옵션을 끄면 기존 현재 이미지 편집으로 동작하게 해줘. 파일 전체 복사 없이 단일/복수 이미지 바이트·누락 이미지 차단·연속 편집·대화 복원·기존 UI 보존을 검증하고 기술문서와 Tauri 대기 목록을 갱신해줘. Tauri 빌드와 배포는 실행하지 말고 실제 얼굴 품질 미검증을 구분해줘.
```
