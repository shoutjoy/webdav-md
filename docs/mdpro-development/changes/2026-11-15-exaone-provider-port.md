# 2026-11-15 LG EXAONE ENV·JENA·텍스트 도구 이식

- 변경 ID: `MDPRO-20261115-EXAONE-PORT`
- 소스: `C:\CusorApps\MDPRO\MDproViewer`, 대상: `C:\CusorApps\WebDav-MD\webdav-md`
- 기준: Viewer `Docs/ai/AI_JENA.md`, `AI_REASONING_SETTINGS.md`, `Docs/porting/EXAONE_AI_PORTING.md` 및 실제 대응 함수 읽기 비교. 2026-11-15 미커밋 구현.
- 상태: WebDAV 구현 및 합성 브라우저 검증. Viewer 원본 미수정. 실제 EXAONE 인증/생성·운영 HTTPS 중계·Tauri frontend/native/설치 검증은 미실행.
- 기존 미커밋 MoveDestinationModal 및 이동 관련 변경 문서는 보존했다. 기존 개발목록/빌드목록에는 이번 항목만 추가했다.

## 사용자 동작과 보존 계약

ENV에 `LG EXAONE 설정` 접기 카드를 추가했다. 개인 API Key, 공식 발급 링크, Base URL, Model ID, 전체 컨텍스트, 추론 포함 최대 출력, 응답 제한시간, 저장, 실제 생성 연결 테스트를 제공한다. 기본 주소 `https://api.exaone.ai/v1`, 모델 `k-exaone_v2.5`, 컨텍스트/출력 각각 524288, 제한시간 580초다. 브라우저 개인 설정이며 빌드 환경변수나 프런트 번들에 비밀 키를 넣지 않는다. 키는 대상 ENV에서 사용자가 다시 저장한다.

일반 JENA와 공통 텍스트 도구 선택기에 `LG EXAONE (텍스트)`를 추가했다. main JENA는 기존 `openai-compatible` 경로와 EXAONE scoped 설정을 사용한다. 공통 picker는 명시 `exaone`을 `provider:openai-compatible`, `openAICompatibleProvider:exaone`으로 정규화한다. 기존 로컬 공급자/OrcaRouter 프로필과 키, 중지, 문서 적용/undo 경로는 보존한다. 다른 호환 공급자로 돌아가면 이전 프로필을 복원한다. EXAONE은 이미지 생성/비전/OCR 공급자로 등록하지 않으며 이미지 요청은 전송 전에 텍스트 전용 오류를 낸다.

변경 전후 컨트롤 목록: expanded header의 history/new/copy/save/data-center/layout/close, compact Alt+4의 drag/toggle/input/모드/실시간 문서쓰기/send/stop을 유지한다. 기존 공급자/모델/모델 로드/FAST/모드/표시/문서 입력 컨트롤은 제거하지 않았다. 새 TL의 닫힘 패널과 미지원 TL만 숨기며 기존 UI를 숨기는 CSS는 추가하지 않았다. compact 문서쓰기에 자동 확장을 추가하지 않았다.

## 즉시·추론·TL·표시의 독립성 및 처리 순서

1. 공급자/프로필/모델 선택 → `AIReasoningSettings.describe`의 EXAONE 공식 지원 판정 → 모델별 저장 복원.
2. 일반 JENA 요청 시작 시 `completeJenaRequest`가 TL 선택과 실제 프로필을 캡처한다. 생성 중 TL은 잠긴다.
3. 공통 브리지가 인증·모델·이미지 제한·입력/출력 예산을 검증한다. 즉시/FAST/독립 작업은 기본 low, 추론 모드는 기본 high다.
4. 명시 TL low/high/max를 기본 정책 뒤에 적용한다. 명시 high/max이면 즉시 모드용 최소 추론 힌트를 강제하지 않는다. `disableThinking:true` 작업은 메인 TL을 상속하지 않으며 EXAONE에서 끄기를 전송하지 않는다.
5. `preserve_thinking:false`로 과거 추론 재전송을 막는다. 실제 받은 reasoning_content와 content는 기존 SSE 파서에서 reasoning.delta/message.delta로 분리한다.
6. `추론내용 표시`는 수신된 추론 텍스트만 보이거나 숨긴다. 추론 강도·실제 공급자 연산과 별개다. 즉시 모드라도 추론 delta가 오면 표시하며, 생성 중 표시 토글은 DOM 전체를 교체하지 않는다.
7. 중지 시 fetch와 reader를 취소하고 이후 delta를 차단한다. 재시도 대기도 동일 AbortSignal을 사용한다.

