# AI Jena 하단 플로팅(Alt+4) 구현·모바일 동작 기술서

- 문서 ID: `MDPRO-20261110-JENA-ALT4-DOC`
- 작성·코드 확인: 2026-11-10
- 원본: `C:\CusorApps\Webdav_md\webdav-md`
- 비교 대상: `C:\CusorApps\md-viewerVscode\md_viewer`
- 기준: WebDAV HEAD `dfe6a18` 위의 현재 작업 트리. `ai-chat.js` 등 기존 미커밋 변경을 포함한 코드를 읽었다. HEAD 단독의 기능 명세가 아니다.
- 이번 변경: 기술문서·개발 목록·Tauri 상태 기록만 추가. 기능 코드, 상대 앱, 빌드 산출물은 수정하지 않는다.

## 1. 목적과 네 가지 배치의 관계

문서를 편집하면서 작은 AI 입력창을 하단에 띄우고, 필요할 때만 대화·설정을 펼치는 기능이다. 별도의 AI 공급자나 별도의 대화 저장소를 만드는 방식이 아니라, 기존 `#ai-chat-panel`의 배치와 표시 상태를 전환한다.

| 배치 | 내부 값 | 단축키 | 역할 |
| --- | --- | --- | --- |
| 팝업 | `popup` | Alt+1 | 이동 가능한 독립 창. WebDAV에서는 상위 셸로 이동하는 경로가 있다. |
| 우측 Dock | `dock` | Alt+2 | 우측 공간을 확보하는 사이드바 |
| 전체화면·기록 | `fullscreen` | Alt+3 | 넓은 대화·기록 보기 |
| 하단 플로팅 | `floating` | Alt+4 | 문서 위에 겹치는 축소 입력창과 확장 대화창 |

첨부 화면의 `OFF`와 `시작 ON`은 **앱을 열 때 사용할 시작 배치**다. 기능 사용 가능 여부나 현재 확장 여부가 아니다. 행의 활성 표시와 시작 배치 표시는 별도로 관리한다. WebDAV 초기화에는 `dock-alt2-v1` 기본값 마이그레이션이 있으며, 사용자가 변경한 시작 위치를 이후 복원한다.

## 2. 사용 흐름과 상태 전환

1. 레이아웃 메뉴에서 ‘하단 플로팅’을 누르거나 Alt+4를 누른다. 단축키는 `Digit4`와 `Numpad4`를 처리하며 Ctrl/Shift/Meta가 함께 눌리면 이 분기로 들어오지 않는다.
2. 하단에 축소형 입력창을 표시한다. 모바일은 물리 키보드 없이 레이아웃 메뉴를 터치해 선택한다.
3. 입력창의 `☰`로 대화창을 확장한다. 확장 헤더의 `☰`로 다시 입력창만 남긴다.
4. 일반 채팅을 전송하면 답변을 볼 수 있도록 자동 확장한다. 문서 실시간 작성이 켜져 있으면 전송 때문에 자동 확장하지 않는다.
5. 축소형 닫기 또는 기본 닫기 버튼은 패널을 닫는다. 확장 헤더의 `☰`는 접기이므로 닫기와 구분한다.
6. 패널을 다시 열면 `setOpen(true)`가 축소 상태와 화면 하단 배치를 다시 적용한다. Alt+4도 `setLayout('floating') → setOpen(true)`를 호출하므로 반복 입력은 닫기 토글이 아니다.

| 상태 | 클래스·조건 | 표시 내용 |
| --- | --- | --- |
| 닫힘 | `state.open === false` | 패널 비표시 |
| 축소 | `layout-floating floating-compact` | 이동 손잡이, 첨부 미리보기, 입력, 응답 모드, 작성 도구, 전송·중지·닫기 |
| 확장 | `layout-floating`, `floating-compact` 없음 | 헤더, 기록, 공급자 설정 진입, 메시지와 입력 도구 |
| 설정 펼침 | 확장 + `floating-settings-open` | 설정 영역을 확보하고 화면 안으로 위치 재계산 |

