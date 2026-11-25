# 2026-11-25 Mermaid 도표 유형별 스타일 조절

- ID: `MDPRO-20261125-MERMAID-TYPE-CONTROLS`
- 원본 구현: `C:/CusorApps/Webdav_md/webdav-md`, 작성·확인 2026-11-25, 미커밋.
- 상대: `C:/CusorApps/md-viewerVscode/md_viewer`, 실제 Mermaid 소스 읽기 비교, 상대 수정·문서 사본·빌드·설치·배포 없음.
- 선행: [보기 스타일 패널](2026-11-25-mermaid-view-appearance-port.md), [연결선 길이](2026-11-25-mermaid-edge-length.md).

## 요청과 동작

이전에는 많은 조절이 flowchart 전용 선택자/config를 사용했고, 코드 적용도 flowchart/graph로 제한됐다. 첨부 화면의 Quadrant/Mindmap/Kanban/Journey와 다양한 도표에 대해 공통 스타일과 유형별 배치를 확장했다. ✎ 패널 맨 위에 해당 도표의 **도표별 조절 · 유형명**을 추가하며 기존 5개 카테고리·줌·다운로드·테마·Dock·플로팅은 보존한다.

| 유형 | 새 유형별 조절 | 연결 구현 |
| --- | --- | --- |
| Quadrant | 점 크기 1~30px, 차트 너비/높이 0.5~3배 | quadrantChart.pointRadius/chartWidth/chartHeight, 실제 .data-point circle 반지름 |
| XY chart | 차트 너비/높이 0.5~3배 | xyChart.width/height |
| Mindmap | 배치 간격 0.5~5배, 기존 박스 너비 | mindmap.padding/maxNodeWidth |
| Kanban | 열 배치 배율 0.5~5배, 기존 박스 너비 | kanban.sectionWidth=200×width×layoutSpacing. 열 너비와 배치 간격이 함께 바뀜 |
| Journey | 점 크기, 배치 간격, 기존 박스 너비 | actor 범례/작업 표시점 반지름, journey.taskMargin/width. 얼굴·눈 반지름은 바꾸지 않음 |
| Sequence | 배치 간격, 기존 박스 너비 | sequence.actorMargin/messageMargin/width |
| Timeline | 도표 여백 | timeline.padding. 작업 사이 간격을 바꾼다는 의미가 아님 |
| GitGraph | 점 크기 | circle.commit만 대상. 실제 GitGraph 회귀는 미실행 |
| Pie/ER/Class 및 기타 | 공통 글자·도형·연결선 스타일 | 렌더된 SVG/HTML 라벨과 도형/연결선 분류 후 명시 속성 적용 |

공통 속성은 글자 크기/볼드/폰트/색, 도형 배경/알파/테두리 두께/색, 연결선 두께/색이다. 종류별 렌더러가 다른 점을 반영해 텍스트에 stroke를 씌우지 않고, defs/marker/clipPath/mask는 도형 배경 변경에서 제외한다. 명시 배경색은 도표의 여러 도형 색을 동일하게 덮어쓴다. 데이터 값·노드·연결·차트 좌표 원문을 재작성하지 않는다.

기존 TD/LR·연결선 길이·화살촉 크기는 flowchart용임을 새 유형 패널에 안내한다. 기존 컨트롤을 삭제/숨김/비활성화하지 않았다. 비flowchart 모든 종류에서 모든 설정이 동등하게 작동한다는 의미는 아니다. 새 조절은 실제 해당 유형에 존재하는 구조/config에 연결한다.

## 실제 코드와 처리 순서

- 새 `mdpro/js/mermaid/appearance-types.js`: `type`은 YAML/init/관리주석을 제외한 선언으로 유형 판별. `config`는 유형별 지원 설정 생성, `css`는 측정 전 글꼴 설정, `prepare`는 렌더 사본에 명시 config 지시문 삽입, `apply`는 최종 SVG 도형/선/점/라벨 스타일을 적용한다. 외부 입력을 실행하거나 새로운 패키지를 설치하지 않는다.
- `mdpro/js/mermaid/mermaid_render.js`: configureMermaid에 source를 전달하고 유형 config/CSS 병합. 초기 렌더도 저장 appearance로 설정한다. setWrapperMermaidTheme에서 렌더 입력 사본만 prepare하고 기존 직렬 큐/run/polish/실패 복구를 재사용한다. polish에서 유형별 스타일 적용, addFixedMermaidControls에서 해당 유형의 추가 조절과 초기화 키를 연결한다.
- `mdpro/js/mermaid/appearance-source.js`: pointSize/chartWidth/chartHeight/layoutSpacing을 숫자 범위 검증 후 복구한다. 비flowchart는 style/linkStyle 문법을 억지로 생성하지 않고 관리 metadata를 저장한다. YAML이 없으면 유형 config와 글꼴 themeCSS의 표준 init도 관리 블록에 저장한다. YAML이 있으면 frontmatter 바로 뒤에 관리 주석만 삽입해 기존 YAML을 정확히 보존한다. YAML을 JSON으로 임의 변환하지 않는다.
- 코드 적용/복원은 기존 validateSource→mermaid_refs 백업 transaction 완료→MermaidAppearanceEditor의 최신 session/documentKey/content/readOnly 검사→기존 편집/undo/render/자동저장 경로를 그대로 사용한다. 비JSON 수기 init은 기존처럼 안전 적용을 거부한다. flowchart의 YAML 원본 적용 제한은 유지한다.
- `index.html`에 types helper를 추가하고 renderer/source/app appearance query를 `20261125-3`으로 갱신했다. PWA cache `20261125-mermaid-appearance-3`에 types/source 자산 반영. Vite copy-mdpro-runtime이 전체 mdpro를 dist/mdpro로 복사한다.

