# 2026-11-13 실시간 이어쓰기·Auto 클릭 복구 및 Lemonade 시작 지연

- 변경 ID: MDPRO-20261113-CONTINUATION-START
- 원본: C:\CusorApps\WebDav-MD\webdav-md, 미커밋 / 2026-11-13.
- 대상 참고: C:\CusorApps\MDPRO\MDproViewer. 대상 런타임 미수정. 상태: WebDAV 구현·실제 Chrome 클릭·실모델 첫 본문 측정·검사/빌드 완료. Viewer 포트·Tauri 준비/빌드/설치 앱 미실행.

## 요청과 확인한 원인

Auto/제안대로 이어쓰기를 누르면 실시간 문서 이어쓰기 오류가 발생했다. continueAssistantAnswer가 beginRealtimeDocForCurrentGeneration()을 미리 호출한 뒤 try 안에서 continuationText로 다시 호출했다. 두 번째 호출은 realtimeDocActive가 이미 true라 false를 반환하고, 정상 문서에서도 오류를 던졌다. catch에서 Auto를 해제해 체크가 안 먹는 것처럼 보였다.

실제 Lemonade 측정에서는 gemma4e-flash-e4b-FLM이 single-turn 모델이라 assistant 역할이 있는 이어쓰기 요청 자체를 HTTP 오류로 거부하는 추가 원인을 확인했다. 적재 성공과 이어쓰기 API 지원은 별개다.

## 실제 수정

mdpro/AI_App/aiChat/ai-chat.js:
- continueAssistantAnswer: 문서 세션을 continuationText와 함께 딱 한 번 시작한다. 문서에서 원래 답변을 못 찾는 경우 원문/선택 영역을 건드리지 않고 realtimeDocActive/Exclusive=false로 두어 채팅에서 계속 생성한다. 전역 실시간 쓰기 설정을 임의 변경하지 않는다. 결과는 일반 채팅 본문으로 표시해 명시적으로 문서에 넣을 수 있다.
- Auto 체크박스를 state.running 때문에 비활성화하지 않는다. 생성 중에도 다음 자동 반복을 해제할 수 있으며 중복 생성은 기존 continueAssistantAnswer의 실행 가드가 방지한다. 제안대로 이어쓰기/수동 버튼/12회 상한·중지 동작은 유지.
- updateLiveStreamDom 및 message.delta: 실제 문서 쓰기가 활성화된 경우에만 채팅 본문 스트림을 숨기고 문서 작성 단계로 표시한다. 문서 앵커 실패로 채팅 fallback한 경우 첫 토큰부터 보인다.
- Lemonade의 실시간 문서 작성은 disableThinking=true로 본문부터 생성한다. 기존 이어쓰기는 이미 quick/disableThinking=true를 유지한다. 일반 채팅의 사용자 선택 추론 모드는 유지한다.
- 실시간/FAST의 Mermaid 전역 지시문은 mermaidInstructionForRequest(text,false)로 필요한 요청에만 포함한다. 요청과 무관한 긴 Mermaid 안내로 prefill을 늘리거나 일반 답변에 코드블록을 강요하지 않는다.

mdpro/js/app.js:
- prepareLemonadeSingleTurnMessages(messages,model): 실제 캐시 metadata labels에 single-turn이 있는 경우에만 system은 유지하고 이전 user/assistant/최신 user 문맥을 구분한 하나의 user 입력으로 묶는다. 기존 답변과 원래 질문·첨부 참조를 보존하고 원본 배열을 변조하지 않는다. 일반 multi-turn 모델은 기존 역할 구조를 그대로 사용한다.
- 기존 문맥 예산 처리 뒤, aiChatMessagesWithImageContent 변환 전에 호출하므로 실제 이미지 데이터 처리도 유지한다. 새 모델 로딩/연결 확인 요청을 생성 경로에 추가하지 않는다.
- index.html app.js, app.js aiChat 동적 URL continuationStart=20261113-1 및 PWA 20261113-continuation-start-1 갱신. 신규 의존성 없음.

## UI 인벤토리와 보존

필수 Jena header history-toggle/new/copy-all/save-all/data-center-open/layout-menu-button/close 및 Alt+4 drag/toggle/입력/응답모드/실시간 쓰기/send-stop 전부 유지. 새 CSS 숨김/클리핑 없음. answerWrap의 기존 숨김 조건을 실제 문서 쓰기 활성 상태로 좁혀 fallback 본문 접근성을 회복했다. 저장된 질문/답변·문서 원본·수식/MathJax/PV/출력 경로 미변경.

## 검증과 10초 목표의 범위

