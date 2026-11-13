# 2026-11-13 Mermaid Ref 입력 압축과 큰 미리보기

- 변경 ID: MDPRO-20261113-MERMAID-COMPACT-PREVIEW
- 원본: C:/CusorApps/WebDav-MD/webdav-md / 대상: C:/CusorApps/MDPRO/MDproViewer
- 작성: 2026-11-13, 미커밋. 대상 앱은 읽기 비교만 수행.
- 상태: WebDAV 구현·32개 검사·빌드 통과 / 실제 웹 UI 미검증 / Viewer 이식·Tauri 준비·네이티브 빌드·설치 검증 대기.

## 요청과 완료 기준

우측 Dock의 좁은 iframe(900px 이하)에서 업로드·선택·붙여넣기·이미지 크게 보기·선택 후 제거를 34px 높이 한 줄로 배치한다. 파일 입력, 드롭, 붙여넣기와 기존 ID/이벤트는 보존한다. 업로드 장식 아이콘만 좁은 화면에서 생략한다.
프롬프트는 기본 닫힌 details로 바꾸고 입력 글자를 12px로 줄인다. 이미지 → 프롬프트 → 참고 텍스트 → 가져온 코드 수정 → 실행/모델/저장/삽입 순서로 배치하며 세 입력 details는 기본 닫힘이다. 값은 지우지 않는다.
저장 기록 ×는 대비가 있는 사각형 ‘닫기’ 버튼으로 변경한다. 주 미리보기 Dark 왼쪽에 ‘크게 보기’를 추가한다.

## 실제 구현

- mdpro/js/mermaid/mermaid-editor/index.html: 프롬프트 label을 details/summary로 전환, 참고/수정 블록 이동, 닫기 문구, preview-large-btn 추가. CSS/app 캐시 revisionChat=20261113-4.
- style.css: 마지막에 한정된 900px 미디어 규칙 추가, 기존 컨트롤 삭제 없음. 닫힌 프롬프트 textarea와 접힌 참고 설명만 숨긴다. 입력 전체는 summary로 다시 접근 가능.
- app.js: openLargePreview()가 현재 SVG를 복제한 별도 1200×850 창을 동기적으로 연다. 확대/축소/Reset/닫기/DN 제공. DN은 복제 SVG와 열 때의 테마로 기존 createRenderedPngBlob → triggerDownload를 호출한다. 원본 편집/렌더링 파이프라인과 PNG 구현은 변경하지 않는다. 팝업 차단/다운로드 오류 안내 포함. 새 창은 열린 시점의 스냅샷이다.
- 신규 의존성 없음. 주 보기/PV/miniPV/DOCX/PDF 파이프라인 변경 없음.

## 상대 앱 대응과 이식 순서

대상 js/mermaid/mermaid-editor/index.html에서 동일 ID의 기존 프롬프트 label, 이미지 버튼, 저장 기록 ×를 확인했다. 대상은 기존 독립 구현이므로 index.html/app.js/style.css 전체 복사를 금지한다. 대상의 실제 CSS 순서·iframe 폭·export 함수 서명을 추가 확인한 후 details 전환과 블록 이동, scoped CSS, 팝업 함수를 선택적으로 적용한다. 대상의 AI/저장 브리지는 보존한다. 대상 런타임은 수정하지 않았으며 웹 동작 미검증.

## 검증

- node --test tests/mermaidAiCollapse.test.mjs tests/aiJenaUiContract.test.mjs: 32/32 통과.
- node --check mdpro/js/mermaid/mermaid-editor/app.js 및 mdpro/AI_App/aiChat/ai-chat.js: 통과.
- npm run build: 통과. 기존 대형 chunk 경고 있음.
- git diff --check: 통과. 최종 diff에서 기존 컨트롤 삭제/ID 변경 없음을 검토.
- 실제 브라우저: agent-browser 실행 시 사용자 홈 소켓 폴더 쓰기 권한 거부로 시작 실패. 실제 Dock 390/650/900px, 펼침/접힘, 밝은/어두운 테마, 이미지 선택 후 제거 포함 한 줄, 창 열기·줌·PNG 파일 시각 검증은 미검증. 정적 검사와 빌드를 실제 UI 증거로 간주하지 않음.

## Tauri 반영 계획

