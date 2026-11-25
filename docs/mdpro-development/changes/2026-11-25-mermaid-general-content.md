# 2026-11-25 모든 도표의 텍스트·내용 추가와 Jena ME 연결

- ID: `MDPRO-20261125-MERMAID-CONTENT`
- 원본 `C:/CusorApps/Webdav_md/webdav-md`, 2026-11-25 확인, 이번 변경 미커밋.
- 상대 `C:/CusorApps/md-viewerVscode/md_viewer`: 해당 content helper 미존재 확인. 상대 소스/문서/Tauri/frontend/native/설치/배포 미수정·미실행.
- 선행: [커스텀 생성 도구](2026-11-25-mermaid-custom-tool-builder.md), [기본 접기/플로팅](2026-11-25-mermaid-panel-defaults.md), [XY 숫자 추가](2026-11-25-mermaid-custom2-value-labels.md).

## 사용자 요청과 구현 범위

커스터마이즈 2를 XY 전용 숫자 UI에서 **텍스트·내용 추가** 도구로 확장했다. 모든 도표에서 자유 텍스트/제목/설명·출처/메모 상자를 여러 개 추가하고 위치·글꼴 크기·굵기·색·정렬·줄바꿈 너비를 조절한다. 메모는 배경색/테두리색/두께/배경 알파/여백도 조절한다. 원래 노드·연결·차트 데이터는 변경하지 않고 SVG 위에 내용 레이어를 추가한다.

기존 XY 숫자 기능은 같은 영역의 `XY 막대 숫자 추가` details 안에 유지했다. custom/custom2 기본 접기, 편집 기본 플로팅도 유지한다. 새 내용은 미리보기 상태이며 **코드에 적용**해야 metadata로 문서에 저장된다. 일반 파일/NAS 저장은 기존 저장 기능이다. 새 문서 내용/레이어를 SVG/PNG에도 포함한다.

Mermaid의 실제 노드/흐름/데이터를 추가하려면 별도 `Jena ME 내용 추가 요청`과 `Jena ME에서 코드·내용 수정`을 사용한다. 현재 도표의 원문과 입력한 요청을 ME의 가져온 코드 수정 영역에 준비한다. 요청을 확인해 기존 ME의 수정 실행을 누르고 결과를 검토한 다음 `ME 수정 코드로 이 도표 교체`를 누른다. 수정 결과는 새 코드 편집기 값을 사용한다. **모델 호출이나 원문 교체를 자동 실행하지 않는다.** 새 AI 공급자·키·인증·요청 경로를 만들지 않았다.

## 실제 코드

| 경로/함수 | 변경 |
| --- | --- |
| 새 `mdpro/js/mermaid/appearance-content.js` clean | annotations 배열의 id/텍스트/유형/좌표/색/숫자/정렬 검사. 최대100개, 개당4000자, 합계20000자. HTML/CSS 실행 입력이 아님 |
| content apply | `data-mdpro-added-content` 사본 레이어 정리 후 SVG text/tspan 및 메모 rect 생성. textContent로 텍스트 삽입, 여러 줄/너비 기준 문자 줄바꿈, 인라인 스타일, bbox와 viewBox 합집합으로 잘림 완화 |
| content attach/refresh | 새 항목 추가/편집/삭제. 제목은 위쪽, 나머지는 아래쪽에 기본 배치하고 XY 좌표로 이동. 어두운 도표의 일반 글자는 밝은 색, 메모 글자는 밝은 배경에 어두운 색으로 기본화 |
| `appearance-custom2.js` clean/current/commit/apply | 기존 version1/items를 보존하고 optional annotations[] 추가. 숫자만 있던 기존 데이터는 내용 모듈 없이도 빈 annotations로 호환. annotations만 있어도 config 유지. sourceKey가 맞는 도표에서만 숫자/내용을 복원 |
| custom2 attach | 제목을 `커스터마이즈 2 · 텍스트·내용 추가`로 변경, 새 범용 폼 배치, 기존 XY 폼은 별도 접기 안에 보존 |
| `appearance-custom.js` elements | 추가 내용 레이어는 기존 개체 인덱스 목록에서 제외. 기존 custom 대상/그룹 index를 불필요하게 바꾸지 않음 |
| `appearance-source.js` | metadata의 %를 JSON Unicode escape로 저장하여 텍스트 속 Mermaid directive가 실행 구문으로 재해석되지 않도록 함. read에서 정확히 복구. replaceCode는 기존 target/validate/IDB 백업/editor replace 경계를 호출 |
| `mermaid-editor/app.js` message listener | 현재 parent만 허용하는 기존 가져오기 메시지에서 appearanceInstruction을 받으면 코드/수정 요청 채우기→AI 영역 펼치기→가져온 코드 수정 탭 선택. 진행 중 ME 요청이 있으면 이 가져오기를 거부 |
| index/ME index/PWA | content/custom/custom2/source 자산 및 ME 자식 app·iframe query를 20261125-9로 갱신, PWA cache `20261125-mermaid-content-9`. 새 content helper 포함 |

annotation 설정은 `{id,kind,text,x,y,fontSize,width,padding,borderWidth,opacity,color,fill,border,bold,align}`이다. 좌표는 SVG 단위 ±10000, 글자4~200px, 너비40~3000, 테두리0~30, 배경 알파0~1이다. metadata는 기존 custom2 안에 저장하며 새 DB/migration/localStorage/저장 루프를 추가하지 않았다.