현재 선택한 배치와 시작 배치는 다르다. 행 본문은 `setLayout(layout)`을 실행하고, 행의 시작 배지나 ‘시작 위치’ 버튼은 `setStartLayout(layout)`을 실행한다. 축소/확장 자체를 영구 저장하는 키는 없고, 열기 동작에서 축소 상태로 시작한다.

## 3. 구현 소스와 책임

아래 경로는 원본 저장소 기준 상대 경로다. 함수명과 선택자를 기준으로 찾아야 하며, 줄 번호는 이후 편집에 따라 바뀔 수 있다.

| 파일·함수 | 책임 |
| --- | --- |
| `mdpro/AI_App/aiChat/ai-chat.js`의 UI 생성 부분 | 네 가지 메뉴, 공용 패널, 플로팅 이동·확장·접기·닫기·리사이즈 요소 생성 |
| `normalizeLayout`, `setLayout`, `setOpen` | 배치 정규화, DOM 부모 변경, 열기와 축소 초기화 |
| `setFloatingExpanded` | 클래스·ARIA 변경, 축소 위치 기억, 확장·복귀 좌표 계산 |
| `getFloatingViewportBounds`, `clampFloatingToViewport` | 보이는 화면 경계 계산과 이탈 방지 |
| `positionFloatingCompactAtBottom` | 다시 열 때 축소창을 하단에 놓기 |
| `setupPopupDrag` | 팝업뿐 아니라 플로팅 헤더·손잡이 이동도 처리 |
| `setupFloatingResize` | 상·하·좌·우·우하단 크기 조절과 상태별 저장 |
| `setProviderControlsOpen` | 설정 열기 전 바닥 좌표 보존과 재배치 |
| `sendMessage`, `setRealtimeDocWrite` | 일반 답변 자동 확장, 실시간 문서 작성 시 축소 유지 |
| `mdpro/AI_App/aiChat/ai-chat.css` | `layout-floating`, `floating-compact`, 모바일 미디어 규칙 |
| `tests/aiJenaUiContract.test.mjs` | DOM/소스/CSS 계약 회귀 검사 |

핵심 제어는 다음과 같다. 아래는 기존 코드의 핵심 발췌이며 완전한 독립 실행 예제는 아니다.

```js
// 단축키 처리: 배치를 바꾼 뒤 반드시 연다.
setLayout(layoutShortcut);
setOpen(true);

// setLayout 내부: 같은 패널의 배치 클래스와 DOM 소속을 바꾼다.
(layout === 'popup' ? popupHost() : frameDocument.body).appendChild(panel);
setFloatingExpanded(layout !== 'floating');

// sendMessage 내부: 문서 직접 작성에서는 축소창을 유지한다.
if (state.layout === 'floating' && !state.realtimeDocWrite) setFloatingExpanded(true);
```

### 3.1 DOM과 제어 보존

축소창의 주요 ID는 `ai-chat-floating-drag-handle`, `ai-chat-floating-toggle`, `ai-chat-input`, `ai-chat-floating-compact-close`, `ai-chat-send`, `ai-chat-stop`이다. `ai-chat-floating-close`는 확장 헤더의 접기 버튼이다.

응답 모드에는 즉시·FAST·추론·추론 표시·학술검색·인터넷 검색·검색 결과 수가 연결된다. 입력 도구에는 첨부, 이미지 생성, 얼굴 유지, 선택 가져오기, 실시간 문서 작성, 작성 위치, 문장 전용 작성이 있다. 일부 도구는 이미지 모드 등 기존 조건을 따르므로 항상 모두 보인다고 가정하지 않는다.

축소 상태에서는 CSS로 헤더·기록·공급자 영역·상태·메시지 영역을 감추고 composer를 남긴다. 해당 요소를 DOM에서 삭제하거나 새 입력창을 복제하지 않는다. 확장 시 기록·새 대화·전체 복사·전체 저장·데이터 센터·레이아웃 메뉴·닫기의 기존 연결을 유지한다. 복사·저장은 기존 ENV 표시 정책도 보존한다.

