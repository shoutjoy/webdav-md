# 2026-11-25 Mermaid 개체 자동 선택 제거

- ID: `MDPRO-20261125-MERMAID-NO-AUTOSELECT`
- WebDAV `C:/CusorApps/Webdav_md/webdav-md`, 2026-11-25 미커밋 수정.
- `mdpro/js/mermaid/appearance-custom.js/refresh`가 최초 목록 생성에서 첫 개체를 강제 선택하던 코드를 제거했다. `show`는 빈 선택이면 강조하지 않고 직접 선택 안내만 표시한다. 목록 갱신과 reload에도 선택이 없으며 사용자의 명시 선택은 기존처럼 재렌더 중 유지한다.
- 다중 선택/동일 종류/XY 막대 전체/그룹 도구/개별 스타일 저장은 보존했다. 저장된 수정 스타일은 복원되지만 선택 강조는 자동 복원하지 않는다. 원문/IDB/undo/렌더 엔진은 미수정.
- index/PWA custom helper query `20261125-11`, cache `20261125-mermaid-no-selection-11` 갱신.
- 실제 Chrome `mermaidAppearanceMultiSelect.browser.cjs`에서 초기 선택0/강조0, 목록 갱신 후0, 사용자가 동일 종류/막대 전체/Ctrl 다중 선택·그룹 도구를 적용하고 저장/reload 후 강조0 확인. 기존 테스트의 예전 inline·기본 펼침 절차도 현재 기본 플로팅/접힘에 맞췄다.
- custom 구문 검사·웹 빌드·diff 공백 검사 통과. CDN 대신 기존 로컬 실제 Mermaid/marked를 제공한 Chrome 검사이며 실기기/NAS/PV/설치 앱은 미검증.
- Viewer는 선행 custom helper 이식이 필요하며 이번 상대 runtime/frontend/native/설치/Tauri는 미수정·미실행. WebDAV 기술문서/목록만 갱신한다.

재명령:
```text
C:/CusorApps/md-viewerVscode/md_viewer에서 AGENTS.md와
C:/CusorApps/Webdav_md/webdav-md/docs/mdpro-development/changes/2026-11-25-mermaid-no-default-selection.md를 읽고,
선행 custom 도구의 첫 개체 자동 선택을 제거해줘. 원래 도형 스타일과 사용자 명시 다중 선택은 유지하고
초기·목록 갱신·reload 선택0/강조0과 수동 그룹 선택·저장을 검증해줘.
문서/목록을 갱신하고 별도 요청 없이 Tauri 빌드·설치·배포하지 마.
```
