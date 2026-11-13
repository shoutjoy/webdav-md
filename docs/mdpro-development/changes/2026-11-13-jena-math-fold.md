# Jena Math 이름·모델 기본 접기·연결 상태

- 변경 ID: MDPRO-20261113-MATH-FOLD
- 날짜: 2026-11-13, 미커밋. 기존 작업 트리 변경 보존.
- 원본: C:/CusorApps/WebDav-MD/webdav-md
- 대상: C:/CusorApps/MDPRO/MDproViewer (읽기 비교만 수행, 미이식)
- 상태: WebDAV 구현, 실제 브라우저 미검증. Viewer 웹/frontend/native/설치 검증 대기. 빌드 요청 없음.

## 요청과 실제 구현

`mdpro/index.html`의 메뉴·제목·접근성 이름을 Jena Math로 변경했다. 기존 ID와 이벤트는 유지한다. `img2math-ai-model`을 open 속성 없는 `details#img2math-model-settings` 안에 넣고 summary에 인공지능 모델을 표시했다. 공급자·모델 선택·수동 ID·새로고침·로드·인증 컨트롤은 펼친 영역에 보존한다. 프롬프트·실행·결과·삽입은 그대로다. 수식 파싱/렌더/출력 파이프라인은 수정하지 않았다.

`task-provider-picker.js`의 mountAITaskPicker는 기존 closest(details)의 summary에 상태 badge를 넣는 경로를 재사용한다. 해당 Math details에만 연결됨/확인 중/연결 실패/미확인 요약을 적용하고 상세 설명은 title에 남긴다. 최초 load는 Math에만 강제 조회를 사용하여 저장 목록을 연결 성공으로 간주하지 않는다. 모델 변경 시 기존 unknown 상태를 보존한다. 모델 적재·비전 인식 성공을 연결 성공과 동일시하지 않는다.

`style.css`는 disclosure·상태 색상을 추가했다. 새 숨김/클리핑 규칙 없음. HTML CSS/공유 picker 캐시 토큰 math-fold로 갱신. 이름 변경에 맞춰 기존 메뉴 검사 접근성 이름을 갱신했다.

## 대상 비교와 이식 순서

Viewer index.html에는 img2math-ai-model에 jena-table-ai-model 클래스가 추가되어 있다. AI_App/aiChat/task-provider-picker.js의 mountAITaskPicker가 존재한다. 전체 파일을 복사하지 말고 대상 클래스·브리지·선택 저장 방식을 유지하며 details와 상태 요약/최초 확인만 이식한다. 대상 런타임 동작은 미검증.

## 검증

- node --test tests/aiJenaUiContract.test.mjs 통과 (artifacts/jena-math-fold-tests.txt).
- node --check mdpro/AI_App/aiChat/ai-chat.js 및 task-provider-picker.js 통과.
- git diff --check 통과.
- npm run build 통과 (artifacts/jena-math-fold-build.txt).
- 추가 실행한 mdpro/tests/img2math-menu.test.cjs는 이전 코드용 단언 때문에 실패: getCachedGeminiModels 등 이전 모델 조회 구조를 요구한다. 이름 변경 단언은 갱신했으나 나머지 기존 실패는 미해결. 전체 검사 통과로 보고하지 않는다.
- 실제 브라우저·공급자 연결 상태 변화·OCR 생성은 미검증. 확인 항목: 기본 접힘, 펼친 뒤 모든 기존 컨트롤 접근, 연결/실패/모델 변경 상태가 접힌 summary에 표시되는지.

## Tauri 반영 계획

TAURI_BUILD_QUEUE 항목 MDPRO-20261113-MATH-FOLD. 대상 index.html/CSS/공유 picker를 개별 이식하고 웹 검증 후 frontend 준비, native 빌드와 설치 앱 검증을 별도로 진행한다. 현재 대상 자산 미수정, 빌드 미실행.

## 다른 앱에서 다시 실행할 명령

```text
C:/CusorApps/MDPRO/MDproViewer에서 AGENTS.md와 WebDAV의 docs/mdpro-development/changes/2026-11-13-jena-math-fold.md를 읽고 Jena Math 이름, 기본 접힌 인공지능 모델 설정과 접힌 상태에서도 보이는 실제 연결 상태를 이식해줘. 대상의 클래스·공급자 브리지·저장 코드를 보존하고 전체 파일을 덮어쓰지 마. 기본 접기/펼치기/모든 컨트롤/성공·실패·모델 변경을 실제 UI에서 검증하고 문서·색인·Tauri 대기를 갱신해줘. Tauri 빌드는 이번 요청에 포함하지 않아.
```