TAURI_BUILD_QUEUE.md의 동일 ID로 대기. 대상 웹 이식 후 해당 세 자산의 frontend 포함 여부와 Tauri/dist를 확인하고 설치 앱의 새 창 허용 및 DN 저장을 검증해야 한다. 빌드 요청이 없어 이번에는 Viewer 웹 이식/네이티브 빌드/설치를 실행하지 않았다. 요청 시 대상 Docs/mdpro-development/TAURI_BUILD.md를 먼저 따른다.

## 다른 앱에서 다시 실행할 명령

```text
C:/CusorApps/MDPRO/MDproViewer에서 작업해줘. AGENTS.md와 원본 C:/CusorApps/WebDav-MD/webdav-md/docs/mdpro-development/changes/2026-11-13-mermaid-ref-compact-preview.md를 읽고 Mermaid Ref 업로드 한 줄, 프롬프트 기본 접기/12px, 참고·코드 수정 위치, 저장 기록 닫기, 별도 큰 미리보기와 DN을 대상 구조에 맞춰 구현해줘. 기존 export/AI/저장 브리지와 ID를 보존하고 전체 파일을 덮어쓰지 마. 390/650/900px에서 모든 이미지 컨트롤, 세 details, 닫기, 새 창 줌과 실제 PNG를 검증하고 문서·인덱스·Tauri 대기 상태를 갱신해줘. 이번에는 Tauri 빌드하지 말고 미검증을 구분해 보고해줘.
```


## 후속 요청: 미리보기 마우스 드래그 이동 (2026-11-13)

- 사용자 요청: 도표를 마우스로 잡고 상하좌우 이동.
- app.js의 initPreviewDragPan(viewport)를 주 renderWrapper, 수정용 revisionPreviewPanel, openLargePreview의 main에 연결했다. 왼쪽 primary 포인터에서 시작 위치와 scrollLeft/Top을 저장하고 pointer capture 후 이동 차이만큼 스크롤한다. pointerup/cancel/lostpointercapture에서 상태와 capture를 해제한다. 터치는 기존 스크롤에 맡기고 버튼/링크/입력과 네이티브 스크롤바 영역은 제외한다. SVG 원본과 transform/내보내기는 변경하지 않는다.
- style.css와 새 창 style에 grab/grabbing 커서, 드래그 중 user-select:none 추가. 기존 컨트롤 숨김/삭제 없음. index.html CSS/app 캐시 revisionChat=20261113-5.
- 대상 Viewer app.js에서 renderWrapper와 initPreviewWheelZoom 연결을 읽기 확인했다. 대상은 새 팝업 함수와 수정 미리보기 컨테이너 존재 여부 및 scroll 소유자를 별도 확인해 함수만 선택 이식해야 한다. 대상 수정 없음.
- 검증: Node VM으로 실제 함수를 추출하여 XY 스크롤·capture/해제·release 후 이동 무시·오른쪽 버튼·컨트롤·스크롤바 제외·pointercancel을 실행해 통과했다. 기존 32개 계약 검사 통과. JS 구문 검사 통과. 웹 빌드 통과. git diff --check 통과. 실제 브라우저 드래그는 미검증(앞서 확인된 사용자 홈 agent-browser 소켓 디렉터리 쓰기 제한). PV/문서/내보내기 변경 없음.
- Tauri: 같은 변경 ID로 대상 웹 이식/웹 검증/frontend 준비/네이티브 빌드/설치 검증 모두 대기. 빌드 요청 없음.

후속 이식 명령:
```text
C:/CusorApps/MDPRO/MDproViewer에서 AGENTS.md와 C:/CusorApps/WebDav-MD/webdav-md/docs/mdpro-development/changes/2026-11-13-mermaid-ref-compact-preview.md의 후속 드래그 요청을 읽고 구현해줘. 대상의 실제 스크롤 컨테이너를 확인하여 initPreviewDragPan을 주/수정/별도 큰 미리보기에 선택 적용하고 grab/grabbing 커서를 추가해줘. 기존 줌·스크롤바·버튼·SVG·DN을 보존하고 마우스 해제/취소와 가로세로 이동을 실제 UI로 검증해줘. 파일 전체 복사와 Tauri 빌드는 하지 말고 문서/인덱스/빌드 대기를 갱신해줘.
```


