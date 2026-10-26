# FMA AI Studio·Lemonade 버튼 분리와 이미지 편집 닫기

- 변경 ID: `MDPRO-20261027-FMA-SPLIT-CLOSE`
- 작성·최종 확인: 2026-10-27 Asia/Seoul.
- 구현: `C:\CusorApps\Webdav_md\webdav-md`, 미커밋. 기존 미커밋 공급자·모델/전송 수정 위에 좁게 추가했다.
- 참고 원본: `C:\CusorApps\md-viewerVscode\md_viewer\Docs\mdpro-development\changes\2026-10-27-fma-lemonade-jena-button.md` 및 Viewer 실제 `preview.js`/`aiJena.js`/`index.html` 대응 코드.
- 선행: [FMA 공급자·모델 선택과 전송](2026-10-27-fma-jena-provider-and-transport.md).
- 상태: WebDAV 구현·51개 검사·빌드·Edge 다크/라이트 버튼 클릭 검증. Viewer 런타임 수정·Tauri frontend 준비·네이티브 빌드·설치 앱 검증은 미실행.

## 요청과 완료 기준

FMA 이미지 작업줄에 `✦ AI Jena · AI Studio`와 오렌지색 `✦ AI Jena · Lemonade`를 따로 배치한다. 선택한 버튼의 공급자로 같은 이미지 편집기를 연다. 영상 항목에는 두 버튼을 추가하지 않는다. 이미지 편집창의 오른쪽 상단에 `× 닫기`를 항상 노출한다. 실행 중 클릭하면 요청을 취소하고 한 번에 닫는다.

WebDAV의 기존 키 없이 공급자·모델을 설정할 수 있는 진입 동작을 보존하기 위해 두 버튼은 모두 노출한다. Viewer 문서의 loaded 모델일 때만 로컬 버튼 노출 정책과는 다르다. `getFmaLemonadeImageModel()`은 전역 선택 설정을 반환하며 서버 loaded 상태를 보증하지 않는다. 준비 표시를 실제 서버 로드 성공으로 해석하지 않는다. 전역 공급자 설정은 버튼 클릭으로 변경하지 않는다.

## 실제 구현

- `mdpro/Apps/fmaviewer/js/gallery/preview.js`의 `renderDynamicMeta()` 내부 이미지 작업줄: 공급자별 버튼을 만들고 `openAiJena(idx, provider)`에 연결한다. 새 카드가 문서에 붙기 전에도 상태를 설정하도록 `updateAiJenaKeyStatus(container)`로 카드 범위를 전달한다. 기존 Edit/Crop/BG Remove/Upscale 및 조건부 AI 도구는 유지한다.
- `mdpro/Apps/fmaviewer/js/ai/aiJena.js`: `aiJenaState.imageProvider`를 추가한다. `openAiJena()`에서 세션 공급자를 기록하고 모델 UI를 다시 그린다. 처리 중 중복 열기는 막는다. `updateAiJenaKeyStatus()`는 각 공급자 버튼과 편집창 상태를 구분한다. 이미지 요청은 기존 원본·마스크·얼굴/옷/배경/자세 참조 조립 및 전송 함수를 그대로 사용하며 AI 사용 중지 상태를 검사한다. `requestAiJenaVideo()`는 Lemonade 세션에서 AI Studio로 암묵 전환하지 않고 공급자 선택 안내 오류를 반환한다.
- `mdpro/Apps/fmaviewer/js/ai/aiJenaModels.js`: `getAiJenaImageConnection()`이 세션 공급자를 저장된 FMA/전역 기본값보다 우선한다. 모델은 기존 공급자별 저장 설정을 유지한다. `initAiJenaModelControls()`가 `window.renderAiJenaModelControls`를 연결하고 명시적 공급자 변경 시 세션 값도 동기화한다. 버튼 클릭 자체는 저장된 FMA/전역 공급자를 바꾸지 않는다.
- `closeAiJena()`: 처리 중 `stopAiJena()` 후 조기 반환하던 동작을 제거한다. 참고 미리보기·FMA 선택기·저장 선택기를 닫고 메인 모달을 숨긴다. 실제 처리 종료는 기존 AbortSignal과 finally 정리가 담당한다. 갤러리 이미지나 생성 히스토리는 닫기로 삭제하지 않는다.
- `mdpro/Apps/fmaviewer/index.html`: 기존 `#btnAiJenaClose` ID와 연결은 유지하면서 설정 줄 밖의 헤더 직속으로 옮기고 `× 닫기`, title/aria-label을 명시한다. styles/preview/aiJena/aiJenaModels 캐시 키를 `20261027-split-close-1` 계열로 갱신한다.
- `mdpro/Apps/fmaviewer/css/styles.css`: 헤더 오른쪽 100px 여백 및 닫기 버튼 absolute 위치로 모델 선택 줄의 줄바꿈과 분리한다. 닫기 버튼 최소 74×36px, focus 표시와 라이트 테마 색상을 지정한다. Lemonade 버튼은 `#fdba74 → #fb923c`, 글자는 `#431407`, 테두리는 `#f97316`이다.

핵심 흐름:

```js
button.onclick = () => openAiJena(idx, provider);
// getAiJenaImageConnection(): sessionProvider → FMA preference → global preference
// closeAiJena(): stopAiJena() if processing → child dialogs close → modal hidden
```

문서 보기/PV/수식/인쇄/내보내기 파이프라인과 원본 해상도는 변경하지 않았다.

## 상대 앱 대응표와 이식 순서

