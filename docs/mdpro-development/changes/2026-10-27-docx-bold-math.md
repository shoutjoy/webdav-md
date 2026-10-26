# DOCX 볼드 안 수식·특수문자 서식 보존

- 변경 ID: `MDPRO-20261027-DOCX-BOLD-MATH`
- 원본: `C:\CusorApps\Webdav_md\webdav-md` / 대상: `C:\CusorApps\md-viewerVscode\md_viewer`
- 작성·확인: 2026-10-27, 원본 미커밋. 상대 문서 사본·런타임 수정 없음.
- 상태: WebDAV 구현·32개 자동 검사·빌드·실제 DOCX ZIP/XML 검증 완료. 브라우저 메인/PV·실제 메뉴 내보내기·Word 열기 미검증. 상대 이식·Tauri 빌드·설치 검증 미실행.

## 요청과 완료 기준

`**기준: \(\text{CR} \ge .70\)**`처럼 볼드 범위에 수식이 있을 때 일반 글자와 수식 모두 굵게 내보낸다. 특수문자, 분수, 근호, 위·아래첨자를 유지하고 별표 강조 구분자가 출력되지 않아야 한다. 기존 일반 수식은 원래 서식을 유지한다. 원본 Markdown·보기/PV·UI는 변경하지 않는다. 기존 DOCX에는 자동 적용되지 않으므로 새로 내보낸다.

## 실제 구현

- `mdpro/js/extendFiles/docx-export.js`
  - `splitMathSegments`: 구분자 포함 `raw`를 기록한다.
  - `splitBoldMarkdownSegments`: 수식을 충돌 없는 임시 토큰으로 보호한 뒤 Markdown 볼드를 나누고 복원한다. 식 내부 `**p`·`__`가 외부 볼드 경계를 끊는 문제를 방지한다(M-02).
  - `makeDocxRichRuns` → `makeDocxMath` → `latexToOmmlNodes`: `isBold || segment.bold`를 전달하며 분수·근호·첨자의 재귀 호출에도 전파한다.
  - `ommlRun`: 수학 문자는 `<m:sty m:val="bi"/>`, 일반 텍스트/직립 수식은 `b`로 출력하고 `<w:rPr><w:b/><w:bCs/></w:rPr>`를 추가한다. 일반 수식은 이전 기본 스타일을 유지한다.
  - `\mathbf`를 평문으로 저장하던 경로도 직립 볼드 재귀 변환으로 바꾸어 내부 명령과 첨자까지 변환한다.
- `mdpro/js/app.js`: 선택 로더 버전 `20261027-bold-math-1` 갱신(M-13).
- `tests/docxMermaidExport.test.mjs`: 분수·근호·첨자/목록/표의 모든 수식 run에 볼드가 있는지, 일반 수식에 번지지 않는지, 통계 별표·중첩 mathbf를 검증한다.
- 신규 의존성 없음. M-01~M-13 계약 유지. 화면 수식 파이프라인 변경 없음. 실제 렌더링 확인이 남아 있으므로 계약 전체의 실환경 준수 완료로 주장하지 않는다.

## 상대 앱 대응표와 이식 순서

| 원본 | 대상 실제 코드 | 차이·선행 조건 | 상태 |
| --- | --- | --- | --- |
| `mdpro/js/extendFiles/docx-export.js` OMML 함수 | `js/extendFiles/docx-export.js`의 `ommlRun`, `latexToOmmlNodes`, `makeDocxMath`, `makeDocxRichRuns` 읽기 확인 | 대상도 수식 볼드 인자를 버리고 mathbf를 일반 run으로 출력한다. 대상 자체 세그먼트 파서·호출자를 확인하고 필요한 함수만 이식 | 미이식 |
| `mdpro/js/app.js` 선택 로더 | 대상 `js/app.js` | 대상 로더 URL 및 캐시 방식 추가 확인 필요 | 미수정 |

대상 전체 파일을 덮어쓰지 않는다. 대상의 수식/코드 보호, 표·이미지 경로를 유지한 채 위 함수의 스타일 전달과 테스트를 옮긴다.

## 검증과 증거

- `node --check mdpro/js/extendFiles/docx-export.js`, `node --check mdpro/js/app.js`, `git diff --check`: 성공.
- `node --test tests/docxMermaidExport.test.mjs tests/markdownMathPlaceholders.test.mjs tests/markdownBold.test.mjs tests/mathRenderContract.test.mjs`: 32/32 성공.
- `npm run build`: 성공. 500kB chunk 경고 존재.
- 실제 JSZip으로 `C:\CusorApps\Webdav_md\check\docx-bold-math-proof\bold-math.docx` 신규 생성. 같은 폴더 `input.md`가 재현 원문이다. Python ZIP/XML 파싱으로 수식 5개, 앞의 볼드 수식 4개 내 모든 run의 w:b, 마지막 일반 수식의 비볼드 확인.
- 사용자 스크린샷의 정확한 Markdown 원문은 제공되지 않아 CR·λ·오차분산을 이용한 유사 문장으로 재현했다.
- 실제 앱 브라우저/PV, 실제 내보내기 메뉴, Word 열기·시각 확인은 미검증. ZIP/XML 검증은 Word 표시 검증을 대신하지 않는다.

## Tauri 반영 계획

대기 목록 ID `MDPRO-20261027-DOCX-BOLD-MATH`. 대상 `js/extendFiles/docx-export.js`, 해당 로더 캐시 및 테스트를 이식하고 웹 메뉴로 새 DOCX를 생성·Word 확인한 후 `Docs/mdpro-development/TAURI_BUILD.md`에 따라 빌드한다. `Tauri/dist`에 해당 자산과 캐시가 포함되는지 확인하고 설치 앱에서 재내보내기한다. 이번 요청은 WebDAV 수정이므로 상대 이식·프런트 준비·네이티브 빌드·설치 확인 모두 미실행이다.

## 다른 앱에서 다시 실행할 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 작업해줘. AGENTS.md, 수식 렌더링 계약과 C:\CusorApps\Webdav_md\webdav-md\docs\mdpro-development\changes\2026-10-27-docx-bold-math.md를 읽고 DOCX 볼드 범위의 수식·특수문자 서식 보존을 이식해줘. 대상 세그먼트 파서와 로더를 먼저 확인하고 전체 파일 덮어쓰기 없이 OMML 스타일 전달, 재귀 분수·근호·첨자, mathbf, 수식 내 별표 보호를 적용해줘. 일반 수식 비볼드 유지·목록·표를 검사하고 실제 새 DOCX를 Word에서 확인해줘. 이식 문서·목록·Tauri 대기 상태도 갱신해줘. Tauri 빌드는 이번 명령에 포함하지 않고 미검증 항목을 구분해서 보고해줘.
```