`setFloatingExpanded()`는 `aria-expanded`, `aria-label`, title을 함께 갱신한다. 아이콘 버튼은 글자를 시각적으로 감추고 `::before`로 표시하므로 접근 가능한 이름을 제거하면 안 된다.

### 3.2 위치와 크기 저장

| 저장 키 | 값·용도 |
| --- | --- |
| `ss_ai_chat_layout` | 현재 배치 |
| `ss_ai_chat_start_layout` | 시작 배치 |
| `ss_ai_chat_floating_position` | `{left, top}` |
| `ss_ai_chat_floating_size` | 확장 `{width, height}` |
| `ss_ai_chat_floating_compact_size` | 축소 `{width, height}` |

저장은 기존 `storageGet/storageSet` 추상화를 사용한다. 위치·크기의 JSON 파싱 오류와 유효하지 않은 숫자는 읽기 단계에서 무시한다.

축소창을 확장할 때 `floatingCompactReturnPosition = {left, top, bottom}`을 메모리에 보관한다. 확장 높이가 커져도 원래 바닥을 기준으로 위쪽으로 펼치고, 접으면 원래 위치로 복귀하도록 계산한다. 접을 때 확장 상태의 inline width/height를 먼저 지우고 축소 전용 크기를 적용한 뒤 위치를 계산해야 커다란 빈 입력창이 남지 않는다.

다시 열 때 저장 위치의 가로 좌표는 참고하지만 세로 좌표는 하단으로 재계산한다. 따라서 ‘드래그한 세로 위치를 다시 열어도 그대로 유지한다’는 명세가 아니다. 화면 크기 변화 시에도 축소창은 하단으로 재배치된다.

주의: 현재 `applyFloatingSize()`는 `max-width: 760px` 조건에서만 저장한 확장 크기를 복원한다. 데스크톱에서도 크기 변경 시 저장은 하지만 같은 복원 경로가 실행되는 것은 아니다. 이 비대칭은 현재 구현 사실로 기록하며 이번 문서 작업에서 변경하지 않았다.

### 3.3 이동·리사이즈

이동은 확장 헤더 또는 축소창 상단 손잡이에서 `pointerdown`으로 시작한다. 입력·버튼·select·메뉴에서 시작한 조작은 이동으로 처리하지 않는다. `setPointerCapture()`로 이동을 이어가고 `pointerup/pointercancel`에서 정리·저장한다. 손잡이와 리사이저의 `touch-action: none`은 해당 표면에서 드래그와 페이지 스크롤이 충돌하지 않게 한다.

리사이저는 `data-ai-chat-floating-resize="n|e|s|w|se"`의 다섯 개다. 축소 상태에서도 확장하지 않고 크기를 변경하며, 시작 시 축소 여부를 기억해 올바른 키에 저장한다. JS 최소 크기는 축소 360×132, 확장 280×260을 기준으로 하되 보이는 화면에서 8px를 뺀 값으로 제한한다. 실제 CSS 최소 크기와 함께 적용되므로 이 수치를 모든 화면에서의 최종 렌더링 크기로 단정하지 않는다.

손잡이와 리사이저에는 `tabindex`와 role이 있으나, 현재 플로팅 이동·리사이즈 함수에는 방향키 처리기가 없다. 키보드로 동일한 크기 조절이 구현됐다고 해석하지 않는다.

## 4. 모바일 반응형과 화면 키보드

### 4.1 서로 다른 두 분기점

| 화면 너비 | 코드상 처리 |
| --- | --- |
| 700px 이하 | 기본 확장창 좌우·하단 6px, 높이 `calc(100dvh - 12px)`, 최소 폭/높이 해제, 중앙 translate 제거 |
| 760px 이하 | composer 한 열 구성, 모드 행과 작업 행 분리, 모드 행 가로 스크롤, 설정 영역 세로 스크롤 |
| 760px 초과 | 모드와 작업 도구를 두 열에 놓는 기본 grid |

