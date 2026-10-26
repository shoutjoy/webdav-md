# llama.cpp 주소 기반 ENV·AI Jena 연결 이식

- 변경 ID: `MDPRO-20261026-LLAMACPP`
- 작성·최종 확인: 2026-10-27 (Asia/Seoul), WebDAV 미커밋.
- 원본: `C:\CusorApps\md-viewerVscode\md_viewer`, `Docs/mdpro-development/changes/2026-10-26-llamacpp-address-only.md`와 실제 `js/app.js` 및 테스트를 읽어 부분 이식.
- 이번 대상: `C:\CusorApps\Webdav_md\webdav-md`. Viewer 런타임·문서·네이티브 빌드는 수정/실행하지 않았다.
- 상태: WebDAV 구현·자동 검사·웹 빌드 완료. 실제 UI·실제 GGUF 추론·LAN/CORS·Tauri·설치 앱 검증은 미완료.

## 요청과 완료 기준

기존 WebDAV는 ENV의 OpenAI 호환 설정에 키를 필수로 요구하고, 저장 연결과 AI Jena 모델을 OrcaRouter 저장 키에서 고정으로 읽었다. 서버 루트 주소도 `/v1`로 보정하지 않아 llama.cpp 연결을 주소만으로 구성할 수 없었다.

사용 방법: **ENV → 외부 OpenAI 호환 API 설정 → API Provider → llama.cpp (llama-server)**를 선택하고 Base URL에 서버 주소를 입력한다. Model ID와 API Key를 비워 저장하면 `/v1/models`의 첫 모델을 선택하고 AI Jena의 OpenAI 호환 공급자·모델에 동기화한다. 인증 서버에서는 키를 입력한다. 복수 모델은 모델 확인 후 선택하거나 Model ID를 직접 입력한다. 모델이 준비되지 않은 경우 주소는 저장하고 자동 조회 실패를 안내한다.

예시: `127.0.0.1:8080`, `http://127.0.0.1:8080/`, `/v1/`, `/v1/chat/completions`, `/v1/models?x=1` 형식이 같은 `http://127.0.0.1:8080/v1`로 정규화된다. IPv6와 프록시 prefix를 보존한다. 다른 공급자에는 `/v1` 보정이나 키 선택 규칙을 적용하지 않는다.

기존 llama-server와 GGUF가 있는 경우의 서버 실행 예시:

```powershell
llama-server.exe -m C:\models\model.gguf --host 127.0.0.1 --port 8080
```

8080은 프리셋 예시이며 실제 서버 포트로 바꾼다. 다른 PC는 서버 IP, listen host, 방화벽을 맞춰야 한다. 브라우저 CORS 및 HTTPS 페이지에서 HTTP 서버를 호출할 때의 제한은 별도 서버/배포 환경 조건이며 앱이 자동 변경하지 않는다. 참고: [llama.cpp 공식 서버 문서](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md), 2026-10-26 확인.

## 실제 구현

