# 2026-11-12 WebDAV Jena 군 연결·작업 실행·UI 갱신

- 변경 ID: `MDPRO-20261112-JENA-SERIES-RUNTIME`
- 대상: `C:/CusorApps/Webdav_md/webdav-md`, 시작 HEAD `b795268`, 이번 수정 미커밋
- 비교 원본: `C:/CusorApps/md-viewerVscode/md_viewer`, 읽은 HEAD `250ab9e`
- 기준 문서: Viewer `Docs/toskill/README.md`, `00_PORTING_PLAN.md`~`11_LATEST_UPDATES.md` 및 연결된 기능 설명. 11월 12일 갱신본에서 Macro 등록/실행 분리와 ME 코드 수정의 대체 관계를 적용했다.
- 작성·최종 확인: 2026-11-12 KST
- 상태: WebDAV 구현·로컬 웹 검사·웹 빌드 완료. Viewer 런타임 수정, Tauri 빌드, 설치·배포·커밋·푸시 없음.
- 원본 Git HEAD 조회는 성공했지만 원본 `git status`는 work tree 오류로 실패했다. 원본 문서의 과거 검증을 이번 검증으로 계산하지 않았다.

## 요청과 적용 경계

Viewer의 기능 개수나 화면을 그대로 맞추는 작업이 아니다. 사용자의 추가 지시에 따라 WebDAV Jena 도구별 공급자·모델·연결·속도·실행 안정성을 우선했다. WebDAV 문서 저장, 인증, `/JENA_DATA` 동기화, 프록시, React iframe, 기존 메뉴와 설정을 보존했다. 시작 시 대상의 추적 파일 변경은 없었고, 중지 전 생성한 비교 자료만 있었다.

기존 `app.js`, `index.html`, AI 채팅, 저장소 파일을 Viewer 파일로 덮어쓰지 않았다. 새 전용 작업창은 의존성을 확인해 추가하고, 기존 파일은 함수·호출자·선택 UI 단위로 적응했다. 작업 중 발견한 PNG API 차이와 PV 초기화 경합도 실제 WebDAV 실행으로 확인하고 보완했다.

## 도구별 점검·결과

