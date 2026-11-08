# 2026-11-08 Mermaid·이미지 삽입 PC 다운로드

- 변경 ID: `MDPRO-20261108-IMAGE-DOWNLOAD`
- 작업 저장소: `C:\CusorApps\Webdav_md\webdav-md`, 미커밋. 작업 전 clean.
- 참조 원본: `C:\CusorApps\md-viewerVscode\md_viewer\Docs\mermaidToImage_skill.md` 및 같은 앱의 실제 대응 소스. Viewer는 읽기 비교만 수행했다.
- 상태: WebDAV 구현·실제 로컬 Chrome 검증·웹 빌드 완료. Viewer 런타임 변경, 배포, Tauri frontend/EXE/NSIS 및 설치 앱 검증 미실행.

## 요청과 완료 기준

보기의 고정형 Mermaid 도구 모음에서 PNG 오른쪽에 **DN**을 추가하여 PNG를 PC로 직접 저장한다. 기존 SVG/PNG는 이미지 삽입 창으로 전달하는 기능을 유지한다. 이미지 삽입 창의 Gallery 새창 오른쪽에 **toPC**를 추가하고 PNG(기본)/SVG/JPEG 선택 후 다운로드한다. 기존 캡쳐도구·문서내부저장·imgBB·삽입 옵션을 유지한다.

ME 코드 편집기에서 SVG/PNG 저장 및 이미지 삽입 전달은 최신 코드를 렌더링하고 글꼴 준비를 기다린다. 저장 크기는 viewBox 기준이며 화면 배율이나 스크롤로 잘라 저장하지 않는다. Markdown 및 렌더링 원본은 변경하지 않는다.

## 실제 구현과 이유

- `mdpro/js/mermaid/mermaid_render.js`: `downloadMermaidWrapperPng` → 글꼴 준비 → 기존 `exportMermaidWrapperImage(wrapper, 'png')` → download 링크. `addFixedMermaidControls`에 DN 추가 및 버튼 인자 전달. 중복 클릭 방지·finally 복구·실패 알림. 기존 개별 도표 테마 토글 보존.
- `mdpro/imageDB/image_insert.js`: `downloadImageInsertToPc` → 형식 dialog → `downloadImageInsertFile` → `convertImageInsertDownloadBlob` → Blob 다운로드. URL 필드 우선, internal://는 ImageDB 원본 Blob 사용. 동일 MIME은 재압축하지 않는다. SVG→SVG 원본 보존, 래스터→SVG는 data URL image 컨테이너이며 자동 벡터화하지 않는다. JPEG는 원본 픽셀·품질 .95·흰 배경이다. HTTP 실패 시 이전 업로드를 대신 저장하지 않고 오류 표시. 버튼과 Object URL 정리.
- `prepareImageInsertSvgForCanvas`: foreignObject가 있는 SVG는 sandbox iframe(스크립트 금지, CSP 외부 자원 금지)에서 글꼴 준비 후 라벨 위치를 측정하여 native SVG text 사본으로 변환한다. 변환 불가능한 라벨 내 이미지/svg/canvas는 오류로 처리한다. 원본을 그대로 Canvas에 그려 tainted canvas를 만드는 문제를 피한다.
- 신규 `mdpro/js/mermaid/mermaid-editor/image-export.js`: Viewer의 공용 serializer를 재사용했다. 실제 Range·역 CTM으로 줄별 위치·글꼴 크기·색·굵기를 보존한다. XMLSerializer 및 DOMParser 검사, text stroke:none, width/height/viewBox 보존. 외부 의존성 추가 없음.
- ME `app.js`: `serializeRenderedSvg`를 SVG/PNG 저장·삽입에 공유하고 `getMermaidSvgForConverter`도 연결한다. PNG 목표 8배, 최장 변 8192px 제한. WebDAV의 provider 선택·변환기 팝업·편집 UI 코드는 보존했다.
- `mdpro/index.html`: toPC 연결, helper를 image_insert.js 앞에 defer 로딩. ME 내부 index.html도 helper 선행 로딩. 부모 iframe·ME app.js·image_insert.js·renderer·CSS 쿼리와 PWA 캐시 버전 갱신.
- `mdpro/css/style.css`: 새 형식 dialog에만 라이트/다크 스타일 추가. 기존 컨트롤 숨김/제거 없음.

## 상대 앱 대응표와 차이

