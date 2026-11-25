# 2026-11-25 수치 범위 확대와 하단 커스텀 도구 만들기

- ID: `MDPRO-20261125-MERMAID-CUSTOM-TOOLS`
- 작성·소스 확인: 2026-11-25, WebDAV 미커밋 구현.
- 원본: `C:/CusorApps/Webdav_md/webdav-md`. 상대: `C:/CusorApps/md-viewerVscode/md_viewer`.
- 선행: [유형별 조절](2026-11-25-mermaid-diagram-type-controls.md), [스타일 코드 적용](2026-11-25-mermaid-view-appearance-port.md).
- 상태: WebDAV 구현·Chrome·웹 빌드. Viewer 읽기 비교만 수행, 상대 수정·Tauri/frontend/native/설치·배포 없음.

## 사용자 요구와 최종 UX

수치 범위가 작다는 요청과, 기존에 만들어진 유형별 도구를 더 나열하는 것이 아니라 **하단에서 사용자가 새 조절 도구를 만드는 기능**이라는 사용자 정정을 반영했다. 기존 카테고리 뒤에 `커스텀 도구 만들기`를 추가한다. 처음에는 만든 도구가 없으며 사용자가 추가한 도구만 하단 카드로 표시된다.

1. 대상 개체 목록 또는 `도표에서 선택`으로 막대·점·도형·연결선·글자를 고른다. 선택 대상에 점선 외곽 표시를 한다.
2. 새 도구 이름과 속성을 정한다. 예: `첫 막대 색`→배경색, `막대 너비 도구`→개체 너비, `내 두께`→선 두께.
3. 숫자 속성은 최솟값·최댓값·증감 단위를 지정하고 `하단에 도구 추가`를 누른다.
4. 새 카드의 색상/숫자 입력, −/+ 또는 Shift+클릭 10배 증감으로 지정 개체만 조절한다.
5. `코드에 적용`하면 만든 도구 정의와 개별 수정값이 문서 metadata에 함께 저장된다. 일반 파일/NAS 저장은 기존 저장 기능을 사용한다.

도구 삭제는 조절 카드 정의를 지우며 이미 적용한 개체 스타일은 유지한다. 선택 개체 초기화는 해당 개체의 개별 수정값을 제거한다. 커스텀 전체 초기화는 도구와 개별 수정값을 모두 제거한다. 원래 저장된 설정을 문서에서도 제거하려면 다시 코드에 적용한다. `설정 JSON 만들기/불러오기`로 같은 원본 도표의 도구 정의·수정값을 보관하고 재사용할 수 있다. JSON에는 임의 selector/CSS/JavaScript를 받지 않는다.

고정 속성 체크박스 방식의 직접 편집은 `고급: 속성 직접 편집` 안으로 접어 두었다. 이 고급 폼은 도구 생성 기능의 대체물이 아니다. 사용자 요청의 주 기능은 이름·대상·속성·범위를 지정해 하단에 새 카드를 추가하는 방식이다.

## 확대 범위

기존 −/+ 사이 값을 숫자 입력으로 바꿨다. 직접 입력 및 Shift+클릭 10배 증감을 지원하며 범위를 넘는 값/빈 값은 적용하지 않는다. 숫자 입력의 step을 any로 두어 범위 안의 소수를 직접 입력할 수 있고 버튼 증감 단위는 기존 속성 단위를 유지한다.

| 공통 속성 | 새 범위 |
| --- | --- |
| 글자 | 4~200px |
| 연결선·도형 테두리 두께 | 0~100px |
| 연결선 길이 | 0.1~30배 |
| 화살촉·박스 너비 | 0.1~10배 |
| 점 크기 | 0.5~100px |
| 차트 너비·높이 | 0.2~10배 |
| 유형별 간격 | 0.1~20배 |
| 알파 | 기존 0~1 유지 |

