# MDPro 수식 렌더링 공통 규칙

문서 ID: `MDPRO-MATH-RENDER-CONTRACT`

이 문서는 MDPro와 파생 앱에서 Markdown/AI 응답의 TeX 수식을 보기 모드, PV/miniPV, 인쇄, PDF, DOCX에 일관되게 표시하기 위한 필수 계약이다. 단순 구현 설명이 아니며, 다른 앱으로 기능을 옮길 때도 규칙 ID와 검증 사례를 함께 복사해야 한다.

## 1. 적용 범위

- 메인 보기 모드와 편집기 옆 미리보기
- PV, miniPV, 새 창 미리보기, 공유 보기
- AI Jena 및 다른 AI 응답의 Markdown 렌더링
- 인쇄와 PDF용 복제 DOM
- DOCX 내보내기의 Word 수식(OMML)
- 단일·이중·과잉 이스케이프된 TeX 입력

기준 구현은 다음 파일에 있다.

| 역할 | 기준 위치 |
| --- | --- |
| 공통 Markdown/MathJax 전처리 | `mdpro/js/math_render/math_render.js` |
| Markdown 굵게 전처리 | `mdpro/js/Markdown_bold.js` |
| 메인 보기 모드 연결 | `mdpro/js/app.js` |
| PV/새 창 연결 | `mdpro/js/UI_PV/editpv.js` |
| DOCX TeX→OMML 변환 | `mdpro/js/extendFiles/docx-export.js` |
| MathJax 설정/스크립트 연결 | `mdpro/index.html` |

## 2. 필수 규칙

### M-01. 하나의 공통 수식 전처리기를 사용한다

모든 HTML 보기 경로는 `MathRender.renderMarkdownSafe()` 또는 같은 계약을 구현한 공통 함수를 거쳐야 한다. 각 미리보기 창이 독자적인 정규식으로 수식을 고치면 안 된다.

처리 순서는 다음과 같다.

1. 코드 블록과 인라인 코드를 보호한다.
2. TeX 구분자와 수식 본문을 정규화한다.
3. 수식 전체를 Markdown 파서용 안전 토큰으로 보호한다.
4. Markdown을 HTML로 변환한다.
5. 보호 토큰을 HTML 이스케이프된 TeX로 복원한다.
6. 복원된 DOM에 MathJax를 실행한다.

### M-02. Markdown 전처리보다 수식을 먼저 보호한다

수식 안의 `*`, `**`, `_`, `<`, `>`, `~`, `&`는 Markdown 강조, HTML 태그, 취소선으로 해석되면 안 된다.

특히 다음 식은 한 덩어리로 보호해야 한다.

```markdown
\(*p<.05, **p<.01, ***p<.001\)
```

`MarkdownBold.preprocessBold()` 같은 선행 전처리기도 코드뿐 아니라 수식을 임시 토큰으로 보호해야 한다. 문장 밖의 실제 `**굵게**` 표시는 정상 처리해야 한다.

### M-03. 지원 구분자와 이스케이프 수준을 정규화한다

최소한 다음 입력을 지원한다.

| 입력 | 의미 |
| --- | --- |
| `$x$` | 인라인 수식 |
| `$$x$$` | 블록 수식 |
| `\(x\)` | 인라인 수식 |
| `\[x\]` | 블록 수식 |
| `\\(x\\)` | 이중 이스케이프 인라인 수식 |
| `\\[x\\]` | 이중 이스케이프 블록 수식 |

이중 이스케이프를 정규화할 때 구분자의 역슬래시를 모두 소비해야 한다. 역슬래시 하나가 남으면 한글 Word 글꼴에서 `₩β`, `₩AVE`처럼 보인다.

수식 본문의 `\\beta`, `\\sum`, `\\sqrt`, `\\text`, `\\frac`도 한 단계 정규화한다. 단, 행렬·`aligned` 환경의 실제 TeX 줄바꿈 `\\`는 보존한다.

### M-04. 이미 수식이 든 괄호를 다시 수식으로 감싸지 않는다

일반 괄호 안에 명시적 수식이 있는 경우 바깥 괄호는 텍스트로 유지한다.

```text
입력: (\(\beta = .792\))
정상: ($\beta = .792$)
금지: \($\beta = .792$\)
```

