# Lemonade NPU 첫 응답 스트리밍 복구

- 변경 ID: MDPRO-20261116-NPU-STREAMING
- 날짜: 2026-11-16 / 미커밋
- 원본: C:/CusorApps/WebDav-MD/webdav-md
- 대상: C:/CusorApps/MDPRO/MDproViewer (읽기 비교만 수행)
- 상태: 원본 구현·자동검사·웹 빌드 완료. 실제 UI/실모델 속도 미검증, 대상 미이식, Tauri frontend/native/설치 검증 대기.

## 요청과 원인

사용자는 Lemonade 실시간 표시 불량과 30~40초 대기를 보고하고 Viewer 설정 이미지를 참고로 제공했다. NPU 공급자 `ollama-npu`는 일반 전송과 이어쓰기의 onStreamEvent 선택식에서 빠져 있었다. 따라서 callNPUChat은 stream:false JSON 경로를 사용해 전체 생성 완료 후 표시했다. 일반 Lemonade 공급자의 기존 스트림 경로는 유지한다. 서버 첫 토큰 지연과 전체 응답 완료 시간은 별개이며 10초 보장은 아직 검증되지 않았다.

## 실제 구현

- mdpro/AI_App/aiChat/ai-chat.js: send 경로 streamHandler와 이어쓰기 onStreamEvent에 ollama-npu 추가. handleStreamEvent → 기존 streamNPUChat → requestLocalAITextStream 경로를 연결한다. 일반 전송/이어쓰기/실시간 문서 쓰기에서 같은 응답의 토큰을 받는다.
- mdpro/js/app.js callNPUChat: `npuThinking = request.mode === 'reasoning' && request.disableThinking !== true && !request.fastMode`. thinking, enable_thinking, chat_template_kwargs.enable_thinking을 일치시켜 즉시/FAST 모드의 불필요한 추론을 끈다. 추론 모드 선택은 보존한다.
- 세부 설정 안에 즉시/추론 모드와 최초 모델 로드 시간 안내 추가. 새 의존성/저장 키/캐시 버전 변경 없음.
- 기존 헤더 7개 버튼, Alt+4 입력·드래그·모드·문서 쓰기·전송/중지, 모델 선택/로드 및 설정 ID를 보존한다. CSS 변경·숨김·삭제 없음.

## 대상 비교와 적응

| 원본 | 대상 | 차이 및 순서 |
| --- | --- | --- |
| js/app.js callNPUChat, streamNPUChat | js/app.js callNPUChat, streamLiteRTLMChat | Viewer는 NPU에서 streamLiteRTLMChat을 사용하고 컨텍스트 오류 3회 재시도 및 부분 출력 보호가 있다. 원본 함수 전체를 복사하지 않는다. thinking 플래그만 대상의 요청 정책과 대조한다. |
| AI_App/aiChat/ai-chat.js 전송/이어쓰기 | AI_App/aiChat/ai-chat.js | 대상 실제 전송 선택식은 추가 확인 필요. NPU 콜백 전달 여부를 독립 검증한다. |

## 검증

- node --test tests/aiNpuStreaming.test.mjs tests/aiJenaUiContract.test.mjs tests/aiNpuConnection.test.mjs tests/lemonadeReasoning.test.mjs tests/lemonadeEmptyResponse.test.mjs: 47개 중 46 통과, 선택적 실모델 1개 skip.
- 추가 회귀: 일반 전송/이어쓰기 콜백 연결, quick/reasoning 플래그, 종료를 보류한 모의 스트림에서 첫 토큰을 먼저 수신함을 검사.
- node --check mdpro/AI_App/aiChat/ai-chat.js 및 mdpro/js/app.js 통과. git diff --check 통과.
- npm run build 통과 (기존 500 kB 청크 경고).
- node tests/lemonadeWarmStart.live.browser.cjs 실패: Chrome DevToolsActivePort 생성 안 됨. 실제 UI 증거 없음.
- localhost:13305 모델 목록 fetch 실패. 실모델 TTFT·사용자 장문 동일 입력·10초 이내 응답 미검증.

## Tauri 반영 계획

빌드 큐 MDPRO-20261116-NPU-STREAMING. 대상 전송 콜백 및 thinking 정책을 선별 적용하고 웹/실모델 검증 후 대상 Docs/mdpro-development/TAURI_BUILD.md를 따른다. AI_App/aiChat/ai-chat.js 및 js/app.js가 최종 frontend 자산에 포함되는지 확인한다. Tauri/dist 검사, 네이티브 빌드와 설치 앱의 스트리밍/중지/이어쓰기 검증은 대기. 이번 요청에 대상 빌드·배포는 포함되지 않는다.

## 다른 앱에서 다시 실행할 명령

```text
C:/CusorApps/MDPRO/MDproViewer에서 AGENTS.md와 WebDAV의 docs/mdpro-development/changes/2026-11-16-lemonade-npu-streaming.md를 읽고 NPU 일반 전송/이어쓰기 스트리밍 콜백 누락과 quick/FAST thinking 정책을 점검·선별 이식해줘. 기존 streamLiteRTLMChat과 컨텍스트 재시도/부분 출력 보호 및 모든 UI를 유지하고 전체 파일을 덮어쓰지 마. 모의 스트림 종료 전 토큰 표시, 실제 NPU 장문 첫 응답 시간, 중지/이어쓰기/문서 쓰기를 검증하고 문서·인덱스·Tauri 큐를 갱신해줘. Tauri 빌드와 배포는 실행하지 말고 실측 미검증은 구분해줘.
```
