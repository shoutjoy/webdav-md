# 2026-11-10 ME AI 설정·비전·압축 UI·도표별 테마 이식

- 변경 ID: `MDPRO-20261110-ME-AI-SETTINGS`
- 작업 저장소: `C:/CusorApps/Webdav_md/webdav-md`, 기준 HEAD `dfe6a18`, 작업 전 clean, 구현은 미커밋.
- 참조: `C:/CusorApps/md-viewerVscode/md_viewer/Docs/ME_AI_SETTINGS.md` 개정 1.1 및 연결 변경 기록 4개. 문서가 명시한 기준은 AI `7f67c8c`, 고밀도 UI/테마 `baa589a`이며 현재 원본 HEAD를 별도로 검증한 것은 아니다.
- 상태: WebDAV 웹 이식·Node 102개·실제 로컬 Chrome 4개 회귀·웹 빌드 완료. Viewer는 실제 소스 읽기 비교만 수행했으며 수정하지 않았다. 배포·Tauri frontend 준비·네이티브 빌드·설치 앱 검증 미실행.
- 사용 안내: [WebDAV ME AI 설정](../../ME_AI_SETTINGS.md).

## 요청과 적용 순서

기술문서 1~11절의 통합 계약을 의존성 순으로 반영했다.

1. 부모 RPC와 공급자/모델 선택·저장값 이전을 연결한다.
2. 공급자별 이미지 전송·스트리밍·독립 취소·제한 시간을 연결한다.
3. 코드 정리·검증 후 보정·단계 진행률·시간·토큰을 적용한다.
4. 이미지 입력·확대·클립보드와 고밀도 UI, 본문 공간을 확보하는 Dock를 적용한다.
5. 보기 도표별 테마·렌더 큐·SVG 캐시 ID 격리를 적용한다.
6. 부모/iframe/Jena/renderer/PWA 자원을 갱신하고 기존 이미지 내보내기·수식 회귀를 확인한다.

ENV 주소/키와 WebDAV의 저장·문서 편집·inDB·SVG/PNG 삽입·DN·toPC를 보존한다. 이미지 원본을 썸네일 해상도로 재압축하지 않는다. 외부 공급자로 자동 우회하지 않는다.

## 구현 코드와 변경 이유

