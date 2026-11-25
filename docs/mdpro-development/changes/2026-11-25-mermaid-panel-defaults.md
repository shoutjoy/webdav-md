# 2026-11-25 커스텀 도구 기본 접기·스타일 기본 플로팅

- ID: `MDPRO-20261125-MERMAID-PANEL-DEFAULTS`
- 원본: `C:/CusorApps/Webdav_md/webdav-md`, 2026-11-25 미커밋 구현.
- 대상: `C:/CusorApps/md-viewerVscode/md_viewer`. 대상 수정/Tauri/frontend/native/설치 미실행.

## 동작과 구현

보기의 ✎ 편집 버튼으로 도표 스타일을 열면 기본 플로팅으로 표시한다. `appearance-panel.js/setOpen`에서 열기 시 부착 상태라면 기존 anchor를 확인하고 기존 `float` 함수를 호출한다. Dock·도표에 붙이기·닫기·Esc·드래그·resize·입력 DOM을 유지한다. 붙인 뒤 닫고 다시 편집을 누르면 다시 플로팅으로 열린다. Popover 기반 기존 비모달 창이며 OS 창은 아니다.

`attach`에서 `.trt-mermaid-custom`와 `.trt-mermaid-custom2`의 legend를 보존하고 기존 내용 DOM을 각각 기본 닫힌 details로 감싼다. `도구 펼치기/도구 접기` summary로 열고 닫는다. 기존 생성 도구·숫자 항목·다중 선택·JSON·입력·이벤트를 삭제하거나 재생성하지 않는다. 기본값은 새 패널 생성 때 접힘이고, 사용자가 펼친 상태와 입력은 동일 패널을 닫았다 다시 열 때 유지한다. 영구 저장 키를 추가하지 않았다.

변경 파일은 `mdpro/js/mermaid/appearance-panel.js`, index/PWA의 해당 자산 query/cache revision(20261125-8)이다. 다른 동시 작업의 app.js/CSS/MobileUI/custom2 런타임은 이번 변경에서 수정하지 않았다. 원문 Markdown/IDB/editor/undo/수식·출력 엔진 변경 없음.

## 검증

- `tests/mermaidAppearanceDefaults.browser.cjs`: 실제 전체 앱 Chrome에서 편집 클릭 즉시 popover/dialog, 두 custom 섹션 기본 닫힘, 수동 펼침, 입력 후 부착→닫기→재열기 플로팅/입력 보존, 390px 경계·재열기 통과.
- 관련 Node 검사 39/39 통과. `npm run build`, `git diff --check` 통과(기존 chunk 크기 경고).
- 증거 `artifacts/mermaid-panel-defaults-20261125/result.json`, `mobile.png`.
- 로컬 실제 Mermaid/vendor marked를 CDN 요청에 제공한 기존 테스트 환경을 사용했다. CDN 실연결·물리 모바일·모든 창 조합·PV/Word/PDF/설치 앱은 미검증이다. 과거 브라우저 검사 중 기본 inline/펼친 custom을 전제로 한 절차는 새 기본값에 맞춘 수동 펼침/현재 패널 선택이 필요하다. 이번 전체 재실행 대상은 위 전용 브라우저 검사와 Node 검사다.

## 상대 앱과 재명령

Viewer의 기존 appearance-panel 부착/float 모듈이 대응점이며 WebDAV의 새 custom/custom2 클래스와 같은 모듈·호출 시점을 먼저 확인해야 한다. 전체 파일을 덮어쓰지 말고 setOpen과 내용 접기만 선택 적용한다. 상대 웹 적용·빌드·설치는 이번 요청 범위 밖이다.

```text
C:/CusorApps/md-viewerVscode/md_viewer에서 AGENTS.md와
C:/CusorApps/Webdav_md/webdav-md/docs/mdpro-development/changes/2026-11-25-mermaid-panel-defaults.md를 읽고,
도표 스타일 편집은 기본 플로팅, custom/custom2 영역은 기본 접힘으로 적용해줘.
기존 DOM/입력/이벤트/부착/Dock/드래그/resize/Esc를 유지하고 새로 열린 패널의 기본값과
부착→닫기→재열기·입력 보존·390px을 실제 앱에서 확인해줘.
문서/목록을 갱신하고 별도 요청 없이 Tauri 빌드·설치·배포·커밋하지 마.
```
