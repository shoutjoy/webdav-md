# 2026-11-25 Mermaid 연결선 길이

- ID: `MDPRO-20261125-MERMAID-EDGE-LENGTH`
- 원본 구현: `C:/CusorApps/Webdav_md/webdav-md`, 미커밋. 확인일 2026-11-25.
- 상대: `C:/CusorApps/md-viewerVscode/md_viewer`, 읽기 비교만 수행. 상대 런타임·문서 사본·Tauri/frontend/native/설치 미수정·미실행.
- 선행: [보기 스타일 이식](2026-11-25-mermaid-view-appearance-port.md).

## 사용자 동작과 구현

보기 → ✎ → 연결선·화살표에 **연결선 길이 −/값/+** 추가. 기본 1배, 0.25배씩 0.5~5배 조절한다. 도형 사이의 진행 방향 간격을 Mermaid flowchart의 `rankSpacing = 50 * edgeLength`로 설정해 선이 길어지게 한다. TD는 수직, LR은 수평 단계 간격이 늘어난다. 전체 그래프에 적용되며 개별 연결선 선택 편집이 아니다. 실제 선 길이의 정확한 배수는 도형/경로/라벨에 따라 달라지고, 문서 너비 맞춤 시 전체 도표가 작아 보일 수 있다.

`mdpro/js/mermaid/mermaid_render.js`: 기존 edgeGroup/pair와 change 직렬 렌더 경로 재사용. configureMermaid의 flowchart 설정에 조건부 rankSpacing 병합. 초기화에서 edgeLength도 null로 해제. 기존 두께·화살촉·색·너비·방향·줌·출력 컨트롤 유지.

`mdpro/js/mermaid/appearance-source.js`: readAppearance/serialize에 edgeLength의 유한 숫자·0.5~5 범위 검증 추가. width의 padding/wrappingWidth와 rankSpacing을 병합해 표준 init 코드에 저장한다. 관리 metadata에도 저장하고 재열기에서 패널 값을 복원한다. 초기화 후 코드 적용 시 생성 설정을 제거하며 수기 설정을 유지한다. 명시 적용 전 원문 불변, inDB 백업·undo·문서 경합/읽기 전용 보호는 기존 경로 사용.

index의 appearance 자산 revision은 `20261125-2`, PWA cache는 `20261125-mermaid-appearance-2`. 새 의존성/저장 키/DB migration/AI 호출 없음. 수식·PV·내보내기 엔진 변경 없음. M/C/P/D 전체 출력 검증을 주장하지 않는다.

## 상대 앱과 이식

실제 Viewer의 renderer에는 고정 `rankSpacing: 50`이 있으며 edgeGroup에 선 두께/화살촉/색만 존재한다. appearance-source에는 edgeLength 검증·직렬화가 없다. 이식 시 renderer의 고정 50을 조건부 배율로 연결하고 pair/reset을 추가하며 source의 read/serialize/config 병합을 함께 옮겨야 한다. Viewer의 별도 editor history/renderMeasured/native SVG export를 WebDAV 파일로 덮어쓰지 않는다. 이번 상대 적용·Tauri 빌드는 요청 범위 밖이며 미실행이다.

## 검증

- 관련 Node 검사 **28/28 통과**: 표준 rankSpacing 100 생성·width 동시 보존·metadata 왕복·초기화·범위 오류 포함.
- Chrome 패널 검사: 같은 도표에서 1→2배 조절 후 실제 SVG path.getTotalLength 증가, 다시 1배로 줄이면 원래 길이 복귀. 기존 Dock/모바일/PNG 등 회귀 통과. 측정값은 `artifacts/mermaid-panel-20261125/result.json`의 edgeLength에 기록.
- Chrome 전체 앱 검사: 2배를 코드에 적용하면 rankSpacing 100 저장, reload 후 edgeLength 2 복구. 중복 둘째 도표만 적용·원문 보존·IDB 복원/삭제·undo/redo·실패 보호 회귀 통과. `artifacts/mermaid-source-20261125/` 참고.
- `node --check` renderer/source, `git diff --check`, `npm run build` 통과. 빌드의 기존 대형 청크 경고 있음.
- 브라우저는 앞 문서와 동일한 로컬 실제 Mermaid/marked를 제공했다. CDN 실연결·실제 사용자 첨부 원문·물리 터치·NAS 저장/PV/Word/PDF/설치 앱은 미검증. flowchart/graph 외 유형에서 간격 조절 지원은 보장하지 않는다.

## 다른 앱 재명령

```text
C:/CusorApps/md-viewerVscode/md_viewer에서 AGENTS.md와
C:/CusorApps/Webdav_md/webdav-md/docs/mdpro-development/changes/2026-11-25-mermaid-edge-length.md를 읽고,
기존 보기 스타일 패널의 연결선·화살표에 연결선 길이 0.5~5배 조절을 추가해줘.
renderer의 pair/change/reset과 rankSpacing=50*edgeLength, source의 범위 검증·metadata·표준 init 저장을
함수 단위로 적용해줘. 기존 너비 설정과 병합하고 원문·백업·undo·내보내기 경로를 보존해줘.
실제 SVG 경로 길이 증가/복귀와 원본 적용·reload·초기화·기존 Dock/PNG를 검사하고 문서/목록을 갱신해줘.
Tauri 빌드·설치·배포는 별도 요청이 없으면 실행하지 마.
```
