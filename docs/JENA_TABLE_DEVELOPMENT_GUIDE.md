# Jena Table 개발 및 MDPro 이식 가이드

## 1. 문서 목적

이 문서는 WebDAV MDPro의 `Jena Table`을 유지보수하거나 다른 MDPro 계열 편집기에 이식·재구현하기 위한 개발 명세다.

Jena Table은 다음 기능을 하나의 흐름으로 제공한다.

- 표 캡처 이미지 업로드, 드래그 앤 드롭, 클립보드 붙여넣기
- 쉼표·탭·문장·기존 Markdown 표 텍스트 입력
- 이미지와 텍스트를 함께 AI Jena에 전달
- 공급자와 모델을 사용자가 직접 선택
- AI 응답을 GitHub-Flavored Markdown 표로 정규화
- 결과 원문 직접 수정과 즉시 표 미리보기
- 전체 화면 작업창과 별도의 대형 표 미리보기
- 기존 문서의 선택 범위 또는 커서 위치에 표 삽입
- 기존 Markdown 표의 행·열 추가 및 삭제

이 기능은 특정 AI 서비스에 종속되지 않는다. UI, AI 공급자 선택, 요청 브리지, 결과 정규화, 편집기 삽입을 분리하는 것이 핵심이다.

## 2. 기준 구현 파일

| 역할 | 파일 | 주요 진입점 |
| --- | --- | --- |
| 표 메뉴, Jena Table 작업창, 대형 미리보기 DOM | `mdpro/index.html` | `#table-insert-picker`, `#jena-table-popup`, `#jena-table-preview-popup` |
| 입력·AI 요청·표 파싱·미리보기·삽입·행열 편집 | `mdpro/js/app.js` | `openJenaTablePopup()`, `generateJenaTable()`, `insertJenaTableResult()`, `editMarkdownTableStructure()` |
| 공급자/모델 목록과 선택 저장 | `mdpro/js/ai-tool-providers.js` | `AIToolProviders.read()`, `mount()`, `models()` |
| AI 공급자별 실제 요청 | `mdpro/js/app.js`의 AI 브리지 영역 | `AIChatBridge.complete()` |
| 작업창과 표 미리보기 스타일 | `mdpro/css/style.css` | `.jena-table-dialog`, `.jena-table-render`, `.jena-table-preview-modal` |
| 회귀 테스트 | `mdpro/tests/jena-table.test.cjs` | UI·브리지·정규화·표 구조 편집 계약 |
| 캐시 버전 | `mdpro/index.html` | `style.css?...img2MathCss=...`, `app.js?...img2Math=...` |

## 3. 전체 데이터 흐름

```text
표 메뉴
  └─ Jena Table 열기
       ├─ 이미지 파일 / 드롭 / 클립보드
       ├─ 직접 입력한 텍스트
       └─ 문서에서 가져온 선택 텍스트
                    │
                    ▼
       AIToolProviders에서 공급자·모델 선택
                    │
                    ▼
       AIChatBridge.complete(request)
                    │
                    ▼
       cleanJenaTableMarkdown(response.text)
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
  작은/대형 표 미리보기   Markdown 직접 수정
          └─────────┬──────────┘
                    ▼
       현재 선택 범위 또는 커서에 삽입
                    │
                    ▼
       renderMarkdown + performAutoSave
```

## 4. UI 계약

### 4.1 표 메뉴의 배치

`#table-insert-picker`의 10×10 크기 선택 그리드 아래에 기능을 둔다.

1. `Jena Table · 이미지/텍스트로 표 만들기`
2. 표 편집: `행 추가`, `열 추가`, `행 삭제`, `열 삭제`
3. `표 캡션 넣기`

이 순서는 표 생성 → 구조 조정 → 캡션 추가라는 작업 순서를 반영한다.

### 4.2 작업창 구조

작업창은 Img2Math의 시각·동작 패턴을 재사용한다.

- 왼쪽: 이미지 및 텍스트 입력
- 오른쪽 위: 프롬프트, 공급자, 모델, 실행 상태
- 오른쪽 아래: 수정 가능한 Markdown 결과, 표 미리보기, 문서 삽입
- 우측 상단: 전체 화면/복원, 닫기
- 모든 가장자리와 모서리: 크기 조절 손잡이
- 헤더 드래그: 창 이동

작업창은 문서 선택 영역을 다시 가져올 수 있어야 하므로 배경을 완전히 차단하는 모달로 만들지 않는다. `aria-modal="false"`를 유지한다.

### 4.3 대형 미리보기

