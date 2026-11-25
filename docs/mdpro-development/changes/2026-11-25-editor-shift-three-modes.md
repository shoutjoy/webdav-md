# 2026-11-25 문서 도구 모음 가로·세로·하단바 모드

- 변경 ID: `MDPRO-20261125-EDITOR-SHIFT-MODES`
- 원본 저장소: `C:\CusorApps\Webdav_md\webdav-md`
- 상대 저장소: `C:\CusorApps\md-viewerVscode\md_viewer` (읽기 비교만 실행)
- 문서 사본: 원본의 이 문서만 작성. 상대 저장소 미수정.
- 작성·최종 확인: 2026-11-25
- 상태: WebDAV 미커밋 구현·웹 빌드·로컬 Chrome 검사 완료. Viewer는 유사한 3단계 전환이 이미 있음. 이번 상대 런타임·frontend·Tauri·설치 앱 미수정/미실행.
- 증거: `tests/editorShiftOrientation.test.mjs`, `tests/editorShiftModes.browser.cjs`, `artifacts/editor-shift-inline-footer-20261125/` (최종), `artifacts/editor-shift-modes-20261125/` (초기 구현).
- 작업 시작 때 Mermaid 관련 소스·문서·스크린샷 수정이 있었으며 이번 변경에 포함된 것으로 취급하지 않는다. index/PWA/문서 목록의 기존 변경을 유지한 상태로 필요한 항목만 추가했다.

## 요청과 완료 기준

첨부된 L/C/R·긴/가/세·+P 도구 모음의 배치 전환 버튼에 하단바 모드를 추가한다. **가로 → 세로 → 하단바 → 가로**로 순환한다. 후속 요청으로 최초 기본값을 하단바로 변경했다. 저장된 mode 및 명시적인 구형 vertical:true/false 배치는 유지하고, 설정이 없거나 잘못된 값이면 footer로 시작한다. 초기 HTML도 같은 하단 슬롯 내부에 도구를 배치해 초기화 전에 플로팅으로 나타나지 않는다. `긴/가/세`는 문서 종류를 바꾸는 기존 버튼으로, 도구 모음의 배치 설정과 별개이다.

후속 요청에 따라 하단 모드는 기존 상태줄의 확대/축소 컨트롤 앞에 같은 행으로 삽입한다. 별도 행·패널·배경·그림자·문서 하단 여유를 추가하지 않으며 전환 전후 상태줄과 문서 영역 높이가 같아야 한다. 좁은 폭은 가로 스크롤로 접근한다. 하단 모드 버튼 크기는 기존 상태줄 높이에 맞춰 26×24px로 고정하고, 플로팅 모드의 크기 설정은 보존한다.

드래그 손잡이, L/C/R, 긴 문서, A4 가로, A4 세로, +P, 배치 전환의 9개 버튼과 기존 onclick을 모두 보존한다. 긴 문서에서 +P가 비활성인 기존 조건도 유지한다. 배치 변경은 문서 내용을 수정하지 않는다.

## 실제 구현

| 파일·함수 | 변경 및 이유 |
| --- | --- |
| `mdpro/js/app.js` · `initEditorShiftFloat()` | `md-editor-shift-float-v1` 객체에 `mode: horizontal / vertical / footer` 추가. mode가 없거나 잘못되면 명시적 구형 `vertical`을 해석하고, 구형 값도 없으면 footer를 사용한다. 클릭은 세 모드를 순환하며 기존 vertical 값도 갱신한다. `data-mode`, `data-orientation`, `is-horizontal`, `is-vertical`, `is-footer`, 아이콘·title·aria를 함께 갱신한다. |
| 같은 파일 · `syncEditorShiftFloatPosition()` | 초기화 → 모드 판정 → 동일 DOM을 footer slot 또는 drop-zone으로 이동 → 고정 좌표/정적 배치 적용 순서. 별도 모바일 하단 여유 높이 추가를 제거했다. 모바일에서 분리한 플로팅은 기존 확대/축소 행 위로 좌표를 제한해 하단 메뉴가 전환 버튼을 가리지 않게 한다. footer 모드에서는 저장 x/y를 덮어쓰지 않는다. ResizeObserver로 도구 모음 자체의 높이 변경도 반영한다. |
| 같은 파일 · 손잡이 pointerdown | 하단바 손잡이를 드래그하면 현재 하단 위치에서 가로 플로팅으로 분리한다. 기존 move/up/cancel 저장 흐름을 재사용한다. |
| `mdpro/index.html` | 기존 `#footer-zoom-font`의 첫 자식으로 `#editor-shift-footer-slot`을 삽입한다. 상태줄 위에 만들었던 별도 행은 제거한다. 초기 HTML의 도구 자체도 footer slot 안으로 옮기고, 초기 버튼 문구는 가로 메뉴 전환으로 변경. 기존 버튼 ID·클래스·이벤트 보존. |
| `mdpro/css/style.css` | footer slot을 flex 항목으로 삽입하고 도구 모음은 static/row/nowrap·26×24px로 제한한다. 별도 padding/border/radius/background/shadow/backdrop-filter를 제거한다. 상태줄은 한 행 가로 스크롤을 허용해 기존 컨트롤 접근성을 보존한다. 빈 슬롯은 높이를 차지하지 않는다. 선택 버튼 색상만 별도 보정한다. |
| `mdpro/MobileUI/mobile-ui.css` | 기존 도구 모음 display:none 규칙 제거. footer 자식 숨김 규칙에서 새 슬롯 제외. 모바일에서도 기존 확대/축소 행 내부에 삽입하며, 별도 고정 슬롯과 줄바꿈·추가 문서 하단 여유를 제거한다. 해당 행은 왼쪽 정렬·가로 스크롤을 사용하고 모든 컨트롤의 축소를 막는다. 기존 접기 버튼은 오른쪽 화면 가장자리에 고정해 스크롤 시 헤더 축소 버튼을 덮던 문제도 방지한다. 다른 모바일 메뉴 숨김 정책은 유지한다. |
| index·PWA | CSS `editorShiftMode=20261125-3`, MobileUI CSS `v=20261125-editor-shift-modes-2`, app의 `editorShiftOrientation=20261125-three-modes-3`, PWA `CACHE_VERSION=20261125-mermaid-custom2-7` (동시 진행된 커스터마이즈 2 캐시 갱신 포함). 기존 Mermaid query·core asset 변경은 보존한다. |