| 영역 | 확인한 차이·문제 | WebDAV에 반영한 동작 | 보존한 대상 계약 |
| --- | --- | --- | --- |
| 공통 모델 선택 | 기존 picker에는 전체 목록 선택·명시 로드·작업 API가 부족했다. WebDAV는 Lemonade/NPU 목록과 전송이 독립이다. | 목록/직접 ID/새로고침/명시 로드/숫자 이미지 점검. 캐시 목록은 연결 확인 전 상태로 표시하고 비어 있을 때만 첫 원격 조회. 저장된 명시 ID 유지. 새 도구는 이미 저장된 메인 Jena 공급자를 상속. | 기존 공급자 순서·ENV 주소/키, Lemonade/FLM 카탈로그, 기존 도구별 선택 키 |
| Table | 기존 요청은 일반 채팅과 독립 취소가 분리되지 않았고 작업 옵션·스트림 표시가 없었다. | 한 번 요청, 결과 코드 스트림, 경과/생성량/수신 속도, 중지, 실패·취소 시 이전 결과 복원. 결과가 확정된 뒤 늦은 스트림이 덮지 못한다. | 이미지+텍스트 입력, Markdown 표, 대상의 미리보기·명시 삽입·저장 경로 |
| Math | WebDAV에는 Viewer보다 넓은 텍스트 수식 입력이 있다. 행 구분이 사라지거나 초기 MathJax typeset과 겹칠 수 있었다. | 텍스트 입력을 유지하면서 이미지 전사 지시 보완. 다중행·음수·행렬 보존, 독립 중지/복구. 최종 코드 확정 후 스트림 차단. startup 완료 후 버전/큐로 도구 미리보기 직렬화. | 텍스트→수식, 이미지→수식, 기존 확대/이미지 삽입과 공통 MathRender |
| ME | 부모·자식 메시지를 함께 바꿔야 한다. WebDAV PNG helper는 `serialize`만 공개하며 Viewer 신규 호출은 `pngBlob`을 기대했다. | 참고 텍스트·이미지 혼합, 별도 코드 수정 요청/결과 검토/명시 적용, 선택 감싸기, 모바일 UI, 접힌 메뉴에서도 삽입 버튼 접근. 부모의 모델 로드·클립보드·target 분기 연결. | 기존 도표별 테마, 토글 ID, 취소 요청 ID, WebDAV Range/CTM serializer와 기존 PNG rasterizer |
| Tidy/JS | WebDAV는 자체 JS JENA 대화·등록·WebDAV 데이터 동기화가 이미 있었다. Worker 종료 뒤 현재 커서를 쓰는 범위 오류가 있었다. | 기존 관리창에 공통 picker·응답 초안·중지 연결. 독립 요청과 수동 코드 보호. 실행 전 범위/원문/문서 identity 고정, 최신 등록 코드 재조회, 읽기 모드·문서 전환 차단. | 기존 기능 ID, 등록·테스트·다운로드·대화 복원, 비모달 iframe과 8개 크기 조절 핸들, SQLite/GitHub/inDB 경로 |
| Macro | 대상에는 녹화·JS 편집이 있으나 새 Jena 개발창은 없었다. 일반 매크로 기능과 AI 허용 설정을 분리해야 한다. | ENV에서 명시 허용 후 별도 Jena Macro 작업창. 공통 모델·스트림·중지·수동 편집 보호. JS 넣기/등록·저장/명시 실행 분리. 비동기 녹화 실행을 기다리고 같은 항목 중복 실행 차단. | 기존 JS 편집기·녹화·단축키·H4/H5·목록·저장 키. 기존 기능을 새 개발창으로 강제 교체하지 않음 |
| Slide | 실제 진입은 `Html2pptx/jenaEditor`이며 대상의 기존 ScholarAI 버튼·저장 흐름을 유지해야 한다. | 누적 텍스트/원고/페이지 입력, 중앙 4탭, 공통 모델, 이미지 입력, 표/도형/그래프의 독립 초안·격리 렌더, Dock, ME 반환. 준비 전 새 버튼을 잠깐 비활성화해 초기 클릭 유실 방지. | 기존 ScholarAI 버튼·일반 편집기·MPP v2·inDB·슬라이드 undo. optional `jenaSlide/jenaText/jenaImage/jenaVisual`만 확장 |
| Scholar | 기존 자체 공급자 선택/취소와 SSP 취소가 섞여 있었다. | 기존 선택을 이전한 공통 picker와 독립 요청/취소, 응답모드·출력 예산·누적 onText 전달. 기본 900초를 일반 도구 180초와 구분. | 기존 학술 문장/선택 치환/히스토리/검색 옵션 |
| SSP 이미지 | 대상에는 이미 Lemonade 공급자·이미지 목록·생성/참조 편집 경로가 있다. | 기존 DOM을 모델 details로 이동. 선택 이미지 모델의 실제 health만 적재됨으로 표시. 활성 창에서 15초 조회, 요청 5초 제한·늦은 응답 배제. Klein 4B non-base에만 최대 768px/4단계/CFG 1, 기존 품질 복원. 모델별 seed도 보존. | 이미지 모델·입력 참조 픽셀·생성/편집 endpoint·ENV/FMA/채팅 품질 설정. 다른 모델/도구의 품질을 덮지 않음 |

## 구현과 호출 순서

### 공통 AI 계층

`mdpro/AI_App/aiChat/task-provider-picker.js`의 `mountAITaskPicker`와 `AIJenaTaskPolicy`를 확장했다. 대상의 `mdv_ai_tool_mermaid` 이전 경로를 유지하고 `adapter.initialSelection/getModels/loadModel`을 지원한다. WebDAV는 `requestLiteRTLM`/ENV에서 인증하므로 Viewer 전용 비밀번호 컨트롤을 무조건 추가하지 않는다. 비밀번호 UI는 명시 unlock adapter가 있을 때만 사용한다.

`AIChat.getTaskModels(provider, refresh, selectedModel)`은 대상의 `getCached/refreshLemonadeModels`, `NPUModels` 등을 그대로 호출한다. 목록 조회와 적재/비전 지원을 구분한다. 설치 목록에 없는 명시 입력 ID를 다른 모델로 자동 교체하지 않는다. 서버가 명시적으로 vision=false라고 보고한 최근 모델은 이미지 전송 전에 거절한다. 모르는 capability를 지원으로 단정하지 않는다.