`#jena-table-render`는 `role="button"`, `tabindex="0"`을 사용한다.

- 마우스 클릭, Enter, Space: 대형 미리보기 열기
- Escape, 닫기 버튼, 바깥 배경 클릭: 닫기
- 가로·세로 스크롤 제공
- Markdown의 `<br>`는 DOM `br`로 표시
- 셀 내용은 `innerHTML`로 넣지 않고 텍스트 노드로 생성

마지막 규칙은 AI가 반환한 HTML이나 스크립트가 실행되는 것을 막는 필수 보안 계약이다.

## 5. 상태와 입력 처리

Jena Table은 다음 최소 상태를 가진다.

```js
let jenaTableImage = null;
let jenaTableSelection = { start: 0, end: 0 };
let jenaTableLastDocumentSelection = '';
let jenaTableBound = false;
let jenaTableFloatingBound = false;
let jenaTableFloatingPositioned = false;
```

이미지는 다음 형태로 저장한다.

```js
{
  name: 'table.png',
  type: 'image/png',
  size: 12345,
  dataUrl: 'data:image/png;base64,...'
}
```

`setJenaTableImage()`는 `image/*`만 허용한다. 파일 선택, 드롭, `paste` 이벤트, `navigator.clipboard.read()`가 모두 이 함수로 합류해야 한다.

문서 선택은 작업창을 열기 전에 편집기의 `selectionStart/selectionEnd`를 보존한다. 보기 영역에서 선택한 문자열과 편집기 선택 문자열을 모두 지원하며, 작업창으로 포커스가 옮겨진 뒤에도 마지막 선택값을 유지한다.

## 6. AI 공급자와 모델 계약

### 6.1 도구별 저장 키

Jena Table은 AI 도구 ID로 `jena-table`을 사용한다.

```js
AIToolProviders.read('jena-table');
AIToolProviders.mount(container, 'jena-table', options);
```

선택값은 `localStorage`의 `mdv_ai_tool_jena-table`에 저장된다. 명시적으로 저장된 선택이 없을 때만 AI Jena의 현재 공급자/모델을 기본값으로 사용한다. 사용자가 저장한 선택을 임의의 기본 모델로 덮어쓰지 않는다.

### 6.2 요청 형식

```js
await AIChatBridge.complete({
  provider: selected.provider,
  model: selected.model,
  mode: 'quick',
  messages: [{
    role: 'user',
    content: messageContent,
    attachments
  }],
  systemInstruction
});
```

이미지 첨부 형식:

```js
{
  kind: 'image',
  name,
  type,
  size,
  dataUrl
}
```

Ollama 경로에서는 AI 브리지가 data URL의 쉼표 뒤 Base64만 추출해 `/api/chat` 메시지의 `images` 배열로 보낸다. 이 변환이 누락되면 비전 모델을 선택해도 이미지를 받지 못한다.

### 6.3 모델 요구사항

- 텍스트만 표로 바꾸는 경우: 일반 텍스트 모델 사용 가능
- 표 이미지를 읽는 경우: 반드시 이미지 입력을 지원하는 비전 모델 필요
- 모델 목록에 나타나는 것과 이미지 입력 지원은 별개이므로 모델 capability를 확인해야 한다
- 작은 로컬 모델은 연결에 성공해도 작은 글자, 많은 열, 병합 셀, 수식이 있는 표에서 OCR 정확도가 낮을 수 있다

예: `gemma4:latest`, `granite3.2-vision` 같은 비전 모델을 사용할 수 있다. 정확도가 중요한 복잡한 표는 더 큰 비전 모델이나 Gemini 계열과 비교 검증한다.

## 7. AI 출력 계약

시스템 지침은 다음 결과만 허용해야 한다.

- 하나의 GitHub-Flavored Markdown 표
- 제목 행 1개
- 구분선 행 1개
- 모든 데이터 행
- 설명, 코드 fence, JSON, HTML 표, 캡션 금지
- 빈 셀 유지
- 셀 내부 리터럴 `|`는 `\|`로 escape
- 셀 내부 줄바꿈은 `<br>` 사용
- 보이지 않는 데이터 추측 금지

정상 결과 예:

```markdown
| 변수명 | AVE | 판정 |
| --- | ---: | --- |
| 직원경험 | 0.768 | 적합 |
| 인간-AI 협업 | 0.426 | 부적합<br>(미달) |
```

## 8. Markdown 정규화와 파싱

### 8.1 `cleanJenaTableMarkdown()`

다음 AI 응답 변형을 허용한다.

