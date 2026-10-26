# 2026-10-26 Lemonade 설치 모델 전체 표시

- 변경 ID: MDPRO-20261026-LEMONADE-MODELS
- 원본: `C:\CusorApps\Webdav_md\webdav-md`; 대상: `C:\CusorApps\md-viewerVscode\md_viewer`
- 작성·확인: 2026-10-26. 원본 미커밋. 기존 이미지 첨부 등 작업 변경을 보존했다.
- 상태: WebDAV 구현·자동 검사·빌드 완료, 로컬 실제 브라우저에서 설치 모델 10개 표시·수동 새로고침 검증. 상대 앱 읽기 비교만 수행, 이식·Tauri 빌드·설치 앱 검증 미실행.

## 요청과 완료 기준

AI Jena → Lemonade 모델 선택에서 설치된 채팅, 이미지, TTS, 전사, 음악 모델을 모두 표시한다. 기존에는 현재 선택이 이미지 모델이 아니면 이미지 모델과 `chat` 라벨이 없는 모델을 새로고침 직후 제외했다. 현재 선택과 응답 모드가 목록 범위를 제한하지 않도록 한다. 목록 노출 수정이며 새로운 음성·음악 생성 API를 구현한 것은 아니다.

## 실제 구현

- `mdpro/AI_App/aiChat/ai-chat.js`의 `refreshModels`: `bridge.refreshLemonadeModels()` 이후의 이미지/라벨 필터를 제거한다. 공급자 변경·갱신 순서 보호, `setModelOptions`의 선택 유지와 저장, 기존 이미지 생성 분기는 유지한다.
- 빈 목록 오류는 “Lemonade 서버에 설치된 모델이 없습니다.”로, 일반 선택 상태는 “Lemonade 모델:”로 바꿔 음성·음악을 채팅 모델로 잘못 안내하지 않는다.
- 기존 `mdpro/js/app.js`의 브리지는 `models?show_all=true` → `normalizeInstalledLemonadeModels` → 캐시 저장 → `prioritizeInstalledLemonadeModels`로 처리한다. `downloaded === false`만 제외하며 모든 모달리티를 보존한다. 이 경로의 코드 변경·캐시 마이그레이션·신규 의존성은 없다.
- `tests/aiJenaConnection.test.mjs`: 전체 모달리티 노출, 수동/자동 새로고침 선택 유지, 미다운로드 카탈로그 제외 회귀 검증을 추가했다.

핵심 변경:

```js
var lemonadeModels = await bridge.refreshLemonadeModels();
if (state.provider !== requestedProvider || refreshRevision !== modelRefreshRevision) return;
if (!lemonadeModels || !lemonadeModels.length) throw new Error('Lemonade 서버에 설치된 모델이 없습니다.');
setModelOptions(lemonadeModels || [], state.lemonadeModel, false);
```

## 상대 앱 대응표와 이식 순서

| 원본 | 대상 실제 코드 | 차이·선행 조건 | 상태 |
| --- | --- | --- | --- |
| `mdpro/AI_App/aiChat/ai-chat.js` / `refreshModels` Lemonade 분기 | `AI_App/aiChat/ai-chat.js` / `refreshModels` OpenAI 호환 분기 | 대상은 `state.openaiCompatibleProvider === 'lemonade'`로 구분하고 `commitOpenAICompatibleModel`로 저장. 해당 분기에 원본과 같은 모달리티 필터는 없음 | 읽기 확인·미수정 |
| `mdpro/js/app.js` / `refreshLemonadeModels` | `js/app.js` / `refreshOpenAICompatibleModels(providerId)` | 대상은 `fetchOpenAICompatibleModels`와 `getVisibleOpenAICompatibleModelIds`를 사용. 전체 설치 목록 보존 여부는 그 하위 경로와 실제 서버로 추가 확인 필요 | 읽기 확인·미수정 |

대상은 공급자·캐시·설정 구조가 다르므로 전체 파일을 복사하지 않는다. 먼저 대상의 실제 모델 정규화·노출 경로를 확인하고 필요한 필터만 수정한다. 원본 이미지 첨부 관련 다른 변경은 이 문서의 이식 범위가 아니다.

## 회귀와 검증

