# 2026-10-27 FMA AI Studio 이미지 편집 할당량 오류 안내

- 변경 ID: MDPRO-20261027-FMA-STUDIO-QUOTA
- 원본: `C:/CusorApps/Webdav_md/webdav-md`; 대상: `C:/CusorApps/md-viewerVscode/md_viewer`
- 작성·확인: 2026-10-27, 로컬 미커밋 변경. 문서 사본은 원본 저장소에만 작성.
- 상태: 원본 오류 처리 구현·자동 검사·웹 빌드 완료. 실제 브라우저 UI·인증 편집 미검증. 상대 이식·Tauri 준비·네이티브 빌드·설치 앱 검증 미실행.

## 요청과 원인

사용자가 제공한 AI Studio 편집 오류는 `HTTP 429`, `generate_content_free_tier_requests`, `limit: 0`, `gemini-3.1-flash-image`이다. Google이 프로젝트의 무료 등급 이미지 할당량 0으로 요청을 거절한 증거이며, 이 메시지만으로 실제 결제 설정이나 키의 소속 프로젝트를 확인할 수는 없다. 기존 코드의 선택 모델 generateContent 전송에는 원본·마스크·참조 이미지가 이미 포함된다. 이번 변경은 계정 할당량을 해제하거나 실제 편집 성공을 구현했다고 주장하지 않는다.

공식 근거: [이미지 모델 가격](https://ai.google.dev/gemini-api/docs/pricing)의 Gemini 3.1 Flash Image 무료 등급 미지원 및 [프로젝트별 할당량](https://ai.google.dev/gemini-api/docs/rate-limits). 같은 프로젝트의 키 재발급은 별도의 할당량을 만들지 않는다.

## 실제 구현

- `mdpro/Apps/fmaviewer/js/ai/aiJenaModels.js`: `createAiJenaStudioError`가 구조화된 QuotaFailure `violations[].quotaValue` 또는 기존 오류 문자열의 `limit: 0`을 판별한다. 429와 결합해 `AI_STUDIO_QUOTA_ZERO`/`AI_STUDIO_RATE_LIMIT`을 반환하고 다른 오류는 기존 HTTP·공급자·모델 문맥을 유지한다. `requestAiJenaStudioImage`가 분류 후 모델 상태와 채팅 오류를 갱신한다. 긴 원문 반복과 혼동을 주는 13시간 재시도 안내 대신 키 소속 프로젝트·결제 연결·할당량 확인 경로를 안내한다. 성공한 이미지 응답은 이전 오류 상태를 교체한다.
- `mdpro/Apps/fmaviewer/js/ai/aiJena.js`: `updateAiJenaKeyStatus`에 키 저장과 권한/할당량 검증의 차이를 명시하고 `runAiJena`에서 분류한 오류를 진행 상태에 표시한다.
- `mdpro/Apps/fmaviewer/index.html`: 작업 방식 영역에 접을 수 있는 API 도움말과 키/프로젝트·사용량·결제 링크를 추가한다. 두 JS URL을 `20261027-studio-quota-1`로 갱신한다. 기존 컨트롤 삭제나 숨김 없음.
- 원본/프롬프트/참조/선택영역/히스토리 보존. 자동 재시도·모델 또는 공급자 자동 변경·키 변경·결제 변경 없음. 새 의존성 없음.

## 상대 앱 대응표와 선행 작업

| 원본 | 대상 실제 확인 | 차이 및 이식 순서 |
| --- | --- | --- |
| `aiJenaModels.js:requestAiJenaStudioImage` | `Apps/fmaviewer/js/ai/aiJena.js:requestAiJenaImage` | 대상은 Google에 `AI_UPSCALE_ENDPOINT`, `AI_UPSCALE_MODEL`, `input/response_format`을 사용한다. 같은 함수 구조가 아니다. 먼저 기존 공급자 전송 문서의 generateContent 전환 필요성을 확인해야 한다. |
| `aiJena.js:runAiJena/updateAiJenaKeyStatus` 및 HTML | 대상 `Apps/fmaviewer/js/ai/aiJena.js` | 대상은 로컬 `MDProImageProvider.generate`, identity/cameraOnly 옵션이 있다. 전체 파일을 덮어쓰지 말고 오류 분류·표시만 국소 반영한다. 대상 UI 대응 요소는 추가 확인 필요. |

선행 문서: [공급자·모델 전송](2026-10-27-fma-jena-provider-and-transport.md). 이번에는 대상 파일을 읽기만 했으며 런타임·문서 사본은 수정하지 않았다.

## 회귀 예제와 검증

- `node --test tests/fmaJenaModels.test.mjs tests/fmaJenaProgress.test.mjs tests/fmaJenaPersonPreservation.test.mjs tests/fmaMdproApiKey.test.mjs tests/aiJenaUiContract.test.mjs`: 62개 통과.
- 새 회귀: 제공된 무료 등급 0 오류 → 프로젝트·결제 안내 및 요청 1회; 구조화된 숫자 0 → 동일 분류; 양수 한도 → 일반 제한; 정상 이미지 응답 → 이전 오류 상태 교체.
- 기존 회귀로 원본·마스크·참조의 generateContent 입력, 선택 공급자/모델, 취소, 보관함 잠금, 원본 인물 보존 검사 통과.
- `node --check` 두 FMA JS 및 `mdpro/AI_App/aiChat/ai-chat.js` 통과. `git diff --check` 통과.
- `npm run build` 성공. 500KB 초과 청크 경고 있음.
- 실제 Google 계정 프로젝트/결제·할당량 설정은 확인·변경하지 않음. 유료 API 실제 편집, 브라우저 화면, 설치 앱은 미검증. 제공된 오류가 원인 판별의 실제 API 증거이고 회귀 응답은 모의 응답이다.

## Tauri 반영 계획

대기 ID는 `MDPRO-20261027-FMA-STUDIO-QUOTA`. 대상 Google 전송 및 UI 차이를 반영한 후 JS·HTML을 대상 웹에서 검증하고, 빌드 요청 시 대상 `Docs/mdpro-development/TAURI_BUILD.md`에 따라 Tauri/dist 자산 포함 및 설치 앱 오류/정상 편집을 확인한다. 이번 WebDAV 빌드는 Tauri 빌드가 아니다.

## 다른 앱에서 다시 실행할 명령

```text
C:/CusorApps/md-viewerVscode/md_viewer에서 AGENTS.md와 C:/CusorApps/Webdav_md/webdav-md/docs/mdpro-development/changes/2026-10-27-fma-studio-quota.md 및 선행 공급자 전송 문서를 읽고, FMA AI Studio 이미지 편집의 할당량 0과 일반 429 오류를 구분해줘. 대상 Google 전송과 MDProImageProvider, identity/cameraOnly 옵션을 유지하며 필요한 부분만 수정하고 키 저장/모델 조회와 실제 생성 권한을 구분해줘. 프로젝트·결제·할당량 확인 링크와 실패 상태를 제공하고 원본·마스크·참조 보존, 자동 대체 없음, 오류/정상 응답 회귀를 검증해줘. 이식 문서·목록·Tauri 대기도 갱신하되 Tauri 빌드와 결제 설정 변경은 하지 말아줘. 실제 유료 API 성공 여부를 자동 검사와 구분해 보고해줘.
```