## 후속 요청: 입력 탭과 실행 설정 접기 (2026-11-13)

- 사용자 지정: 이미지/참고 텍스트/가져온 코드 수정의 세 탭, Jena ME 실행 왼쪽 ‘설정’, AI 모델/저장 기록/문서 삽입은 설정으로만 펼친다.
- index.html: mermaid-input-tabs tablist 추가. 이미지 카드와 프롬프트를 mermaid-image-panel로 묶고 기존 참고/수정 details를 각각 tabpanel로 연결했다. 초기 이미지 탭만 표시하며 참고/수정 탭을 선택하면 해당 details를 연다. 기존 입력 노드와 모든 ID/이벤트/값은 유지한다. mermaid-settings-toggle은 실행 왼쪽에 배치하고 기존 모델 details/저장/삽입 세 컨트롤을 hidden mermaid-settings-panel로 감쌌다. 피드백/진행률/중지는 이 패널 밖에 유지한다. CSS/app 캐시 revisionChat=20261113-6.
- app.js: initMermaidInputTabs()는 각 탭의 hidden/aria-selected/tabIndex를 동기화한다. 좌우/Home/End 키로 전환하고 포커스를 이동한다. 설정 버튼은 hidden 및 aria-expanded를 동기화한다. 탭은 입력 데이터의 삭제나 생성 경로를 변경하지 않으며 이미지+참고 텍스트 함께 사용도 기존대로 유지한다.
- style.css: 선택 탭 대비, 모든 폭에서 실행 행 2열(설정/실행), 옵션과 피드백 전체 폭, hidden 우선 적용과 전체 Jena 접기 상태를 추가했다. 요청된 패널 숨김만 추가하며 기존 버튼 삭제/비활성화 없음.
- 대상 C:/CusorApps/MDPRO/MDproViewer/js/mermaid/mermaid-editor/index.html에서 기존 actions/text/revision 대응 ID를 재확인했다. 대상 독립 HTML 및 초기화에 맞춰 래퍼와 초기화만 선택 이식할 것. 원본 파일 전체 복사 금지. 대상 웹 구현/실제 검증/Tauri frontend 준비/네이티브 빌드/설치는 모두 미실행·대기.
- 검증: 실제 initMermaidInputTabs 함수를 Node VM으로 실행하여 탭 전환, details open, 키보드 포커스, 설정 양방향 토글/ARIA 통과. 기존 AI UI+Mermaid 계약 32/32 통과, 두 JS 구문 검사 및 git diff --check 통과. npm run build 통과(기존 chunk 크기 경고). 실제 브라우저 UI는 미검증이며 앞서 agent-browser 사용자 홈 소켓 쓰기 제한이 확인됨. 공급자 실행·다운로드 경로는 변경하지 않음.

추가 이식 명령:
```text
C:/CusorApps/MDPRO/MDproViewer에서 AGENTS.md와 C:/CusorApps/WebDav-MD/webdav-md/docs/mdpro-development/changes/2026-11-13-mermaid-ref-compact-preview.md의 입력 탭/설정 후속 요청을 읽고 적용해줘. 기존 ID/브리지/입력값을 보존하여 이미지·참고 텍스트·가져온 코드 수정 탭과 실행 왼쪽 설정 버튼을 만들고 AI모델·저장기록·문서삽입만 설정 패널에 기본 숨김으로 넣어줘. 피드백/중지는 항상 기존대로 접근 가능하게 하고 탭 전환/키보드/내용 보존/설정 펼침과 전체 Jena 접힘을 좁은 Dock와 전체화면에서 실제 검증해줘. 전체 파일 복사나 Tauri 빌드 없이 문서/인덱스/대기 목록을 갱신해줘.
```


## 후속 요청: 참조 이미지 독립 창과 Crop (2026-11-13)