ME 연결은 현재 iframe의 load 또는 준비된 같은 출처 DOM을 확인해 기존 `mdv-load-document-selection` 메시지를 보낸다. 현재 코드와 요청만 전달하며 기존 ME 공급자·모델·중지·검토 흐름을 재사용한다. `replaceCode`는 비어 있거나500000자를 초과하는 코드를 거부하고, 최신 문서에서 해당 wrapper/fence를 다시 찾은 뒤 구문 확인→기존 mermaid_refs 백업 transaction 완료→문서 충돌/읽기전용 검사→원자적 편집을 실행한다. 선택 도표 외의 본문을 통째로 교체하는 별도 구현은 없다.

## 검증

- Node 관련 **41/41 통과**. 새 단위 검사는 flowchart/mindmap/sequence/YAML code 원본 보존·annotation 저장/복구·% directive escape·초기화, 잘못된 색/숫자/타입/과대 텍스트/중복 ID 거부를 확인한다.
- `mermaidAppearanceContent.browser.cjs`: 실제 전체 앱 Chrome에서 Flowchart/Mindmap/Sequence/Quadrant에 여러 줄 메모 추가, 32px 조절, `<script>` 문구를 실행하지 않고 텍스트로 표시, SVG/PNG, 코드 적용→reload 복원 통과. ME iframe의 실제 코드/수정 요청/탭 준비, 사용자가 누른 코드 교체와 undo도 통과했다. 수정 결과는 테스트에서 수동 입력했으며 실제 AI 모델 생성은 실행하지 않았다.
- `mermaidAppearanceCustom2.browser.cjs`: 기존 XY 여섯 숫자의 위치/포맷·원본 값·custom 도구 공존·출력/재열기/삭제·가로 다중 계열/390px 회귀 통과. 새 XY details를 펼치는 절차로 테스트만 적응했다.
- `mermaidAppearanceDefaults.browser.cjs`: 두 영역 기본 접기·기본 플로팅·입력 보존·390px 회귀 통과.
- content/custom2/ME app 구문 검사, `npm run build`, `git diff --check` 통과. 기존 청크 크기 경고 유지.
- 증거 `artifacts/mermaid-content-20261125/{result.json,content.png}` 및 기존 custom2/defaults 증거 폴더. 로컬 실제 Mermaid와 vendor marked를 CDN 요청에 제공한 기존 검사 환경이다. 실제 CDN·실제 공급자 생성/속도·모든 도표 유형·NAS 저장·물리 모바일·PV/miniPV·Word/PDF/인쇄는 미검증.

## 한계·상대 앱·빌드

이 기능의 직접 추가 내용은 Mermaid 표준 노드 문법이 아니라 MDpro metadata와 SVG 레이어다. 다른 기본 Mermaid 앱에서 자동 재현되지 않는다. 실제 표준 Mermaid 코드 구조 추가는 Jena ME를 통해 검토하고 명시 교체하는 별도 경로다. 텍스트 줄바꿈은 문자 수/글자 크기 기준이며 전문 조판·자동 노드 회피·모든 폰트의 정밀 폭 측정을 보장하지 않는다. 원문이 바뀌어 sourceKey가 다르면 기존 내용은 잘못된 도표에 자동 적용하지 않는다.

스킬 REA의 완전한 소스 저장소 작업 경로에 따라 일반 소스 도구로 조사·구현했다. 바이너리 분석/설정 변경/진단 설치는 실행하지 않았다. Viewer에는 content helper가 없으므로 선행 custom/custom2/source/renderer를 비교한 후 새 schema/UI/레이어/ME 가져오기 경계를 함수 단위로 이식해야 한다. Viewer의 고유 native SVG/editor history/renderMeasured와 WebDAV의 호스트/CM6 경계를 통째로 덮어쓰지 않는다.

웹 소스/빌드만 반영했다. Viewer runtime/frontend/native/설치 앱/Tauri 미수정·미실행. 수식·인쇄/PDF 엔진은 변경하지 않았으며 기존 M/C/P/D 계약 전체 준수를 새로 선언하지 않는다. 동시 다른 app.js/CSS/MobileUI 작업은 이번 변경 대상이 아니다.

## 재명령

```text
C:/CusorApps/md-viewerVscode/md_viewer에서 AGENTS.md와
C:/CusorApps/Webdav_md/webdav-md/docs/mdpro-development/changes/2026-11-25-mermaid-general-content.md를 읽고,
커스터마이즈 2를 XY 전용이 아닌 범용 제목/텍스트/설명/메모 추가로 확장해줘.
기존 XY 숫자·생성 도구·다중 선택·기본 접기/플로팅을 보존하고 annotations schema 검증과
SVG 사본 레이어·코드 저장/reload·출력을 연결해줘. 임의 HTML/SVG 문자열 실행 대신 textContent를 써줘.
코드 구조 추가는 기존 Jena ME에 현재 코드와 요청을 준비한 뒤 사용자가 실행/검토/명시 교체하도록 연결해줘.
기존 IDB 백업·undo·읽기전용/원문 경합·대상 fence 보호를 재사용하고 자동 AI 호출/자동 문서 교체하지 마.
실제 네 유형 내용 추가/저장/reload/PNG·ME 준비/교체/undo·기존 XY 회귀를 검사하고 문서/목록을 갱신해줘.
별도 요청 없이 Tauri 빌드·설치·배포·커밋하지 마.
```
