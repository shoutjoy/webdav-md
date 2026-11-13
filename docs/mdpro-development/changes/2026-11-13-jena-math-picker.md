# 2026-11-13 Jena Math 연결·선택 상자 대비

- 변경 ID: MDPRO-20261113-MATH-PICKER
- 원본: C:/CusorApps/WebDav-MD/webdav-md (미커밋)
- 대상: C:/CusorApps/MDPRO/MDproViewer (읽기 비교만, 수정 없음)
- 상태: WebDAV 구현·웹 검증·빌드 완료. Viewer 이식/frontend/native/설치 미실행.

## 요청과 실제 구현

WebDAV React 호스트 iframe 안의 Math에서 모델 조회가 바깥 parent로 보내져 15초 시간 초과되던 문제를 수정했다. `AI_App/aiChat/task-provider-picker.js`의 `mountAITaskPicker`는 자체 `AIChat` 또는 lazy loader `openAiJenaChat`이 있으면 현재 창을 host로 사용한다. 자체 런타임이 없는 ME 등 하위 도구는 기존 parent 메시지를 유지한다. 모델 조회뿐 아니라 모델 로드·인증도 동일 host 선택을 따른다. 제공자·모델 저장과 추론 요청은 기존 코드를 유지한다.

`css/style.css`에 `.img2math-dialog .ai-tool-provider-controls` 범위로 select/input/button/option의 어두운 배경과 밝은 글자를 명시했다. 비활성 글자색과 상태 줄 줄바꿈도 적용했다. Math와 같은 구조의 Table에 함께 적용된다. 기존 파일/붙여넣기/선택 가져오기/프롬프트/공급자/모델/직접 입력/새로고침/모델 로드/인식/수정/삽입/닫기 컨트롤을 삭제하지 않았다. 기존 숨김 정책은 변경하지 않았다.

`index.html`의 CSS·picker 버전과 PWA cache version을 갱신했다. 수식 파서·MathJax·보기/PV·출력 파이프라인 변경 없음.

## 검증

- `node --test tests/aiJenaUiContract.test.mjs tests/aiToolProviders.test.mjs tests/jenaSeriesRuntime.test.mjs`: 55/55 통과 (`artifacts/jena-math-tests.txt`).
- `node --check mdpro/AI_App/aiChat/ai-chat.js`, picker syntax, `git diff --check`: 통과.
- `npm run build`: 통과 (`artifacts/jena-math-build.txt`, 기존 chunk 경고).
- Chrome agent-browser 전용 세션, http://127.0.0.1:5201/mdpro/index.html?webdav=1 안에 같은 앱 iframe 재현. AI Studio 저장된 목록 10개 표시, Lemonade 전환 실제 연결 16개·Gemma-4-E4B-it-GGUF 선택 확인.
- AIChat가 불변 객체여서 시도한 메서드 교체는 적용되지 않았으며 위 목록은 모의 결과가 아닌 기존 실제 런타임 결과이다. AI Studio 새 인증/실제 추론 성공은 검증하지 않았다.
- 공급자 select computed background rgb(16,38,51), color rgb(232,245,247). `artifacts/jena-math-iframe.png` 실제 이미지에서 가독성·버튼 표시 확인.
- Lemonade 텍스트 수식 생성은 시작했으나 다른 작업의 Vite 자동 새로고침으로 결과 확인이 중단됨. 이미지 OCR·모든 공급자 실제 생성·모바일·보기/PV/Word 출력은 이번 미검증.
- 동시 작업의 기존 app.js/MobileUI/imageDB/Tidy 변경은 이번 수정 범위가 아니다.

## 대상 대응·Tauri

대상의 `AI_App/aiChat/task-provider-picker.js` 읽기 확인. 공통 picker가 존재하지만 Viewer 고유 브리지·인증/초기화 경로가 있으므로 전체 파일 복사 금지. 대상 창 소유권 및 실제 AIChat 초기화 시점을 다시 비교하고 필요 부분만 적용한다. Math/Table CSS 대응 클래스와 캐시 정책은 대상 확인 필요. WebDAV 수정은 Viewer 설치 앱에 자동 반영되지 않는다.

대기 ID MDPRO-20261113-MATH-PICKER. 대상 웹 이식과 브라우저 검증 후 frontend 준비, 네이티브 빌드, 설치 앱 검증 모두 대기. 이번 Tauri 빌드 요청 없음. 요청 시 대상 Docs/mdpro-development/TAURI_BUILD.md를 따른다.

## 다른 앱에서 다시 실행할 명령

```text
C:/CusorApps/MDPRO/MDproViewer에서 AGENTS.md와 WebDAV의 docs/mdpro-development/changes/2026-11-13-jena-math-picker.md를 읽고 Jena Math 연결·선택 상자 대비 수정을 필요한 부분만 이식해줘. 자체 AIChat/lazy loader가 있는 앱 창과 parent 통신만 사용하는 하위 도구를 구분하고, 공급자 전환·목록·모델 로드·직접 입력·저장·OCR 버튼을 보존해줘. 전체 파일 덮어쓰기 없이 실제 iframe/독립 창과 AI Studio/Lemonade 목록·추론, 다크 UI를 검증하고 미검증을 구분해줘. 인계 목록·Tauri 대기를 갱신해줘. 이번 명령에서는 Tauri 빌드·설치·배포하지 마.
```