커스텀 도구 속성은 배경색·테두리색·글자색·선 두께·불투명도·글자 크기·반지름/모서리·너비/높이·X/Y 위치·실선/파선/점선이다. 너비/높이는 사각형과 foreignObject 라벨, 반지름/모서리는 원·사각형, 위치는 rect/foreignObject/text/circle/ellipse를 지원한다. 원·타원의 X/Y는 cx/cy로 연결한다. 숫자 속성별 상한 안에서 도구 범위를 정한다(너비/높이 최대10000, 위치±10000, 모서리/반지름 최대150).

## 구현

- 새 `mdpro/js/mermaid/appearance-custom.js`: `elements`로 defs/marker/clipPath/mask/HTML 내부를 제외한 SVG 개체 목록을 생성한다. `signature`는 태그·클래스·부모 태그/클래스, `sourceKey`는 관리 블록을 제외한 원문 hash+길이다. `clean/style`이 도구·대상·속성·수치·색상·개수를 검사한다.
- `attach`는 빈 도구 만들기 폼, 도표 클릭 선택, 도구 카드 추가/조절/삭제, 선택/전체 초기화와 JSON 왕복 UI를 만든다. 도구 정의는 `{id,label,index,signature,property,min,max,step}`, 수정값은 별도의 `{index,signature,style}` 규칙이다. 최대 도구100개/규칙500개, JSON 가져오기200000자 제한.
- `apply`는 원문 key와 개체 signature가 일치하는 규칙만 선택적으로 최종 SVG에 적용한다. 원문/대상 불일치 시 다른 개체에 강제로 매핑하지 않는다. 전역 스타일→기존 화살촉/대비 보정→개별 규칙 순서여서 개별 수정이 우선한다. 큰 선·위치/치수 변경 후 원래 viewBox와 실제 bbox의 합집합으로 표시 영역을 확장한다.
- `appearance-source.js`: `ranges`를 공통 검증/패널에 공개해 UI·저장 범위를 일치시킨다. custom을 검증해 metadata 읽기/직렬화에 포함하며 flowchart의 custom만 존재하는 경우에도 관리 블록을 생성한다. `baseSource`를 공개해 반복 적용/reload에서 같은 원문 key를 얻는다.
- `mermaid_render.js`: pair 숫자 입력·Shift 증감·0 두께, 하단 custom attach, 기존 change Promise 반환, 재렌더 후 대상 목록/도구 카드 복원 연결. 미리보기만 수정하고 기존 명시 적용/IDB/undo/자동저장 경계를 재사용한다.
- 한글 Sankey에서 별도로 발견한 두 문제도 수정했다. labelMap은 canvas 부모 viewport가 아닌 가까운 wrapper에서 읽고, metadata 앞에 있는 Sankey도 유형 판별 후 기존 alias 전처리를 실행한다. `validateSource`도 실제 렌더와 같은 preprocess 경로로 parse한다. 한글 원문은 그대로 저장한다.
- index/PWA는 custom helper와 renderer/source 캐시를 갱신한다. 새 npm 의존성·AI 호출·서버 API·DB migration·새 저장 루프 없음. REA 스킬의 완전한 소스 저장소 경로에 해당하여 바이너리/설정 진단은 실행하지 않았다.

## 검증

- 관련 Node 검사 **34/34**: 확대 범위 왕복/상한 차단, custom의 flowchart/YAML 저장·초기화, 잘못된 CSS/색/숫자/대상/과대 규칙 차단 포함.
- `mermaidAppearanceCustom.browser.cjs`: 실제 전체 앱 Chrome에서 XY 막대·한글 Sankey 노드·flowchart 노드에 대해 클릭으로 대상 선택, 이름을 정해 색/숫자 도구 생성, 숫자 범위·증감5, XY의 새 너비 도구, 개별 수정/다른 개체 fill 보존, JSON 왕복/전체 초기화, SVG/PNG, 코드 적용→reload→수정값/도구 정의 복원 통과. 직접 글자64px 입력/Shift로74px 증감도 확인했다. 한글 Sankey 라벨 식비 표시도 확인했다.
- 기존 패널 Chrome: 6카테고리(기존5+custom), 글자/색/길이·화살촉·Dock/플로팅·8resize·390px·PNG 회귀 통과.
- 기존 유형별 Chrome 10종 및 전체 앱4종/source 회귀 실행. 원본 적용/IDB/undo/reload/실패·경합 보호 유지.
- 구문 검사 renderer/source/custom, `git diff --check`, `npm run build` 통과. 기존 대형 chunk 경고는 유지한다. 최종 실행 결과 및 커스텀 도구 화면: `artifacts/mermaid-custom-20261125/result.json`, `xychart-beta.png`, `sankey-beta.png`, `flowchart.png`.

