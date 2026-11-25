# 2026-11-25 커스텀 개체 다중 선택·동일 종류 선택

- ID: `MDPRO-20261125-MERMAID-MULTISELECT`
- 원본: `C:/CusorApps/Webdav_md/webdav-md`, 2026-11-25 미커밋 구현.
- 선행: [사용자 생성 커스텀 도구](2026-11-25-mermaid-custom-tool-builder.md).
- WebDAV 구현/Chrome/웹 빌드 완료. Viewer 소스·문서·Tauri/frontend/native/설치 미수정·미실행.

## 사용자 동작

`커스텀 대상 개체`를 8행 다중 선택 목록으로 변경했다. Ctrl/⌘로 개별 추가/해제, Shift로 연속 선택한다. `도표에서 선택`을 켠 상태에서 Ctrl/⌘+클릭으로 선택을 누적하거나 해제하며, 일반 클릭은 하나로 교체한다. 선택 모드는 버튼으로 종료한다. 선택한 모든 개체에 외곽 표시를 하고 선택 개수를 보여준다.

- `같은 종류 선택`: 현재 선택들의 역할과 같은 개체들을 합쳐 선택한다. XY 막대는 bar-plot 안의 rect 역할로 분류해 배경 사각형·축·텍스트를 제외한다. 기타 SVG는 태그/클래스/부모 태그·클래스가 같은 종류를 사용한다. 따라서 모든 Mermaid의 의미상 같은 종류를 완벽히 인식한다는 의미는 아니다.
- `XY 막대 전체 선택`: XY 차트의 모든 bar-plot 시리즈에 속한 막대를 선택한다. 배경 rect를 포함하지 않는다.
- `선택 해제`: 모든 선택/강조를 지운다. 재렌더·목록 갱신 시 선택 목록을 보존하고 최초 초기화 때만 첫 개체를 기본 선택한다.
- 여러 개체 선택 후 `하단에 도구 추가`: 대상 그룹을 조절하는 도구 하나를 만든다. 예: 모든 막대 색 도구, 선택한 두 막대의 테두리 도구. 선택 목록을 이후 바꿔도 이미 만든 도구의 대상 그룹은 그대로다.
- 고급 직접 편집의 적용/선택 초기화도 선택 전체에 적용한다. 표시값은 첫 선택 개체 기준임을 안내한다. 도구 정의·개별 스타일은 기존 JSON/코드 적용/재열기 경로에 저장한다.

## 코드와 보존 경계

`mdpro/js/mermaid/appearance-custom.js`의 `targets`가 1~500개 대상(index/signature)을 검증한다. 중복·음수·빈 대상은 거부한다. `clean`은 기존 단일 index/signature 설정을 1개짜리 targets로 변환해 호환성을 유지하고, 첫 대상의 기존 필드도 유지한다. tool 정의는 `targets[]`, 실제 렌더 규칙은 기존처럼 개체별 rules로 저장한다. schema version은 1이며 기존 파일을 깨뜨리지 않는 추가 필드다.

`selectedAll/refresh/show`가 다중 선택을 관리하고, `kind`가 XY 막대 역할을 구분한다. builder는 선택 전체에서 속성 지원 여부를 확인한 뒤 그룹 도구를 만든다. `renderTools.set`은 모든 대상 signature와 sourceKey를 먼저 검사한 다음 전체 rules를 병합해 기존 change를 한 번 호출한다. 한 대상이라도 달라졌으면 해당 그룹 적용을 거부한다. 다른 속성·다른 개체의 rules를 지우지 않는다. 기존 원문/IDB/undo/출력 경계는 그대로다.

index의 renderer appearance query/custom helper와 PWA cache를 `20261125-6` 계열로 갱신했다. 새 npm/AI/서버 API/DB migration 없음. 기존 다른 UI 작업의 app.js/css 변경은 건드리지 않았다.

## 검증

- 관련 Node **35/35 통과**. 그룹 도구 왕복, 구버전 단일 대상 설정 수용, 중복·빈 그룹 거부를 추가했다.
- `node tests/mermaidAppearanceMultiSelect.browser.cjs`: 실제 전체 앱 Chrome에서 XY 막대 3개 동일 종류 선택·막대 전체 선택·선택 해제·Ctrl 클릭2개 선택, 3개 그룹/2개 그룹 도구 생성, 전체 빨강→두 개만 파랑 적용, 배경·텍스트 보존, JSON 대상 수 `[3,2]`, 코드 적용/reload 후 색상/도구 그룹 복원 통과.
- `node tests/mermaidAppearanceCustom.browser.cjs`: 기존 XY·한글 Sankey·flowchart 단일 선택/도구 생성/설정 왕복/출력/reload 회귀 통과.
- custom JS 구문 검사, `git diff --check`, `npm run build` 통과. 기존 대형 chunk 경고 있음.
- 증거: `artifacts/mermaid-multiselect-20261125/{result.json,app.png}`. 브라우저는 기존 로컬 실제 Mermaid/marked를 CDN 요청에 제공했다. CDN 실연결·모든 SVG 역할/모든 Mermaid 유형·물리 모바일·NAS·PV/Word/PDF/설치 앱은 미검증. 다중 목록의 실제 모바일 선택 제스처는 기기 검증 필요.

## 상대 이식과 Tauri

Viewer에는 이 작업의 custom helper/생성 도구 schema가 아직 이식되지 않았다. 먼저 앞 커스텀 도구 이식을 완료하고 custom의 targets 호환/다중 선택/그룹 일괄 적용을 함수 단위로 병합해야 한다. 원본 앱의 독립 editor/native SVG/renderMeasured를 덮어쓰지 않는다. Viewer 런타임·frontend/native/설치 앱 빌드는 요청하지 않아 실행하지 않았다. 수식·인쇄/PDF 엔진은 미수정이며 기존 계약 전체 준수 재검증을 주장하지 않는다.

## 재명령

```text
C:/CusorApps/md-viewerVscode/md_viewer에서 AGENTS.md와
C:/CusorApps/Webdav_md/webdav-md/docs/mdpro-development/changes/2026-11-25-mermaid-custom-multiselect.md를 읽고,
선행 커스텀 도구 구현을 확인한 뒤 목록/Ctrl/Shift 및 도표 Ctrl 클릭 다중 선택을 적용해줘.
같은 종류 선택과 XY 막대 전체 선택은 배경/축을 제외하고 그룹 도구는 targets 배열을 저장해줘.
기존 단일 대상 설정 호환·원문 key/signature 검증·전체 대상 검사 후 일괄 적용을 보존하고,
세 막대 전체 색/두 막대만 수정·다른 개체 보존·JSON/코드 저장/reload를 검증해줘.
기술문서/목록/Tauri 대기 상태를 갱신하되 별도 요청 없이 빌드·설치·배포·커밋하지 마.
```