| Viewer 원본 | WebDAV 적용 | 차이와 상태 |
| --- | --- | --- |
| imageDB/image_insert.js 신규 다운로드 함수 | mdpro/imageDB/image_insert.js | WebDAV 별도 삽입 옵션·캡쳐도구·갤러리 코드를 보존하고 함수만 추가 |
| js/mermaid/mermaid_render.js DN | mdpro/js/mermaid/mermaid_render.js | Viewer 전체 테마 변경 대신 WebDAV 개별 블록 테마 토글 유지 |
| ME image-export.js·관련 app.js 함수 | mdpro/js/mermaid/mermaid-editor/ | export 함수만 대응 이식, WebDAV aiSelection/변환기 팝업 유지 |
| Viewer 크게보기 기능 | 이번 요청 범위에서 미이식 | 이미지 다운로드와 편집기 저장 개선만 적용 |

Viewer는 요청 기능이 이미 존재함을 실제 코드에서 확인했다. 파일 전체 덮어쓰기와 상대 앱 런타임·문서 수정은 수행하지 않았다.

## 검증과 증거

- JS 4개 구문 검사 및 `git diff --check` 통과.
- `node --test tests/mermaidViewImageInsert.test.mjs tests/mermaidImageExport.test.mjs tests/mermaidBlockTheme.test.mjs tests/imageInsertImgbbGallery.test.mjs tests/imageInsertCapture.test.mjs tests/docxMermaidExport.test.mjs`: 35/35 통과. 예전 구현/캐시 문자열에 묶인 검사와 Windows 줄바꿈 가정을 현재 serializer 계약에 맞춰 갱신했다.
- `npm run build` 성공. Vite의 500kB 청크 안내가 있으나 빌드 실패 없음.
- `tests/imageInsertDownload.browser.cjs`: 실제 전체 WebDAV mdpro를 임시 127.0.0.1 HTTP 서버와 Chrome에서 로딩했다. DN 위치·직접 PNG 1440×1368, 기존 PNG 삽입 유지, toPC 기본/세 형식, **실제 보기 SVG 버튼으로 얻은 foreignObject SVG의 PNG/JPEG 변환**, 원본 SVG 문자열·PNG 바이트·inDB 바이트·HTTP URL 바이트 보존, JPEG 흰 배경, HTTP404 오류 및 버튼 복구 확인. pageerror 0.
- `tests/meImageExport.browser.cjs`: 한글/영문/br/font size=2/classDef/투명 노드/긴 분기 예제 저장. native label 19개, 15px·13px 글꼴 보존, 라벨 가로 넘침 0, 152% 확대와 출력 크기 분리. SVG 및 PNG 2177×8192 저장 및 재열기. pageerror 0. 저장 SVG 스크린샷 육안 확인.
- 증거: `artifacts/image-insert-download-20261108/` 및 `artifacts/me-export-20261108/`의 result.json, 실제 다운로드 파일, 스크린샷.
- 초기 sandbox 브라우저는 ERR_NETWORK_ACCESS_DENIED로 실행 실패하여 허용된 로컬 브라우저 검증으로 재실행했다. 중간 테스트의 이전 아티팩트 URL 및 Viewer 전용 applyUiTheme 호출을 WebDAV에 맞게 고친 뒤 최종 두 검사 모두 성공했다.
- 수식/인쇄/PV/DOCX 출력 경로 변경 없음. Word·OS 인쇄·전체 문서 레이아웃·배포·설치 앱은 검증하지 않았다.

브라우저 재실행(Playwright 설치 경로가 다르면 환경 변수 교체):

```powershell
$env:PLAYWRIGHT_MODULE='C:/Users/USER/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core'
node tests/imageInsertDownload.browser.cjs
node tests/meImageExport.browser.cjs
```

## Tauri 반영

대기 목록 ID `MDPRO-20261108-IMAGE-DOWNLOAD`. Viewer 원본에는 대응 기능이 존재하지만 해당 웹 자산의 native 포함 여부와 설치 앱 동작은 이번에 검증하지 않았다. Tauri 빌드는 요청되지 않아 실행하지 않았다. 이후 빌드 요청 시 대상 AGENTS.md 및 Docs/mdpro-development/TAURI_BUILD.md를 읽고 helper 로딩·캐시·실제 파일 포함 여부를 점검한다.

## 재명령 프롬프트

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md, Docs/mermaidToImage_skill.md와 C:\CusorApps\Webdav_md\webdav-md\docs\mdpro-development\changes\2026-11-08-mermaid-image-download.md를 읽어줘. 기존 DN/toPC/ME 저장 구현과 이번 WebDAV 대응 코드를 함수 단위로 비교하고 차이가 있을 때만 적용해줘. 전체 파일 덮어쓰기 없이 기존 테마·공급자·삽입 기능을 보존하고 실제 foreignObject Mermaid SVG의 PNG/JPEG 저장, 원본 보존, inDB/URL/오류 복구, 한글·작은 글씨·줄바꿈·확대와 출력 분리를 검증해줘. 문서·목록·Tauri 대기를 갱신하되 배포/Tauri 빌드는 제외하고 미검증 범위를 보고해줘.
```
