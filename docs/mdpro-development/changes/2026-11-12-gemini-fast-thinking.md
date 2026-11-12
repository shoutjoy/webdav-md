# 2026-11-12 Gemini 즉시 응답 추론 수준 복원

- 변경 ID: MDPRO-20261112-GEMINI-FAST
- 원본: C:\CusorApps\WebDav-MD\webdav-md / 대상: C:\CusorApps\md-viewerVscode\md_viewer
- 작성·확인: 2026-11-12, 미커밋. 근거: mdpro/js/app.js의 callAIStudioChat, tests/aiStudioThinking.test.mjs
- 상태: 원본 구현 완료 / 상대 미이식 / 실제 웹 속도 미측정 / Tauri 준비·빌드·설치 앱 미실행

## 요청과 완료 기준

Gemini 3.1 Flash Lite에서 첫 토큰 43초 대기 화면이 보고됨. quick(즉시) 요청이 low 추론을 강제하던 설정을 지원 모델의 minimal로 복원한다. 고급 추론 high, Pro low, Gemini 2.5 thinkingBudget, 전체 출력 토큰 한도, 검색·이미지·TTS·대화·모든 UI 컨트롤과 저장값은 보존한다. 이 변경만으로 서버·네트워크 지연까지 해결되었다고 판단하지 않는다.

## 실제 구현

- mdpro/js/app.js → callAIStudioChat: Gemini 3 Flash 및 3.1 Flash-Lite(정식/preview)에만 minimal 지원 정규식 적용. reasoning은 high 유지. 다른 Gemini 3 모델은 기존 low 유지.
- 핵심 코드: `thinkingLevel: reasoningMode ? 'high' : (supportsMinimalThinking || (fastTask && /flash|lite/i.test(model)) ? 'minimal' : 'low')`.
- mdpro/index.html: app.js의 aiJenaReasoning 캐시 키를 20261112-gemini-minimal-1로 갱신.
- tests/aiStudioThinking.test.mjs: 함수 실행과 모의 전송으로 7개 모델/모드의 요청 및 답변·출력 한도 보존 검증. 신규 의존성 없음.
- 공식 근거: https://ai.google.dev/gemini-api/docs/gemini-3 (Flash-Lite minimal 기본값, Pro minimal 미지원). low 강제가 기본값보다 높은 추론을 유발한다는 설정 문제를 수정했으며 실제 43초 원인 전체는 미확정.

## 상대 앱 대응표와 이식 순서

| 원본 | 대상 | 차이·선행 조건 | 상태 |
| --- | --- | --- | --- |
| mdpro/js/app.js callAIStudioChat | 대상 js/app.js 대응 함수 확인 필요 | 지정 Viewer 경로 Test-Path=False; 대상 확인 필요·미검증 | 미이식 |
| mdpro/index.html app.js 캐시 키 | 대상 로더 확인 필요 | 독립 로더 및 Tauri 자산 구조 확인 | 미이식 |

전체 파일 복사는 금지. 대상 공급자 요청 함수의 모델 판별·응답 모드 매핑·이미지/TTS 제외를 실제 조사한 후 해당 분기만 적응한다.

## 회귀 예제와 검증

- `node --test tests/aiStudioThinking.test.mjs tests/aiStudioModels.test.mjs tests/aiJenaUiContract.test.mjs`: 42/42 통과.
- `node --check mdpro/js/app.js`, `node --check mdpro/AI_App/aiChat/ai-chat.js`: 통과.
- `npm run build`: 통과, 기존 큰 청크 경고 있음.
- `git diff --check`: 통과.
- 최종 diff: UI 제거·숨김·클리핑 CSS 변경 없음. 기본 모드 quick 유지, 기존 모델/설정 저장 유지.
- 실제 Google API 및 UI 속도 측정 미실행. 제공된 화면의 질문을 quick 모드로 다시 전송해 첫 토큰 시간/완료 시간과 API 오류 여부를 확인해야 한다. 서버 혼잡·계정 제한·검색 지연은 별도 원인일 수 있다. API 키를 읽거나 새로 저장하지 않았다.

## Tauri 반영 계획

큐 ID MDPRO-20261112-GEMINI-FAST. Viewer 웹 이식 후 js/app.js·캐시 로더와 테스트를 확인하고 Docs/mdpro-development/TAURI_BUILD.md에 따라 요청 시 빌드한다. 현재 웹 이식·프런트엔드 준비·네이티브 빌드·설치 앱 속도 검증 모두 대기. 이번 작업에서 자동 빌드·대상 코드 변경 없음.

## 다른 앱에서 다시 실행할 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 작업해줘. AGENTS.md와 WebDAV의 C:\CusorApps\WebDav-MD\webdav-md\docs\mdpro-development\changes\2026-11-12-gemini-fast-thinking.md를 읽고 Gemini quick 모드의 3.1 Flash-Lite/3 Flash 요청만 minimal 추론으로 적응해줘. 실제 대상 함수·로더·응답 모드 매핑부터 확인하고 전체 파일을 덮어쓰지 마. high 추론, Pro low, 2.5 예산, 이미지/TTS, 출력 한도와 UI를 보존해줘. 요청 payload 회귀 검사와 실제 첫 토큰/완료 시간 검증을 구분하고 인계 문서·목록·Tauri 큐를 갱신해줘. Tauri 빌드는 이번 명령에 포함하지 마. 미검증 항목을 명시해줘.
```

## 원격 변경 통합 검증

2026-11-12 origin/main 8b9bf8e 위로 재배치. 기존 requestOptions/fastTask의 최소 추론·출력 제한·2.5 Pro 예산과 원격 로더 캐시 및 인계 목록을 보존했다. 통합 후 동일 42개 검사, 두 JS 문법 검사, 웹 빌드와 diff 공백 검사가 통과했다.