- 변경 범위: 이미지 탭의 크게 보기만 기존 dialog 대신 실제 새 브라우저 창으로 연다. 도표의 별도 큰 미리보기는 기존대로 보존한다.
- 신규 reference-crop.js의 openMermaidReferenceCrop(image, applyImage)는 클릭 시 window.open을 동기 호출한다. 팝업 차단 시 허용 안내를 표시한다. 이미지 이름은 파일명 처리로만 사용하고 HTML에 삽입하지 않는다.
- 별도 창 컨트롤: 확대/축소, 화면 맞춤, 100%, 선택 영역 자르기, 선택 해제, 원본 복원, 참고 이미지에 적용, 닫기. 캔버스 위 pointer drag로 사각 영역을 선택한다. CSS 축척을 원본 좌표로 환산하고 역방향 드래그 및 경계 제한을 처리한다. pointer capture/up/cancel/lostcapture를 연결한다. 재로딩 중 자르기/적용을 비활성화한다.
- 선택 영역 자르기는 창 내부 작업 이미지만 변경한다. 원본 복원은 창을 열 때의 이미지를 복원한다. 적용 시 장식 없는 별도 캔버스에서 PNG blob을 만들고 20MB 제한을 검사한다. 원본 파일/문서는 수정하지 않는다. 적용 이미지는 Jena ME 분석에 사용된다.
- app.js: 이미지 크게 보기 핸들러가 새 함수를 호출하고 현재 reference 객체를 확인해 교체/제거된 이미지에 오래된 창의 결과가 적용되지 않게 한다. loadMermaidReferenceFile(file, onLoaded)의 기존 읽기/상태/썸네일 갱신 경로로 적용하며 선택 인자인 onLoaded에서 이미지 identity를 갱신한다. 기존 일반 호출은 유지한다. dialog 마크업/기존 ID도 보존하되 사용자 클릭은 새 창으로 연결한다.
- index.html: reference-crop.js?v=20261113-1을 app.js 앞에 로드. CSS/app revisionChat=20261113-7.
- 대상 Viewer app.js에서 mermaidImageLarge → referenceDialog.showModal() 대응을 읽기 확인했다. 대상 독립 파일 전체를 덮어쓰지 말고 신규 helper 로드, 클릭 핸들러, 기존 파일 로더의 완료 콜백을 대상 구조에 맞춰 선택 적용한다. 대상 런타임은 미수정.

검증:
- tests/mermaidReferenceCrop.test.mjs: 실제 helper를 VM에서 실행하여 50% 표시의 역방향 드래그(400,300 → 100,50)를 원본 crop(200,100,600,500)으로 환산, clean export PNG 파일명/타입, Crop 후 선택 해제, 원본 복원을 검증해 1/1 통과.
- 기존 UI/접기 계약 32/32 통과. app.js/reference-crop.js/ai-chat.js 구문 검사 및 git diff --check 통과. 웹 빌드 통과(기존 chunk 경고).
- 실제 브라우저에서 창 열기/사진 Crop/AI에 적용 및 OS별 팝업 정책은 미검증. 앞서 agent-browser 홈 소켓 쓰기 제한으로 실행 실패했고 자동 검사로 실제 시각 증명을 대체하지 않는다.
- 수식/PV/인쇄/PDF/도표 내보내기 변경 없음. 새 의존성 없음.

Tauri: 새 reference-crop.js도 대상 frontend 자산에 포함해야 한다. 대상 Docs/mdpro-development/TAURI_BUILD.md를 따르는 빌드 요청 전까지 웹 이식/웹 검증/frontend 준비/네이티브 빌드/설치 앱 검증 모두 대기. WebDAV 빌드만 수행했다.

다른 앱에서 실행할 명령:
```text
C:/CusorApps/MDPRO/MDproViewer에서 AGENTS.md와 C:/CusorApps/WebDav-MD/webdav-md/docs/mdpro-development/changes/2026-11-13-mermaid-ref-compact-preview.md의 참조 이미지 독립 창/Crop 항목을 읽고 적용해줘. 이미지 크게 보기만 실제 새 창으로 열고 확대/맞춤/100%/영역선택/Crop/선택해제/원본복원/참고 이미지 적용/닫기를 제공해줘. 원본 파일을 보존하고 기존 이미지 로더와 공급자 브리지를 사용하며 오래된 창이 새 이미지를 덮지 않게 해줘. 새 helper와 이벤트 변경만 선택 이식하고 전체 파일을 덮어쓰지 마. scaled/reverse/boundary Crop, 실제 사진 적용과 초기화/팝업 차단을 실제 UI로 확인하고 문서/인덱스/Tauri 대기를 갱신해줘. Tauri 빌드는 이번 요청에 포함하지 마.
```