| 파일 | 실제 변경 함수/동작 |
| --- | --- |
| `mdpro/AI_App/aiChat/task-provider-picker.js` 신규 | `mountAITaskPicker`: requestId/부모 source를 확인하는 모델 RPC, 15초 제한, stale 조회 ticket, 목록+직접 입력, 연결 배지. 기본 AI Studio `gemini-3.5-flash-lite`. `mdv_mermaid_ai_selection_v1` 우선, 이전 `mdv_ai_tool_mermaid` 선택도 읽어 이전. `ollama-npu`→`lemonade-flm`, 호환 하위 프로필 보존. 저장 접근 실패는 실행을 막지 않음. |
| `mdpro/AI_App/aiChat/ai-chat.js` | `ensureInitialized`로 초기화 Promise를 공유. `getTaskModels`는 WebDAV 실제 `state`와 기존 bridge 모델 메서드를 사용하며 Jena 공급자 옵션을 picker에 반환. 표시는 실제 Jena 순서를 따르고 NPU/외부 Compatible의 picker 값만 정규화. 키는 반환하지 않음. |
| `mdpro/js/app.js` 메시지 수신 | 현재 `mermaid-editor-frame.contentWindow`만 모델 목록·클립보드·분석·취소 RPC를 처리. 자식에는 키/접속 객체를 보내지 않음. `getCachedLMStudioModels` 신규, `refreshLMStudioModels`는 설치+로드 모델을 합침. |
| 같은 파일 `analyzeImageToMermaidForEditor` | 요청별 AbortController Map, 이미지 검증, `selection`이 상속이면 실행 시 Jena의 현재 provider/model/profile을 조회. `independent:true`, quick, disableThinking, 요청 상한 4096, 부모 180초. 델타/단계/usage를 requestId와 함께 전달. IMAGE_UNREADABLE 오류 표시. |
| 같은 파일 `AIChatBridge.complete` | 독립 작업이 기존 Jena controller를 교체·취소하지 않음. 상위 signal 중계와 timeout 및 finally 정리. 기존 이미지 채팅은 공유 비전 함수로 연결하고 텍스트/이미지 생성 경로는 보존. |
| 같은 파일 `getMermaidCompatibleConnection`/`completeTaskVision` | WebDAV 전용 Lemonade 설정과 고정 FLM 서버 경로를 별도 해석. 외부 Compatible은 기존 인증/주소 사용. Ollama `/api/chat` base64 images+NDJSON, LM Studio image_url+SSE, Compatible image_url 스트림. DeepSeek 이미지 분석은 명시적 미지원. Gemma4 이름만으로 차단하지 않음. |
| `mdpro/js/mermaid/mermaid-editor/ai-quality.js` 신규 | 원본 언어/관계/방향/라벨 보존 지침, 외곽 펜스 제거, 노드 모양을 보존한 라벨 정규화, 원문 파싱 실패+후보 성공일 때만 보정. 다른 Mermaid 언어·style·복구 불가능한 초안은 유지. |
| ME `app.js` | 스트림은 편집기에만 표시하고 최종 코드에서 렌더·이력 저장. 성공한 렌더에서만 100%. 원문 스냅샷/Undo·185초 watchdog·중지/오류 타이머 정리. 파일/Ctrl+V/부모 clipboard RPC, 참조 확대 dialog의 맞춤/100%/±/Esc/포커스 복원. UI/코드/미리보기 테마 분리. 기존 SVG 변환기 창의 `getMermaidSvgForConverter` 전달은 보존. |
| ME `index.html`/`style.css` | 썸네일 옆 선택/붙여넣기/확대/제거, 60px 프롬프트, details 모델 요약과 실행/기록/삽입/접기 행, 통합 피드백. 기존 `mermaid-ai-provider-toggle-btn` ID를 summary에 유지하고 기존 접힘 저장 키도 이전. 900px 2열/560px 1열. |
| 부모 `app.js`/`css/style.css`/`index.html` | `main-workspace`에 Dock 폭을 예약하고 작업 영역 top/height와 동기화. iframe을 재배치/재로드하지 않음. 기존 6개 resize handle 보존, Dock의 서쪽 handle은 포인터·좌우 화살표로 폭 조절. 닫기/해제 시 공간 복원. |
| `mdpro/js/mermaid/mermaid_render.js` | `setWrapperMermaidTheme`, optional wrapper `getTheme/setTheme/toggleTheme`, 전역 initialize/run 큐. wrapper override와 source+theme 캐시, 복제 SVG ID/CSS/url/href/aria 참조 격리. SVG ID 아래로 추가 CSS 범위 제한, 명시 fill/stroke/선 두께/color 보존, 기본 라벨 대비만 보정. 전체 refresh 시 크기·확대/이동·override 전달. 기존 `setBlockTheme(wrapper,theme)` API도 유지. |

핵심 호출 계약:

```js
const selected = data.selection && data.selection.provider
    ? data.selection
    : (await ensureAiChatLoaded(), await window.AIChat.getTaskModels(undefined, false));
// AIChatBridge.complete({ provider, model, openAICompatibleProvider,
//   independent: true, signal: controller.signal, timeoutMs: 180000,
//   mode: 'quick', disableThinking: true, maxOutputTokens: 4096, ... })
```

LM Studio quick 비전은 enable_thinking=false/reasoning_effort=none/temperature 0.1과 저장된 quick 한도·요청 한도의 최솟값을 보낸다. Ollama quick은 think=false, 요청 4096, 최소 context 8192. Lemonade는 자신의 출력·샘플링 프로필을 사용한다. 단계 10/25/40/55/65/90/95/100%는 실제 서버 전체 처리량 비율이 아니며 추정 토큰에는 `약`을 붙인다.

## 상대 앱 대응과 보존한 차이

