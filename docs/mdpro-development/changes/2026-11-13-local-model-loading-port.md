# 2026-11-13 Viewer 모델 로딩 이식 및 로컬 LLM 연결

- 변경 ID: MDPRO-20261113-LOCAL-MODEL-LOAD
- 원본 참고 앱: C:\CusorApps\MDPRO\MDproViewer (읽기 전용 비교), 실제 적용: C:\CusorApps\WebDav-MD\webdav-md.
- 작성일 2026-11-13 / WebDAV 미커밋. 기존 Lemonade 빈 응답 복구 미커밋 변경은 보존.
- 상태: WebDAV 이식·Node/Chrome 모의·실제 로컬 서버·웹 빌드 완료. Viewer 원본 수정/역이식·Tauri 프런트엔드 준비/네이티브 빌드/설치 앱 검증 미실행.

## 요청과 소스 비교

사용자가 지정한 실제 Viewer 경로를 조사했다. 과거 문서의 C:\CusorApps\md-viewerVscode\md_viewer 경로와 다르다. 참고 자료는 Viewer의 AGENTS.md, Docs/mdpro-development/changes/2026-11-10-local-model-runtime.md 및 2026-11-10-lemonade-task-model-load.md, AI_App/aiChat/ai-chat.js의 loadLemonadeModel/isLemonadeModelAlreadyLoaded, js/app.js의 lemonadeModelLoadBody와 loadOpenAICompatibleTaskModel/refreshLMStudioModels/loadLMStudioModel이다.

Viewer는 health 적재 확인, jobs 작업 생성/조회, 구형 서버 load fallback, FLM/이미지 preset 보존을 구현한다. WebDAV는 별도 lemonade provider, getStoredLemonadeConnection, 개발 서버 프록시, iframe/부모 popup DOM, 독립 저장 키가 있으므로 전체 파일을 복사하지 않았다.

## 사용자 흐름과 구현

1. AI Jena 공급자 설정을 펼치고 LM Studio/Lemonade/Ollama를 고른다. 설치 모델을 선택하고 새 “모델 로드” 버튼을 누른다. 기존 상세 Lemonade “선택 모델 Load”도 공통 로더로 연결했다. 기존 새로고침과 필수 컨트롤은 유지한다.
2. ai-chat.js loadSelectedLocalModel: 선택 공급자·모델을 고정하고 로딩 동안 공급자/모델/새로고침/전송과 로드 버튼 잠금. sendMessage/continueAssistantAnswer/completeTask/loadTaskModel도 로딩 중 충돌을 방지한다. 실제 진행 단계만 표시하고 기존 가짜 5→92% 타이머는 제거했다. Lemonade “로드 대기 취소”는 AbortSignal과 서버 job DELETE를 전달한다. job ID 수신 전 또는 구형 load 요청에서 서버 적재 자체의 취소 완료는 보장하지 않으며 메시지에서 재조회하도록 안내한다. finally에서 잠금을 해제한다.
3. app.js loadLemonadeRuntimeModel(connection,model,options): 5분 제한, health의 정확한 model_name/id 및 backend_alive/loaded 확인으로 중복 로드를 생략한다. jobs POST의 load params에는 save_options=false, FLM/image에는 ctx_size를 넣지 않아 서버 프리셋 보존. 나머지 텍스트 모델에만 설정 contextTokens를 전송한다. job GET 상태를 400ms 간격으로 확인, HTTP200 오류/failed/paused/interrupted/cancelled도 실패 처리. jobs 404/405에서만 load POST로 fallback한다. 완료 뒤 health를 다시 확인해야 loaded=true. 외부 signal listener/timer 정리. job ID가 있으면 취소 시 별도 5초 제한 DELETE. 이미 적재된 모델에는 강제 재로드를 하지 않는다.
4. Jena loadLemonadeModel 브리지, Functional AI loadOpenAICompatibleTaskModel, ENV loadLemonadeModel가 위 로더를 공유한다. 실제 저장 키 갱신은 성공 후 수행한다. 설정 저장 동작 전체를 바꾸지 않는다.
5. LM Studio: 기존 비활성 모델 선택을 활성화하고 설치 목록을 제공한다. 로드된 모델이 없더라도 선택 후보를 보존하고 연결 성공·모델 미적재를 구분한다. loadLMStudioModel은 기존 native API를 사용하고 refreshLMStudioModels로 설치/적재 목록을 재확인한다.
6. Ollama는 기존 api/generate 빈 prompt 및 keep_alive=10m preload를 사용한다. 목록 갱신에는 10초 제한 추가. 로드 HTTP 오류·done 확인은 기존 로직 유지.
7. 실제 LM Studio 비추론 모델의 “does not expose reasoning configuration” 오류를 발견했다. ai_local/local-ai.js isUnsupportedReasoningSettingError에 정확한 오류 패턴을 추가해 기존 단발 reasoning 필드 제거 fallback을 사용한다. 인증/연결 오류에는 이 fallback을 적용하지 않는다.