## 후속 요청: 공급자 최상단·세 실행 버튼·삽입 활성 조건 (2026-11-13)

최종 UI는 앞의 ‘설정 패널’ 요청을 대체한다. AI 모델/공급자 연결 상태의 기존 details를 image-to-mermaid의 첫 자식으로 이동하여 Jena 전체 접힘에도 접근 가능하게 했다. 기존 설정 토글/래퍼와 JS 리스너는 현재 사용자 요청에 따라 제거했고 기존 저장 기록 버튼을 그 위치에 노출한다. 기존 history/document/generate ID·이벤트를 유지하며 하단은 저장 기록 → 문서 삽입 → Jena ME 실행의 한 행이다. 탭/이미지 Crop/드래그는 그대로 유지한다.

- index.html: 공급자 details 위치 변경, 설정 래퍼 제거, 세 버튼 순서 조정, 문서 삽입 초기 disabled와 일반 상태 초기 hidden. CSS/app 캐시 revisionChat=20261113-8.
- app.js: initMermaidInputTabs의 폐기된 설정 토글 리스너 제거. syncMermaidDocumentInsert()는 editor.value.trim()이 비어 있으면 disabled로 설정한다. 초기화, render() 진입, 직접 input에서 동기화하여 초기 샘플/불러오기/AI 렌더/직접 편집/삭제에 반응한다. insertIntoDocumentAndClose의 빈 코드 방어도 보존한다. setMermaidImageStatus는 일반 비실행 설명을 숨기며 오류 또는 실행 중 상태만 보인다. 진행률/중지/실측 결과는 기존 경로를 유지한다.
- style.css: 공급자 최상단 전체 폭, 전체 접힘에도 표시, 3버튼 grid와 disabled 대비, hidden status 규칙을 한정 추가했다. 요청된 일반 설명 이외의 기능을 숨기지 않는다.
- 대상 Viewer HTML의 기존 model/history/document ID를 읽기 재확인. 대상 자체 배치/입력 렌더 흐름에 맞춰 위치 이동 및 활성화 함수를 선택 이식할 것. 원본 파일 전체 복사 금지. 대상 웹 이식·웹 검증·frontend 준비·Tauri 네이티브 빌드·설치는 미실행/대기.

검증: 기존 UI/접기/Crop 33/33 통과. 실제 syncMermaidDocumentInsert를 VM에서 빈 값·공백·유효 코드 문자열·전체 삭제로 실행해 disabled 동기화 통과. app.js/ai-chat.js 구문 검사, git diff --check, npm run build 통과(기존 chunk 크기 경고). 실제 공급자 UI 배치 및 브라우저 클릭은 미검증이며 이전 browser 소켓 권한 제한과 구분해 기록한다.

```text
C:/CusorApps/MDPRO/MDproViewer에서 AGENTS.md 및 C:/CusorApps/WebDav-MD/webdav-md/docs/mdpro-development/changes/2026-11-13-mermaid-ref-compact-preview.md의 마지막 공급자/버튼 항목을 적용해줘. AI 공급자·연결 상태를 Jena 입력 최상단으로 옮기고 전체 접힘에서도 유지해줘. 설정을 저장 기록으로 대체하고 저장 기록/문서 삽입/Jena ME 실행 한 행을 만들어줘. 일반 비실행 하단 설명은 숨기고 오류·진행·중지는 유지해줘. 아래 editor에 trim 후 코드가 있을 때만 문서 삽입을 활성화하고 초기/불러오기/AI 완료/입력/삭제를 검증해줘. 대상 독립 코드에 선택 이식하고 전체 파일 복사/Tauri 빌드 없이 문서와 대기 목록을 갱신해줘.
```


## 후속 요청: Jena 펼침 연동·공급자 한 행·로드 진행 표시 (2026-11-13)

마지막 요청이 앞의 ‘전체 접힘에도 공급자 표시’를 대체한다. ai-collapsed일 때 공급자 details는 숨기고 Jena를 펼쳤을 때 표시한다. 내부 모델 details는 초기 open=true로 열어 공급자/모델/조작/연결 표시등을 바로 노출한다. 기존 모델 details 토글 ID와 입력/새로고침/로드/이미지점검/인증을 보존한다. 좁은 창은 가로 스크롤 가능한 nowrap 한 행으로 모든 컨트롤을 유지한다. 연결 성공은 초록빛, 확인 중 주황, 실패 빨강, 미확인 회색으로 표현한다. 캐시 목록만 받은 상태는 연결 성공으로 만들지 않는다.

