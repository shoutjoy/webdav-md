# Git 병합 충돌 표시 제거

ID: MDPRO-20261116-MERGE-RESOLUTION · 소스 확인: 2026-11-16 · 미커밋

## 원인과 변경
이미 커밋된 충돌 표시가 HTML script 속성 및 JavaScript에 남아 parse5와 JS 파싱을 막았다. Git unmerged index 항목은 없었다.
- mdpro/index.html: MathJax보다 먼저 로드되는 MathRender script 속성의 충돌 제거.
- mdpro/js/math_render/math_render.js: DEFAULT_SCRIPT_URL 충돌 제거.
- mdpro/js/UI_PV/editpv.js: getPreviewPopupDocumentHtml의 MathRender.getHeadTags scriptUrl 충돌 제거.
- 세 경로 모두 캐시 버전 20261116-merge-resolution-1로 통일. Enter 줄바꿈과 괄호 안 강조의 실제 처리 코드는 유지.
- 개발 목록과 Tauri 대기 목록은 양쪽 브랜치 항목을 모두 보존.

## 검증과 제한
node --check 두 JS 파일 통과. mathRenderContract, markdownMathPlaceholders, markdownEnterBreaks, markdownBold, printMathFit, pdfMathPreservation 26개 검사 통과. git diff --check 및 npm run build 통과. 빌드의 500kB chunk 경고는 남음. 실제 브라우저 메인/PV, PDF/Word 출력은 이번 작업에서 미검증. 수식 처리 알고리즘과 출력 로직은 변경하지 않았다.

## 구조 차이와 Tauri
대상 Viewer C:/CusorApps/MDPRO/MDproViewer는 루트 index.html 및 js/를 사용하고 WebDAV는 mdpro/를 사용한다. Viewer 기존 미커밋 작업은 보존했으며 이번 수정은 WebDAV에만 적용했다. Viewer 이식/frontend/native 빌드/설치 앱 검증은 수행하지 않았다. 창/저장/UI 흐름 변경 없음.

## 재명령 프롬프트
WebDAV의 이 기록과 수식 계약을 읽고 Viewer에 동일 충돌이 있는지 먼저 검사하라. 대상 파일 전체를 복사하지 말고 충돌 표시만 제거하되 양쪽 기능을 보존하라. MathRender 로드 버전은 모든 경로를 통일하고 수식 회귀 및 빌드를 검사하라. 실제 UI 검증 여부를 별도로 보고하라.