1. `mdpro/index.html`: 기존 provider select에 `llamacpp` 추가, 주소만 저장·모델 자동 조회·키 선택 안내 추가. scheme 없는 주소 입력을 허용하도록 Base URL 입력을 text로 변경. 기존 컨트롤 보존.
2. `mdpro/js/app.js`: `OPENAI_COMPATIBLE_PROVIDER_URLS.llamacpp` 프리셋 추가. `normalizeOpenAICompatibleBaseUrl(value, providerId)`는 llama.cpp에만 scheme·endpoint suffix·`/v1`을 정리한다.
3. `getOpenAICompatibleFormConnection`과 `getStoredOpenAICompatibleConnection(providerOverride)`는 llama.cpp 빈 키를 허용하며 전용 `ss_openai_compatible_{base_url,api_key,model_id}_llamacpp` 저장값을 읽는다. 공용 cloud 키·모델을 대입하지 않는다. 별도 Lemonade 연결·프록시는 보존하고 `isLemonadeConnection`은 명시적 llama.cpp를 Lemonade로 판정하지 않는다.
4. `openAICompatibleHeaders(connection, accept)`는 키가 있을 때만 Authorization을 만든다. 모델 조회, ENV 연결 테스트, AI Jena JSON/SSE에 연결. `resolveLlamaCppModel`은 모델이 없을 때만 조회하고 빈 목록은 명시적 오류. 모델 조회에는 15초 timeout과 기존 요청 취소 signal을 결합한다.
5. `saveOpenAICompatibleSettings`: 모델 자동 조회 → 기존 `setAiSettings` → 공급자별/localStorage 저장 → Jena 공급자·모델 저장 → `AIChat.syncSettings`. 조회 실패 시 주소·빈 모델을 저장하고 서버/인증/CORS 안내. 무인증 재시도 또는 cloud fallback 없음.
6. `loadOpenAICompatibleSettingsUI`: llama.cpp 빈 키·모델을 유지하고 기존 OrcaRouter migration으로 덮어쓰지 않는다. 저장 시 migration revision도 남긴다. preset 전환 시 공급자별 주소·키·모델 복원.
7. 모델 cache의 출처를 현재 서버 주소와 비교한다. llama.cpp 모델은 cloud 가격 정보의 무료 필터로 숨기지 않는다. 다른 공급자 및 Lemonade 모델 처리는 유지한다.
8. AI Jena bridge `complete`의 기존 compatible/Lemonade 분기에서 llama.cpp 빈 모델을 조회한 뒤 기존 JSON/SSE 요청·이미지 첨부 변환으로 보낸다. stream과 JSON 모두 동일 서버와 선택적 키 사용. llama.cpp에 Lemonade lifecycle load/unload를 보내지 않는다.
9. `mdpro/AI_App/aiChat/ai-chat.js`: `storedOpenAICompatibleModel`로 공급자와 선택 모델의 소유자를 확인하고 다른 공급자의 cloud 모델 복원을 차단. llama.cpp silent refresh도 서버를 조회한다. 늦은 모델 조회는 revision으로 격리한다. 공급자 상태 표시에 llama.cpp 이름 반영.
10. index app.js 및 optional ai-chat.js URL에 `llamacpp=20261026-1` cache 식별자 추가. 신규 라이브러리 없음. 수식/PV/인쇄/내보내기 코드는 이번 수정 대상이 아니다.

핵심 요청 계약:

```js
await resolveLlamaCppModel(connection, controller.signal);
const model = String(request.model || connection.modelId || '').trim();
// JSON과 SSE 모두 openAICompatibleHeaders 사용
if (connection.apiKey) headers.Authorization = 'Bearer ' + connection.apiKey;
```

작업 시작 시 AI 이미지 첨부·얼굴 참조·업로드 도구·Lemonade 목록·문서 삽입 관련 미커밋 변경이 이미 있었다. 해당 변경을 덮어쓰지 않았다. 기존 이미지 요청 테스트 harness에는 새 공통 helper의 실제 코드를 연결했다. UI 계약의 고정 OrcaRouter cache 검사도 서버 주소별 cache 계약으로 변경했다.

## 상대 앱 대응표와 이식 순서

| Viewer 원본 | WebDAV 대상 | 차이와 이번 처리 |
| --- | --- | --- |
| `js/app.js` normalize/header/model resolver | `mdpro/js/app.js` 대응 함수 | 세 helper를 부분 이식, 기존 `openAICompatibleRequestUrl`·Lemonade 분리 유지 |
| provider별 stored connection | 기존 OrcaRouter 고정 stored connection | override·provider별 키 추가, llama.cpp cloud fallback 차단 |
| Viewer `localAIRequestUrl` | WebDAV `openAICompatibleRequestUrl` | 전체 복사하지 않음. WebDAV Lemonade 프록시 유지, llama.cpp 직접 호출 |
| `AI_App/aiChat/ai-chat.js` | `mdpro/AI_App/aiChat/ai-chat.js` | 원본과 다른 refresh·syncSettings·모델 선택 구조에 helper 연결 |
| Viewer 신규 CJS test | `tests/llamacppOpenAICompatible.test.cjs` | WebDAV의 compatible/Lemonade 통합 bridge 분기와 이미지 변환 helper를 실제 실행하도록 조정 |

Viewer의 원본 문서에 기록된 구현은 존재함을 읽기 확인했다. 이번에는 Viewer 전체 UI나 실제 서버 추론을 재검증하지 않았다. WebDAV 전체 파일을 Viewer에 덮어쓰면 독립 Lemonade·provider 초기화 및 저장 구조가 손상될 수 있다.