### 코드와 실제 진행 데이터

- task-provider-picker.js: adapter.showLoadProgress 옵션을 Mermaid에서만 켠다. 이때 짧은 연결 badge를 picker 내부에 배치하고 상세 연결 정보는 title로 보존한다. picker 아래 ai-task-load-progress에 progress와 시간/단계 라벨을 생성한다. 실행 시작 시 Date.now 기반 0.1초 간격 경과 시간을 갱신하고 성공/실패 finally에서 타이머를 정리한다. 실패 시 100%로 올리지 않는다. 다른 picker는 기존 badge 위치/로딩 UI를 유지한다.
- 실제 서버가 byte 단위 모델 적재율을 제공하지 않으므로 **단계 진행률**이다. 시작 0%, 기존 Lemonade onProgress 문자열의 상태 확인 5%, 서버 요청 15%, job running 대기 50%, health 완료 확인 90%, 성공 응답 확인 100%로 표시한다. 시간 경과로 퍼센트를 꾸미지 않는다. 단계 없는 다른 공급자는 대기 중 0%, 성공 100%이며 경과 시간은 제공한다. hover 도움말에 실제 적재율이 아님을 명시한다.
- ai-chat.js: loadTaskModel(provider,model,options)의 선택 options를 기존 loadOpenAICompatibleTaskModel로 전달한다. 다른 공급자의 적재 동작과 응답 확인은 바꾸지 않는다.
- mdpro/js/app.js: 인증된 기존 fromMermaidEditor 로드 요청에 onProgress 콜백을 연결하여 mdv-task-model-load-progress {requestId,progress} 메시지를 전송한다. picker parentLoadModel은 event.source/requestId를 검증하여 해당 진행 메시지만 받으며 최종 result 전에는 timeout/리스너를 해제하지 않는다.
- mermaid-editor/app.js: showLoadProgress:true 활성화와 초기 provider details open. style.css: 최종 접힘 우선순위, nowrap 행(기존 inline flex-wrap보다 우선), 상태등 및 progress 행. index.html: revisionChat=20261113-9, picker v=20261113-load-progress-1.

### 검증·이식·Tauri

- 기존 AI UI/Mermaid 접기/로컬 로드/공급자 목록 검사 44/44 통과. 요청에 맞게 초기 모델 details가 열리는 계약으로 기존 기억 상태 테스트를 갱신했다.
- tests/taskPickerLoadProgress.test.mjs는 실제 mount 함수를 실행해 0→5→15→50→90→100 단계/연결 상태, 실패가 50%에서 종료됨, 양 경로 interval 정리를 검증하며 1/1 통과했다.
- picker/ai-chat/app/mermaid app 구문 검사, git diff --check, npm run build 통과(기존 chunk 경고). 실제 브라우저 공급자 1행·라이브 모델 로드 시간/상태등은 미검증. 이전 agent-browser 홈 소켓 권한 제한과 구분한다. 실제 서버 byte 적재율 구현이라고 주장하지 않는다.
- 대상 C:/CusorApps/MDPRO/MDproViewer/AI_App/aiChat/task-provider-picker.js의 runModelAction/loadTaskModel 대응을 읽기 확인했다. 대상의 자체 bridge/메시지 경로와 모델 로더를 확인해 선택 옵션과 진행 중계만 적응한다. WebDAV의 mdpro/js/app.js 전체를 복사하지 않는다. 대상 웹 이식/웹 검증/frontend 준비/네이티브/설치 앱은 모두 대기. 신규 helper/프런트 자산 포함을 확인하고 빌드 요청 시 대상 Docs/mdpro-development/TAURI_BUILD.md를 따른다. 이번 빌드는 WebDAV 웹만 수행했다.