데스크톱 확장 기본값은 폭 `min(960px, calc(100vw - 48px))`, 높이 `min(620px, calc(100dvh - 92px))`다. 축소 상태는 뒤쪽 CSS가 `height: auto`, 투명 패널과 둥근 composer로 덮어쓴다. 모바일 기본 확장 높이를 그대로 축소창 높이로 사용하면 안 된다.

모바일 축소 grid 순서는 손잡이 → 첨부 → 입력 → 응답 모드 → 작업 도구다. 모드 행은 가로 스크롤할 수 있다. 작업 행은 nowrap이므로 매우 좁은 화면에서 모든 작업 버튼의 도달 가능성은 별도 실측해야 한다. CSS에 버튼 크기 32×32px가 있으므로 충분한 터치 영역 확보 여부도 확인 항목이다.

### 4.2 보이는 화면을 기준으로 계산

```js
var visualViewport = root.visualViewport;
var left = visualViewport && Number.isFinite(visualViewport.offsetLeft)
  ? visualViewport.offsetLeft : 0;
var top = visualViewport && Number.isFinite(visualViewport.offsetTop)
  ? visualViewport.offsetTop : 0;
var width = visualViewport && Number.isFinite(visualViewport.width)
  ? visualViewport.width : root.innerWidth;
var height = visualViewport && Number.isFinite(visualViewport.height)
  ? visualViewport.height : root.innerHeight;
// right = left + width; bottom = top + height;
```

`window.resize`와 `visualViewport.resize/scroll`에서 `clampFloatingToViewport()`를 호출한다. 축소창의 top은 `viewport.bottom - height - margin`으로 다시 계산한다. margin은 `root.innerWidth <= 700`이면 6px, 그 외 22px이며 각 경계에서 최소 4px 안쪽으로 제한한다.

이 경로는 화면 키보드로 visual viewport가 줄어드는 경우 입력창을 보이는 영역의 하단으로 이동시키기 위한 구현이다. 다만 WebDAV 플로팅은 편집기 iframe 내부에 있고 **그 프레임의** `visualViewport`를 읽는다. 실제 모바일 브라우저가 상위 셸의 키보드 변화를 프레임에 어떻게 전달하는지까지 이 소스 확인으로 보장할 수 없다. Android/iOS 실기기에서 키보드 열기·닫기와 상위 셸/iframe의 viewport 변화를 함께 확인해야 한다.

`setOpen()`과 `setLayout()`은 입력에 focus를 시도한다. 모바일 소프트 키보드가 자동으로 열리는지는 사용자 제스처·브라우저 정책에 따라 달라지므로 보장 동작으로 쓰지 않는다. Enter 전송, Shift+Enter 줄바꿈, `isComposing` 중 전송 방지는 입력 키 처리에 구현되어 있다. 모바일 키보드별 Enter와 한글 조합은 실기기 확인 대상이다.

### 4.3 설정 영역과 한계

확장 후 공용 공급자 설정 버튼으로 설정을 연다. 축소 상태의 `☰`는 대화 확장 버튼이며 별도의 플로팅 전용 설정 버튼을 생성하지 않는다. `☰` 클릭 전에 설정이 열려 있었다면 설정을 닫는 코드도 있다.

760px 이하 설정 영역은 `max-height: min(46dvh, 360px)`, 세로 스크롤, `overscroll-behavior: contain`을 사용한다. 설정을 연 확장창에서는 메시지 최소 높이 72px를 둔다. `setProviderControlsOpen()`은 기존 바닥을 기억하고 다음 프레임에서 새 높이를 읽어 화면 안으로 제한한다.

Alt+4 전용 하단 여백 계산은 고정 6/22px이며 `env(safe-area-inset-bottom)`을 합산하지 않는다. 홈 인디케이터·노치 안전영역, 가로 회전, 확대/축소, 키보드를 닫은 뒤 이전 크기가 복원되는지 등은 추가 검증 대상이다. 현재 clamp는 화면에 맞춰 축소한 inline 크기를 자동으로 원래 값으로 되돌린다고 보장하지 않는다.

