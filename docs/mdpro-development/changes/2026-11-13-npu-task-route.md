# FLM NPU 작업 실행 경로 분리

- 변경 ID: MDPRO-20261113-NPU-TASK-ROUTE
- 작성: 2026-11-13, 원본 미커밋. 기존 사용자 변경 보존.
- 원본: C:\CusorApps\WebDav-MD\webdav-md
- 대상: C:\CusorApps\MDPRO\MDproViewer (읽기 비교만 수행)
- 상태: 원본 구현 및 자동검증 완료 / 대상 미이식 / 실제 Mermaid UI 미검증 / Tauri 미빌드.

## 요청과 구현

첨부 화면은 FLM NPU 연결 목록이 정상인데 실행 시 OrcaRouter 키 오류가 표시된다. NPU 하드웨어 미연결로 단정하지 않는다. 현재 로컬 서버 추론은 성공했다. 배포된 구버전 또는 당시 요청의 정확한 전송 내용은 미확인이다.

`mdpro/js/app.js`의 `AIChatBridge.complete`에서 provider=lemonade-flm 및 provider=openai-compatible/profile=lemonade-flm 모두를 ollama-npu로 정규화한다. 이미지 입력은 기존 completeTaskVision, 텍스트/코드 수정은 기존 callNPUChat으로 보내 로컬 모델 검사와 requestLocalAIJson/streamNPUChat 전송을 공유한다. 클라우드 프로필/키 조회를 거치지 않는다. 모델과 중지 signal은 보존한다.

`getMermaidVisionProviderSelection`의 Lemonade 상속이 외부 호환 프로필로 변환되던 별도 결함도 수정: provider=lemonade 및 ss_ai_chat_lemonade_model을 반환한다. 기존 UI 컨트롤/레이아웃/수식/출력 코드는 변경하지 않았다.

index.html app.js URL에 npuTaskRoute=20261113-1을 추가하고 PWA 캐시를 20261113-npu-task-route-1로 갱신했다. 테스트 harness에 현행 completeTask의 localModelLoading 상태를 제공했다.

## 대상 비교 및 적응

Viewer js/app.js는 lemonade-flm을 자체 OpenAI 호환 프로필로 정식 지원하며 localhost:13305/api/v1 기본값과 자체 설정 읽기가 있다. WebDAV의 ollama-npu 정규화를 전체 파일 복사로 이식하지 않는다. Viewer에서는 실제 선택 프로필이 getStoredOpenAICompatibleConnection에 전달되는지 먼저 재현/확인하고, 대상 고유 설정과 native transport를 보존한다. 이번 대상 런타임은 수정하지 않았다.

## 검증

- node --test tests/jenaSeriesRuntime.test.mjs tests/task-vision-provider.test.cjs tests/me-task-models.test.cjs tests/aiJenaUiContract.test.mjs: 62/62 통과. FLM 별칭 두 종류가 cloud credentials 조회 없이 NPU transport로 가는 실행 테스트 및 Lemonade 상속 검사 포함.
- node --check mdpro/AI_App/aiChat/ai-chat.js 및 mdpro/js/app.js 통과.
- npm run build 통과 (기존 chunk 크기 경고).
- 실제 127.0.0.1:13305/api/v1/models 조회: FLM 설치 모델 확인.
- 같은 서버 chat/completions에 gemma4-it-e4b-FLM, Reply only OK., max_tokens=8 요청: OK 응답. 이는 직접 서버 추론 증거이며 Mermaid UI 성공 증거는 아니다. NPU 사용률 계측은 미실행.
- 실제 Mermaid Ref UI/이미지 비전/사용자 배포 환경 재현은 미검증. git diff --check 별도 확인.

## Tauri

대기 ID MDPRO-20261113-NPU-TASK-ROUTE. 대상 웹 이식·frontend·native·설치 검증 모두 미실행. 대상 이식 시 js/app.js 및 대상 자체 캐시 자산 반영 후 Docs/mdpro-development/TAURI_BUILD.md를 따른다. 이번 요청으로 대상 자동 빌드하지 않는다.

## 복사 가능한 재명령

```text
C:\CusorApps\MDPRO\MDproViewer에서 AGENTS.md와 WebDAV docs/mdpro-development/changes/2026-11-13-npu-task-route.md를 읽고 Mermaid Ref FLM 선택 후 OrcaRouter 키 오류가 발생하는지 점검해줘. 대상의 lemonade-flm 고유 프로필과 native 전송을 보존하면서 실행 공급자와 모델 조회 공급자를 일치시켜줘. 전체 파일을 복사하지 말고 실제 모델 목록·코드 수정·이미지 경로·중지 동작을 검증해줘. 이식 문서와 Tauri 빌드 대기 상태를 갱신하고 빌드/설치는 실행하지 마.
```