- 순수 Markdown 표
- ` ```markdown ` 또는 ` ```table ` fence
- `{ "markdown": "..." }`, `{ "table": "..." }`, `{ "content": "..." }`
- 표 앞뒤에 붙은 짧은 설명

표 문법으로 사용할 `|` 포함 행만 추출하고 바깥 파이프를 보정한다. 구분선이 없는 결과는 완성된 표로 취급하지 않는다.

### 8.2 escape-aware 셀 분리

`split('|')`만 사용하면 `\|`가 포함된 셀이 깨진다. `splitJenaTableRow()`는 백슬래시 escape 상태를 추적해야 한다.

구분선 판정은 각 셀이 다음 정규식을 만족하는지 확인한다.

```js
/^:?-{3,}:?$/
```

### 8.3 안전한 렌더링

`renderJenaTableInto()`는 `table`, `thead`, `tbody`, `tr`, `th`, `td`를 DOM API로 생성한다. 셀 값은 `textContent` 또는 `createTextNode()`로 삽입하고 `<br>` 토큰만 명시적으로 `br` 요소로 변환한다.

AI 출력 전체를 `innerHTML`에 넣지 않는다.

## 9. 문서 삽입 계약

`openJenaTablePopup()`에서 저장한 `jenaTableSelection`을 기준으로 결과를 삽입한다.

- 선택 범위가 있으면 해당 범위를 표로 교체
- 선택 범위가 없으면 커서 위치에 삽입
- 앞뒤 문자가 같은 줄에 있으면 필요한 줄바꿈 추가
- 삽입 후 `currentMarkdown` 갱신
- 커서를 삽입된 표 뒤로 이동
- `renderMarkdown()` 실행
- `performAutoSave()` 실행

작업창을 연 뒤 사용자가 다른 곳을 클릭했더라도 최초 삽입 대상을 잃지 않아야 한다.

## 10. 기존 표 행·열 편집

`editMarkdownTableStructure(action)`이 지원하는 action:

| action | 동작 |
| --- | --- |
| `add-row` | 현재 행 다음에 동일 열 수의 빈 행 추가 |
| `delete-row` | 현재 데이터 행 삭제 |
| `add-column` | 현재 열 오른쪽에 빈 열 추가 |
| `delete-column` | 현재 열 삭제 |

`getMarkdownTableStructureAtCursor()`는 다음 정보를 계산한다.

- 현재 줄
- 연속된 표의 시작/끝 줄
- 제목 바로 다음에 있는 구분선
- 현재 셀의 열 인덱스
- 전체 열 수
- 문서의 기존 줄바꿈 형식 (`LF` 또는 `CRLF`)

보호 규칙:

- 커서가 Markdown 표 안에 없으면 수정하지 않음
- 제목 행과 구분선은 행 삭제 금지
- 마지막 남은 열은 삭제 금지
- `\|`는 열 경계로 세지 않음
- 수정 후 렌더링과 자동 저장 수행

## 11. 이동·크기 조절·전체 화면

작업창의 일반 위치와 크기는 인라인 `left`, `top`, `width`, `height`로 유지한다. 전체 화면은 `.is-maximized` 클래스만 토글한다.

```css
.jena-table-dialog.is-maximized {
  inset: 6px !important;
  width: calc(100vw - 12px) !important;
  height: calc(100dvh - 12px) !important;
}
```

클래스를 제거하면 이전 인라인 위치와 크기가 다시 적용되므로 별도의 복원 좌표 저장이 필요 없다.

## 12. 다른 MDPro에 이식하는 순서

1. 대상 앱의 실제 편집기 요소와 삽입/자동 저장 API를 확인한다.
2. `index.html`에 표 메뉴 버튼, 작업창, 대형 미리보기 DOM을 이식한다.
3. `style.css`에서 Img2Math 공통 클래스 또는 Jena Table 전용 스타일을 이식한다.
4. 상태 변수와 이미지 입력 함수군을 이식한다.
5. 대상 앱의 AI 브리지에 이미지 attachment 계약이 있는지 확인한다.
6. `AIToolProviders`가 없다면 공급자·모델 선택과 저장 계층을 먼저 구현한다.
7. AI 요청과 시스템 지침을 연결한다.
8. Markdown 정규화·escape-aware 파서·안전한 DOM 미리보기를 이식한다.
9. 대상 편집기의 선택 범위 교체, 렌더링, 자동 저장 API에 연결한다.
10. 행·열 편집 기능을 연결한다.
11. 전역 onclick 진입점을 `window`에 노출한다.
12. CSS/JS 캐시 버전을 갱신한다.
13. 전용 테스트, 문법 검사, 빌드, 실제 브라우저 클릭 검증을 수행한다.