이번 TL 노출 범위는 EXAONE `k-exaone_v2.5`다. Viewer 문서의 OpenAI/Gemini/DeepSeek/로컬 메타데이터 TL 전체를 이식 완료로 주장하지 않는다. 다른 모델의 TL은 숨기고 기존 추론 정책을 유지한다.

## 파일·함수와 대상별 적응

| Viewer 경계 | WebDAV 실제 변경 | 적응 |
| --- | --- | --- |
| index/ENV, app.js EXAONE 함수 | `mdpro/index.html`, `mdpro/js/app.js` | 독립 카드와 기존 settings rack에 추가. scoped 저장만 사용하며 타 프로필 폼으로 EXAONE 키를 저장하지 않음 |
| getStoredOpenAICompatibleConnection | 같은 이름의 대상 함수 | EXAONE은 legacy 공유 키 fallback 금지. 다른 프로필의 기존 fallback 유지 |
| 모델 카탈로그 | getAIChatOpenAICompatibleModelIds/getCached/refresh/getTaskModels | `/models` 호출 없이 고정 카탈로그, 인증 미확인 상태. 무료 필터로 모델을 제거하지 않음 |
| applyExaoneGenerationPolicy/budgetExaoneOutput | 공통 브리지 complete의 호환 공급자 분기 | 기존 대상 fit/Lemonade 경로 유지. 최근 이력과 최소 생성 여유 확보 후 입력+안전 여유를 제외한 출력 제한 |
| Python run.py 중계 | `src/exaoneProxy.js`, `vite.config.js` | 기존 로컬/Lemonade 중계는 유지. dev/preview 양쪽 고정 EXAONE 라우트 추가 |
| reasoning-settings.js 및 JENA | `mdpro/AI_App/aiChat/reasoning-settings.js`, ai-chat.js/css | EXAONE만 노출, 기존 브리지/실시간 영역에 연결. 기존 파일 전체 덮어쓰기 없음 |
| 도구 picker | task-provider-picker.js | EXAONE 별칭·저장 복원·명시 프로필 정규화 |
| 캐시 | index/app lazy JS/CSS query, PWA service-worker | 신규 모듈 선행 로드·PWA core 포함·버전 갱신·dist 복사 |

저장 키는 `ss_openai_compatible_{api_key,base_url,model_id,context_tokens,max_output_tokens,timeout_seconds}_exaone`, 추론은 `ss_ai_reasoning_settings_v1:["openai-compatible","exaone","k-exaone_v2.5"]`다. `ss_exaone_output_limit_revision=524288-v1` 이전 표식이 없을 때 누락/이전8192 기본값만 한 번 이전하고 이후 명시값을 보존한다. 샘플링은 EXAONE 기본값을 사용한다.

## 중계·오류·배포 경계

정확한 공식 chat URL만 서버 루트 `/api/exaone/chat/completions`로 매핑한다. 고정 HTTPS upstream, loopback host/client, same-origin 검사, POST JSON/Bearer, 16MiB 한도, redirect 거부, 원래 상태/Content-Type/Retry-After/할당량 헤더 보존, 버퍼링 없는 SSE와 연결해제 취소를 적용했다. client 기본580초/설정30~3600초, relay 상한3600초이며 먼저 취소되는 쪽이 우선한다.

busy600/일시429만 최대2회 추가 재시도(기본3초/8초 또는 서버 헤더, 최대60초 대기)하며 인증401/403·일 할당량 소진·일반 네트워크 오류는 재시도하지 않는다. HTTP200 오류 JSON도 성공 답변으로 처리하지 않는다. SSE 본문 시작 후 처음부터 재요청하지 않는다.

Vite dev/preview에만 이 relay가 존재한다. GitHub Pages 등 정적 호스팅과 운영 HTTPS 도메인에서는 인증·CSRF·사용량 제한을 갖춘 별도 서버 중계가 필요하다. 이번 빌드는 운영 중계 배포가 아니다. custom URL은 고정 relay로 보내지 않는다. 기존 local LLM 포트 허용 목록은 확장하지 않았다.

## 검증 증거와 제한

