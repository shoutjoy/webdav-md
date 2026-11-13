# 참고 텍스트 버튼 축소·가져온 코드 수정 배치

- ID: MDPRO-20261113-ME-COMPACT-ACTIONS
- 날짜: 2026-11-13 / 미커밋, 기존 작업 보존
- 원본: C:/CusorApps/WebDav-MD/webdav-md
- 대상: C:/CusorApps/MDPRO/MDproViewer / 문서 사본 미작성, 대상 미수정
- 상태: 원본 구현·검사·빌드 완료. 실제 웹 화면 미검증. Viewer 웹 이식/frontend/native/설치 대기.

## 요청·구현

mdpro/js/mermaid/mermaid-editor/index.html: 참고 텍스트 summary의 `이미지 없이도 Jena ME 실행 가능 · 이미지와 함께 사용 가능` small 문구만 삭제. 기존 텍스트 붙여넣기/파일 가져오기/문서 선택 가져오기/비우기와 입력·파일 컨트롤 유지.

가져온 코드 수정의 기존 가져오기 버튼과 코드/미리보기 탭을 revision-code-pane에서 revision-toolbar로 이동했다. 전체 폭 상단 도구 행에서 가져오기는 왼쪽, 보기 탭은 오른쪽이며 좁으면 줄바꿈한다. 아래 코드/미리보기와 대화·수정 프롬프트는 기존 2열, 720px 이하 기존 1열 유지. 이벤트 ID·aria 참조·모델 호출 변경 없음. 미리보기 theme/zoom/reset/DN, 실행/중지/적용·상태 보존.

style.css: `#image-to-mermaid .mermaid-text-actions > button` 및 revision-view-tabs 버튼에 11px 글자, 4px 8px 여백, 데스크톱 최소 높이 28px/모바일 32px 적용. revision-toolbar는 grid-column:1/-1과 flex wrap을 사용한다. 선택 탭 청록 강조 유지. 코드/프롬프트 라벨 12px. 새로운 숨김/클리핑/opacity 규칙 없음. 수식·인쇄·PDF 파이프라인 변경 없음.

내부 CSS URL과 mdpro/index.html iframe의 revisionChat 캐시 20261113-13으로 갱신.

## 대상 비교·이식

대상 js/mermaid/mermaid-editor/index.html에도 동일 참고 텍스트 안내 문구가 존재함을 읽기 확인. 대상 revision DOM 대응은 추가 확인 필요. 대상의 코드 편집기·브리지·저장을 보존하며 작은 DOM 이동과 CSS만 이식한다. 전체 파일 덮어쓰기 금지.

## 검증

- node --test tests/mermaidAiCollapse.test.mjs tests/aiJenaUiContract.test.mjs: 33/33 통과 (artifacts/me-compact-actions-tests.txt).
- node --check mdpro/AI_App/aiChat/ai-chat.js 통과.
- git diff --check 통과.
- npm run build 통과 (artifacts/me-compact-actions-build.txt), 기존 큰 chunk 경고.
- HTML 변경부/기존 컨트롤 ID 보존 검토. 실제 UI 미검증: 앞선 agent-browser 소켓 디렉터리 권한 문제 미해결. 후속 확인: 390/800/1200px 버튼 크기·줄바꿈, 코드 가져오기·탭 전환·미리보기 도구·수정 대화·실행/중지/적용.

## Tauri 및 복사 명령

TAURI_BUILD_QUEUE 동일 ID. 대상 웹 이식·검증 후 frontend 자산을 반영하고 별도 요청 시 Docs/mdpro-development/TAURI_BUILD.md를 따른다. native 빌드/설치 검증 미실행, 빌드 요청 없음.

```text
C:/CusorApps/MDPRO/MDproViewer에서 AGENTS.md와 WebDAV docs/mdpro-development/changes/2026-11-13-me-compact-actions.md를 읽고 참고 텍스트 안내 문구 삭제, 버튼 축소, 가져온 코드 수정의 상단 공통 도구 행과 아래 코드·대화 배치를 대상 DOM에 맞춰 구현해줘. 전체 파일 덮어쓰기 없이 기존 ID와 모든 기능을 유지하고 390/800/1200px 실제 UI에서 가져오기·탭·수정·중지·적용을 확인해줘. 문서·색인·Tauri 대기도 갱신하되 Tauri 빌드는 포함하지 않아.
```