## 5. 다른 앱에서 구현하는 순서와 실제 차이

2026-11-10에 Viewer의 `AI_App/aiChat/ai-chat.js`와 CSS를 읽기 비교했다. 확인한 Viewer 소스의 메뉴·단축키는 Alt+1~3이고 `normalizeLayout()`도 popup/dock/fullscreen만 허용한다. 플로팅이라는 파일 설명만으로 Alt+4가 있는 것으로 판정하면 안 된다.

| 항목 | WebDAV 현재 | 확인한 MDproViewer | 적응 방법 |
| --- | --- | --- | --- |
| 경로 | `mdpro/AI_App/aiChat/` | `AI_App/aiChat/` | 실제 자산 로더·테스트 경로 확인 |
| DOM 부모 | 팝업은 `popupHost()`, 플로팅은 `frameDocument.body` | `setLayout()`의 비Dock 부모는 `document.body` | Viewer 문서·창 좌표계에 연결 |
| 배치 값 | floating 포함 네 가지 | 세 가지 | 정규화·메뉴·단축키·클래스 제거 목록 모두 확장 |
| 모바일 화면 계산 | floating 전용 경계·clamp | `syncMobileViewport()`가 CSS 변수 높이·top 갱신 | 기존 모바일 Dock/전체화면 동작과 병합 |
| 시작 위치 | 저장·메뉴 갱신 | `setStartLayout()`이 `settings-ai-jena-start-layout`도 갱신 | 설정 select의 floating 선택지와 동기화도 확인 |

구현 순서는 다음과 같다.

1. 대상 AGENTS와 개발 기록을 읽고 기존 변경·모바일 제어·공급자·문서 쓰기 브리지를 목록화한다.
2. `floating` 값, 메뉴, Alt+4, 시작 위치 설정과 복원 경로를 먼저 연결한다. 대상 설정 select 등 문자열을 저장·검증하는 다른 위치도 검색한다.
3. 공용 composer에 손잡이·확장·접기·축소 닫기와 다섯 리사이저를 추가하고 이벤트를 한 번만 연결한다.
4. 위치·상태별 크기 저장, 경계 계산, 이동·리사이즈, 확장/복귀를 연결한다. `requestAnimationFrame` 이후 측정 순서를 유지한다.
5. 대상 CSS의 뒤쪽 모바일/테마 규칙까지 살펴 floating 전용 규칙을 병합한다. 기존 세 배치와 모바일 전체화면 버튼을 보존한다.
6. 일반 전송만 자동 확장하도록 연결한다. 기존 문서 쓰기 브리지와 스트리밍·중지·대화 기록을 유지한다.
7. 기존 최상위 레이어 처리, 포커스, 스크롤 잠금, Dock 폭 확보에서 floating 분기가 올바른지 확인한다. WebDAV의 상위 셸 프록시를 Viewer에 그대로 옮기지 않는다.
8. 아래 회귀 사례를 실행하고 대상 문서·목록·Tauri 대기 상태를 실제 결과로 갱신한다.

전체 JS/CSS 덮어쓰기는 금지한다. 공급자·이미지·보안 저장·모바일 UI 등 대상 고유 구현은 이 문서의 이식 범위가 아니다.

## 6. 검증 결과와 재현 체크리스트

이번 문서 작성 시 `node --test tests/aiJenaUiContract.test.mjs`를 실행하여 **29/29 통과**했다. Alt+4 손잡이, 실시간 작성 축소 유지, 상태별 크기 저장, 다섯 리사이저, 접기/닫기 구분, viewport 이벤트, 헤더 보존 등을 소스/CSS 계약으로 확인한다. 이는 브라우저에서 실제 조작하거나 실기기에서 화면 키보드를 확인한 증거가 아니다.