- tests/aiJenaRealtimeContinuation.browser.cjs: 실제 Vite iframe/Chrome, native Input.dispatchMouseEvent로 제안대로 이어쓰기 버튼과 Auto 체크박스를 각각 클릭. 요청 전송, continuation=true, 이어쓰기마다 문서 세션 정확히 1회, 문서 앵커 실패 후 채팅 생성 확인. 모의 bridge로 문서/요청 상태를 검사한다.
- tests/lemonadeWarmStart.live.browser.cjs: 실제 운영 bridge→적재된 gemma4e-flash-e4b-FLM, 이전 질문/답변을 포함한 한국어 이어쓰기, quick/disableThinking 및 maxOutputTokens256. 첫 본문 714ms, 전체21144ms, 본문578자. 시작 10초 목표는 이 측정에서 통과. 전체 생성 완료가 10초라는 뜻이 아니다. screenshot의 gemma4-it-e4b-FLM은 이 실측 모델과 다르며 모든 모델/질문/서버 부하에서 10초를 보장하지 않는다.
- 최초 live 측정의 single-turn assistant 메시지 오류를 위 metadata 적응으로 수정한 뒤 실측 성공했다. 모델 강제 교체/재로드/서버 프리셋 변경은 하지 않았다.
- node --test tests/lemonadeSingleTurn.test.mjs tests/aiJenaResume.test.mjs tests/lemonadeReasoning.test.mjs tests/aiJenaUiContract.test.mjs tests/aiChatImageAttachments.test.mjs: 최종47/47. reasoning 계약은 실시간 본문 우선 예외를 반영하고 이미지 테스트 harness에 실제 single-turn helper를 로드했다.
- node --check app.js/ai-chat.js, git diff --check, npm run build 통과. 기존 큰 청크 경고.
- 추가 실행한 tests/aiCompatibleContext.test.mjs의 7개는 현재 HEAD에도 없는 fitOpenAICompatibleContext 함수를 소스에서 추출하도록 되어 있어 실패했다. 이번 변경 전부터 불일치한 별도 테스트이며 통과로 집계하지 않았다.
- 실기기 모바일·사용자 실제 문서/긴 대화·원격 배포·모든 모델의 지연은 미검증. 문서 원문이 바뀌었거나 여러 번 나온 경우 자동 삽입 위치를 추정해 덮어쓰지 않는다.

## Viewer 적응 및 Tauri 대기

실제 Viewer AI_App/aiChat/ai-chat.js와 js/app.js에서 동일 continueAssistantAnswer/continuationText/single-turn 패턴은 찾지 못했다. 대상에서 현재 이어쓰기/스트림 함수의 대응을 다시 확인해야 하며 기능명만으로 포트 완료라 판정하지 않는다. 파일 전체 복사 금지. 대상 네이티브 브리지와 문서 편집 세션 구조를 유지하고, single-turn metadata 및 세션 단일 시작/채팅 fallback만 필요한 범위로 적응한다.

대기 ID: MDPRO-20261113-CONTINUATION-START. Viewer 웹 이식·웹 검증·프런트엔드 준비·네이티브 빌드·설치 검증 모두 미실행. 빌드 요청 시 대상 Docs/mdpro-development/TAURI_BUILD.md를 먼저 확인하고 Tauri/dist 자산과 설치 앱의 버튼/문서 보존/지연을 별도 검증한다. 이번 빌드/설치는 요청되지 않았다.

## 복사할 구현 명령

```text
C:\CusorApps\MDPRO\MDproViewer에서 AGENTS.md와 C:\CusorApps\WebDav-MD\webdav-md\docs\mdpro-development\changes\2026-11-13-continuation-start.md를 읽어줘. 실제 이어쓰기/실시간 문서 세션 대응을 먼저 찾고 문서 세션이 정확히 한 번 시작되도록 고쳐줘. 문서 앵커를 못 찾으면 원문을 변경하지 않고 채팅에서 이어가며 Auto 체크는 실행 중에도 해제 가능하게 해줘. metadata로 single-turn인 Lemonade 모델에는 이전 대화와 최신 지시를 하나의 user 입력으로 적응하되 첨부/원문/일반 추론 모드를 보존해줘. 실시간 문서와 이어쓰기의 본문 시작 지연을 줄이고 native 클릭과 실모델 첫 본문 시간을 측정해줘. 첫 본문/전체 완료 시간을 구분하고 모델별 10초 미달 보장을 과장하지 마. 전체 파일 복사 없이 문서·목록·Tauri 대기를 갱신하고 네이티브 빌드·설치·커밋·푸시는 하지 마.
```