| WebDAV | Viewer 참고 문서의 대응 | 차이·이식 상태 |
| --- | --- | --- |
| `mdpro/Apps/fmaviewer/js/gallery/preview.js` | `Apps/fmaviewer/js/gallery/preview.js` | 별도 버튼은 Viewer 문서상 구현됨. WebDAV는 두 버튼을 설정 진입점으로 계속 표시함 |
| `aiJenaModels.js` 세션 우선 선택 | Viewer `aiJena.js` 세션 공급자 | Viewer 공통 `MDProImageProvider`와 WebDAV `getFmaLemonadeImageModel`/`requestFmaLemonadeImage`가 다름. 전체 파일 복사 금지 |
| `index.html`/`styles.css` 닫기 헤더 배치 | Viewer index.html의 같은 ID가 설정 줄 안에 있음 | 실제 소스 확인·닫기 개선은 미이식 |
| `aiJena.js` 취소 후 즉시 닫기 | Viewer도 처리 중 stop 후 return함 | 실제 소스 확인·취소 후 즉시 닫기 미이식 |

Viewer 실제 소스에서 별도 버튼과 MDProImageProvider.getState().imageLoaded 조건, 설정 줄 내부의 같은 닫기 ID, 처리 중 stop 후 return하는 closeAiJena를 확인했다. Viewer 실실행 증거는 아니다. 대상 이식 시 AGENTS와 모달 상태 정리의 추가 호출자를 확인한다.

## 회귀 예제와 검증

실행한 검사:

```powershell
node --test tests/aiJenaUiContract.test.mjs tests/fmaJenaModels.test.mjs tests/fmaLemonadeGeneration.test.mjs
node --check mdpro/AI_App/aiChat/ai-chat.js
node --check mdpro/Apps/fmaviewer/js/ai/aiJena.js
node --check mdpro/Apps/fmaviewer/js/ai/aiJenaModels.js
node --check mdpro/Apps/fmaviewer/js/gallery/preview.js
git diff --check
npm run build
```

51개 통과, 구문·공백 검사 통과, production build 통과. 번들 크기 500kB 초과 안내는 남아 있다. `tests/fmaJenaModels.test.mjs`에 세션 선택이 저장된 설정을 변경하지 않음, 생성 중 한 번에 취소·닫기, Lemonade 세션에서 Veo가 Google로 넘어가지 않음을 추가 검증했다. 기존 원본·마스크·참조 요청 및 오류 시 fallback 제한 검사는 유지한다.

실제 Edge URL: `http://127.0.0.1:5175/mdpro/Apps/fmaviewer/index.html`. 자체 생성한 64×64 단색 테스트 PNG를 클립보드로 넣어 다음을 확인했다.

1. 선택 이미지 작업줄에 두 공급자 버튼과 기존 편집 도구가 함께 표시된다.
2. Lemonade 버튼 클릭 시 공급자 combobox가 Lemonade, 모델이 Flux-2-Klein-4B로 열린다.
3. 닫기 버튼을 클릭하면 dialog가 보이지 않는다.
4. AI Studio 버튼 클릭 시 공급자 값이 `aistudio`로 열린다.
5. 라이트 테마에서도 닫기 버튼이 보이고 클릭 후 dialog가 사라진다. 테스트 후 다크 테마와 클립보드를 복원했다.

증거:

- `artifacts/fma-split-close-20261027/lemonade-editor.png`
- `artifacts/fma-split-close-20261027/provider-buttons-light.png`
- `artifacts/fma-split-close-20261027/editor-light.png`

초기 in-app browser 연결 및 샌드박스 안 로컬 서버 연결은 실패했다. 정상 로컬 서버 5175와 Edge를 이용해 UI 검증을 완료했다. 1px 테스트 PNG 입력은 반영되지 않아 유효한 64px PNG로 교체했다. 실제 모델 편집·생성 완주, 서버 취소 완료, 내장 iframe의 좁은 크기, Viewer 및 설치 앱은 미검증이다. 생성 중 취소·닫기는 자동 검사 증거와 구분한다.

## Tauri 반영 계획

빌드 대기 ID `MDPRO-20261027-FMA-SPLIT-CLOSE`. Viewer에는 이미 별도 버튼이 기록되어 있으므로 기존 공급자 경로를 보존하고 닫기 개선을 좁게 이식한다. 변경할 웹 자산은 대응 index.html/styles.css/aiJena.js이며 모델 UI 분리가 다르면 실제 구조에 맞춰 적응한다. 웹에서 원본·참조·기존 도구와 좁은 화면을 확인한 뒤 Tauri/dist 자산·캐시·브리지 포함을 검사한다. 이번에는 frontend 복사·네이티브 빌드·설치를 실행하지 않았다.

## 다른 앱에서 다시 실행할 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md와
C:\CusorApps\Webdav_md\webdav-md\docs\mdpro-development\changes\2026-10-27-fma-provider-buttons-and-close.md를 읽고,
기존 AI Studio/Lemonade 별도 버튼과 MDProImageProvider 라우팅을 보존하면서
AI Jena 이미지 채팅 편집의 닫기 버튼을 헤더 오른쪽 상단에 항상 보이도록 배치해줘.
기존 ID/이벤트를 유지하고 실행 중 닫으면 취소 후 한 번에 닫히도록 해줘.
참고 미리보기와 자식 대화상자 정리, 히스토리 보존, 다크/라이트·좁은 화면에서 클릭을 검증해줘.
전체 파일을 덮어쓰지 말고 기술문서·목록·Tauri 대기 상태를 갱신해줘.
Tauri 빌드·설치·커밋·푸시는 수행하지 말고 미검증 항목을 구분해줘.
```