| Viewer 원본 | WebDAV 실제 대응 | 적용/차이 |
| --- | --- | --- |
| `AI_App/aiChat/task-provider-picker.js` | `mdpro/AI_App/aiChat/task-provider-picker.js` | 신규 모듈을 도입하되 이전 WebDAV 도구 저장 키를 이전. 일반 `AIToolProviders`를 쓰는 다른 OCR 도구는 변경하지 않음. |
| `AI_App/aiChat/ai-chat.js`의 `getTaskModels` | WebDAV AIChat state/bridge 메서드 | WebDAV는 Lemonade·NPU가 별도 공급자. Viewer의 전체 provider/인증 구현을 덮어쓰지 않고 메서드 단위로 적응. |
| `js/app.js` 비전/RPC/독립 controller | `mdpro/js/app.js` 대응 함수 | 외부 Compatible와 Lemonade 설정 분리를 유지. FLM은 WebDAV 기존 `getNPUBaseUrl()` 사용. LM Studio 로컬 클라이언트의 모델/로드 API가 이미 있어 해당 파일을 통째로 복사하지 않음. |
| ME app/index/style 및 ai-quality | WebDAV ME 동일 역할 | 코드 델타/블록 단위 적용. Viewer의 `advancedAiFeatureFlags`/ai URL gating을 가져오지 않고 WebDAV 기존 접근성 유지. 기존 SVG 변환기 전달 유지. |
| 보기 renderer 테마·큐·캐시 | WebDAV renderer | 기존 dark/default Mermaid 설정, viewBox/foreignObject 크기, palette, SVG/PNG/DN/이미지 삽입 버튼과 export 함수 보존. Viewer의 geometry 확장·다른 도구 모음 축소를 가져오지 않음. |
| Viewer PWA/루트 경로 | WebDAV 중첩 mdpro 및 outer shell | 로더·부모·iframe·renderer 쿼리와 두 PWA 계층 갱신. |

전체 파일 덮어쓰기로 앱 차이를 없애지 않았다. 신규 helper 파일은 원본 모듈을 가져왔으며 기존 app/renderer/Jena는 대응 함수·마크업·스타일 변경으로 반영했다.

## 캐시와 빌드

- ME/부모/renderer port version: `20261110-me-ai-1` 또는 `meAI=20261110-1`/`instanceTheme=20261110-1`.
- quality helper는 코드가 같은 `20261109-2`, image-export helper는 기존 `20261108-me-export-1` 유지.
- MDpro PWA `20261110-me-ai-1`, WebDAV outer worker `webdav-viewer-v22-me-ai`.
- `npm run build`는 성공. 기존 500kB chunk 크기 안내는 남는다. build-mdpro-apps가 관리하는 textToAudio worker 사본도 outer worker 버전으로 함께 생성되었다.
- 배포 시 부모·iframe·picker·quality·renderer·PWA를 함께 올리고 새로고침 후 실제 로드 URL을 확인한다. 사용자 데이터/전체 사이트 저장소 삭제를 선행 조치로 안내하지 않는다.

## 검증과 증거

Node 명령(102/102 통과):

```powershell
node --test tests/me-ai-bridge.test.cjs tests/me-task-models.test.cjs tests/mermaid-ai-quality.test.cjs tests/task-vision-provider.test.cjs tests/mermaid*.test.mjs tests/aiJenaUiContract.test.mjs tests/aiChatImageAttachments.test.mjs tests/lmStudioServer.test.mjs tests/lemonadeReasoning.test.mjs tests/markdownMathPlaceholders.test.mjs tests/mathRenderContract.test.mjs tests/printMathFit.test.mjs tests/pdfMathPreservation.test.mjs
node --check mdpro/js/app.js
node --check mdpro/AI_App/aiChat/ai-chat.js
node --check mdpro/js/mermaid/mermaid-editor/app.js
node --check mdpro/js/mermaid/mermaid_render.js
git diff --check
npm run build
```

| 실제 로컬 Chrome 회귀 | 결과와 증거 |
| --- | --- |
| `tests/me-ai-connection.browser.cjs` | opaque iframe 모델 RPC/기본값·공급자 대응·클립보드/확대/제거·Gemini image inlineData·usage·독립 중지/재실행·연결 오류/복구·Jena 텍스트·Dock/키보드 폭 조절. 4노드/6연결 보정·복구 불가능 원문 보존. 기본/완료 85px, 설정 펼침 117.5px, 340px 넘침 없음. `artifacts/me-ai-20261110/result.json` 및 스크린샷. |
| `tests/mermaid-instance-theme.browser.cjs` | 세 도표 독립/반복/빠른 전환·형제 SVG/높이 동일·확대율·명시 색과 선 보존·흰 노드 대비·캐시 중복 ID 없음·전역 refresh 후 override·원문 보존. dark PNG 5208×2192. `artifacts/mermaid-instance-theme-20261110/result.json`, SVG/PNG/스크린샷. |
| `tests/meImageExport.browser.cjs` | 19라벨, 15/13px 글꼴, overflow 0, PNG 2177×8192. `artifacts/me-ai-20261110/export/`. |
| `tests/imageInsertDownload.browser.cjs` | foreignObject SVG→PNG/JPEG·DN·기존 PNG 삽입·형식 선택·원본 바이트·URL 우선순위·HTTP 실패·확대/Esc 보존. `artifacts/me-ai-20261110/download/`. |