저장 복원 핵심:

```js
const mode = ['horizontal', 'vertical', 'footer'].includes(editorShiftFloatPreferences.mode)
    ? editorShiftFloatPreferences.mode
    : (editorShiftFloatPreferences.vertical === false ? 'horizontal' : editorShiftFloatPreferences.vertical === true ? 'vertical' : 'footer');
const host = document.getElementById(docked ? 'editor-shift-footer-slot' : 'drop-zone');
if (host && control.parentNode !== host) host.appendChild(control);
```

신규 런타임 의존성 없음. 인쇄・PDF・PV・miniPV・수식・문서 변환 코드는 수정하지 않았다.

## 상대 앱 대응표와 이식 순서

2026-11-25 실제 상대 소스를 읽어 비교했다. 같은 기능이 이미 있다는 사실을 이번 적용/빌드 완료로 기록하지 않는다.

| WebDAV | Viewer 실제 대응 | 차이·선행 조건 | 이번 상태 |
| --- | --- | --- | --- |
| `mdpro/js/app.js` · `initEditorShiftFloat`, `syncEditorShiftFloatPosition` | `js/app.js` · `applyEditorShiftFloatOrientation`, `setEditorShiftFloatFooter`, `toggleEditorShiftFloatOrientation`, `bindEditorShiftFloatDrag` | Viewer는 별도 orientation/dock/position 키와 `is-footer`·`is-positioned` 사용. 이미 horizontal → vertical → footer 순환. 대상 초기화는 저장값이 없으면 orientation vertical, dock=false임을 추가로 확인했으며 WebDAV의 새 footer 기본값은 미적용이다. footer에서는 손잡이 드래그를 막는다. WebDAV 객체 키나 전체 app.js로 덮어쓰지 않는다. | 읽기 비교·Viewer 미수정 |
| index의 `.editor-shift-orientation`, footer slot | `index.html`의 `.editor-shift-orientation-toggle`, `#editor-shift-footer-slot` | Viewer는 inline onclick 기반이며 WebDAV는 init의 이벤트 리스너. 버튼 클래스를 통째로 교체하면 기존 연결이 끊길 수 있다. | Viewer 기존 구조 유지 |
| style/MobileUI | `css/style.css`의 `#editor-shift-float.is-footer` 및 orientation-toggle | Viewer는 footer에서 손잡이를 숨기는 규칙과 coarse-pointer 44px 최소 크기가 있음. 이번 WebDAV는 손잡이를 유지하고 분리 드래그 제공. 모바일 경로는 대상의 실제 MobileUI 계약을 추가로 확인한 뒤 선택 반영해야 한다. | 모바일 세부 대응은 추가 확인 필요 |

상대에 추가 요청이 생기면 기존 세 모드 회귀부터 확인하고, 필요한 저장 호환·모바일 표시·분리 드래그만 대상 함수에 선택 반영한다. 상대의 저장·브리지·초기화 순서는 보존한다.

## 회귀 예제와 검증