이번에는 런타임 코드를 수정하지 않아 웹 빌드·Tauri 빌드·실제 AI 추론은 실행하지 않았다. 브라우저 UI, 모바일 실기기, 설치 앱도 미검증이다. 사용자 첨부 이미지는 메뉴 항목의 참고 자료이며 모바일 동작 증거로 사용하지 않았다.

| 재현 | 확인할 결과 | 이번 상태 |
| --- | --- | --- |
| 메뉴 선택·Alt+4·재입력 | 축소 열기, 입력 도달 가능, 반복해도 열림 | 소스 확인 |
| ☰ 확장·헤더 ☰ 접기·닫기 | 좌표 복귀, 접기와 닫기 구분 | 소스·계약 검사 |
| 축소/확장 이동·5방향 크기 조절 | 화면 이탈 방지, 축소 유지, 저장 키 분리 | 소스·계약 검사 |
| 일반 질문·문서 쓰기 ON 질문 | 일반만 확장, 문서 쓰기는 축소와 스트리밍 유지 | 소스·계약 검사, 실제 추론 미실행 |
| 320/360/390/700/760/761px | 두 분기 경계, 모든 버튼 접근, 작업 행 넘침 확인 | 실제 UI 미검증 |
| Android Chrome·iOS Safari 키보드 | 입력/전송 표시, iframe 경계, 한글 조합, 닫은 뒤 크기 | 실기기 미검증 |
| 회전·확대·안전영역·설정 열기 | 화면 안 배치와 설정 스크롤, 문서 스크롤 영향 | 실제 UI 미검증 |
| 새로고침·시작 위치 변경·세 배치 왕복 | 설정 복원, 기존 대화/제어 보존 | 실제 UI 미검증 |

## 7. Tauri 영향과 변경 이유

기존 Alt+4의 구현 방법과 모바일 적응 조건을 재사용 가능한 문서로 남기기 위해 작성했다. 이번에는 코드 동작을 바꾸지 않았고 Viewer도 수정하지 않았다. 따라서 이번 문서 변경에 필요한 Tauri 재빌드는 없다.

향후 Viewer에 구현하면 실제 로더가 포함하는 `AI_App/aiChat/ai-chat.js`, CSS 및 필요한 연결 자산을 대상 빌드 절차에 따라 준비해야 한다. 먼저 대상 `Docs/mdpro-development/TAURI_BUILD.md`를 읽고 웹 회귀를 검증한 뒤, 빌드를 요청받았을 때 프런트엔드 준비·네이티브 빌드·설치 앱 터치/키보드 검증을 각각 기록한다. 관련 상태 ID는 `MDPRO-20261110-JENA-ALT4-DOC`이며 WebDAV의 `TAURI_BUILD_QUEUE.md`에 연결한다.

## 8. 복사해서 실행할 재명령 프롬프트

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 작업해줘.
대상 AGENTS.md와 Docs/mdpro-development/README.md를 읽고,
C:\CusorApps\Webdav_md\webdav-md\docs\mdpro-development\changes\2026-11-10-ai-jena-alt4-bottom-floating.md를 기준으로
AI Jena의 네 번째 배치인 하단 플로팅(Alt+4)을 대상 구조에 맞게 구현해줘.
기존 변경을 먼저 확인하고 전체 파일을 덮어쓰지 말아줘.
메뉴/시작 위치 설정 select/단축키/저장 복원/축소·확장·접기·닫기/이동/5방향 리사이즈를 연결하고,
문서 실시간 작성 때는 축소창을 유지해줘. 대상 모바일 viewport CSS 변수와 전체화면·Dock 기능을 보존해줘.
320~761px 경계, 일반 답변 자동 확장, 실시간 작성, 설정 스크롤, 모든 버튼 접근성을 검증하고
가능하면 Android/iOS의 키보드와 안전영역도 확인해줘. 미검증은 분리해서 기록해줘.
관련 계약 검사·구문 검사·diff 검사·웹 빌드를 실행하고 기술문서·목록·Tauri 대기 상태를 갱신해줘.
Tauri 네이티브 빌드·설치·커밋·푸시는 이번 요청에 포함하지 않아.
```