네 회귀 모두 pageErrors 0. 브라우저의 생성 API는 모의 Gemini SSE이고 서버별 이미지 payload/스트림/프로필/취소는 VM 테스트로 별도 확인했다. 실제 LM Studio·Ollama·Lemonade·AI Studio·OpenAI 서버 연결·비전 인식 품질은 이번 작업에서 검증하지 않았다. 원본 문서의 다른 PC 포트 5678/로드 모델/권한 진단을 현재 PC 사실로 옮기지 않았다.

초기 sandbox 실행은 로컬 HTTP 연결 EACCES/ERR_NETWORK_ACCESS_DENIED로 실패했고, 로컬 서버 접근이 허용된 실행에서 위 검사를 통과했다. 변경된 함수명/자원 버전에 맞춰 기존 테스트를 갱신했다. `lemonadeReasoning`의 기존 얼굴 유지 분기용 VM 상태가 누락돼 있던 harness에는 false/빈 배열 stub을 보충했고 실행 기능을 변경하지 않았다.

수식 파싱·PV/miniPV/인쇄/PDF/DOCX 배치 코드는 변경하지 않았다. 수식 관련 자동 회귀 성공은 실제 PV 화면·Word·OS 인쇄·PDF 저장 검증을 의미하지 않는다. 출력 계약의 기존 부분 준수/미검증 상태를 유지한다.

## Tauri 반영 계획

대기 ID는 `MDPRO-20261110-ME-AI-SETTINGS`. Viewer 원본에는 문서 기능이 이미 있으므로 WebDAV 파일을 역으로 덮어쓰지 않는다. WebDAV 전용 저장값 이전·분리 profile adapter와 테스트는 Viewer 적용 필요 여부를 먼저 비교한다. Viewer에서 빌드 요청 시 그 앱의 `Docs/mdpro-development/TAURI_BUILD.md`와 대기 목록을 따른다.

필수 자산: 부모 index/app/CSS, ME index/app/style/ai-quality, task-provider-picker, Jena ai-chat, renderer, PWA worker 및 기존 image-export. frontend 복사 후 경로/쿼리/SHA256을 확인하고 opaque/native bridge·독립 취소·Dock·다중 테마·PNG/JPEG를 설치 앱에서 확인한다. 이번 WebDAV 웹 빌드는 frontend 준비나 EXE/NSIS 빌드가 아니다.

## 다른 앱에서 다시 실행할 명령

```text
C:/CusorApps/md-viewerVscode/md_viewer에서 AGENTS.md와
C:/CusorApps/Webdav_md/webdav-md/docs/mdpro-development/changes/2026-11-10-me-ai-settings-port.md를 읽어줘.
ME_AI_SETTINGS.md의 원본 구현과 WebDAV 적응 차이를 함수 단위로 비교해줘.
Viewer의 기존 공급자/프로필/네이티브 브리지/원문/이미지 export를 보존하고,
WebDAV 전용 저장 키나 NPU 주소를 그대로 가져오지 마.
필요한 차이만 반영한 뒤 opaque 모델 RPC·실행 시 Jena 상속·독립 취소/timeout·4노드6연결 보정·340px UI·Dock·세 도표 테마/캐시·PNG/JPEG를 검증해줘.
문서·목록·Tauri 대기 상태를 갱신하고 실제 공급자 품질과 모의 검사를 구분해줘.
배포·커밋/푸시·Tauri 빌드는 별도 요청 전에는 실행하지 마.
```

## 후속: Vite 개발 서버 버튼 오류

앞선 Chrome 검사는 정적 서버 기반이었다. 사용자 보고 후 실제 Vite에서 classic app.js에 injectQuery import가 삽입돼 초기화가 중단되는 별도 경로를 재현·수정했다. [Vite 수정·실제 호스트 버튼 검증](2026-11-10-vite-classic-script-buttons.md)을 함께 따른다.
