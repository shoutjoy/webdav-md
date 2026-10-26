# 2026-10-27 AI Jena 얼굴 유지 위치 정리

- 변경 ID: MDPRO-20261027-JENA-FACE-LAYOUT
- 원본: `C:\CusorApps\Webdav_md\webdav-md`, 대상: `C:\CusorApps\md-viewerVscode\md_viewer`.
- 작성·확인: 2026-10-27 (Asia/Seoul). 미커밋. 문서는 원본 저장소에만 작성.
- 상태: WebDAV 구현·자동 검사·빌드 완료. 실제 브라우저 배치 미검증. Viewer 미이식, 네이티브 빌드·설치 앱 검증 미실행.

## 요청과 실제 구현

`mdpro/AI_App/aiChat/ai-chat.js`의 패널 생성 HTML에서 `대화 내용은 IndexedDB에 저장됩니다.`와 `이미지 생성 · 첫 사진이 얼굴 기준`을 삭제했다. 얼굴 유지 전용 mode-row도 제거하고, 기존 체크박스 label을 compose-actions의 `#ai-chat-img-gen` 바로 다음, 선택 가져오기 버튼 앞에 이동했다. 안내 문구와 별도 행을 줄이고 ImgG 옆에서 얼굴 유지 옵션을 조작하도록 한 사용자 요청이다.

`#ai-chat-preserve-identity`, checked 기본값, title, 공통 ai-chat-fast-toggle 클래스와 이벤트 바인딩을 유지했다. IndexedDB 저장, 얼굴 유지 상태 저장 및 이미지 생성·편집 로직은 변경하지 않았다. 신규 의존성·CSS·캐시 변경 없음. 파일 첨부·선택 가져오기·응답 모드·실시간 문서 작성·전송·중지 컨트롤을 보존했다.

### 후속 요청: 파일부터 선택 가져오기까지 한 줄

동일 날짜 후속 요청으로 `mdpro/AI_App/aiChat/ai-chat.css`도 수정했다. 기존 좁은 입력창용 6열 그리드에서 선택 가져오기가 4열을 차지하여, 새 얼굴 유지 옵션과 함께 첫 행에 들어가지 못했다. 일반 그리드는 `auto auto auto minmax(0, 1fr) auto auto auto`로 7개 도구에 맞췄다. 430px 이하 container에서는 `auto auto auto repeat(3, minmax(0, 1fr))`로 변경하고 선택 가져오기를 3열로 배치하여 첫 네 컨트롤이 같은 행을 채운다. 실시간 도구 3열·중지 1열·전송 2열은 다음 행에 유지한다. 얼굴 유지 label 높이·패딩을 도구 행에 맞추고 내부 span은 부모 색을 상속하도록 했다. 플로팅 전용 flex 규칙은 유지한다.

`tests/aiJenaUiContract.test.mjs`의 기존 반응형 계약을 새 그리드·3열 배치에 맞춰 갱신했다. 29개 검사, JS 문법 검사, diff 검사와 빌드가 다시 통과했다. 브라우저 실제 배치는 여전히 미검증이다. 대상 CSS에서 같은 430px container 규칙은 검색되지 않아 독립 레이아웃 적응이 필요하다. 상대 앱 이식 시 파일·생성·얼굴 유지·선택 가져오기를 한 줄에 배치하고 다음 행의 나머지 기능을 보존한다. 위 문단의 CSS 변경 없음은 최초 수정 시점의 상태이며, 후속 수정에는 해당하지 않는다.

## 상대 앱 대응과 이식 순서

| 원본 | 대상 실제 코드 | 차이·선행 조건 | 상태 |
| --- | --- | --- | --- |
| `mdpro/AI_App/aiChat/ai-chat.js` 패널 HTML | `AI_App/aiChat/ai-chat.js` 패널 HTML | 대상에는 저장 안내가 있고 생성 버튼 ID는 `ai-chat-image-gen`, 표기는 imgGen OFF이다. 원본 얼굴 유지 ID는 대상에서 검색되지 않았다. 얼굴 유지 기능 유무부터 확인해야 한다. | 읽기 비교만 수행·미이식 |

대상 고유 공급자·초기화·생성 버튼 상태 관리를 보존하고 전체 파일을 덮어쓰지 않는다. 얼굴 유지 기능을 먼저 대응한 후 대상 버튼 오른쪽에 배치한다.

## 검증

- `node --test tests/aiJenaUiContract.test.mjs`: 29개 통과.
- `node --check mdpro/AI_App/aiChat/ai-chat.js`: 성공.
- `git diff --check`: 성공.
- `npm run build`: 성공. 기존 500kB 초과 청크 경고 있음.
- 최종 코드 diff 확인: 요청한 두 문구·전용 행 삭제와 기존 label 이동만 수행. 숨김·클리핑 규칙 추가 없음.
- 실제 브라우저 팝업·도킹·Alt+4·좁은 화면에서의 배치 및 체크박스 클릭·새로고침 저장 복원은 미검증.

## Tauri 반영 계획

대기 목록 ID는 위 변경 ID와 같다. 대상 웹 이식 후 `Docs/mdpro-development/TAURI_BUILD.md`에 따라 프런트엔드 자산과 Tauri/dist 포함 여부를 확인하고 빌드한다. 설치 앱에서 생성 버튼 오른쪽 체크박스, 기타 도구 접근성과 상태 복원을 확인한다. 이번 요청에는 대상 이식·Tauri 빌드가 포함되지 않았다.

## 다른 앱에서 다시 실행할 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md와 C:\CusorApps\Webdav_md\webdav-md\docs\mdpro-development\changes\2026-10-27-jena-face-toggle-layout.md를 읽고 AI Jena 안내 문구 두 개를 제거하고 얼굴 유지 체크박스를 이미지 생성 버튼 오른쪽에 배치해줘. 대상의 얼굴 유지 기능 유무와 고유 ai-chat-image-gen 버튼을 먼저 확인하고 필요한 선행 기능을 구현해줘. 전체 파일 복사 없이 기존 컨트롤·저장·이벤트를 보존하고 팝업·도킹·Alt+4·좁은 화면 및 상태 복원을 검증해줘. 기술문서·목록·Tauri 대기 상태를 갱신하고 빌드·배포는 하지 말아줘.
```