금지 형태는 MathJax 수식 안에 `$`를 중첩시켜 보기 모드에 달러 기호가 그대로 나타나게 한다. 자동 괄호 수식 감지는 본문에 `$`, `\(`, `\[`가 이미 있으면 건너뛴다.

### M-05. 코드의 달러 기호는 수식으로 처리하지 않는다

다음 영역의 `$`와 TeX 표시는 그대로 보존한다.

- 인라인 코드: `` `result$points` ``
- 백틱 fenced code
- 물결표 fenced code
- HTML의 `script`, `style`, `textarea`, `pre`, `code`

코드의 첫 `$`와 뒤 문장의 `$x$`를 하나의 수식으로 연결하면 안 된다.

### M-06. 일반 문장을 수식으로 과잉 판정하지 않는다

다음은 수식이 아니다.

```text
(Self-Efficacy)
(cost/benefit)
(A/B testing)
(→ 동기 부여 및 몰입 유도)
```

한글 두 글자 이상, 일반 영문 단어, 인용 연도와 쉼표가 포함된 괄호는 자동 수식 변환에서 제외한다. 명시적 구분자가 있으면 이 휴리스틱보다 명시적 구분자를 우선한다.

### M-07. AI가 만든 경계 장식만 제한적으로 제거한다

AI 출력이 `\(&r=.9&\)`처럼 식 전체를 `&`로 감싼 경우, 정렬 환경 밖의 바깥쪽 `&` 한 쌍만 제거할 수 있다.

다음은 보존한다.

- `&=` 정렬 연산자
- `matrix`, `aligned` 등 환경 내부의 `&`
- `\\` 행 구분
- 내부에 여러 개 존재하는 `&`

### M-08. 원본 Markdown을 수정하지 않는다

보기 모드 정규화는 렌더링용 사본에서만 수행한다. 저장된 Markdown, 편집기 값, 선택 영역을 바꾸지 않는다. 사용자가 입력한 수식을 자동 저장 시 다른 구분자로 영구 치환하면 안 된다.

### M-09. 모든 보기 표면에 같은 결과를 적용한다

메인 보기 모드에서 고친 뒤 아래 표면을 빠뜨리면 안 된다.

- PV 및 miniPV
- 새 창/공유 보기
- AI 답변 미리보기
- 인쇄용 DOM
- PDF 미리보기용 복제 DOM

각 표면은 공통 `MathRender`를 로드하고, Markdown HTML 복원 후 해당 문서의 `MathJax.typesetPromise([root])`를 실행한다. iframe/새 창에서는 부모 창이 아니라 대상 창의 MathJax와 DOM을 사용한다.

### M-10. 비동기 렌더링 경합을 막는다

MathJax 로딩과 렌더링은 비동기다. 같은 문서 루트의 typeset 요청은 큐로 직렬화하고, 이전 렌더 결과가 최신 Markdown을 덮지 않도록 렌더 버전 또는 취소 토큰을 확인한다.

MathJax가 아직 없으면 제한된 횟수만 재시도하고, 실패 시 원문을 안전하게 표시한다. 무한 대기하거나 문서 전체를 비우면 안 된다.

### M-11. DOCX는 화면용 HTML이 아니라 Word 수식으로 내보낸다

DOCX에서 TeX 문자열이나 MathJax DOM을 일반 텍스트로 저장하지 않는다. TeX를 Word 네이티브 OMML로 변환하고 `xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"`를 선언한다.

최소 지원 구조:

- 분수 `\frac`
- 위첨자/아래첨자 `^`, `_`
- 제곱근 `\sqrt`
- 합계·적분 기호
- 그리스 문자
- 비교 기호
- `\text`, `\mathrm`, `\mathbf`

본문, 목록, 표 셀에서 동일하게 처리한다. 이중 이스케이프 구분자의 첫 역슬래시가 일반 Word 텍스트로 남지 않아야 한다.

### M-12. PDF/인쇄는 렌더 완료 후 복제한다

MathJax typeset 완료 전에 DOM을 복제하면 원본 TeX 또는 빈 수식이 출력될 수 있다. 인쇄/PDF 경로는 렌더 완료를 기다린 후 사본을 만들고, 원본 편집 DOM은 수정하지 않는다. 세부 출력 규칙은 `MDPRO-PRINT-PDF-CONTRACT`를 함께 따른다.

### M-13. 캐시 버전을 함께 갱신한다

