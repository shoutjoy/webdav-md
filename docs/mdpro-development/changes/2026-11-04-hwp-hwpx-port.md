# 2026-11-04 WebDAV HWP/HWPX 열기·내보내기

- ID: MDPRO-20261104-WEBDAV-HWP / 작성·확인: 2026-11-04 KST.
- 원본: `C:/CusorApps/MDPRO/MDproViewer`, 대상·이 문서: `C:/CusorApps/WebDav-MD/webdav-md`. 양쪽 미커밋 소스의 경로·함수로 식별한다. WebDAV 기준 ac78a9b, 앞선 LM FAST 작업을 보존했다.
- 참고 원본 기술문서: Viewer `Docs/mdpro-development/changes/2026-11-04-hwp-{hwpx,document-import,native-math,export-job,styles-open-modes,large-documents}.md`.
- 상태: WebDAV 구현·선별 자동 검사·실제 Chrome 열기/내보내기 검증 완료. 별도 PV 수식 로딩 검증 실패. 독립 한컴 한글·설치 앱·Tauri 빌드·배포 미실행. 전체 문서 호환성 또는 수식/인쇄 계약 완전 준수 판정 아님.

## 사용자 동작과 보존

이전에는 파일 선택기에 hwp/hwpx 확장자가 있었으나 브라우저 변환기가 없었다. 파일 선택/드롭/로컬 폴더/readFile 경로에 한글 분기를 추가했다.

- 원본 페이지 보기: same-origin iframe, Worker에서 한 쪽씩 표시. 세로/가로 및 원래 용지 크기, 쪽 이동/확대/사본 다운로드를 제공한다. 현재 Markdown을 교체하지 않는다.
- A4 편집 보기: 저장 확인 후 텍스트·제목·표·이미지를 기존 문서 보기/편집 경로로 가져온다. 수식은 표시용 그림이다. 원본 문서와 자동 페이지 수가 다를 수 있음을 선택창에 명시한다.
- 취소/Escape는 현재 문서를 유지한다. 변환은 성공한 뒤에만 `.md` 이름으로 연결하며 HWP 바이너리 파일 핸들을 새 텍스트 문서에 넘기지 않는다.
- 내보내기 주 메뉴와 fallback에 HWP/HWPX를 추가했다. 기존 MD/DOCX/MDD/ZIP/HTML/PDF/GitHub/취소를 유지한다. 제목 #~######는 개요1~6, 표·이미지·지원 TeX는 네이티브 개체로 생성한다. 손실 보고/본문 누락·중복/재열기 검사 실패는 다운로드를 막는다.
- 내보내기는 편집기와 동기화한 스냅샷으로 수행한다. dirty/원래 저장 위치를 변경하지 않는다. 진행 단계/경과시간/중지, 중복 실행 차단, 120초 작업 상한, 비동기 단계 제한과 재시도를 포함한다.

## 실제 코드와 앱별 적응

| Viewer 원본 | WebDAV 대상 | 확인된 차이·적응 |
| --- | --- | --- |
| `rHwp/` 독립 모듈·고정 JS/WASM | 신규 `mdpro/rHwp/` | 해당 디렉터리가 대상에 없음을 확인하고 독립 런타임과 라이선스/해시 manifest를 이식. 소스 tgz는 제외. 기존 앱 파일 전체 덮어쓰기 없음 |
| app.js isHwpFile/openHwpInEditor | `mdpro/js/app.js` 동일 함수 및 각 파일 진입점 | Viewer의 ensureMainDatabaseReady 대신 대상의 기존 db/ImageDB 사용. 바이너리 저장 핸들은 원본 보기로만 전달 |
| A4Pages.serialize: v1/mdpro-page | 신규 serializeImportedHwpPages | 대상은 A4Pages.serialize API가 없고 문법도 다름. 대상의 mdpro-a4:portrait, mdpro-a4-orientations, mdpro-a4-page-break 문법으로 구역 방향과 수동 경계 직렬화. 기존 a4-pages.js 전체 이식 안 함 |
| exportCurrentDocumentByChoice.hwpJob | 대상 app.js의 기존 dispatcher에 한글 분기 추가 | 대상 이미지 resolver·다운로드·저장 정책 유지. async import URL은 document.baseURI 기준 |
| extend-files / fallback 선택창 | `mdpro/js/extendFiles/extend-files.js`, app.js | 기존 항목에 HWP/HWPX만 추가, 지원 제한 안내 |
| MathRender.protectMathSegments 옵션 | `mdpro/js/math_render/math_render.js` | HWP exporter가 사용하는 preserveStructuralRows 옵션이 대상에는 없었음. matrix/aligned 환경의 행 구분자가 바로 문자 앞에 있어도 유지하도록 opt-in 부분만 이식. 기본 보기 동작 유지 |

