# 2026-11-04 LM Studio FAST 추론 정책 보완

- 변경 ID: MDPRO-20261104-LM-FAST
- 원본: `C:\CusorApps\WebDav-MD\webdav-md`, 기준 ac78a9b 위 미커밋 변경.
- 대상: `C:\CusorApps\md-viewerVscode\md_viewer`. 해당 `js/app.js` 경로 없음. 대상 확인 필요·미이식.
- 원본 구현·자동 검증 완료. 실제 웹 UI·모델 속도 미검증. Tauri 준비·빌드·설치 앱 검증 미실행.

## 발견한 기존 개선과 이번 적용

`mdpro/js/app.js`의 LM Studio complete 경로에는 이미 FAST 토큰/시간 제한, 컨텍스트 잔여량 기반 출력 제한, 예산 기반 과거 대화 유지가 있다. `mdpro/AI_App/ai_local/local-ai.js`에는 스트리밍과 미지원 reasoning 설정 재시도가 있다. Ollama는 이미 `reasoningMode = responseMode === 'reasoning' && !fastMode`로 FAST에서 추론을 끈다. Lemonade도 enable_thinking 계산에서 FAST와 disableThinking을 반영한다. 기존 개선을 중복 구현하지 않았다.

LM Studio만 FAST의 토큰·시간 설정을 쓰면서 심층 모드의 reasoning 설정과 장문 추론 지시를 계속 사용할 수 있었다. 실제 모델 추론 속도 개선 수치를 의미하지는 않는다.

## 실제 코드 변경

`mdpro/js/app.js` LM Studio 요청 블록에서 fastMode 선언을 reasoningMode 앞에 이동했다:

```js
const fastMode = request.fastMode === true;
const reasoningMode = request.mode === 'reasoning' && request.academicSearch !== true
    && request.disableThinking !== true && !fastMode;
```

이 값은 모드 지시, 이력 예산, 요청 시작 이벤트, chatOptions.reasoning에 공통 적용된다. FAST+심층은 reasoning=off, 일반 심층은 기존 reasoningLevel을 유지한다. 사용자가 지정한 maxOutputTokens와 기존 컨텍스트 상한은 유지한다. 설정 저장·기본값 변경과 신규 의존성은 없다. `mdpro/index.html`의 app.js URL에 `lmStudioFastReasoning=20261104-1` 캐시 키를 추가했다.

UI 컨트롤·단축키·ID·CSS 변경 없음. popup/Dock/fullscreen/Alt+4의 기존 컨트롤은 그대로 보존한다. 수식·인쇄 경로 변경 없음.

## 검증

- `node --test tests/aiLMStudioFastMode.test.mjs tests/aiJenaUiContract.test.mjs`: 31개 통과. 새 테스트는 실제 요청 옵션 생성 블록을 VM에서 실행하여 FAST+심층의 reasoning=off, 토큰 제한, 스트리밍, store=false 및 일반 심층·quick·학술·명시적 disableThinking·출력 토큰 재정의를 확인한다.
- `node --check mdpro/AI_App/aiChat/ai-chat.js`, `node --check mdpro/js/app.js`, `git diff --check`: 통과.
- `npm run build`: 통과. 기존 500KB 초과 청크 경고 있음.
- 추가 실행한 `tests/aiOllamaGenerationSettings.test.mjs` 5개 실패: 기존 harness localStorage에 setItem이 없어 설정 마이그레이션에서 실패. 이번 수정은 Ollama 경로를 변경하지 않는다. 해당 실패를 통과로 간주하지 않는다.
- 실제 LM Studio 응답/첫 본문 지연·tok/s 측정, 실제 브라우저 UI 확인은 미실행. 서버가 reasoning=off를 지원하지 않아 자동 재시도하면 추론 억제를 보장할 수 없다. 모델 설정을 임의 변경하지 않았다.

## 상대 앱 대응과 Tauri

| 원본 | 대상 | 적응·선행 작업 | 상태 |
| --- | --- | --- | --- |
| app.js LM Studio complete 요청 | 실제 경로 확인 필요 | FAST/disableThinking/학술 조건 및 chatOptions.reasoning의 공통 정책 확인 | 미이식 |
| index.html app.js 캐시 키 | 대상 로더 확인 필요 | 대상 고유 버전 정책 사용 | 미이식 |
| aiLMStudioFastMode.test.mjs | 대상 테스트 구조 확인 필요 | 해당 앱의 요청 생성 블록에 맞게 검증 | 미이식 |

전체 파일을 덮어쓰지 않는다. 대상의 독립 브리지·초기화·저장 구조를 보존한다. 대기 목록 ID는 MDPRO-20261104-LM-FAST. 이식 뒤 대상 TAURI_BUILD.md에 따라 프런트엔드 자산 포함과 Tauri/dist를 확인하고, 설치 앱에서 FAST/심층 전환 및 중단을 검증한다. 이번 요청에서는 상대 앱 수정·네이티브 빌드를 실행하지 않았다.

## 다른 앱에서 다시 실행할 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md와 WebDAV의 docs/mdpro-development/changes/2026-11-04-lmstudio-fast-reasoning.md를 읽어줘. 실제 저장소 경로부터 확인하고 LM Studio 요청 생성에서 FAST 또는 disableThinking일 때 reasoning을 끄도록 대상 구조에 맞춰 적용해줘. 일반 심층·학술·컨텍스트 예산·스트리밍·모든 UI를 보존하고 전체 파일을 덮어쓰지 마. FAST+심층과 일반 심층의 실제 요청을 검증하고 실속도 미측정은 구분해 기록해줘. 이식 문서·목록·Tauri 빌드 대기 상태를 갱신하되 네이티브 빌드는 별도 요청 전 실행하지 마.
```
