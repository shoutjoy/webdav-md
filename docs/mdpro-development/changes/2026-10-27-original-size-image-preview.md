# 2026-10-27 이미지 원본 크기 미리보기·이동·크기 조절

- ID: MDPRO-20261027-IMAGE-PREVIEW
- 원본: `C:/CusorApps/Webdav_md/webdav-md`; 대상: `C:/CusorApps/md-viewerVscode/md_viewer`
- 작성·확인: 2026-10-27 (Asia/Seoul), 기존 변경 보존·미커밋.
- 원본 구현 및 자동 검사·웹 빌드 완료. 실제 브라우저 조작 미검증. 상대 앱 수정·문서 사본·Tauri frontend 준비·네이티브 빌드·설치 앱 검증 미실행.

## 요청과 완료 기준

업로드/생성 이미지의 크게 보기를 원본 픽셀 크기(이미지 픽셀당 CSS 1px)로 표시한다. 이전에는 팝업 폭 96vw, 이미지 폭 100%로 작은 이미지도 확대되었다. 이제 naturalWidth/naturalHeight에 테두리·여백·도구줄 공간을 더해 창을 초기 배치한다. 화면보다 큰 이미지는 원본 표시 크기를 유지하고 내부 영역을 스크롤한다. 작은 이미지의 창은 도구줄 사용을 위해 최소 폭 240px, 높이 160px이며 이미지는 늘리지 않는다. 실제 물리 픽셀은 브라우저 배율·OS DPI에 따른다.

제목줄을 드래그하면 이동하고, 상·하·좌·우 및 오른쪽 아래 모서리 5개 핸들로 창 크기를 바꾼다. 이미지 자체의 표시 배율은 창 크기 조절로 변하지 않는다. 화면 경계 여백 8px과 최소 사용 크기를 유지한다. FMA 보기·닫기·Escape 모달 종료를 보존한다.

## 실제 구현

- `mdpro/AI_App/aiChat/ai-chat.js`: `openGeneratedImagePreview`에 제목과 스크롤 viewport를 추가한다. `showModal` 후 `bindImagePreviewGeometry(dialog, actions, preview)`를 호출한다. 이미지 load 또는 이미 로드된 naturalWidth를 이용해 원본 크기로 배치한다.
- `bindImagePreviewGeometry`: `fitOriginal` → 도구줄 높이 측정 → 중앙 배치. `connect`는 pointerdown/move/up/cancel/lostpointercapture를 통해 이동 및 5방향 리사이즈를 처리한다. 버튼에서 시작한 드래그는 무시한다. 사용자가 움직인 뒤 늦게 load가 와도 위치를 초기화하지 않는다. window resize 때 창을 화면 안으로 제한하고 close 때 전역 resize 리스너를 제거한다.
- `mdpro/AI_App/aiChat/ai-chat.css`: preview를 fixed 배치·열 방향 flex로 전환하고 내부 viewport에만 스크롤을 준다. img는 width/height auto, max-width/max-height none으로 원본 크기를 유지한다. 5개 핸들에 방향별 커서·터치 동작·시각 표시를 추가했다. overflow hidden은 창 테두리/핸들 프레임에 한정되며 이미지 원본 전체는 내부 스크롤로 접근 가능하다.
- `mdpro/js/app.js`의 imageQuality 쿼리를 `20261027-2`, `mdpro/index.html` CSS v를 `20261027-image-quality-2`로 갱신. 기존 image-actions/llamacpp/reasoning 쿼리 보존. UI 계약 버전 검사 동기화. 신규 의존성 없음.
- 개발 목록의 기존 UPLOAD-ACTIONS 항목이 저장소 비교표에 잘못 들어 있던 것을 변경 목록으로 옮겼다.

## 상대 앱 대응과 이식 순서