예: A4 직렬화는 `<!-- mdpro-a4: portrait -->`와 `<!-- mdpro-a4-orientations: portrait,landscape -->` 뒤에 HTML을 배치하고 `<!-- mdpro-a4-page-break -->`로 분리한다. 원본 Viewer의 v1 헤더를 그대로 저장하면 대상은 A4로 인식하지 못한다.

신규 런타임 의존성: 로컬 `@rhwp/core 0.8.7` JS/WASM 및 KaTeX 0.16.9 MathML 파서, MIT 라이선스/고정 해시는 vendor/manifest.json 참조. 기존 global marked/JSZip을 재사용한다. 브라우저 테스트 재현을 위한 로컬 marked UMD·LICENSE는 `mdpro/vendor/marked/`에 두되 기존 앱 CDN parser 로드 정책은 변경하지 않았다.

캐시: index app/extend-files 키 `hwpSupport=20261104-1`, MathRender 자체/메인/PV 로더의 `20261104-hwp-structural-rows-1`, PWA `20261104-hwp-hwpx-1`. Vite copy-mdpro-runtime이 신규 자산도 dist/mdpro로 복사한다.

## 검증과 실제 증거

- `node --test tests/hwp-core.test.mjs tests/hwp-export-job.test.mjs tests/markdownMathPlaceholders.test.mjs tests/markdownBold.test.mjs tests/docxMermaidExport.test.mjs tests/aiJenaUiContract.test.mjs`: **69/69 통과**. 한글/표/Unicode 왕복, 입력 형식 검증, 손실 차단, 파일 진입점, matrix 행 분리 옵션, 취소/지연, 기존 수식·DOCX·UI 계약 포함.
- `node tests/hwp-smoke.browser.cjs`: 양 형식 다쪽 생성·재열기, 한글/글머리표/이모지/표/이미지/코드 보존, 실제 export dispatcher 및 미지원 수식 거부 통과.
- `node tests/hwp-modes-styles.browser.cjs`: 실제 WebDAV index 소스·버튼에서 원본/A4 선택, HWP/HWPX × 세로/가로, 혼합 구역·수동 나눔, 취소·Markdown/핸들 보호 통과. 개요1~6 스타일 ID 2~7과 반복 제목 재사용 확인. 대상 A4 파서는 테스트에서 해당 문법으로 해석하며 Viewer parse API를 가정하지 않는다.
- `node tests/hwp-math.browser.cjs`: 11개 수식 HWP/HWPX 생성 및 native 재열기·페이지 SVG 렌더 통과. 첫 실행에서는 대상 공통 파이프라인에 structuralRows 옵션이 없어 행렬이 깨졌으며, 해당 옵션 이식 후 통과했다. 양 형식 각 1쪽. 생성 파일과 PNG는 `artifacts/hwp-20261104-webdav/`, 수식 페이지와 열기 선택 화면 육안 확인.
- `node tests/hwp-export-job.browser.cjs`: 중복 클릭·진행 표시·중지·늦은 완료 다운로드 방지·이미지 단계 timeout·재시도 통과.
- `node tests/hwp-math-surfaces.browser.cjs`: 실제 main에서 계약 예제를 typeset하고 placeholder/코드/일반 괄호를 확인하는 단계 통과. PV는 격리 origin의 document.write 결과가 첫 MathRender script에서 진행하지 않아 로딩 timeout. PV 합격 증거 없음. 관련 null classList pageerror도 관찰했으며 원인을 확정하거나 정상으로 처리하지 않았다. 기존 출력 경로 전체 수정을 이 이식의 부수 작업으로 하지 않았다.
- app.js / ai-chat.js / math_render.js / editpv.js 구문, `git diff --check`, `npm run build` 통과. 기존 500KB 초과 청크 경고 유지.
- agent-browser CLI는 사용자 홈 소켓 경로 권한으로 실행 실패. 기존 Playwright Chrome 기반의 재현 가능한 테스트로 대체했다. 이는 사용자 데이터/원본 문서로 실행한 실증이 아니다.
- 신규 런타임 최대 파일 WASM 약 11.8MB로 100MB 미만. 재현 산출물은 `.gitignore`의 해당 artifacts 폴더에만 제외. 비밀정보나 새 소스 압축파일을 포함하지 않는다.