`AIChat.loadTaskModel/checkTaskVision`은 부모 `AIChatBridge`의 명시 로더로 연결된다. Ollama는 빈 prompt의 `/api/generate`와 `keep_alive:'10m'`, LiteRT-LM은 짧은 실제 응답, LM Studio는 현재 적재 목록을 먼저 확인, Lemonade/FLM은 기존 URL adapter의 `/load`를 사용한다. 로더가 ENV의 선택·서버 프로필을 임의로 저장/변경하지 않는다.

`AIChat.completeTask(options)`는 **초기화부터** 독립 AbortController·180초 타이머·abort race를 적용한다. 사용자 signal을 relay하고, abort 이후 delta와 최종 응답을 무시하며 finally에서 리스너/타이머를 정리한다. 기존 채팅의 controller와 공유하지 않는다. `messages` 또는 `prompt/attachments`, `provider/model/openAICompatibleProvider`, `task`, `maxOutputTokens`를 전달한다.

```javascript
// 호출 의도 예: 실제 구현은 AIChat.completeTask / AIChatBridge.complete를 따른다.
{
  independent: true,
  signal: controller.signal,
  mode: 'quick', fastMode: true, disableThinking: true,
  provider, model, openAICompatibleProvider,
  task: 'table-ocr', maxOutputTokens: 8192
}
```

부모 `AIChatBridge.complete`는 Lemonade/FLM 하위 프로필을 실제 WebDAV 전송 경계까지 유지한다. 일반 외부 호환 API는 기존 `getStoredOpenAICompatibleConnection()` 경로를 유지한다. 새 키 저장소나 별도 AI HTTP 클라이언트를 만들지 않았다.

### 속도·결과 보호

- AI 채팅의 선택적 검색/Markdown 보조 스크립트를 모두 기다린 후 핵심 채팅을 로드하던 순서를 완화했다. 보조 기능 실패는 개별 기능에서 처리한다.
- AI Studio의 짧은 도구 요청은 매번 모델 metadata를 조회하지 않고 캐시/작업 출력 예산을 사용한다. 지원 모델의 최소 thinking을 전달한다. 일반 장문 채팅 정책을 전부 바꾸지 않았다.
- Ollama 텍스트 도구 요청은 기존 설정을 저장 변경하지 않고 최대 16K context와 요청별 출력 예산을 사용한다. 사용자가 설정한 더 작은 context는 존중한다. 일반 채팅의 큰 context migration은 이번에 변경하지 않았다.
- LiteRT-LM 작업의 thinking/출력 예산/stream을 실제 body에 연결했다. 모델 적재와 비전 정답률은 구분한다.
- `mdpro/js/jena-tool-runtime.js`는 Table/Math의 readOnly·삽입 잠금, 첫 출력/후속 50ms 표시, 중지/복구, 늦은 응답 차단을 맡는다. 토큰은 서버 usage가 없으면 문자 추정이라고 표시한다. 응답 완료 시 시간을 고정해 렌더 시간이 수신 속도를 낮추지 않는다.
- 출력 한도에 도달한 Table/Math 결과는 잘림 가능성을 안내한다. partial stream을 정상 최종 결과로 삽입하지 않는다.

### Tidy의 실제 문서 범위

`tidy-script-manager.js::applyScript`는 await 전에 선택·원문·문서 identity를 캡처하고 runBusy를 잠근다. `refresh()`로 동일 ID의 최신 코드를 읽고 Worker 종료 후 원문·문서/편집 상태를 확인한다.

```javascript
TidyActions.applyResultToEditor({
  value,
  selectionStart: start,
  selectionEnd: end,
  replaceSelection: hasSelection
}, source, actionDeps);
```

문서 identity는 대상 `currentDocumentDisplayRequest`와 `currentDocumentRef`로 구성한다. Viewer의 다른 문서 객체를 복사하지 않았다. `AA target BB`에서 target을 선택한 뒤 Worker 실행 중 커서를 0으로 옮겨도 `AA TARGET BB`가 되며, 동일 내용의 다른 문서로 바뀌면 적용하지 않는다.