| 원본 | 대상 실제 코드 | 확인된 차이 | 상태 |
| --- | --- | --- | --- |
| `mdpro/AI_App/aiChat/ai-chat.js`의 `openGeneratedImagePreview(image,index)` 및 geometry helper | `AI_App/aiChat/ai-chat.js`의 `openGeneratedImagePreview(image)` | 대상은 인라인 CSS로 이동·5방향 조절·방향키 이동을 이미 독립 구현. `dataUrl`/`name` 지원 및 비동기 FMA 버튼 처리 있음. 이미지 width/height 100%, object-fit contain과 fitImage scale로 창에 맞춰 축소함 | 읽기 확인·미수정 |
| preview CSS와 캐시 | 대상 인라인 스타일 및 대상 로더 | 전체 CSS/함수 교체 금지. 대상 이동·키보드·비동기 FMA를 유지하고 자연 크기/스크롤 영역만 국소 적용 | 미이식 |

대상은 먼저 현재 변경을 다시 확인한 뒤 원본 크기 요구와 fitImage 계산 차이를 조정한다. 대상의 dataUrl 입력, 이동 버튼과 키보드, FMA 비동기 성공 후 닫기를 보존한다. 동일 기능명이 있어도 이번 구현과 같은 배율 정책으로 간주하지 않는다.

## 검증

- `node --test tests/aiJenaUiContract.test.mjs tests/aiChatImagePreview.test.mjs tests/aiChatImageActions.test.mjs`: 39개 통과, 실패 0.
- 신규 preview 검사: 320×240 이미지 초기 창 338×306(모형 도구줄 48), 4096×2048 이미지의 화면 제한, 원본 크기 CSS/스크롤, 이동 경계, 버튼 드래그 제외, 늦은 load 시 배치 보존, 브라우저 창 축소, close 리스너 정리, 5방향 핸들 각각의 geometry, 최소 크기/화면 밖 확대 제한.
- `node --check mdpro/AI_App/aiChat/ai-chat.js`, `git diff --check`: 통과.
- `npm run build`: 종료 0, 성공. 500kB 초과 chunk 경고 존재.
- 실제 브라우저에서 이미지 크기·마우스/터치 드래그·모달/FMA/Escape 조작 미검증. DOM 모형 검사 결과를 실 UI 증거로 대체하지 않는다.

## Tauri 반영 계획

빌드 대기 ID: MDPRO-20261027-IMAGE-PREVIEW. 대상은 이미 이동·리사이즈가 있으므로 원본 배율/스크롤 정책 차이를 먼저 검증한다. 대상 웹 수정 후 해당 JS 및 필요 CSS/HTML 로더를 frontend 자산에 포함한다. Tauri 빌드 요청 시 대상 `Docs/mdpro-development/TAURI_BUILD.md`에 따라 dist 자산, 네이티브 빌드, 설치 앱에서 작은 이미지/화면 초과 이미지/5방향 핸들/키보드 이동/FMA 동작을 따로 확인한다. 이번에는 대상 수정·빌드를 실행하지 않았다.

## 다른 앱에서 다시 실행할 명령

```text
C:/CusorApps/md-viewerVscode/md_viewer에서 AGENTS.md와 C:/CusorApps/Webdav_md/webdav-md/docs/mdpro-development/changes/2026-10-27-original-size-image-preview.md를 읽고 크게 보기의 이미지를 원본 픽셀 크기로 표시해줘. 대상의 기존 이동·5방향 리사이즈·방향키 이동·dataUrl/name 지원·비동기 FMA를 유지하면서 fitImage 축소 계산과 img의 100% 크기를 자연 크기 및 내부 스크롤 정책으로 국소 수정해줘. 업로드/생성 이미지, 작은 이미지와 화면 초과 이미지, 5개 핸들, 이동 경계와 닫기 정리를 검증해줘. 전체 파일을 덮어쓰지 말고 이식 문서·목록·Tauri 대기 상태를 갱신해줘. Tauri 빌드는 실행하지 말고 실제 UI 미검증을 구분해서 보고해줘.
```