공통 수식 스크립트를 변경하면 모든 로드 위치의 쿼리 버전을 함께 갱신한다.

- `mdpro/index.html`
- `mdpro/js/UI_PV/editpv.js`
- 별도 앱/iframe의 동적 스크립트 URL

한 경로만 갱신하면 메인 보기에서는 고쳐지고 PV에서는 이전 오류가 남을 수 있다.

## 3. 금지 구현

- 수식 렌더링 전에 전체 문장에 굵게/기울임 정규식을 적용하는 것
- `<`와 `>`가 든 수식을 보호하지 않고 Markdown/HTML 파서에 전달하는 것
- 명시적 수식이 든 바깥 괄호를 다시 `\(...\)`로 감싸는 것
- 코드 블록을 포함해 문서 전체의 `$`를 정규식 한 번으로 짝짓는 것
- 보기 모드마다 별도의 수식 정규화 규칙을 복사하는 것
- MathJax 완료 전에 PDF/인쇄 DOM을 복제하는 것
- DOCX에 TeX를 일반 문자열로만 기록하는 것
- 빌드 성공만으로 실제 수식 표시가 검증됐다고 보고하는 것

## 4. 필수 회귀 사례

다른 앱에 이 계약을 적용할 때 아래 입력을 그대로 테스트한다.

```markdown
일반 인라인: \(\beta = .792\)

이중 이스케이프: \\(\\beta = .792\\)

괄호 안 수식: (\(\beta = .792\))

통계 유의성: \(*p<.05, **p<.01, ***p<.001\)

합계: \(\sum \beta_i^2\)

분수: \(\text{AVE}=\frac{2.7069}{4}=0.677\)

코드와 수식: `result$points` 다음 값은 $x_i$이다.

일반 문장: (Self-Efficacy), (A/B testing), (→ 동기 부여)

정렬 환경:
$$
\begin{aligned}
a &= b \\
c &= d
\end{aligned}
$$
```

검증 항목:

- 보기 DOM에 `@@MATHSEG_` 토큰이 남지 않는다.
- 정상 수식 주변에 문자 `$`, `\`, `₩`가 남지 않는다.
- 통계 유의성의 별표와 `<`가 HTML/강조 태그로 깨지지 않는다.
- 실제 굵게 표시는 유지된다.
- 코드의 `$`는 그대로다.
- 일반 괄호 문장은 수식이 되지 않는다.
- 메인 보기와 PV 결과가 같다.
- DOCX `document.xml`에 `<m:oMath>`가 있으며 TeX 구분자가 남지 않는다.

## 5. 기준 검증 명령

```powershell
node --check mdpro/js/math_render/math_render.js
node --check mdpro/js/Markdown_bold.js
node --check mdpro/js/UI_PV/editpv.js
node --check mdpro/js/extendFiles/docx-export.js
node --test tests/markdownMathPlaceholders.test.mjs tests/markdownBold.test.mjs tests/docxMermaidExport.test.mjs
git diff --check
npm run build
```

정적 검사 후에는 실제 앱을 새로고침하고, 위 회귀 문서를 메인 보기와 PV에서 열어 MathJax 결과를 확인한다. DOCX 변경이 있으면 새 파일을 내보내 Word에서 열어 확인한다. 기존에 생성된 DOCX는 코드 변경으로 자동 갱신되지 않는다.

## 6. 다른 MDPro 앱으로 이식하는 절차

1. 이 문서를 대상 저장소의 `docs/MATH_RENDER_RULES.md`로 복사한다.
2. 대상 저장소의 `AGENTS.md`에 `MDPRO-MATH-RENDER-CONTRACT` 준수를 필수로 연결한다.
3. 대상 앱의 모든 Markdown 보기 표면과 내보내기 경로를 목록화한다.
4. 각 표면을 M-01~M-13에 매핑한다.
5. 공통 `MathRender` 모듈을 연결하고 중복 정규식을 제거한다.
6. 필수 회귀 사례와 테스트를 이식한다.
7. 캐시 버전과 빌드 산출물을 갱신한다.
8. 실제 브라우저/PV/Word 결과를 각각 검증한다.

문서를 복사했거나 테스트가 통과했다는 사실만으로 준수가 성립하지 않는다. 모든 표면에 연결되고 실제 출력이 확인되어야 완료다.