대상 앱의 편집기나 AI 브리지가 다르면 `app.js`를 통째로 복사하지 말고 각 계약에 맞는 어댑터를 작성한다.

## 13. 필수 전역 진입점

인라인 버튼을 유지하는 구현에서는 다음 함수를 노출한다.

```js
window.openJenaTablePopup = openJenaTablePopup;
window.closeJenaTablePopup = closeJenaTablePopup;
window.toggleJenaTableFullscreen = toggleJenaTableFullscreen;
window.closeJenaTablePreviewPopup = closeJenaTablePreviewPopup;
window.editMarkdownTableStructure = editMarkdownTableStructure;
```

## 14. 검증 절차

### 14.1 정적 검사

```powershell
node --check mdpro\js\app.js
node --test mdpro\tests\jena-table.test.cjs
git diff --check
npm run build
```

### 14.2 실제 브라우저 검증

1. 개발 서버 또는 로컬 배포 포트를 확인한다.
2. 서비스 워커와 브라우저 캐시 상태를 확인하고 필요하면 `Ctrl+F5`한다.
3. 편집 모드 → 표 버튼 → Jena Table을 연다.
4. 이미지 선택, 드롭, Ctrl+V를 각각 시험한다.
5. 텍스트만 입력하고 표를 생성한다.
6. 이미지와 텍스트를 함께 입력하고 표를 생성한다.
7. 공급자 변경, 모델 새로고침, 모델 변경 후 실제 요청 모델을 확인한다.
8. 결과 textarea 수정 시 작은 미리보기가 즉시 갱신되는지 확인한다.
9. 작은 미리보기 클릭/Enter/Space로 큰 미리보기가 열리는지 확인한다.
10. 전체 화면과 화면 복원을 확인한다.
11. 선택한 문서 텍스트가 표로 교체되는지 확인한다.
12. 행·열 추가/삭제가 커서 위치를 기준으로 동작하는지 확인한다.
13. 저장 후 문서를 다시 열어 표가 유지되는지 확인한다.

테스트와 빌드 통과는 실제 이미지가 모델에 전달되었다는 증거가 아니다. Ollama는 `/api/chat` 요청의 `messages[].images`, OpenAI 호환 API는 해당 서버가 요구하는 이미지 content 형식을 실제 네트워크 요청에서 확인한다.

## 15. 문제 해결

### 모델 목록이 비어 있음

- 해당 공급자 서버가 실행 중인지 확인
- 모델 새로고침 실행
- AI 브리지의 `getCached...Models`/`refresh...Models` 구현 확인
- 저장된 provider와 model 조합 확인

### 요청은 성공하지만 이미지 표가 엉뚱함

- 선택한 모델에 vision capability가 있는지 확인
- 원본 이미지 해상도와 글자 크기 확인
- 표 부분만 잘라 확대해 재시도
- 작은 양자화 모델과 더 큰 비전 모델 결과 비교
- Ollama 요청의 `images` 배열에 Base64가 실제 포함됐는지 확인

### 결과에 설명이나 코드 fence가 포함됨

- 시스템 지침을 유지
- `cleanJenaTableMarkdown()` 적용 위치 확인
- 표 구분선 검증을 요청 완료 조건으로 유지

### `\|`가 새 열로 분리됨

- 단순 `split('|')` 사용 여부 확인
- 모든 미리보기와 행·열 편집이 `splitJenaTableRow()`를 공유하는지 확인

### 변경했는데 화면에 나타나지 않음

- `index.html`의 CSS/JS 캐시 쿼리 갱신
- 실행 중인 포트와 체크아웃 확인
- 서비스 워커/브라우저 캐시 제거 또는 강력 새로고침

## 16. 완료 기준

다음 조건을 모두 만족해야 Jena Table 이식이 완료된 것으로 본다.

- 이미지, 텍스트, 이미지+텍스트 요청이 모두 동작
- 사용자가 공급자와 모델을 선택하고 선택값이 유지됨
- 비전 공급자에 이미지가 실제 전달됨
- Markdown 표가 수정 가능하고 미리보기가 안전하게 렌더링됨
- 큰 미리보기와 전체 화면이 동작
- 선택 범위/커서 삽입, 렌더링, 자동 저장이 연결됨
- 행·열 편집이 표를 손상시키지 않음
- 캐시 갱신 후 실제 브라우저에서 확인됨
- 전용 테스트와 프로덕션 빌드가 통과함