## 지원 한계와 계약 대응

원본 engine 미지원 개체·폰트·수식 레이아웃은 한컴 한글과 다를 수 있다. HWP 5.x/HWPX 지원이며 암호/손상/확장자 위장은 거부한다. 최대 입력/ZIP 해제 256MiB 및 수식 2000개 제한이 있다. Mermaid·체크 목록·지원되지 않는 TeX/HTML 등은 누락 성공 대신 명시 차단한다. A4 가져온 HTML/메타데이터와 복잡한 개체를 HWP로 다시 내보내는 것은 별도 지원 범위 검증이 필요하며 완전 왕복을 보장하지 않는다. 원본 보기에서의 사본 다운로드와 Markdown→한글 내보내기는 다른 경로다.

수식 계약 M-01~M-13 유지: HWP는 기존 공통 보호기를 호출하며 원본·코드 분리(M-01/02/05/08), 구분자/구조 보존(M-03/04/06/07), main/PV 캐시(M-09/13)를 유지한다. M-09/10 실제 PV 검증은 위 실패 때문에 미완료. M-11 DOCX/M-12 PDF 경로는 변경하지 않았다. Word 신규 export는 이번 요청에 포함하지 않는다.

인쇄/PDF 코드와 C/P/D 규칙은 변경하지 않았으며 기존 계약의 미해결 상태를 유지한다. 한글 원본 viewer는 인쇄/PDF 기능을 제공하지 않는다. HWP 수식·내용의 검사 통과를 PDF 페이지 배치·종이 출력의 증거로 사용하지 않는다.

## Tauri 및 상대 저장소

빌드 대기 ID MDPRO-20261104-WEBDAV-HWP. 실제 Viewer 경로는 `C:/CusorApps/MDPRO/MDproViewer`이며 이전 문서의 `md-viewerVscode/md_viewer`와 다르다. Viewer에 원본 HWP 구현이 이미 존재함을 읽기 확인했고 수정하지 않았다. WebDAV의 A4 문법/db 어댑터를 Viewer에 역복사하면 안 된다. Viewer 네이티브 포함 상태는 이번에 재감사하지 않았으며 대상 `Docs/mdpro-development/TAURI_BUILD.md`를 따라 별도 빌드 요청 시 확인한다. 이번 변경으로 Tauri 재빌드/설치/배포를 실행하지 않았다.

## 복사해 실행할 후속 명령

```text
C:/CusorApps/MDPRO/MDproViewer에서 AGENTS.md와 WebDAV의 docs/mdpro-development/changes/2026-11-04-hwp-hwpx-port.md 및 대상의 기존 HWP 문서들을 읽어줘. 기존 rHwp 구현을 유지하고 WebDAV의 A4 직렬화/db 코드를 덮어쓰지 마. 원본/A4 열기, 개요1~6 스타일, native 수식, 진행/중지·재시도를 대상 UI에서 검증해줘. 별도 한컴 한글에서 두 형식의 호환성을 확인하고 WebDAV PV 격리 검사 실패는 대상 성공 증거로 대체하지 마. 이식/검증 문서·목록·Tauri 대기 상태를 갱신하고, 네이티브 빌드는 명시 요청 전 실행하지 마.
```