### Macro·Slide·SSP의 대상 적응

- 새 전용 자산: `trt/macro-jena.js/.css`, `trt/macro-runtime.js`, `js/editor/javascript-highlight.js`, `js/Html2pptx/jenaEditor/jena-slide.css`, `js/jena-slide{,-dock,-images,-visuals}.js`.
- Macro는 `TRTMacro.saveScript/executeScript/getCatalog/openJenaEditor`를 대상 런타임에 추가했다. 기존 녹화 카탈로그를 유지한다. 새 등록은 새 ID이며 JS 넣기·Ctrl+S 저장이 자동 문서 실행으로 이어지지 않는다. 원본 코드 기본 펼침, API/실행/답변 JS 접힘을 사용한다. 프롬프트에 남아 있던 과거 ‘저장 즉시 실행’ 설명도 바로잡았다.
- `js/jena-series-settings.js`와 ENV `#macro-jena-enabled`, SQLite 설정 정책의 `macroJenaEnabled`를 연결했다. 신규 기본은 OFF이며 비활성화 시 AI 작업/창을 닫는다. 일반 매크로의 기존 가시성·실행 설정과 구분한다.
- Slide는 실제 fragment와 controller fallback 양쪽에 Jena 버튼을 추가하되 기존 ScholarAI를 남겼다. `state.js/ui.js/save.js/Export/mppExport.js`는 기존 형식에 optional 초안 metadata를 더한다. DB 버전·기존 store는 변경하지 않았다. `src/jenaDataStorage.js`의 기존 JSON 저장 경로가 추가 metadata도 보존함을 코드 확인했다. 실제 NAS 저장은 별도다.
- 부모 `openMermaidEditorForGenSlide/routeMermaidToGenSlide`는 현재 `html2ppt-frame` 소유자만 허용하고, ME 코드/SVG/PNG 반환을 Slide 세션으로 보낸다. 일반 문서 삽입은 이전 경로를 사용한다. Slide를 닫으면 생성/반환 세션을 정리한다.
- ME 신규 호출이 Viewer의 `MermaidEditorExport.pngBlob`을 기대하는 차이를 브라우저 PNG 검사에서 발견했다. 대상의 기존 `createRenderedPngBlob`을 유지해 `serialize`+고해상도 canvas 경로로 연결했다. 기존 Range/CTM/폰트/배율/8192px 제한을 보존했다.
- SSP는 기존 생성/참조 이미지 편집 함수 `generateLemonadeSspImage`에 요청 전용 preset만 적용했다. 선택 모델 health, 상태 요청 ticket, fast/quality와 details 상태 키는 sidebar에서 관리한다. Scholar와 SSP는 별도 abort callback을 사용한다.
- 작은 Slide iframe은 세로 흐름과 입력 영역 최소 높이를 보완했다. 이는 실물 모바일 검증이 아니라 390px/800px Chrome 검사다.

### 수식·PV 점검 중 발견한 별도 경합

실제 메인/PV 수식 검사에서 WebDAV 고유 `a4-presentation.js::leave`가 새 창의 body 생성 전에 `classList`를 읽는 오류를 확인했다. body가 있을 때만 모드 클래스를 해제하는 좁은 guard와 회귀 검사를 추가했다. Viewer에서 동일 파일은 발견하지 못했다. PV 페이지 분할·인쇄/PDF 엔진을 통째로 이식한 것은 아니다.

루트 app/CSS, AI 채팅 lazy URL, Tidy child, ME child, Slide controller, 새 자산, PWA cache를 `20261112-webdav-jena-1`/`jenaSeries=20261112-1`로 연결했다. 다른 기능이 사용하던 기존 query는 보존했다.

## 범위를 제한한 항목

다음은 문서를 검토했지만 이번 안정화와 별도의 데이터/편집 계약이므로 완료로 표시하지 않는다.