- `node --test tests/editorShiftOrientation.test.mjs tests/a4Pages.test.mjs tests/a4Presentation.test.mjs`: **35/35 통과**. 최초 footer 및 비정상 mode의 footer 기본값도 포함한다. 모드 순환, 구형/비정상 설정 복원, x/y 보존, 기존 A4·페이지·내용 보존 회귀 포함.
- `node tests/editorShiftModes.browser.cjs`: **최종 18개 검사 통과**. Chrome headless, 실제 전체 MDpro 페이지를 로컬 임시 HTTP 서버로 제공. 1400×1000, 390×844, 320×844에서 도구 9개와 기존 상태줄의 표시 중인 확대/축소·글꼴·체크박스·접기 컨트롤의 유효 크기·가로 스크롤 후 접근 가능 위치 및 elementFromPoint로 가림 없음, 모드별 부모/방향/position, footer 새로고침 복원, 편집/보기, 밝은/어두운 테마, 모바일 xlarge, 분리 드래그, 한글 문서 원문 보존 확인. 1400/390/320px와 모바일 xlarge에서 하단 모드 전후 footer/zoom/editor/viewer 높이·본문 padding이 동일함을 직접 비교한다. 배경색 투명 및 실제 부모가 기존 footer-zoom-font임도 검사한다.
- 증거: `desktop-footer.png`, `desktop-horizontal.png`, `desktop-vertical.png`, `desktop-dark-footer.png`, `mobile-390-footer.png`, `mobile-320-footer.png`, `mobile-320-xlarge-footer.png`, `result.json`.
- 최초 브라우저 시도는 테스트 서버의 WASM MIME 누락으로 앱 준비가 완료되지 않아 시간 초과했다. MIME과 inDB 초기 설정을 실제 기존 테스트 환경에 맞춰 수정 후 통과했다. 이후 실제 모바일 숨김 규칙을 발견해 소스와 검사를 함께 수정했다. 최종 검사는 0크기 버튼도 실패로 판정한다. 후속 한 행 삽입 검사에서는 모바일 가로 플로팅이 기존 빠른 메뉴에 가려지는 실패를 발견해 좌표의 하단 한계를 수정했다. 기존 모바일 접기 버튼이 가로 스크롤 중 헤더 축소 버튼을 덮던 문제도 검사로 발견해 오른쪽 고정 위치로 보정한 뒤 최종 통과했다. 숨김이 정상인 데스크톱용 모바일 버튼은 해당 검사의 대상에서 제외한다.
- `node --check mdpro/js/app.js`, `node --check mdpro/AI_App/aiChat/ai-chat.js`, `git diff --check`: 통과. AI Jena UI 코드는 수정하지 않았다.
- 최종 소스 기준 `npm run build`: 성공. 기존 500kB 초과 chunk 안내 있음.
- CDN marked는 저장소의 vendor 파일로 대체해 검사. 외부 서비스·NAS·실제 휴대전화·터치/소프트키보드·배포 및 PWA 업그레이드 실기기 검증은 미실행. 배치 이동으로 실제 문서를 저장하거나 A4 변환하는 검증은 이번 범위 밖이며 기존 회귀 검사와 구분한다.

## Tauri 반영 계획

대기 목록 ID: `MDPRO-20261125-EDITOR-SHIFT-MODES`.

Viewer에는 기존 세 모드 기능이 있다. 이번에는 Viewer 웹 소스 이식, frontend 준비, 네이티브 빌드, 설치 앱 검증을 수행하지 않았다. 추후 선택 반영하면 `js/app.js`, `index.html`, `css/style.css`, 대상의 모바일 자산/캐시를 점검하고 해당 저장소 `Docs/mdpro-development/TAURI_BUILD.md`를 따른다. `Tauri/dist`에는 실제 선택 변경이 들어간 자산이 있는지 확인하며, 설치 앱에서 모드 순환·재시작 복원·모바일 대응·기존 페이지 버튼을 재확인한다. 문서 작성이나 WebDAV 웹 빌드는 Tauri 반영 증거가 아니다.

## 다른 앱에서 다시 실행할 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 작업해줘. AGENTS.md와
C:\CusorApps\Webdav_md\webdav-md\docs\mdpro-development\changes\2026-11-25-editor-shift-three-modes.md를 읽어줘.
Viewer의 기존 가로 → 세로 → 하단바 전환을 먼저 확인하고, 필요한 경우에만
설정이 없으면 하단바를 기본으로 시작하고 기존 명시 배치는 보존해줘. 기존 상태줄의 확대/축소 행에 동일한 9개 버튼을 한 줄 삽입하고, 별도 패널·추가 높이·문서 여유를 없애며, 작은 폭에서는 가로 스크롤을 사용하도록 수정해줘. 하단 모드 전후 footer/문서 높이·여백이 같아야 해. 필요하면
하단바 손잡이 분리 드래그를 대상의 기존 함수·저장 키에 맞춰 선택 반영해줘.
app.js/index/CSS 전체를 덮어쓰지 말고 기존 배치·문서 내용·구형 저장 복원을 보존해줘.
모드 순환·재시작 복원·320/390px·큰 버튼·양 테마·편집/보기·드래그를 검증하고,
문서와 목록·Tauri 대기 상태도 갱신해줘. 이번 명령에서는 Tauri 빌드/설치하지 말아줘.
미검증 항목과 기존 구현/새 변경을 구분해서 보고해줘.
```
