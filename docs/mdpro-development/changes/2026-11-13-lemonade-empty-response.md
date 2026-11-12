# 2026-11-13 Lemonade 빈 응답 복구

- 변경 ID: MDPRO-20261113-LEMONADE-EMPTY
- 원본: C:\CusorApps\WebDav-MD\webdav-md, 미커밋. 대상: C:\CusorApps\md-viewerVscode\md_viewer (이전 확인에서 경로 없음·대상 확인 필요).
- 상태: 원본 구현·자동/실제 Chrome 모의 복구·로컬 실모델 생성·웹 빌드 완료. 사용자 장문 오류 동일 재현/해결은 미확정. 대상 이식·웹 검증·프런트엔드 준비·Tauri 빌드·설치 앱 미실행.

## 요청과 확인

Jena Lemonade/gemma4e-flash-e4b-FLM에 “연결됨”인데 “AI 응답이 비어 있습니다.”가 나타남. 연결됨 표시는 모델 목록 확인과 추론 성공을 구분해야 한다. 실제 로컬 127.0.0.1:13305/api/v1/models는 정상이고 선택 모델 설치 확인. 짧은 추론 모드 요청은 SSE로 정상 본문을 반환했다. 긴 합성 요청은 400이므로 사용자 빈 응답과 동일 원인이라고 단정하지 않는다. 서버 설정/모델을 변경하지 않았다.

## 구현

mdpro/js/app.js streamOpenAICompatibleChat:
1. 응답 Content-Type이 application/json이면 줄 단위 SSE로 잘라 읽지 않고 전체 JSON을 한 번 처리한다. 예전 코드는 pretty JSON을 줄별 JSON.parse하다 본문을 누락할 수 있었다.
2. Lemonade가 스트림 종료 후 본문과 추론 모두 비었을 때만 일반 JSON 요청으로 딱 1회 재시도한다. 원 질문·모델·예산 유지, stream=false 및 thinking/enable_thinking/chat_template_kwargs.enable_thinking=false, stream_options 제거. 원래 AbortSignal을 그대로 사용하고 중지된 요청은 재시도하지 않는다.
3. 정상 SSE·추론 전용·부분 응답·HTTP 실패에는 이 재시도를 하지 않는다. 다른 호환 공급자는 자동 재시도 대상이 아니다. 재시도 결과를 동일 processPayload에 보내 UI message.delta와 완료 통계로 연결한다.
4. 재시도도 비면 모델 로드/컨텍스트 확인이 필요한 Lemonade 오류로 보고한다. 재귀/무한 재시도 없음. 실제 HTTP 오류와 중지는 그대로 전달한다.

mdpro/index.html app.js 캐시 lemonadeEmpty=20261113-1, mdpro/Apps/PWA/service-worker.js 20261113-lemonade-empty-1 갱신. 신규 의존성 없음. 필수 Jena 헤더 7개 및 Alt+4 입력/응답모드/실시간 쓰기/전송·중지 컨트롤·CSS·저장·Markdown/수식/출력 경로 미변경. 숨김·클리핑 추가 없음.

## 검증

- node --test tests/lemonadeEmptyResponse.test.mjs tests/lemonadeReasoning.test.mjs tests/aiJenaUiContract.test.mjs: 38통과, 실제 서버 선택 검사 1개 기본 skip.
- LEMONADE_LIVE=1 node --test tests/lemonadeEmptyResponse.test.mjs: 6/6 통과. 실제 production 파서→로컬 gemma4e-flash-e4b-FLM→“안녕하세요! 😊” 수신, 요청 1회.
- node tests/lemonadeEmptyResponse.browser.cjs: 실제 Vite iframe Jena UI/운영 bridge를 사용하고 네트워크만 모의. 빈 SSE→1회 JSON 복구→본문 표시 통과. 테스트 작성 중 eval 문자열 escape 실패를 수정한 후 통과.
- node --check mdpro/js/app.js, node --check mdpro/AI_App/aiChat/ai-chat.js, git diff --check, npm run build 통과. 기존 큰 청크 경고.
- 직접 localhost 읽기 최초 sandbox 실패 후 승인된 실제 실행 정상. 실제 서비스의 장문 안정성·모델 변경 직후 동작·모바일·다른 공급자 실서버는 미검증. 자동 복구는 연결 자체나 모든 모델 설정 오류를 고치는 보장이 아니다.

## 대상 적응과 Tauri

| 원본 | 대상 대응 | 적응/상태 |
| --- | --- | --- |
| js/app.js streamOpenAICompatibleChat | 대상 js/app.js 또는 독립 transport 실제 확인 필요 | SSE/JSON 분기와 빈 결과 1회 복구·AbortSignal/스트림 이벤트 연결 비교·미이식 |
| index.html/PWA 캐시 | 대상 독립 자산 로더 | 버전·브리지 유지·미검증 |

전체 파일 덮어쓰기 금지. 대상의 기존 복구 정책과 중복 요청 가능성을 먼저 확인한다. Viewer 웹 이식·실제 웹 확인 후 Docs/mdpro-development/TAURI_BUILD.md에 따라 자산/Tauri/dist를 확인한다. 프런트엔드 준비·네이티브 빌드·설치 앱 검증은 각각 대기. 이번 요청은 대상 포트/빌드/설치를 포함하지 않는다. 빌드 대기 ID는 위 변경 ID.

## 복사할 구현 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md와 C:\CusorApps\WebDav-MD\webdav-md\docs\mdpro-development\changes\2026-11-13-lemonade-empty-response.md를 읽고 실제 Lemonade transport를 비교해줘. 일반 JSON 응답을 SSE 줄 단위로 누락하지 않게 처리하고 Lemonade의 본문·추론 모두 빈 정상 응답에서만 추론을 끈 일반 JSON 요청으로 1회 복구해줘. AbortSignal·원 질문·모델·예산·UI 스트림 이벤트와 기존 부분 응답을 보존하고 중지/HTTP 오류/정상 출력은 재시도하지 마. 전체 파일 복사 없이 회귀 테스트·브라우저 모의 빈 응답 복구·가능한 실제 모델 생성을 검증하고 문서/인덱스/Tauri 대기를 갱신해줘. 네이티브 빌드·설치는 실행하지 말고 사용자 장문 오류의 재현 여부를 별도로 보고해줘.
```