- Viewer Table codec의 HTML 병합 표·결과 대형 편집기·OCR 모드 전체와 `jena_inputs` 이력 DB migration. 대상 v10의 `writing_style_refs` 등 store를 유지하기 위해 숫자/파일 복사 migration을 하지 않았다.
- Tidy의 Viewer 3열 전체 재배치/별도 코드 이력·빠른 메뉴 Dock, Macro 이미지 목록·목록 Dock·무창 치환 확장. 대상 기존 UI/기능을 보존하고 AI 실행과 실제 범위 오류를 우선 보완했다.
- 일반 표 편집·캡션/빠른 이동/Export 메뉴의 추가 개편, MCP 로컬 서버/외부 계정 연결, PV 중첩 표/출력 엔진 전체 이식. Jena 연결 안정화 완료와 별개로 남긴다.

## 검증 증거와 한계

증거 폴더: `artifacts/jena-port-20261112/`. 최종 요약은 같은 폴더의 `verification-summary.json`을 따른다.

| 검사 | 결과/증거 |
| --- | --- |
| Node 계약·동작 검사 | 공통 task/취소/모델 ID·프로필, AI Studio metadata 생략, Ollama 실제 body 예산, Math 다중행, SSP 모델별 health/preset, 기존 AI Jena UI·첨부·ME/Tidy/Scholar·수식 계약 검사. 최종 181개 통과, 실패 0 (`verification-tests.txt`) |
| 실제 Vite + 모의 공급자 | 루트·`/nested/`에서 Table/Math/ME/Tidy/Macro/Slide/Scholar/SSP. 모든 task의 선택 provider/profile/model 확인, 페이지 오류 0. `browser-root-results.json`, `browser-nested-results.json` |
| 실제 Worker·저장 | Tidy 선택 이동·문서 전환 보호, Slide 격리 시각 JS 렌더, inDB/MPP 초안 실제 저장·재열기, ME 실제 SVG→PNG→Slide 반환·원문 미변경 |
| 작은 화면 | 390px/800px Math/Macro 창 크기와 Send, Slide 입력/생성 접근. `layout-results.json` |
| 기존 앱 흐름 | 기존 `viteButtons.browser.cjs`: root/nested 설정·보기/편집·ME·HWP import 진입, React 호스트 MDpro iframe 검사. 페이지 오류 0. React 기존 중복 key console 경고는 별도 로그에 남음 |
| 메인 보기/PV 수식 | 실제 Vite에서 필수 수식·이중 escape·통계 별표·코드 달러·일반 괄호·aligned. 메인/PV MathJax 오류와 미복원 토큰 없음, 페이지 오류 0. `math-surfaces-results.json`, `math-main.png`, `math-pv.png` |
| 실제 Lemonade | 현재 적재 `Gemma-4-E4B-it-GGUF`: READY 437ms(첫 delta 412ms), 합성 `x = -1 / 2` 이미지 348ms(195ms)→`$x = -1/2$`, 짧은 표 555ms(112ms), 값 12/-3 보존. `real-provider-results.json` |
| 서버 상태 | 로컬 Ollama 설치 목록 응답, `/api/ps` 적재 목록 비어 있음. LM Studio 1234/5678은 연결 거부. 다른 모델을 강제 적재하거나 서버 프로필을 변경하지 않음 |
| 빌드·정적 검사 | 관련 JS `node --check`, `git diff --check`, `npm run build`. `build.txt`와 최종 요약 |

실제 Lemonade 수치는 작은 fixture의 단일 warm 요청이다. 과거 Viewer의 103초 이미지 생성과 비교한 개선율이 아니며, 보편 OCR 정확도·모든 공급자 품질/속도·대형 SSP 생성/참조 편집 성공을 뜻하지 않는다. AI Studio/OpenAI/DeepSeek/FLM/LiteRT-LM/LM Studio 실계정·실장비 추론, Ollama 실적재/비전 정답률, 실제 NAS 재열기·PWA offline·설치 앱·Word·종이 출력은 미검증이다.

초기 광역 검사에서 오래된 Ollama fixture 5개가 기존 HEAD에서도 동일하게 실패했다(`localStorage.setItem` stub과 기존 큰 context migration/기본값 불일치). 브라우저와 같은 storage와 migration 완료 상태, 명시 reasoning context로 fixture를 보완하고 새 task budget 실제 body 검사를 추가했다. 단순히 실패 검사를 제거하지 않았다. ME cache query 검사도 신규 버전에 맞췄다. JENA_DATA fixture도 기존 records RPC 응답/DOM event stub을 보완하고 Slide 추가 metadata 보존 검사를 추가했다. 반복 실행 시 Stop 버튼이 첫 작업의 controller를 캡처하던 문제를 수정했으며, 서로 다른 늦은 응답 값으로 취소 회귀를 검증했다. 공통 picker의 실시간 선택과 빈 provider(현재 Jena 상속)도 Table 실제 UI로 확인했다.

