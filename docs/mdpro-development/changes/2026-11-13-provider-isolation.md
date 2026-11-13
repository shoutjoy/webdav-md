# 2026-11-13 로컬 공급자 분리와 Lemonade 성능 표시

- ID: MDPRO-20261113-PROVIDER-ISOLATION / WebDAV 미커밋 / 2026-11-13.
- 원본 C:\CusorApps\WebDav-MD\webdav-md. 대상 C:\CusorApps\MDPRO\MDproViewer는 이번 미수정·대상 대응 함수 확인 필요. 웹 구현/검사/빌드 완료, Viewer 이식·프런트엔드 준비·Tauri native/설치 검증 미실행.

## 요청과 구현

Lemonade와 LM Studio는 별도 서버·설정·모델이다. AI Jena의 기존 연결 실패 자동 fallback과 최초 LM Studio 선택 강제 마이그레이션, 대화 기록 복원에 의한 선택 변경을 제거/제한한다.

ai-chat.js refreshModels catch는 다른 서버로 provider를 바꾸거나 다른 모델 목록을 요청하지 않는다. 선택 서버의 연결 실패만 표시한다. ensureInitialized는 저장된 LM Studio 선택을 Lemonade로 바꾸지 않는다. 대화 복원 시 로컬 공급자끼리는 현재 명시적 선택을 우선한다. syncSettings는 생성/모델 로딩 중 공급자·모델을 바꾸지 않는다. 공급자 직접 선택 메뉴는 그대로 유지한다.

sendMessage는 Lemonade/Ollama 연결이 이미 확인된 경우 전송마다 refreshModels를 호출하지 않고 선택 모델의 생성 요청으로 바로 진행한다. 미확인/실패 상태만 해당 공급자를 확인하며, 오류 문구도 선택 공급자 이름으로 표시한다. 저장된 endpoint/API key/모델 키는 합치거나 복사하지 않는다. LM Studio/Lemonade의 실제 API 분기는 기존 독립 경로를 유지한다.

app.js streamOpenAICompatibleChat는 요청 전송 시점부터 첫 본문 delta 수신까지를 측정해 Lemonade usage.time_to_first_token_seconds에 저장한다. 서버의 decoding_speed_tps가 있을 때만 tokens_per_second로 표시한다. ai-chat.js 기존 통계 행에 Lemonade를 포함하여 첫 토큰 시간·생성 속도·토큰 수를 표시한다. 모델명/응답의 가짜 속도나 추정 생성 성공을 만들지 않는다.

index.html app.js, 동적 aiChat URL providerIsolation=20261113-1, PWA 20261113-provider-isolation-1 갱신. 기존 버튼/컨트롤/단축키/설정·문서 원문·실시간 쓰기·수식/출력 경로 보존. 새로운 숨김/클리핑 CSS 없음. 신규 의존성 없음.

## 검증

- aiJenaConnection.test.mjs: 실패 시 다른 서버를 조회하지 않음·현재 provider 보존·저장 LM Studio 선택 보존 계약으로 수정. 과거 자동 fallback을 기대한 2개 검사를 변경 후 통과.
- node --test tests/aiJenaConnection.test.mjs tests/aiJenaUiContract.test.mjs tests/lemonadeEmptyResponse.test.mjs tests/lemonadeReasoning.test.mjs: 통과, live 선택 검사 1개 기본 skip.
- ai-chat.js/app.js 문법 및 git diff --check, npm run build 통과. 기존 큰 청크 경고.
- tests/lemonadeWarmStart.live.browser.cjs 재실행은 TypeError network error로 실패. 이번 변경 후 새 실서버 속도 수치는 미검증이다. 앞선 714ms 측정은 이전 변경 문서의 특정 요청 증거이며 이번 성공으로 재사용하지 않는다. 서버 실행·모델 자체 성능·부하에 관계없이 10초를 보장하지 않는다.

## 대상 적응·Tauri

Viewer의 실제 provider 선택/자동 fallback/대화 복원·설정 동기화·통계 처리 함수를 다시 비교해야 한다. 전체 파일을 덮어쓰지 않고 명시적으로 선택한 공급자를 유지하는 정책만 필요한 범위로 적응한다. 대상 native bridge/endpoint·인증·모델 키를 WebDAV와 공유하지 않는다. 대기 ID는 위 ID. 대상 웹 이식·웹 검증·프런트엔드 준비·native build·설치 앱 검증 모두 미실행. 빌드 요청 시 대상 Docs/mdpro-development/TAURI_BUILD.md를 먼저 따른다.

## 복사할 구현 명령

```text
C:\CusorApps\MDPRO\MDproViewer에서 AGENTS.md와 C:\CusorApps\WebDav-MD\webdav-md\docs\mdpro-development\changes\2026-11-13-provider-isolation.md를 읽고 실제 공급자 선택·실패 fallback·대화 복원·통계 코드를 비교해줘. 명시적 Lemonade/LM Studio/Ollama 선택을 서로 자동 전환하지 않고 실행 중 변경도 방지해줘. 연결된 Lemonade의 전송 전 중복 목록 조회를 없애되 오류는 선택 서버에서 보고해줘. 실측 첫 본문 시간과 서버 생성 속도만 표시하고 endpoint/키/모델 저장소를 독립 유지해줘. 기존 기능을 보존하고 전체 파일 복사 없이 검사·문서·Tauri 대기를 갱신해줘. 빌드·설치·커밋·푸시는 하지 말고 실서버 재측정 실패는 숨기지 마.
```
