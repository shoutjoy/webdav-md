# Mermaid Ref 가져온 코드 수정 기본 접기

- 변경 ID: MDPRO-20261113-MERMAID-REF-FOLD
- 작성·확인: 2026-11-13, 미커밋
- 원본: C:/CusorApps/WebDav-MD/webdav-md
- 대상: C:/CusorApps/MDPRO/MDproViewer (읽기 비교만, 미이식)
- 상태: WebDAV 구현·빌드 완료, 실제 UI 미검증, Viewer 웹/프런트엔드/네이티브/설치 검증 미실행.

## 요청과 구현

Mermaid Ref의 ‘가져온 코드 수정’을 최초 로드 시 접는다. `mdpro/js/mermaid/mermaid-editor/index.html`의 `details#mermaid-code-revision`에서 `open` 속성만 제거했다. summary 클릭으로 다시 펼칠 수 있다. 별도 상태 저장이나 강제 접기 로직은 추가하지 않는다.

현재 코드 가져오기, 코드 입력, 수정 프롬프트, 실행/중지/결과 적용, 결과와 상태 영역의 ID·바인딩·기존 활성화 조건을 모두 보존했다. 렌더링/수식/출력 파이프라인과 캐시는 변경하지 않았다. 기존 다른 작업 파일은 유지했다.

## 대상별 적응

| 원본 | 대상 | 차이와 상태 |
| --- | --- | --- |
| mdpro/js/mermaid/mermaid-editor/index.html의 details#mermaid-code-revision | C:/CusorApps/MDPRO/MDproViewer/js/mermaid/mermaid-editor/index.html | 같은 ID에 open 속성 존재 확인. 해당 속성만 선택 제거 가능, 전체 파일 복사 금지. 미이식 |

## 검증

- `npm run build`: 종료 0. 기존 500 kB 초과 청크 경고 존재.
- `git diff --check`: 통과.
- diff 검토: open 속성 1개 제거만으로 모든 컨트롤 보존. CSS 숨김/클리핑 추가 없음.
- 기대 회귀: 새 로드에서 접힘, summary 클릭 시 전체 입력/버튼 노출, 다시 클릭 시 접힘. 실제 브라우저 조작은 미검증.
- AI Jena UI 및 JS는 이번 변경에서 수정하지 않아 전용 계약 검사는 미실행.

## Tauri 영향과 대기

빌드 대기 ID: MDPRO-20261113-MERMAID-REF-FOLD. Viewer 웹 자산 이식 후 프런트엔드에 포함해야 한다. 이후 빌드 요청 시 대상 `Docs/mdpro-development/TAURI_BUILD.md`를 따라 산출물의 초기 접힘과 펼침을 검증한다. 이번에는 대상 수정/빌드/설치를 실행하지 않았다.

## 다른 앱에서 다시 실행할 명령

```text
C:/CusorApps/MDPRO/MDproViewer에서 AGENTS.md와 원본 C:/CusorApps/WebDav-MD/webdav-md/docs/mdpro-development/changes/2026-11-13-mermaid-ref-revision-fold.md를 읽어줘. js/mermaid/mermaid-editor/index.html의 details#mermaid-code-revision을 기본 접힘으로 변경해줘. 초기화에서 강제 열림이 없는지 확인하고 open 속성만 선택 제거해 기존 summary, 입력, 가져오기/실행/중지/적용 버튼과 바인딩을 보존해줘. 전체 파일을 덮어쓰지 말고 새 로드의 접힘과 summary 펼침/재접힘을 검증하고 문서·목록·Tauri 대기를 갱신해줘. Tauri 빌드·설치는 이번 범위에 포함하지 말고 미검증을 구분해줘.
```