기존 `tests/hwp-math-surfaces.browser.cjs`의 가상 `hwp.test` 검사는 PV body 생성 대기에서 시간 초과로 실패했다(`legacy-math-surfaces.txt`). 원인이 모두 해결됐다고 표시하지 않는다. 새 실제 Vite 메인/PV 검사는 별도로 통과했다.

## 상대 앱 대응표·Tauri 상태

| 책임 | Viewer | WebDAV 적응 | 상대 반영 |
| --- | --- | --- | --- |
| 공통 picker/task | `AI_App/aiChat/` | 기존 provider 목록·bridge·ENV/프록시·선택 키 유지, 초기화부터 독립 취소 | Viewer 미수정 |
| Tidy | `js/Tidy/`의 RPC/새 관리창 | 대상 자체 관리창/대화·JENA_DATA 및 실제 document identity 유지 | 안정화 항목은 대상 구조 비교 후 역이식 가능 |
| Macro/Slide | `trt/macro-jena.*`, `Html2pptx/jenaEditor` | 새 전용 모듈 + 대상 기존 런타임·저장·Scholar 버튼 보존 | 원본 기능 존재, WebDAV 적응을 그대로 덮지 않음 |
| ME 변환 | Viewer exporter에 `pngBlob` 존재 | WebDAV serializer + 기존 PNG 함수 유지 | API 차이 유지 |
| PV 초기 body | 동일 Viewer 파일 미발견 | WebDAV `a4-presentation.js` body guard | 대상 동등 경로 확인 필요 |

Tauri 대기 ID는 위 변경 ID다. Viewer 자산을 수정하지 않았으므로 이번 요청으로 Viewer frontend/native/NSIS 빌드를 실행하지 않았다. 향후 역이식하면 해당 저장소 `Docs/mdpro-development/TAURI_BUILD.md`에 따라 웹 검증·frontend 자산·native·설치 앱을 각각 확인한다. WebDAV 웹 빌드 성공을 Tauri 또는 배포 완료로 표시하지 않는다.

## 다른 앱에서 다시 실행할 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md, Docs/toskill/README.md,
C:\CusorApps\Webdav_md\webdav-md\docs\mdpro-development\changes\2026-11-12-jena-series-runtime-port.md를 읽어줘.
WebDAV의 초기화부터 독립 task 취소, 명시 모델 ID/하위 프로필 보존, 최종 결과 이후 스트림 차단,
Tidy 실행 시작 범위·문서 identity 고정, Macro 등록/실행 분리와 실제 검증에서 발견한 경합을
Viewer의 현재 owning 코드와 비교해 필요한 부분만 역이식해줘.
Viewer에 이미 있는 UI·저장·브리지·pngBlob API는 보존하고 WebDAV 경로/프록시/DB 버전을 복사하지 마.
선택 이동/문서 전환/취소·늦은 응답/PNG 반환/초안 저장 왕복을 실제 브라우저로 검사하고
개발 문서·목록·Tauri 대기 상태를 갱신해줘. 이번 명령에는 Tauri 빌드·설치·배포·커밋·푸시를 포함하지 않아.
```

WebDAV에서 계속할 명령:

```text
C:\CusorApps\Webdav_md\webdav-md의 AGENTS.md와 이 변경 문서를 읽고 현재 Jena 회귀를 먼저 실행해줘.
이번에 범위를 제한한 codec/입력 이력/추가 Dock 또는 실제 다른 공급자 검증 중 요청한 항목만
현재 DB·문서 저장·프록시 계약에 맞춰 추가해줘. 실제 서버가 준비되지 않은 항목은 연결·적재·추론·정답률을
구분하고 이미 검증한 기능을 덮어쓰지 말아줘. 검증과 이식 문서·목록을 함께 갱신해줘.
```
