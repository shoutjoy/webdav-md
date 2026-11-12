# 2026-11-13 AI Studio 모델 목록 안내 제거

- 변경 ID: MDPRO-20261113-STUDIO-NOTICE
- 원본: C:\CusorApps\WebDav-MD\webdav-md, 미커밋. 대상: C:\CusorApps\md-viewerVscode\md_viewer (이전 확인에서 경로 없음·대상 확인 필요).
- 상태: 원본 구현·자동 검사·웹 빌드 완료. 실제 화면 미검증. 대상 이식·웹 검증·Tauri 프런트엔드 준비·네이티브 빌드·설치 앱 검증 미실행.

## 요청과 실제 구현

사용자가 지정한 “AI Studio 전체 모델 목록입니다. 계정별 할당량과 전용 API 지원 여부는 별도 확인이 필요합니다.”만 제거한다.

mdpro/AI_App/aiChat/ai-chat.js의 refreshModels Gemini 성공 분기에서 일반 모델의 setStatus 메시지를 빈 문자열로 바꾼다. 이미지 모델의 Nano Banana 안내와 오류 메시지, 모델 목록, 연결 상태는 기존 처리 유지. 기존 setStatus가 이전 상태 문구를 지우도록 호출 자체는 유지한다. UI 컨트롤/이벤트/원문/설정/내보내기 경로 미변경. 기존 헤더 7개 필수 컨트롤과 Alt+4 입력·실시간 쓰기·전송/중지 컨트롤 모두 미수정. 새 CSS 숨김/오버플로 규칙 없음.

app.js aiChat 동적 URL studioNotice=20261113-1, index.html app.js 캐시 키, PWA service-worker 20261113-studio-notice-1 갱신. 신규 의존성 없음. 이전 미커밋 Dock 수정은 보존.

## 검증

node --test tests/aiJenaUiContract.test.mjs 29개 통과. node --check mdpro/AI_App/aiChat/ai-chat.js, git diff --check, npm run build 통과 (기존 큰 청크 경고). 실제 공급자 연결/화면 재확인은 미실행. 기대 회귀: 일반 Gemini 모델 목록 로드 성공 시 해당 안내 없음, 이미지 모델 안내/연결 실패 오류는 표시 유지.

## 대상 적응과 Tauri

원본 ai-chat.js refreshModels의 일반 Gemini 성공 메시지에 대응하는 대상 함수를 먼저 찾아 문구만 제거한다. 전체 파일 복사 금지. 대상 별도 모델/브리지/초기화 구조와 캐시 로더를 보존한다. 대상 코드 경로는 실제 검사 필요·미이식. 웹 이식 후 대상 Docs/mdpro-development/TAURI_BUILD.md에 따라 포함 자산과 Tauri/dist를 확인할 수 있으나 이번 빌드/설치는 미요청·미실행. 대기 ID: MDPRO-20261113-STUDIO-NOTICE.

## 복사할 구현 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md와 C:\CusorApps\WebDav-MD\webdav-md\docs\mdpro-development\changes\2026-11-13-studio-model-notice.md를 읽고 AI Studio 일반 모델 목록 로드 성공 안내 “AI Studio 전체 모델 목록입니다. 계정별 할당량과 전용 API 지원 여부는 별도 확인이 필요합니다.”만 제거해줘. 실제 대응 함수를 확인하고 이미지 모델 안내·모델 목록·연결 상태·오류 메시지·필수 UI를 보존해줘. 전체 파일 덮어쓰기 없이 대상 캐시를 갱신하고 검증 및 문서/인덱스/Tauri 대기를 기록해줘. 네이티브 빌드/설치는 하지 마.
```