## 회귀 예제와 검증

```powershell
node --check mdpro/js/app.js
node --check mdpro/AI_App/aiChat/ai-chat.js
node --test tests/llamacppOpenAICompatible.test.cjs tests/aiJenaConnection.test.mjs tests/aiJenaUiContract.test.mjs tests/aiChatImageAttachments.test.mjs tests/lemonadeProxy.test.mjs tests/aiCompatibleResidency.test.mjs
git diff --check
npm run build
```

- 최종 합동 검사 **70개 통과 / 실패 0**. 신규 llama.cpp 8개, Jena silent refresh 2개 포함. 주소·프록시 prefix·IPv6·키/모델 격리·offline 저장·ENV 재시작·빈 목록·취소·preset 전환·JSON/SSE·인증키·401·첨부 이미지·Lemonade 프록시 및 lifecycle 회귀 확인.
- 실제 loopback HTTP 모의 서버로 `/v1/models`와 `/v1/chat/completions`를 검증했다. **실제 GGUF 모델 추론 서버가 아니다.** sandbox에서는 loopback fetch가 EACCES로 차단되어 테스트를 승인된 실행 권한으로 재실행했다.
- 구문 검사·`git diff --check`·`npm run build` 통과. Vite의 500KB chunk 경고는 남음.
- 추가 시도한 `tests/lemonadeReasoning.test.mjs`의 realtime 흐름 검사는 기존 얼굴 참조 변경의 `preserveImageIdentity`를 독립 VM harness에 정의하지 않아 실패했다. 이번에 해당 얼굴 참조 구간을 수정하지 않았으며, 위 70개 합동 검사에 이 파일은 포함하지 않는다. 전체 테스트 통과를 의미하지 않는다.
- 브라우저: in-app browser에서 개발 서버 `http://127.0.0.1:5189/mdpro/` 접속을 시도했으나 `net::ERR_CONNECTION_TIMED_OUT`. 실제 ENV 표시·저장·Jena 대화 UI는 미검증. 검증용 개발 서버는 종료했다.
- 사용자 서버 URL/GGUF가 주어지지 않아 실제 추론·LAN·CORS·HTTPS 배포·멀티모달 모델 지원은 미검증. 생성 timeout/context 한도는 기존 AI Jena 설정과 서버 설정에 따른다.
- 기존 헤더·Alt+4 컨트롤을 제거하거나 숨기는 UI 변경 없음. 커밋·푸시·배포 미실행.

## Tauri 반영 계획

빌드 대기 ID는 원본과 동일한 `MDPRO-20261026-LLAMACPP`. Viewer 원본에는 `js/app.js`, `AI_App/aiChat/ai-chat.js`, `index.html` 구현이 있으나 실제 native 반영은 원본 문서 기준 대기다. WebDAV는 Tauri 빌드 대상이 아니다. Viewer에서 요청받으면 `Docs/mdpro-development/TAURI_BUILD.md`와 대기 목록을 확인하고, frontend 준비 후 세 자산 및 cache URL이 `Tauri/dist`에 포함되는지 비교한다. 설치 앱에서 주소만 저장·모델 조회·인증 있음/없음·JSON/SSE·중지·provider 전환을 확인한다. 이번 WebDAV 웹 빌드는 Tauri 준비나 EXE 생성 증거가 아니다.

## 다른 앱에서 다시 실행할 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md와 Docs/mdpro-development/changes/2026-10-26-llamacpp-address-only.md, C:\CusorApps\Webdav_md\webdav-md\docs/mdpro-development/changes/2026-10-27-llamacpp-address-only.md를 읽고 기존 llama.cpp 구현과 이번 WebDAV 보완의 차이를 확인해줘. 전체 파일 복사 없이 ENV 재시작 시 빈 키/모델 유지, 공급자별 저장 격리, cache 주소 격리, AI Jena silent 모델 조회와 늦은 응답 차단을 점검하고 빠진 부분만 반영해줘. 주소 변형·빈 모델·취소·cloud 전환·인증/401·JSON/SSE를 검증하고 실제 서버/UI 검증과 모의 검사를 구분해줘. 기술문서·목록·Tauri 대기 상태를 갱신해줘. 빌드·커밋·푸시는 실행하지 마.
```
