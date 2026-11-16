# AI Jena 공통 모델 로드와 진행률

- 변경 ID: MDPRO-20261117-MODEL-PROGRESS
- 원본: C:\CusorApps\WebDav-MD\webdav-md / 대상: C:\CusorApps\MDPRO\MDproViewer
- 작성·확인: 2026-11-17, 미커밋.
- 상태: WebDAV 구현·자동 검사·웹 빌드 완료. 실제 브라우저/실제 공급자 확인 미완료. Viewer 이식·frontend/native 빌드·설치 검증 미실행.

## 요청과 구현

AI Jena 공급자 설정의 기존 모델/새로고침/모델 로드/취소/상세 Load를 보존한다. LM Studio, Ollama, Lemonade 기존 메모리 로더와 AI Studio 모델 목록 API 확인에 공통 버튼을 제공한다. 클라우드는 메모리 적재가 필요하지 않음을 버튼 title과 완료 상태에 표시한다. 모델 목록 확인은 실제 생성 또는 쿼터 보장이 아니다. 다운로드는 실행하지 않는다.

`mdpro/AI_App/aiChat/ai-chat.js`의 updateProviderUI, loadSelectedLocalModel 변경. 기존 progress DOM ID를 보존하면서 상세 details 밖 공급자 공통 영역으로 이동했다. loadSelectedLocalModel은 선택 모델을 고정하고 잠금 후 400ms마다 `min(95, floor(95*(1-exp(-elapsed/30000))))` 예상 진행률을 표시한다. 기존 브리지는 문자열 단계만 전달하므로 실측 %로 표현하지 않는다. 숫자와 aria-valuetext에 예상임을 명시한다. 공급자 응답 및 후속 갱신 완료 후에만 100%로 표시하며 실패 시 해당 수치에서 오류 색상/문구를 유지한다. finally에서 타이머와 잠금을 해제한다. 성공/실패 결과는 다음 공급자 UI 갱신까지 유지한다.

AI Studio는 refreshGeminiModels 결과에 선택 모델이 실제 포함되는지 확인하고 실패 시 기본 목록 fallback으로 성공 처리하지 않는다. 기존 로컬 API/저장 키/브리지/문서·수식·출력 경로는 유지한다. 새로운 의존성 없음. app.js 동적 JS, index.html app/CSS, PWA 캐시 버전을 갱신했다. 헤더 7개와 Alt+4 필수 조작 보존, 신규 CSS 숨김/클리핑 없음.

## 대상 비교와 적응

Viewer AI_App/aiChat/ai-chat.js 읽기 확인: LM 공통 progress 및 Lemonade 예상 progress/cancel DOM이 이미 독립적으로 존재한다. 전체 파일이나 WebDAV DOM을 복사하지 말고 기존 상태·브리지에 동작만 적응해야 한다. 대상 함수 전체/실행 상태는 미검증.

| 원본 | 대상 | 상태 |
| --- | --- | --- |
| updateProviderUI/loadSelectedLocalModel | AI_App/aiChat/ai-chat.js 기존 LM/Lemonade 로더와 progress | DOM 이름 차이 확인, 미이식 |
| app.js 동적 URL/index/PWA | 대상 자산 로더/캐시 | 대상 확인 필요 |

## 검증

- node --test tests/aiJenaUiContract.test.mjs tests/localModelLoad.test.mjs: 35 통과.
- node --test tests/aiJenaModelProgress.test.mjs: 5 통과. 네 공급자 응답 대기 중 예상 표시, 완료 100%, 실패 비완료, 타이머/잠금 해제 확인.
- node --check mdpro/AI_App/aiChat/ai-chat.js, git diff --check 통과.
- npm run build 통과, 기존 500kB chunk 경고.
- node tests/localModelLoad.browser.cjs: Chrome DevToolsActivePort 생성 실패 ENOENT. 실제 UI 미검증. fixture에 AI Studio와 공통 % 확인 추가했으나 실행 완료 못함.
- 실제 서버 로드/클라우드 인증/긴 로드/물리 모바일 미검증. 과거 문서의 실제 검증을 이번 증거로 사용하지 않는다.

## Tauri

빌드 대기 ID는 위 변경 ID. 대상 AI_App/aiChat/ai-chat.js와 실제 캐시 파일을 적응한 뒤 Docs/mdpro-development/TAURI_BUILD.md에 따라 자산 준비, dist 포함 여부, 설치 앱 네 공급자 완료/실패를 각각 검증한다. 이번 요청은 Tauri 빌드를 포함하지 않으므로 실행하지 않았다.

## 복사할 구현 명령

```text
C:\CusorApps\MDPRO\MDproViewer에서 AGENTS.md와 C:\CusorApps\WebDav-MD\webdav-md\docs\mdpro-development\changes\2026-11-17-jena-model-load-progress.md를 읽고 AI Jena 네 공급자 모델 로드/클라우드 확인 버튼과 예상 % 진행바를 기존 로더에 적응해줘. 기존 LM/Lemonade progress DOM과 native bridge를 먼저 비교하고 전체 파일을 덮어쓰지 마. 100%는 응답 완료 후만 표시하고 실패/타이머 정리/모바일/필수 헤더/Alt+4를 검증해줘. 문서·목록·Tauri 대기를 갱신하고 빌드·설치·커밋·배포는 하지 마. 미검증을 구분해줘.
```

## 후속 요청: 대부분 공급자·작은 우측 버튼 (2026-11-17)

사용자 제공 화면의 전체 폭 버튼을 64×34px로 줄였다. provider-row를 공급자/모델/새로고침/로드의 네 열로 구성하고, 좁은 화면은 공급자를 독립 행에 두고 모델/새로고침/로드를 유지한다. 취소는 다음 행 우측에 둔다. 기존 공급자·모델·새로고침·상세 Load·취소와 필수 header/Alt+4 컨트롤을 보존한다. 기존 ID와 이벤트 바인딩 유지, 신규 숨김/클리핑 없음.

Lemonade NPU는 기존 loadOpenAICompatibleTaskModel에 signal/onProgress를 전달하고 LiteRT-LM은 loadLiteRTLMModel을 사용한다. DeepSeek/OpenAI/OpenAI 호환(EXAONE 포함)은 목록 확인에 연결한다. EXAONE 등 일부 목록은 고정 목록이므로 완료 문구에 생성/인증 미검증을 명시한다. 메모리 로드 지원이 없는 클라우드의 서버 적재를 주장하지 않는다. 전 공급자에서 예상 % 규칙을 공유한다. 캐시 suffix -2 갱신.

후속 검증: UI/로더/진행률 총 45검사, syntax/diff/build 확인. 아홉 공급자 완료 대기/100%와 클라우드 실패 검사 포함. 실제 UI는 이전 Chrome 실행 실패로 여전히 미검증. Viewer 후속 소스/배치 미확인, 미이식, Tauri frontend/native/설치 미실행. 기존 재명령 프롬프트에 아홉 공급자 및 64px 우측 배치를 포함해서 적용할 것.