## WebDAV의 같은 출처 연결 적응

LM Studio 기본 저장/예시 값은 5678이고 실제 이 PC에서 시작한 서버는 1234였다. 기본값이나 사용자 설정을 자동 덮어쓰지 않았다. 실제 브라우저 fixture에서만 Base URL을 1234로 지정했다. 최초 오류를 CORS로만 설명했으나 포트 차이도 있어 CORS 단일 원인으로 확정하지 않는다.

LM Studio --cors 재시작은 자동 승인 검토에서 “모든 웹사이트 접근을 허용하는 broad CORS”라는 이유로 거부되어 실행하지 않았다. CORS 설정 완화/우회 실행 대신 제한된 같은 출처 개발 서버 중계를 구현했다.

- src/localLlmProxy.js 및 vite.config.js: dev/preview의 /api/local-llm/config, /api/local-llm/{1234|5678|11434}/... 전용 경로. 요청 Host가 loopback이어야 하고 Origin은 앱의 정확한 출처만 허용하며 Sec-Fetch-Site cross-site 거부. localhost 서버로만 전달, 임의 주소/포트 입력 불가. LM models/load/unload/chat 및 Ollama tags/ps/show/generate/chat로 경로 제한, GET/POST만 허용. 다운로드/pull/임의 API는 차단한다. 응답 스트림 전달과 연결 종료 정리, 610초 upstream 제한. 새 CORS 헤더는 추가하지 않는다.
- app.js fetchLocalLlmWithAppProxy: 앱과 대상이 loopback이고 고정 포트일 때만 config endpoint로 기능 감지. 없으면 기존 직접 요청 유지. 원 API 주소·키·설정을 저장/변조하지 않는다. requestLocalAIJson과 LM native chat client에 연결.
- scholar-ai-provider.js makeLMStudioClient: 호스트의 MDProLocalAIFetch가 있을 때만 fetch 주입. 독립 모듈 및 Viewer의 native bridge를 복사/변경하지 않는다.
- GitHub Pages/원격 정적 서버에는 Vite 중계가 없다. 기존 직접 연결과 서버의 명시적 브라우저 접근 설정이 필요하다. CORS 보안 설정을 자동 변경하지 않았으며 정적 배포의 실제 연결은 미검증이다.

## UI·데이터 보존 및 캐시

기존 필수 header history-toggle/new/copy-all/save-all/data-center-open/layout-menu-button/close 모두 유지. Alt+4 drag/toggle/입력/응답 모드/실시간 쓰기/send-stop 유지. 기존 모델 새로고침/상세 Load 버튼 유지. 새 local load/cancel 버튼만 공급자·실행 상태에 따라 표시/잠금. CSS는 기존 provider grid 안 새 버튼에만 폭/행 배치 추가. 기존 버튼 숨김·클리핑·삭제 없음. 문서 원본·첨부·수식·PV·인쇄/PDF/DOCX 파이프라인 미변경.

index.html의 app.js, ai-chat.css, local-ai.js, scholar-ai-provider.js 캐시와 app.js aiChat 동적 URL localModelLoad=20261113-1 갱신. PWA CACHE_VERSION=20261113-local-model-load-1. 신규 외부 의존성 없음.

## 검증 및 실제 시스템 영향