- 예제: 설치된 chat/image/tts/transcription/music 및 `downloaded:false` 항목 → 설치된 5종만 표시. 채팅 선택 상태의 자동 새로고침과 이미지/음성/음악/전사 선택 상태의 수동 새로고침에서도 목록·선택 유지.
- `node --test tests/aiJenaConnection.test.mjs tests/aiJenaUiContract.test.mjs tests/aiChatImageAttachments.test.mjs`: 53개 통과.
- `node --check mdpro/AI_App/aiChat/ai-chat.js`, `git diff --check`: 통과.
- `npm run build`: 통과. 500 kB 초과 청크 경고 있음.
- 실제 `http://localhost:13305/api/v1/models?show_all=true` 읽기는 실행 환경의 소켓 접근 제한으로 실패했다. 서버 상태나 실제 설치 개수는 확인하지 못했다. 실제 브라우저 드롭다운·모델 실행·배포는 미검증.
- 헤더·버튼·레이아웃 제거 또는 CSS 숨김 변경 없음.

### 같은 날 후속 수정: 실행 중인 이전 코드와 ENV 동기화

사용자 재보고 화면과 `http://localhost:5174/`의 실제 iframe에서 4개 목록 및 이전 “Lemonade 채팅 모델:” 상태 문구를 확인했다. 앞선 필터 제거가 이미 로드된 페이지에 반영되지 않은 상태였다. 캐시/기존 페이지 로딩을 고려해 `mdpro/js/app.js`의 aiChat 지연 로더 버전을 `20261026-all-installed-models-2`로, `mdpro/index.html`의 app.js URL에 `aiJenaModels=20261026-all-installed-2`를 추가했다. ENV `checkLemonadeModels` 성공 후 캐시 저장과 목록 렌더링이 끝나면 `AIChat.syncSettings()`를 호출해 현재 Jena 선택 목록도 즉시 갱신한다. 모델 선택·대화·문서는 초기화하지 않는다.

Edge의 별도 로컬 검증 화면 `http://localhost:5174/mdpro/index.html`에서 AI Jena를 열어 실제 연결 상태와 10개 옵션을 확인했고, ↻ 이후에도 10개와 기존 선택이 유지됐다: Gemma-4-E4B-it-GGUF, ACE-Step-Music, Flux-2-Klein-4B, Gemma-4-12B-it-GGUF, Gemma-4-26B-A4B-it-GGUF, Qwen3.8-27B-GGUF, SD-Turbo, Whisper-Base, Whisper-Large-v3-Turbo, kokoro-v1. 검증 화면은 `evidence/2026-10-26-lemonade-models.png`에 저장했다. 기존 사용자 작업 탭은 다시 로드하지 않았다. GitHub Pages 배포와 각 모델의 생성 실행은 미실행이다.

후속 검사: 처음 UI 계약 검사 2개가 기존 스크립트 버전 문자열을 기대해 실패했다. 기대 버전을 새 로더 URL에 맞춰 갱신한 뒤 ENV 캐시 저장 후 동기화 순서를 검증하는 테스트 포함 54개 통과. 구문 검사·diff 검사·프로덕션 빌드 통과(청크 크기 경고). 위 최초 소켓 접근 실패와 달리 후속 실제 브라우저의 로컬 서버 연결·목록은 검증됐다. 10개 옵션 증거는 브라우저 DOM/접근성 목록이며, PNG는 해당 화면 상태이다(네이티브 select 메뉴는 PNG에 포함되지 않음).

대상 앱 이식 시에도 app.js와 AI Jena 지연 로더 URL을 함께 갱신하고 ENV 모델 확인 후 전체 설치 캐시를 Jena UI에 반영하는 대상 동기화 API를 확인한다. 상대 앱은 이번 후속 작업에서도 수정·빌드하지 않았다.

## Tauri 반영 계획

대기 ID: MDPRO-20261026-LEMONADE-MODELS. 대상 웹 경로 확인 및 회귀 검증 후에만 프런트엔드 준비/네이티브 빌드를 진행한다. 빌드 요청 시 대상 `Docs/mdpro-development/TAURI_BUILD.md`를 따르고 `Tauri/dist` 포함 자산과 설치 앱 드롭다운을 확인한다. 이번 요청에서는 상대 앱 수정·빌드를 실행하지 않았다.

## 다른 앱에서 다시 실행할 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md와 C:\CusorApps\Webdav_md\webdav-md\docs\mdpro-development\changes\2026-10-26-lemonade-installed-model-list.md를 읽어줘. AI Jena의 Lemonade 모델 목록이 설치된 채팅·이미지·TTS·전사·음악 모델 전체를 유지하는지 fetchOpenAICompatibleModels/getVisibleOpenAICompatibleModelIds부터 확인하고 필요한 부분만 수정해줘. 미다운로드 카탈로그 제외, 수동/자동 새로고침과 현재 선택 유지를 검증해줘. 전체 파일을 덮어쓰지 말고 이식 문서·목록·Tauri 대기 상태를 갱신해줘. Tauri 빌드와 배포는 실행하지 말고 실제 UI 미검증 항목을 구분해줘.
```
