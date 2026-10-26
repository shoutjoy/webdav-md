# 2026-10-27 AI Jena 이미지 설정 UI 정리

- 변경 ID: MDPRO-20261027-JENA-IMAGE-UI
- 원본: `C:\CusorApps\Webdav_md\webdav-md`, 대상: `C:\CusorApps\md-viewerVscode\md_viewer`
- 작성·확인: 2026-10-27 / 미커밋. 원본 문서만 작성, 대상 문서 사본·런타임 미수정.
- 상태: WebDAV 구현·웹 빌드·Edge 도킹 UI 검증. Viewer 이식·Tauri 준비·네이티브 빌드·설치 앱 검증 미실행.

## 요청과 구현

첨부 화면에서 이미지 설정 글자가 크고 입력칸이 주변 UI와 어울리지 않는 문제를 개선했다. 프리셋, 폭, 높이, 단계, CFG, 시드 6개 필드와 접기 기능, 기존 ID·이벤트·저장 로직을 보존한다. 헤더 메뉴와 전송·첨부 등 기존 컨트롤은 수정하지 않는다.

`mdpro/AI_App/aiChat/ai-chat.css` 마지막 이미지 설정 블록을 수정했다.

- `.ai-chat-panel .ai-chat-image-settings`: 청록 테두리와 짙은 남색 카드, 좌우 10px 여백, 모서리 10px. 패널의 기본 14px 폰트 상속 대신 명시적 서체·행간 사용.
- summary 11px/600, label 10px/500, 입력값 12px/400, 설명 10px. 입력칸 높이 28px, 숫자 고정폭, 2열 간격 7px × 10px. 프리셋과 시드는 전체 열 유지.
- hover 테두리와 키보드 focus-visible 외곽선을 제공한다.
- `flex: 0 0 auto; max-height: min(320px, 42dvh); overflow-y: auto`로 펼친 내용이 flex에서 제목 높이까지 축소되는 것을 방지하고 낮은 화면에서는 스크롤로 접근한다.
- `mdpro/index.html` 스타일 URL에 `&ui=compact-1` 추가. 기존 image-quality 버전을 유지하면서 브라우저 캐시를 갱신한다. 신규 의존성 없음. JS 런타임 변경 없음.

## 대상 앱 비교와 이식

| WebDAV | Viewer 실제 확인 | 차이·적응 | 상태 |
| --- | --- | --- | --- |
| `mdpro/AI_App/aiChat/ai-chat.css` 이미지 설정 블록 | `AI_App/aiChat/ai-chat.css`의 `#ai-chat-lemonade-image-settings` 블록 | Viewer는 `.ai-chat-compatible-generation-settings`, `.ai-chat-compatible-generation-grid` 사용. WebDAV 클래스 전체 복사 금지 | 미이식 |
| `mdpro/AI_App/aiChat/ai-chat.js` 기존 이미지 폼 | `AI_App/aiChat/ai-chat.js` 이미지 폼 | Viewer는 기본 open, WebDAV는 기본 접힘. 대상 독립 기본값·이벤트 보존 | 읽기 비교만 |
| `mdpro/index.html` CSS 캐시 URL | 대상 `index.html` | 대상 현재 로더 확인 후 독립 버전 갱신 | 미이식 |

## 검증

- `node --test tests/aiJenaUiContract.test.mjs`: 29개 통과.
- `node --check mdpro/AI_App/aiChat/ai-chat.js`: 통과.
- `git diff --check`: 통과.
- `npm run build`: 성공. 500kB 초과 번들 크기 안내 존재.
- Edge `http://localhost:5174/mdpro/index.html`: AI Jena 메뉴 → 이미지 크기·품질 설정 펼치기. 패널 너비 379px, 카드 clientWidth와 scrollWidth 모두 338px로 가로 넘침 없음. summary 11px, label 10px, 6개 입력 높이 28px·12px 실제 computed style 확인. 최초 300px 상한 화면에서 확인 후 설명문의 불필요한 스크롤을 줄이도록 최종 상한을 320px로 조정했다. 최종 재로딩에서는 패널 초기화가 완료되지 않아 이 상한 변경의 추가 화면 확인은 미완료다.
- 별도 서버 포트 5188 연결 실패, 5193 점유로 실행 실패. 기존 실행 중인 동일 저장소 서버 5174에서 변경된 CSS URL 로딩을 확인하여 검증했다.
- 실제 이미지 생성·편집 품질은 이번 CSS 작업 검증 범위가 아니다. shell popup, fullscreen, Alt+4, 작은 모바일·테마 전환은 실제 UI 미검증. 해당 컨트롤을 삭제·숨기는 규칙은 추가하지 않았다.

## Tauri 반영 계획

빌드 대기 ID `MDPRO-20261027-JENA-IMAGE-UI`. Viewer 고유 폼에 CSS를 적응하고 웹에서 좁은 도킹·팝업·작은 창을 확인한 뒤 프런트엔드 자산에 포함한다. Tauri 빌드 요청 시 대상 `Docs/mdpro-development/TAURI_BUILD.md`를 읽고 dist에 해당 CSS·캐시 URL이 포함되는지, 설치 앱에서 접기·모든 입력칸·키보드 포커스를 확인한다. 이번 요청에서 대상 앱 이식이나 네이티브 빌드는 실행하지 않았다.

## 다른 앱에서 다시 실행할 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 작업해줘. AGENTS.md와 C:\CusorApps\Webdav_md\webdav-md\docs\mdpro-development\changes\2026-10-27-jena-image-settings-ui.md를 읽고 AI Jena 이미지 설정 UI를 대상 고유 클래스에 맞춰 개선해줘. compatible-generation-settings/grid 구조, 기존 기본 펼침 상태·ID·저장·이벤트를 보존해줘. 제목 11px, 라벨 10px, 입력값 12px·높이 28px, 2열 그리드와 청록 카드·포커스를 적용하고 flex 축소로 내용이 사라지지 않도록 해줘. 전체 파일을 덮어쓰지 말고 CSS 캐시를 갱신해줘. 379px 도킹과 팝업·작은 창에서 모든 필드와 메뉴 접근성을 검증하고 개발 문서·목록·Tauri 대기 상태를 갱신해줘. Tauri 빌드·설치는 이번 명령에 포함하지 말고 미검증을 구분해 보고해줘.
```