```text
C:/CusorApps/MDPRO/MDproViewer에서 AGENTS.md와 C:/CusorApps/WebDav-MD/webdav-md/docs/mdpro-development/changes/2026-11-13-mermaid-ref-compact-preview.md의 마지막 모델 로드 진행 항목을 읽고 선택 이식해줘. Jena 펼침 때만 공급자를 표시하고 공급자/모델/연결등/새로고침/로드/기존 점검/인증을 가로 한 행으로 보존해줘. 모델 로드의 실제 단계 콜백과 iframe 중계를 대상 구조에 맞게 연결하여 단계 %와 경과 시간을 표시하고 성공/실패 타이머 정리를 검증해줘. 실제 byte 적재율로 오인시키지 말고 live 연결/로드 UI도 확인해줘. 전체 파일 복사와 Tauri 빌드 없이 문서/인덱스/대기 상태를 갱신해줘.
```


## 후속 요청: 처음부터 Dock·Jena 토글 우측 (2026-11-13)

- 원인 확인: mdpro/index.html의 초기 dock 버튼 텍스트가 >>였고 applyMermaidEditorDockRight 실행 후에만 Dock/Dock 해제로 갱신됐다. openMermaidEditorModal은 모바일에만 자동 도킹을 실행했다. 이 경로에 localStorage 레이아웃 복원은 없었으므로 사용자 저장 데이터는 삭제하지 않았다.
- mdpro/js/app.js의 openMermaidEditorModal은 기존 프레임 준비 뒤 applyMermaidEditorDockRight(true)를 **모달 hidden 제거 전** 호출한다. 따라서 이전 플로팅/전체화면 inline 배치는 도킹 코드에서 초기화되고, 모달 공개 후 syncMermaidEditorDockLayout으로 실제 workspace 분할 크기를 반영한다. 데스크톱/모바일 모두 재열기 시 Dock으로 시작한다. 열린 창에서 Dock 해제/전체화면/리사이즈는 계속 쓸 수 있다.
- mdpro/index.html 초기 dock 버튼은 Dock, title/aria-pressed를 명확하게 변경하여 >> 잔여 문구를 제거했다. 부모 app 캐시 mobileMermaid=20261113-3, Mermaid iframe 및 내부 CSS/app revisionChat=20261113-10으로 갱신했다.
- style.css 최종 규칙: mermaid-ai-collapse-btn은 전체 grid 열/첫 행 우측, width:auto 및 margin-left:auto. 전체 접힘에서는 자식 모두 숨겨져 비어 있는 ai-actions 컨테이너도 숨겨 flex 공간을 차지하지 않게 했다. 펼침/접힘 양쪽 우측 토글이며 기존 버튼 ID/바인딩을 보존한다.
- 검증: 실제 openMermaidEditorModal 함수를 VM에서 390/1280px 맥락으로 실행하여 dock → show → sync 호출 순서를 확인했다. AI UI/접힘 32개 검사, app/mermaid app/ai-chat 구문 검사, git diff --check, 웹 빌드 통과. 실제 화면 최초 노출/토글 정렬은 미검증(브라우저 홈 소켓 권한 제한을 앞서 확인). 빌드만으로 실제 UI 완료를 주장하지 않는다.
- 대상 Viewer js/app.js의 실제 openMermaidEditorModal은 advancedAiFeatureFlags/frame src 전환 및 bindMermaidEditorSideResize를 사용하는 별도 경로임을 읽기 비교했다. 해당 기능을 보존하고 공개 전 도킹 호출만 선택 이식해야 한다. 대상 코드/데이터 미수정. Viewer 웹 이식/웹 검증/frontend 준비/Tauri 네이티브/설치 검증은 대기이며 이번 빌드 요청 없음.

```text
C:/CusorApps/MDPRO/MDproViewer에서 AGENTS.md와 C:/CusorApps/WebDav-MD/webdav-md/docs/mdpro-development/changes/2026-11-13-mermaid-ref-compact-preview.md의 처음부터 Dock 항목을 읽고 선택 이식해줘. 기존 advancedAiFeatureFlags/iframe src/side resize를 보존하며 모달 공개 전에 Dock 상태를 적용해 최초/재열기부터 우측 분할로 시작하게 해줘. 초기 >> 텍스트를 Dock으로 고치고 Jena 펼침/접기 버튼은 양 상태에서 우측 정렬해줘. 저장 데이터는 삭제하지 말고 데스크톱/모바일 최초 노출, Dock 해제/전체화면 후 재열기, Jena 양 상태를 실제 UI로 검증해줘. 전체 파일 복사와 Tauri 빌드 없이 문서/인덱스/대기 목록을 갱신해줘.
```


