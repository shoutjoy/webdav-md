# 2026-11-13 중단된 텍스트 답변 이어쓰기

- 변경 ID: MDPRO-20261113-RESUME-ANSWER
- 원본: C:\CusorApps\WebDav-MD\webdav-md, 미커밋 / 작성일 2026-11-13.
- 대상: C:\CusorApps\md-viewerVscode\md_viewer, 이전 접근에서 경로 없음·대상 확인 필요.
- 상태: WebDAV 구현·Node 32검사·실제 Chrome 모의 공급자 동작·웹 빌드 통과. 실제 Lemonade 생성/모바일/Viewer 웹 이식·프런트엔드 준비·Tauri 빌드·설치 앱 미검증.

## 요청과 동작

텍스트가 중간에 끝나도 계속 쓸 수 있게 한다. 모든 비어 있지 않은 정상 텍스트 답변의 기존 작업 버튼 줄에 “이어서 작성”을 추가한다. 모델이 완료라고 보고하거나 예전 자동 탐지에 잡히지 않은 답변에도 사용할 수 있다. 이미지/오류 답변은 제외, 생성 중에는 비활성화한다.

Lemonade 등 로컬/호환 공급자가 토큰 예산에 못 미쳐 멈춰도 240자 이상이고 문장이 미완성이면 기존 이어쓰기 제안/Auto 승인 경로를 제공한다. 완성 문장 오판은 가능하므로 수동 버튼을 항상 제공한다. 기존 Auto 승인 설정/12회 상한은 보존한다. 사용자가 중지하면 기존 정책대로 Auto 승인을 끄며 임의 재시작하지 않는다.

## 구현과 보존

mdpro/AI_App/aiChat/ai-chat.js:
- shouldOfferContinuation: 로컬 공급자의 토큰 근접 조건에 !answerEndsCleanly를 OR로 추가.
- renderMessages: 기존 버튼을 유지하며 .ai-chat-resume-answer 추가, continueAssistantAnswer(messageIndex,'',false) 호출. 기존 중복 제거/대화 문맥/추가 답변 인라인 연결을 재사용한다.
- preserveInterruptedAnswer(previous): liveStream.answer에서 parseAssistantSections 및 extractVisibleAnswerBody로 본문만 추출. 빈 스트림은 저장하지 않음. 받은 본문을 continuationAvailable/interrupted 상태로 저장하고 이어쓰기 중단이면 previous 원문을 유지하며 continuationInline으로 연결한다.
- sendMessage catch 및 continueAssistantAnswer catch에서 스트림이 지워지기 전에 위 함수를 호출한다. 초기 요청에서 받은 본문이 있으면 원 질문을 failed로 제외하지 않아 이어쓰기 문맥을 유지한다. 추론만 수신한 경우 본문으로 저장하지 않는다.
- 기존 setRunning/saveHistory/renderMessages를 통해 버튼과 중단 본문을 저장·복원한다. 재요청 실패 시 기존 답변을 덮어쓰지 않는다.

app.js aiChat URL과 index.html app.js 로더에 resumeAnswer=20261113-1, PWA 캐시 20261113-resume-answer-1 반영. 신규 의존성 없음. 상태 안내 제거 관련 기존 변경은 보존한다.

UI 인벤토리: history-toggle/new/copy-all/save-all/data-center-open/layout-menu-button/close 모두 유지. Alt+4 drag/toggle/입력/응답모드/실시간 쓰기/send-stop 유지. CSS 숨김/클리핑/오버플로 규칙 추가 없음. Markdown/MathJax/인쇄/PDF/DOCX 파이프라인 미변경.

## 검증

- node --test tests/aiJenaResume.test.mjs tests/aiJenaUiContract.test.mjs: 32/32 통과. 예산 미달 Lemonade 미완성/완성 구분, 중단 스트림 저장/빈 스트림 무시, 이어쓰기 중단의 이전 본문 보존 검사.
- node tests/aiJenaResume.browser.cjs: 실제 Vite iframe 및 Chrome에서 배치 전환 후 모의 bridge.complete가 message.delta를 보낸 뒤 AbortError로 중단. 기존 본문 표시, 이어쓰기 버튼 클릭, 두 번째 요청의 continuation=true, 추가 본문과 원문 동시 보존 확인.
- node --check mdpro/AI_App/aiChat/ai-chat.js, git diff --check, npm run build 통과 (기존 큰 청크 경고).
- 실제 공급자/긴 답변의 의미적 완결성·물리 모바일·실시간 문서 쓰기 중단 후 문서 위치는 별도 미검증. 모델이 앞부분을 의역 반복하는 모든 경우의 제거를 보장하지 않음. 승인 없는 자동 재개를 추가하지 않음.

## 대상 적응 및 Tauri 계획

| 원본 | 대상 대응 | 선행 조건/상태 |
| --- | --- | --- |
| ai-chat.js renderMessages/shouldOfferContinuation/중단 catch | 대상 AI_App/aiChat/ai-chat.js 실제 함수 확인 필요 | liveStream 및 부분 응답/저장/문맥 구조 비교 후 분기만 이식·미이식 |
| app.js/index.html/PWA 캐시 | 대상 독립 로더/자산 | 대상 브리지와 버전 보존·미검증 |

전체 파일을 덮어쓰지 않는다. 대상 자체 실시간 문서/학술 분할/Auto 승인 로직을 확인하고 원문 유지 및 수동 중지 후 자동 재시작 금지를 검증한다. Viewer 웹 이식·웹 검증 후 Docs/mdpro-development/TAURI_BUILD.md에 따라 포함 자산 및 Tauri/dist를 확인한다. 프런트엔드 준비·네이티브 빌드·설치 앱 검증은 각각 대기. 이번 요청은 대상 포트/빌드/설치를 포함하지 않는다. 빌드 대기 ID는 위 변경 ID.

## 복사할 구현 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md와 C:\CusorApps\WebDav-MD\webdav-md\docs\mdpro-development\changes\2026-11-13-resume-answer.md를 읽고 중단 텍스트 이어쓰기를 구현해줘. 실제 renderMessages/부분 스트림/중단 catch/기존 이어쓰기/저장 문맥을 먼저 비교해줘. 정상 텍스트 답변에 이어서 작성 버튼을 추가하고 토큰 한도 미달의 미완성 응답을 제안하며 중단 전 본문을 보존해줘. 기존 답변·학술 분할·실시간 쓰기·필수 UI·Auto 승인 상한을 보존하고 수동 중지 후 자동 재시작하지 마. 전체 파일 복사 없이 Node 검사와 실제 브라우저 모의 중단→버튼→추가 본문 및 가능한 실제 공급자를 검증해줘. 문서·인덱스·Tauri 대기를 갱신하되 네이티브 빌드/설치는 실행하지 말고 미검증을 구분해줘.
```