브라우저는 앞 문서와 같은 로컬 실제 Mermaid 파일과 vendor marked를 CDN 요청에 제공했다. CDN 실연결 검증이 아니다. 모든 Mermaid 유형/모든 SVG 구조, 극단값 조합 전체, 물리 모바일·NAS 저장·CM6·PV/miniPV·Word/PDF/인쇄는 미검증이다. 숫자 확대는 자동으로 좋은 배치를 보장하지 않는다. 특히 개별 글자 확대는 전체 Mermaid 레이아웃을 다시 측정해 도형 크기까지 자동 조절하는 기능이 아니다.

## 제한과 이식 차이

생성 도구는 렌더된 SVG 개체에 연결되며 Markdown 데이터 값이나 Mermaid 그래프 연결을 재작성하지 않는다. 개별 규칙과 도구 정의는 MDpro metadata이므로 다른 Mermaid 앱에서 자동 편집 UI/스타일이 재현되지 않는다. 원문이 바뀌면 다른 개체를 잘못 바꾸지 않도록 재선택/도구 재생성이 필요하다. Mermaid 엔진이 DOM 구조/순서를 바꾸는 경우도 재선택이 필요할 수 있다. metadata의 sourceKey는 암호학적 문서 서명이 아니다.

Viewer의 실제 appearance-source 범위는 font8~48/stroke0.5~10/arrow0.25~3이며 custom 규칙·생성 도구 schema는 없다. 새 모듈과 renderer/source/자산 호출을 함수 단위로 이식해야 한다. Viewer 전체 파일을 WebDAV 파일로 덮어쓰지 않는다. Viewer 전용 renderMeasured/native SVG/editor history와 WebDAV의 CM6·호스트 경계는 각각 유지한다.

수식/인쇄/PDF 엔진은 변경하지 않았고 기존 M/C/P/D 계약을 유지하며 전체 준수 선언은 하지 않는다. Viewer runtime/frontend/native/설치 앱/Tauri 미수정·미실행, 이번 빌드 요청 없음. 변경 문서와 대기 목록은 WebDAV 쪽에만 기록한다.

## 재명령

```text
C:/CusorApps/md-viewerVscode/md_viewer에서 AGENTS.md와
C:/CusorApps/Webdav_md/webdav-md/docs/mdpro-development/changes/2026-11-25-mermaid-custom-tool-builder.md를 읽어줘.
도표 스타일 수치 범위를 확대하고 직접 숫자 입력/Shift 증감을 구현해줘.
기존에 만든 유형별 도구를 추가 나열하는 방식이 아니라, 패널 하단에서 대상·속성·이름·범위·증감을
사용자가 정해 새 조절 도구 카드를 만드는 기능을 이식해줘.
원문 key/개체 signature 검증·허용 속성/범위·도구/규칙 schema·JSON 왕복·metadata 재열기를 보존해줘.
원본은 명시 코드 적용까지 유지하고 기존 IDB 백업/undo/출력 변환 경계를 재사용해줘.
XY 막대/한글 Sankey/flowchart에서 생성도구·개별 색/선/너비·다른 개체 보존·저장/reload/PNG를 검증하고
문서/목록/Tauri 대기 상태를 기록해줘. 별도 요청 없이 Tauri 빌드·설치·배포·커밋하지 마.
```