- `node --test tests/aiJenaUiContract.test.mjs tests/exaoneProvider.test.mjs tests/lemonadeEmptyResponse.test.mjs tests/lemonadeReasoning.test.mjs tests/task-vision-provider.test.cjs`: 52개 통과, 로컬 Lemonade 실모델1개 skip. 기존 함수 추출 테스트는 새 요청 wrapper/EXAONE 분기 경계에 맞게 갱신했다.
- `node --test tests/exaoneProxy.test.mjs`: 실제 localhost HTTP 서버에서 3개 통과. 최초 sandbox EACCES는 소켓 허용 실행으로 재검증했다. 고정 upstream/SSE/상태/키·출처 거부/redirect 차단 확인.
- `tests/exaoneProvider.test.mjs`: 키 분리, 일회 이전, 예산, TL 우선순위, UTF-8/JSON 청크 분리, reasoning/answer 분리, HTTP200 오류,401 무재시도, reader 중지 후 delta 차단.
- `tests/exaoneUi.browser.js`: 격리 Chrome 실제 앱·생산 브리지에서 합성 키/SSE 사용. desktop 및390px에서 TL max 실제 전송·생성 잠금·즉시 추론 표시·생성 중 표시 토글 DOM 보존·최종 답변·독립 도구 low 전송 통과.390px TL 입력 x175~232로 화면 안 표시 확인. 초기화 도중 실행 실패는 앱 브리지 대기 후 재검증했다.
- 실제 dev5219/preview5220 양쪽 `/api/exaone/chat/completions`에 키 없는 POST → HTTP401 확인. ENV에서 OrcaRouter 폼을 선택한 채 EXAONE 전용 저장 → 다른 공급자 키 보존·EXAONE 출력2048 재복원 확인(격리 합성 키).
- JS syntax, diff whitespace 검사 및 `npm run build` 통과. 기존 chunk 크기 경고 있음.
- 실제 EXAONE 키·사용자 저장소 접근 및 실제 유료/무료 생성은 수행하지 않았다. 각 Table/Math/ME/JS/Tidy/Macro/Slide/학술 도구의 개별 전체 UI·중지·적용은 공통 브리지 합성 검증으로 대체하지 않으며 별도 미검증이다. 전체 기존 배치의 실기기 검증·운영 배포·Word/PDF/수식 변경은 이번 범위 밖이다.

브라우저 재현(격리 세션, Vite 실행 및 앱 부팅 후):

```powershell
agent-browser --session exaone-port open http://127.0.0.1:5219/mdpro/index.html
$fixtureEncoded = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path tests/exaoneUi.browser.js)))
agent-browser --session exaone-port eval -b $fixtureEncoded
```

## Tauri 영향과 다른 앱 재명령

빌드 대기 ID는 `MDPRO-20261115-EXAONE-PORT`다. Viewer 원본에 EXAONE 웹 구현이 이미 존재하므로 WebDAV 전체 파일을 역복사하지 않는다. 새 모듈·app/index/chat/CSS/picker/PWA가 native frontend에 포함되는지 확인하고, Python/Vite 중계가 설치 앱에 자동 포함되지 않는 점을 별도 해결해야 한다. Viewer frontend/native/NSIS/설치 앱 검증 모두 대기이며 이번 Tauri 빌드 요청 없음.

```text
C:\CusorApps\MDPRO\MDproViewer에서 AGENTS.md, Docs/ai/AI_JENA.md,
Docs/ai/AI_REASONING_SETTINGS.md, Docs/porting/EXAONE_AI_PORTING.md 및
C:\CusorApps\WebDav-MD\webdav-md\docs\mdpro-development\changes\2026-11-15-exaone-provider-port.md를 읽어줘.
Viewer 기존 EXAONE 구현을 보존하고 WebDAV의 scoped 키 분리·독립 ENV 저장·reader 취소·인증 오류 무재시도를 함수별 비교해 필요한 차이만 반영해줘.
전체 파일 복사 없이 실제 ENV 저장 복원, 즉시/추론/TL/표시 독립성, 일반·독립 작업, SSE 중지·늦은 delta를 검증해줘.
Tauri native 중계 및 자산 포함을 먼저 조사하고 Docs/mdpro-development/TAURI_BUILD.md 절차에 따라 빌드 대기 상태를 갱신해줘.
실제 공급자·운영 서버·설치 앱 검증을 합성 검증과 구분해줘. 별도 요청 전 커밋·배포·Tauri 빌드는 하지 마.
```

공식 규격 확인: [K-EXAONE2.5 API](https://docs.exaone.ai/ko/docs/k-exaone-2.5), 2026-11-15 조회. 모델·텍스트 전용·524288·reasoning_effort·reasoning_content/최종 content 분리와 요청 필드를 확인했다.