## 후속 요청: 저장 기록 네 번째 탭·문서 삽입 제거·프롬프트 실행 한 행 (2026-11-13)

현재 사용자 요청이 앞의 하단 3버튼 구성을 대체한다. 입력 탭은 이미지/참고 텍스트/가져온 코드 수정/**저장 기록** 순서다. mermaid-history-open ID를 그대로 네 번째 tab 버튼에 사용하고 history-panel을 fixed overlay에서 일반 흐름의 tabpanel로 바꿨다. 검색/목록/불러오기/삭제/닫기는 보존하며 기록 닫기 및 코드 불러오기 후 이미지 탭으로 돌아간다.

- index.html: history tab/tabpanel ARIA 연결, 기존 history 패널을 actions 앞에 배치. 하단 mermaid-document-insert는 명시 요청대로 제거. 상단 ‘코드로 문서삽입’과 SVG/PNG 삽입은 유지한다. 접이식 mermaid-prompt-input을 이미지 패널 밖의 mermaid-ai-actions 왼쪽으로 이동해 모든 탭에서 실행 오른쪽과 같은 행을 공유한다. CSS/app 및 부모 iframe 캐시 revisionChat=20261113-11.
- app.js: selectMermaidInputPanel(panelId)을 공통 선택 함수로 분리해 hidden/ARIA/tabIndex/details open을 동기화하고 history 선택 시 기존 requestMermaidHistory()를 호출한다. toggleMermaidHistory(forceOpen)은 이 함수로 기록/이미지 탭을 선택한다. 폐기된 하단 삽입 버튼용 syncMermaidDocumentInsert 및 input/render 호출은 제거한다. 저장 내용/AI/상단 삽입/렌더링 파이프라인은 보존한다.
- style.css: history-panel static/전체 폭/420px 내부 스크롤, Jena 전체 접힘에 숨김, actions 2열(프롬프트/실행). 프롬프트 기본 접기는 유지하고 펼친 텍스트 입력도 왼쪽 열에 남는다. 네 탭은 한 행을 유지한다. 기존 ID 변경 없음(하단 삽입 버튼 제거만 사용자 명시 요청).
- 대상 Viewer mermaid-editor/app.js의 toggleMermaidHistory 및 코드 불러오기 후 닫기 경로를 읽기 재확인했다. 대상 독립 탭/닫기/저장 브리지에 맞춰 공통 선택만 선택 이식하고 원본 파일 전체를 덮어쓰지 않는다. 대상 웹 이식/검증/frontend 준비/네이티브/Tauri 설치 모두 대기, 이번 빌드 요청 없음.
- 검증: UI/접힘/Crop/로드 진행 34개 검사 및 JS 구문 검사 통과. 실제 공통 선택 함수를 VM에서 실행해 네 번째 history 선택 시 조회 1회/ARIA 활성/다른 패널 숨김/이미지 복귀를 확인했다. git diff --check와 npm run build 통과(기존 chunk 경고). 실제 화면 배치/브라우저 클릭은 미검증이며 앞서 browser 소켓 쓰기 제한 확인. 빌드와 실제 UI 증거를 구분한다.

```text
C:/CusorApps/MDPRO/MDproViewer에서 AGENTS.md와 C:/CusorApps/WebDav-MD/webdav-md/docs/mdpro-development/changes/2026-11-13-mermaid-ref-compact-preview.md의 마지막 저장 기록 탭 항목을 적용해줘. 저장 기록을 가져온 코드 수정 오른쪽 네 번째 탭으로 바꾸고 조회/검색/불러오기/삭제/닫기를 보존해줘. 하단 문서 삽입만 제거하고 상단 코드로 문서삽입은 유지해줘. 접이식 프롬프트와 Jena ME 실행은 같은 행에 배치하고 입력 내용을 보존해줘. 네 탭/키보드/기록 닫기/코드 불러오기/좁은 Dock를 실제 검증하고 전체 파일 복사와 Tauri 빌드 없이 문서/인덱스/대기를 갱신해줘.
```