코드 저장 후 WebDAV에서 다시 열면 metadata로 공통 스타일도 복원한다. 다른 Mermaid 앱은 MDpro metadata를 해석하지 않으므로 모든 도형/색/알파가 동일하게 재현된다고 보장하지 않는다. YAML 없는 표준 config/글꼴 일부는 표준 Mermaid에 전달되지만, SVG 후처리와 metadata 전체의 이식성은 별개다. 일반 파일 저장/NAS 반영은 기존 저장 기능이다.

## 근거와 앱별 차이

공식 [Mermaid config schema](https://mermaid.js.org/config/schema-docs/config.html)의 유형별 구성과 실제 이 환경의 Mermaid 렌더 결과를 함께 확인했다. 최신 웹 문서와 로컬 실행 버전이 다를 수 있어 실제 버튼/DOM 검사를 기준으로 동작을 판정했다. 로컬 Mermaid의 Kanban renderer는 padding으로 열 간격을 바꾸지 않고 sectionWidth를 사용하므로 열 배치 배율로 구현했다. Timeline의 taskMargin도 실제 배치를 바꾸지 않아 padding을 사용하는 도표 여백으로 범위를 정했다.

Viewer의 `js/mermaid/appearance-source.js`는 flowchart 한정 검증·직렬화이며, renderer에는 유형별 pointSize/layoutSpacing 경계가 없다. 새 helper는 미존재(해당 경로 검색). 상대 이식은 이 helper와 renderer 호출/패널/source 검증·직렬화를 함수 단위로 병합해야 한다. Viewer의 renderMeasured/고유 editor history/native SVG export와 WebDAV의 CM6/호스트 문서 키 경로를 서로 덮어쓰지 않는다.

## 검증 결과

- 관련 Node 검사 **31/31 통과**. 새 단위 검사는 YAML/관리주석 뒤 유형 판별, generic 반복 적용/초기화 안정성·원문 정확 보존, 새 숫자 키 범위/비유한 값 보호를 검사한다.
- `tests/mermaidAppearanceTypes.browser.cjs`: 실제 Chrome에서 앱 내 샘플 **10종**(Quadrant/Mindmap/Kanban/Journey/Sequence/Pie/Timeline/XY/ER/Class)을 실제 Mermaid로 렌더했다. 공통 20px 글자·도형 색 적용, 실제 유형별 버튼을 눌렀을 때 viewBox 변경, 점 반지름9, Journey 얼굴 눈 보존, 코드 parse/관리블록 초기화, PNG 생성 통과. DOM 경계 변화는 모든 미세 배치의 시각 품질을 증명하지는 않는다.
- `tests/mermaidAppearanceTypesSource.browser.cjs`: 실제 전체 앱에서 Quadrant/Mindmap/YAML Kanban/Journey의 원본 적용·주변 문장 보존·초기화로 원본 코드 정확 복구·reload/재열기 후 22px/점 크기8 metadata 복구 및 플로팅 패널 캡처 통과.
- 기존 `mermaidAppearancePanel.browser.cjs`, `mermaidAppearanceSource.browser.cjs`: flowchart 스타일·길이·Dock/모바일/PNG·중복 대상 식별·undo/IDB 저장·복원/삭제·실패/경합 보호 회귀 통과.
- `node --check` types/source/renderer, `npm run build`, `git diff --check` 통과. 빌드의 기존 청크 크기 경고 유지.
- 증거: `artifacts/mermaid-types-20261125/result.json`, `source-result.json`, `*-app.png`. 앞 두 변경의 증거 폴더에는 기존 회귀를 다시 실행한 결과가 기록된다.

브라우저 검사는 앞 문서와 동일하게 실제 로컬 Mermaid(sha256 `217b66ef4279c33c141b4afe22effad10a91c02558dc70917be2c0981e78ed87`)와 vendor marked를 CDN 요청에 제공했다. 가짜 Mermaid 렌더러가 아니다. CDN 실연결·사용자의 정확한 원문·모든 Mermaid 유형/GitGraph·물리 모바일·CM6 직접 상호작용·NAS 저장·PV/miniPV/Word/PDF/인쇄는 미검증이다. 수식/출력 엔진 변경은 없으며 M-01~13/C/P/D 계약 전체 준수를 새로 선언하지 않는다.

## Tauri 상태와 재명령

WebDAV 소스·웹 빌드 완료. Viewer 웹 이식·frontend/native/설치 앱 검증은 대기이며 이번 요청에 Tauri 빌드는 없다. 새 helper와 renderer/source/index/PWA를 함께 반영해야 한다. Tauri/dist 직접 편집으로 대체하지 않는다.

```text
C:/CusorApps/md-viewerVscode/md_viewer에서 AGENTS.md와
C:/CusorApps/Webdav_md/webdav-md/docs/mdpro-development/changes/2026-11-25-mermaid-diagram-type-controls.md를 읽고,
Mermaid 보기 스타일을 Quadrant/Mindmap/Kanban/Journey/Sequence/Timeline/XY 등에 확장해줘.
새 appearance-types helper의 type/config/css/prepare/apply와 기존 renderer/source/패널 경계를 선택 병합하고
기존 flowchart·원본 백업/undo·렌더 직렬 큐·native SVG 변환 경로를 보존해줘.
YAML은 원문을 보존하고 metadata로 복원하며 flowchart 문법을 다른 도표에 삽입하지 마.
유형별 실제 버튼/색/글꼴/배치·PNG·원본 적용/reload/초기화와 기존 회귀를 검증하고 문서/목록을 갱신해줘.
미지원/미검증 유형과 다른 Mermaid 앱의 metadata 한계를 구분해줘.
별도 요청 없이 Tauri 빌드·설치·배포·커밋은 하지 마.
```