- node --test tests/localModelLoad.test.mjs tests/aiJenaConnection.test.mjs tests/aiJenaUiContract.test.mjs tests/lemonadeImageQuality.test.mjs tests/aiChatImageAttachments.test.mjs: 68통과. 상태 오류/구형 API/취소/미적재·기존 이미지 첨부/프리셋 및 필수 UI 검사.
- node --test tests/localLlmProxy.test.mjs: 1통과. same-origin/Host/포트/경로 제한. sandbox 로컬 소켓 EACCES 후 승인된 재실행. Node fetch의 Host 강제 헤더가 실제 전송되지 않는 한계를 확인해 해당 잘못된 테스트 사례는 제외했다.
- node --test tests/aiLMStudioFastMode.test.mjs tests/scholarAIReplacement.test.mjs: 19통과.
- node tests/localModelLoad.browser.cjs: 실제 Chrome iframe에서 LM Studio/Lemonade/Ollama 모델 로드 버튼, 잠금/완료, 1200px/390px 접근성 통과(모의 브리지). 초기 fixture 설정 동기화로 닫힌 창을 재열도록 수정 후 통과.
- node tests/localModelLoad.live.browser.cjs: 실제 운영 브리지에서 LM Studio 설치 모델 20개/Lemonade16개/Ollama9개 조회, Lemonade gemma4e-flash-e4b-FLM health 적재 확인 통과. LOCAL_LLM_GENERATE=1 선택 실행에서 LM Studio hy-mt1.5-1.8b 로드→Hello!, Ollama llama3.2:1b 로드→Hello! 확인. 최초 LM 비추론 모델 오류를 코드로 수정해 재검사 통과. 최초 Ollama cold load 요청은 클라이언트 fetch 실패였으나 서버 ps에는 적재 확인, 이후 실제 load/생성 재검사 통과. cold-load 안정성을 모든 환경에서 보장하지 않는다. 부가 배치전환 fixture 1회 타이밍 실패 후 재실행 통과 사실도 구분한다.
- 실검증을 위해 꺼져 있던 lms server를 127.0.0.1:1234로 시작했고 Ollama serve를 hidden background로 시작했다. --cors 실행은 거부되어 미변경. 다운로드/자동 시작 등록/전역 환경변수 변경 없음. LM Studio hy-mt1.5-1.8b와 Ollama llama3.2:1b가 테스트에서 적재되었으며 서버를 계속 실행 중으로 남겼다. Ollama는 기존 로더의 10분 유지.
- node --check app.js/ai-chat.js/local-ai.js/scholar-ai-provider.js, git diff --check, npm run build 통과. 기존 큰 청크 경고 존재.
- 미검증: 원격 정적 호스팅 직접 CORS, 사용자 NAS/HTTPS 실제 문서, 모든 설치 모델의 생성 품질, 물리 모바일, 서버 job ID를 받기 전 취소의 서버 완료, Viewer native/설치 앱.

## 대상 대응표 및 Tauri

| 참고 Viewer | WebDAV 적용 | 상태 |
| --- | --- | --- |
| ai-chat.js isLemonadeModelAlreadyLoaded/loadLemonadeModel | app.js loadLemonadeRuntimeModel | jobs/health/fallback 적응 구현 |
| js/app.js lemonadeModelLoadBody | runtime loader params | FLM/image 프리셋 보존, save_options=false |
| ai-chat.js loadSelectedLMStudioModel/공통 load | ai-chat.js loadSelectedLocalModel | 세 공급자 공통 UI, 기존 버튼 보존 |
| Viewer native/local bridge | WebDAV same-origin Vite middleware | 대상 독립 브리지는 미수정 |

Viewer는 참고 원본이며 이번 수정 없음. WebDAV 전용 Vite 중계를 Viewer Tauri에 그대로 복사하지 않는다. 향후 역이식 시 Docs/mdpro-development/TAURI_BUILD.md와 실제 native transport를 먼저 확인한다. 빌드 대기 ID는 위 변경 ID, Viewer frontend/native/설치 앱 검증은 모두 미실행. 이번에는 원본 Viewer 빌드가 필요하지 않다.

## 복사할 구현 명령

```text
C:\CusorApps\MDPRO\MDproViewer에서 AGENTS.md와 C:\CusorApps\WebDav-MD\webdav-md\docs\mdpro-development\changes\2026-11-13-local-model-loading-port.md를 읽어줘. 기존 Viewer의 모델 로딩 구현과 실제 native bridge를 먼저 비교해 이미 존재하는 jobs/health/프리셋 보존 코드는 재구현하지 마. WebDAV에서 보완한 세 공급자 공통 모델 로드 잠금, LM Studio 설치 목록 선택 및 비추론 모델 오류 fallback을 필요한 범위만 적응해줘. WebDAV Vite proxy 전체를 복사하지 말고 native 연결을 유지해줘. 기존 컨트롤/저장 키/FLM·이미지 preset/사용자 Base URL을 보존하고 실제 모델 목록·로드·생성을 확인해줘. 문서·목록·Tauri 대기 상태를 갱신하되 네이티브 빌드·설치·커밋·푸시는 하지 마. 미검증 항목을 구분해줘.
```
