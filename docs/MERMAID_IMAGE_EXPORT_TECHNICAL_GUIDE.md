# Mermaid 이미지 변환 및 문서 내보내기 기술 가이드

## 1. 문서 목적

이 문서는 MDPRO에서 구현한 Mermaid 이미지 변환 기술을 MDproViewer 등 다른 Markdown 편집기·뷰어에 이식하기 위한 구현 명세다.

다음 기능을 하나의 공통 렌더링 파이프라인으로 제공한다.

- 보기 모드에서 현재 Mermaid 도표를 SVG 또는 PNG로 이미지 삽입 기능에 전달
- PNG를 고해상도로 생성하면서 Mermaid 노드의 글자 색상과 배치를 보존
- DOCX 내보내기에 렌더링된 Mermaid 이미지와 재사용 가능한 Mermaid 원본 코드를 함께 포함
- PDF 내보내기에 렌더링된 Mermaid 이미지를 포함
- PDF 미리보기에서 이미지 크기를 마우스로 조절하고 저장 결과에 반영

이 문서에서 설명하는 이미지 변환 규칙은 보기 모드, 이미지 삽입, DOCX, PDF가 모두 공유해야 한다. 각 내보내기 기능이 별도의 SVG/PNG 변환기를 만들면 글꼴, 배율, 배경색과 해상도가 달라질 수 있다.

## 2. 기준 구현 파일

| 역할 | 파일 | 주요 진입점 |
| --- | --- | --- |
| Mermaid 화면 렌더링과 SVG/PNG 생성 | `mdpro/js/mermaid/mermaid_render.js` | `exportMermaidWrapperImage()` |
| 보기 모드 SVG/PNG 이미지 삽입 | `mdpro/js/mermaid/mermaid_render.js` | `openMermaidWrapperInImageInsert()` |
| DOCX/PDF 내보내기 연결 | `mdpro/js/app.js` | `withPreparedMermaidExportViewer()`, `createCurrentDocumentDocxBlob()`, `createPdfRenderedElement()` |
| DOCX 구조 생성 | `mdpro/js/extendFiles/docx-export.js` | `markdownToDocxItems()`, `createBlob()` |
| PDF 미리보기와 이미지 크기 조절 | `mdpro/js/export/pdf-export.js` | `openPreview()` |
| 스크립트 캐시 버전 | `mdpro/index.html` | `mermaid_render.js?v=...`, `app.js?...` |

## 3. 전체 데이터 흐름

```text
Markdown Mermaid fence
        │
        ▼
Mermaid 런타임이 보기 영역에 SVG 생성
        │
        ▼
.trt-mermaid-wrapper + data-mermaid-source
        │
        ├─ 보기의 SVG 버튼 ── SVG data URL ── 이미지 삽입 창
        │
        ├─ 보기의 PNG 버튼 ── 공통 8배 PNG ── 이미지 삽입 창
        │
        ├─ DOCX 내보내기 ─── 공통 8배 PNG + Mermaid 원본 코드
        │
        └─ PDF 내보내기 ──── 공통 8배 PNG ── PDF 미리보기
                                                │
                                                └─ 마우스 크기 조절 → PDF 저장
```

핵심 계약은 렌더링된 래퍼가 원본을 잃지 않는 것이다.

```html
<div class="trt-mermaid-wrapper"
     data-mermaid-source="..."
     data-mermaid-original-source="...">
  <div class="mermaid trt-mermaid-canvas">
    <svg>...</svg>
  </div>
</div>
```

DOCX에서 이미지와 원본 코드를 대응시키기 위해 `data-mermaid-original-source`를 우선 사용하고, 없으면 `data-mermaid-source`를 사용한다.

## 4. 공통 SVG/PNG 변환기

### 4.1 SVG 복제

`createMermaidExportClone(wrapper)`는 화면에 렌더링된 SVG를 복제하고 다음 속성을 고정한다.

- `xmlns`, `xmlns:xlink`
- 원본 `viewBox`
- 계산된 `width`, `height`
- `preserveAspectRatio="xMidYMid meet"`
- 화면 확대·이동용 CSS `transform` 제거
- 현재 Mermaid 래퍼의 배경색을 SVG 배경 사각형으로 삽입

내보내기 크기는 `getMermaidExportSize(svg)`가 `viewBox`를 우선 사용하고, 없으면 실제 표시 크기를 사용한다. 크기가 계산되지 않는 경우에만 안전한 기본값을 사용한다.

### 4.2 글자 모양 보존

브라우저 Mermaid는 노드 글자를 SVG `foreignObject` 안의 HTML로 만들 수 있다. SVG를 Canvas에 직접 그릴 때 외부 CSS가 사라질 수 있으므로 다음 처리가 필요하다.

1. `inlineMermaidExportLabelStyles()`가 원본 HTML 라벨의 계산된 스타일을 복제 SVG에 인라인으로 기록한다.
2. PNG 생성 시 `replaceMermaidHtmlLabelsForPng()`가 HTML 라벨을 SVG `text`와 `tspan`으로 변환한다.
3. 원래 계산된 `color`, `font-family`, `font-size`, `font-weight`, 줄 높이와 가운데 정렬을 유지한다.
4. 노드의 `classDef color:#FFFFFF` 같은 글자 색상을 그대로 사용한다.
5. 글자에는 도형의 테두리가 상속되지 않도록 다음 값을 강제로 지정한다.

```js
text.setAttribute('stroke', 'none');
text.setAttribute('stroke-width', '0');
text.style.setProperty('stroke', 'none', 'important');
text.style.setProperty('stroke-width', '0', 'important');
```

동일한 규칙을 모든 `tspan`에도 적용한다. 이 처리가 없으면 노드의 파란색 `stroke-width:2px`가 글자에 적용되어 글자가 번지거나 두껍게 보일 수 있다.

### 4.3 고해상도 PNG

PNG는 SVG를 이미지로 디코딩한 뒤 Canvas에 그린다.

```js
const scale = Math.min(
  Math.max(8, Number(window.devicePixelRatio) || 1),
  8192 / Math.max(sourceWidth, sourceHeight)
);
```

- 기본 목표 배율은 8배다.
- 너무 긴 도표가 브라우저 Canvas 한계를 넘지 않도록 가장 긴 변을 8192px 이내로 제한한다.
- `imageSmoothingEnabled = true`, `imageSmoothingQuality = 'high'`를 사용한다.
- 반환값에는 `dataUrl`, 실제 픽셀 `width`, `height`, `format`을 포함한다.

현재 CFA 예제의 검증 결과는 논리 크기 약 `276×619`에서 PNG `2208×4952px`이다. 실제 크기는 도표의 `viewBox`에 따라 달라진다.

### 4.4 외부 공개 API

다른 모듈은 변환 로직을 복제하지 않고 다음 API만 사용한다.

```js
window.MermaidTRT.exportWrapperImage(wrapper, 'svg');
window.MermaidTRT.exportWrapperImage(wrapper, 'png');
```

반환 형식:

```ts
type MermaidExportResult = {
  dataUrl: string;
  width: number;
  height: number;
  format: 'svg' | 'png';
};
```

## 5. 보기 모드의 SVG/PNG 이미지 삽입

고정형 Mermaid 컨트롤에서 `맞춤` 버튼 바로 다음에 `SVG`, `PNG` 버튼을 둔다.

1. 선택한 래퍼를 `exportWrapperImage()`에 전달한다.
2. 이미지 삽입 창을 연다.
3. 반환된 data URL과 파일명을 기존 이미지 삽입 API에 전달한다.

```js
openImageInsertModal();
applyImageInsertDataUrl(result.dataUrl, generatedFileName);
```

이미지 삽입 기능의 업로드·IndexedDB 저장·Markdown/HTML 삽입 흐름은 그대로 재사용한다. Mermaid 모듈이 문서 저장 방식을 직접 구현하지 않는다.

## 6. 편집 모드에서 안전하게 내보내기

### 6.1 반드시 실제 보기 모드 레이아웃을 재현

편집 모드에서는 `#viewer-container`가 숨겨지고 `body.viewer-view-mode` 전용 글꼴·크기 규칙도 비활성화된다. 숨겨진 `#viewer`만 임의로 표시해 변환하면 노드 글자가 한 글자만 크게 확대되거나 도표가 잘릴 수 있다.

`withPreparedMermaidExportViewer()`는 내보내기 동안 다음을 수행한다.

- 현재 스타일, `hidden` 클래스와 본문 모드 클래스를 저장
- `body.viewer-view-mode`를 임시 적용
- `#viewer-container`를 화면 왼쪽 멀리 이동해 실제 너비로 배치
- `opacity:0`과 `pointer-events:none`으로 사용자 화면과 입력을 방해하지 않음
- 내보내기가 끝나면 모든 클래스와 인라인 스타일을 정확히 복원

`visibility:hidden`만 사용하거나 너비가 0인 부모 안에서 렌더링하지 않는다. Mermaid는 실제 레이아웃 크기를 이용해 노드와 라벨 위치를 계산한다.

### 6.2 비동기 렌더링 경합 방지

일반 보기 렌더링의 후처리와 내보내기 전용 렌더링을 동시에 호출하면, 첫 호출이 코드 블록을 래퍼로 바꾼 직후 두 번째 호출이 이미 처리된 것으로 판단할 수 있다. 이 상태에서는 래퍼 안에 SVG 대신 원본 코드가 남는다.

내보내기 준비 시에는 다음 순서를 지킨다.

```js
await renderMarkdown({ force: true, skipMermaidHydration: true });
await window.MermaidTRT.renderIn(viewer);
await waitForTwoAnimationFrames();
```

완료 후에는 다음 조건을 확인한다.

```js
wrapperCount > 0 && renderedSvgCount === wrapperCount
```

Markdown에 Mermaid fence가 있는데 조건을 만족하지 못하면 원본 코드를 이미지처럼 내보내지 말고 내보내기를 중단한다.

## 7. DOCX 내보내기

### 7.1 이미지 수집

`createCurrentDocumentDocxBlob()`은 모든 `.trt-mermaid-wrapper`를 순회하고 공통 PNG 변환기를 호출한다.

```js
const rendered = await MermaidTRT.exportWrapperImage(wrapper, 'png');
```

DOCX 모듈에 전달하는 항목에는 다음 정보가 필요하다.

```js
{
  type: 'image',
  src: rendered.dataUrl,
  width: rendered.width,
  height: rendered.height,
  mermaidSource: wrapper.dataset.mermaidOriginalSource
}
```

### 7.2 이미지와 원본 코드 함께 보존

`markdownToDocxItems()`는 Mermaid fence의 정규화된 소스와 `mermaidSource`가 같은 이미지를 찾는다. 일치하면 다음 순서로 DOCX 항목을 만든다.

1. 렌더링된 고해상도 Mermaid 이미지
2. 원래 Mermaid 코드 블록

원본 코드는 도표를 Word에서 확인한 뒤 다시 Markdown 편집기로 가져가 재사용할 수 있도록 의도적으로 유지한다. Mermaid가 아닌 일반 코드 블록의 기존 동작은 변경하지 않는다.

## 8. PDF 내보내기

`createPdfRenderedElement()`는 실제 viewer를 직접 수정하지 않고 복제한다.

1. 원본 viewer와 복제 viewer의 Mermaid 래퍼를 같은 순서로 대응시킨다.
2. 원본 래퍼를 공통 8배 PNG로 변환한다.
3. 복제본의 Mermaid 래퍼만 `<figure class="pdf-mermaid-rendered-image"><img ...></figure>`로 교체한다.
4. `break-inside:avoid`, `page-break-inside:avoid`로 이미지 내부 분할을 막는다.
5. `max-width:100%`, `max-height:250mm`, `object-fit:contain`으로 비율을 유지하며 A4 페이지 안에 배치한다.
6. 변환된 복제 DOM을 HTML 내보내기 모듈과 PDF 미리보기에 전달한다.

PNG의 `width`와 `height` 속성에는 실제 원본 픽셀 크기를 넣고, 표시 크기는 CSS로 제어한다. 원본 픽셀을 줄여 다시 래스터화하지 않는다.

## 9. PDF 미리보기 이미지 크기 조절

### 9.1 선택과 손잡이

PDF 미리보기에서 이미지 또는 Mermaid figure를 클릭하면 선택 테두리와 `.pdf-image-resize-handle`을 추가한다. 손잡이는 오른쪽 아래에 배치하고 `pointerdown`으로 드래그를 시작한다.

### 9.2 크기 계산

- 드래그 시작 시 이미지의 현재 너비와 페이지 콘텐츠 너비를 기록한다.
- 포인터 이동량을 반영해 새 너비를 계산한다.
- 페이지 폭에 대한 백분율로 `style.width`를 저장한다.
- `height:auto`, `max-width:100%`를 유지해 종횡비를 보존한다.
- 최소/최대 범위를 적용해 이미지가 사라지거나 페이지 밖으로 과도하게 넘치지 않게 한다.

### 9.3 상태 저장과 PDF 반영

크기 변경 후 수정된 단위의 `outerHTML`을 `state.objectEdits`에 저장한다. 이후 재페이지 나누기, 실행 취소, 문서별 inDB 레이아웃 저장과 최종 PDF 생성은 이 HTML을 사용한다.

선택용 손잡이와 안내 표시는 미리보기 전용 요소이므로 저장·PDF 캡처 전 제거해야 한다.

## 10. 다른 프로젝트로 이식하는 순서

MDproViewer 등에 적용할 때 다음 순서를 권장한다.

1. Mermaid 래퍼에 원본 소스를 보존하는 `data-mermaid-source` 계약을 먼저 적용한다.
2. `exportMermaidWrapperImage()`와 관련 SVG 복제·라벨 변환 함수를 이식한다.
3. 보기 모드의 `SVG`, `PNG` 버튼을 기존 이미지 삽입 API에 연결한다.
4. 실제 보기 모드 CSS를 화면 밖에서 재현하는 내보내기 준비 함수를 구현한다.
5. DOCX가 공통 PNG 변환기를 사용하고 이미지와 원본 Mermaid 코드를 모두 넣도록 연결한다.
6. PDF용 viewer 복제본에서 Mermaid 래퍼를 PNG figure로 교체한다.
7. PDF 미리보기의 선택·드래그·`objectEdits` 저장 기능을 연결한다.
8. 스크립트 URL의 캐시 버전을 갱신한다.
9. 실제 한글·영문 혼합 도표로 브라우저, PDF, DOCX를 모두 검증한다.

## 11. 포팅 시 지켜야 할 규칙

- PDF, DOCX, 보기 모드마다 별도 PNG 변환기를 만들지 않는다.
- 렌더링 완료 전 `cloneNode()`로 내보내기 DOM을 만들지 않는다.
- 편집 모드의 숨겨진 viewer를 너비 0 또는 보기 모드 CSS 없이 렌더링하지 않는다.
- 자동 Mermaid 후처리와 내보내기 Mermaid 렌더링을 동시에 실행하지 않는다.
- `foreignObject`의 외부 CSS를 그대로 기대하지 않는다.
- 글자에 `stroke:none`과 `stroke-width:0`을 강제한다.
- PNG 배율을 CSS 표시 크기와 혼동하지 않는다. 원본 픽셀은 고해상도로 유지하고 문서 안 표시 크기만 CSS/DOCX extent로 조절한다.
- DOCX에서 Mermaid 이미지를 넣더라도 원본 Mermaid 코드를 삭제하지 않는다.
- PDF 크기 조절 UI 요소를 최종 문서 HTML에 저장하지 않는다.
- 렌더러 변경 시 `index.html`의 캐시 버전을 반드시 갱신한다.

## 12. 검증 체크리스트

### 정적·자동 검증

- `node --check mdpro/js/mermaid/mermaid_render.js`
- `node --check mdpro/js/app.js`
- `node --check mdpro/js/export/pdf-export.js`
- `node --check mdpro/js/extendFiles/docx-export.js`
- `node --test tests/mermaidViewImageInsert.test.mjs`
- `node --test tests/docxMermaidExport.test.mjs`
- `node --test tests/pdfMermaidExport.test.mjs`
- `node --test tests/pdfImageResize.test.mjs`
- `npm run build`
- `git diff --check`

### 실제 화면 검증

- 보기 모드에서 SVG와 PNG 버튼이 `맞춤` 옆에 표시되는가
- PNG 이미지 삽입 미리보기에서 한글과 영문이 선명한가
- 노드 글자가 원래 지정 색상이며 파란 테두리가 없는가
- 예제 PNG가 기대한 8배 픽셀 크기로 생성되는가
- 편집 모드에서 바로 PDF를 열어도 Mermaid가 원본 코드가 아닌 이미지로 보이는가
- PDF에서 긴 도표가 비율을 유지하고 페이지 안에 들어가는가
- PDF 이미지 클릭 시 크기 조절 손잡이가 표시되는가
- 크기 조절 후 PDF 저장 결과가 미리보기와 같은가
- DOCX에 고해상도 이미지와 Mermaid 원본 코드가 모두 존재하는가

## 13. 관련 회귀 테스트

- `tests/mermaidViewImageInsert.test.mjs`: SVG/PNG 버튼, 8배 배율, 라벨 stroke 제거, 공통 API
- `tests/docxMermaidExport.test.mjs`: DOCX 이미지 포함 및 Mermaid 원본 코드 보존
- `tests/pdfMermaidExport.test.mjs`: 공통 PNG 렌더러 사용, 편집 모드 레이아웃 준비, 페이지 분할 방지
- `tests/pdfImageResize.test.mjs`: PDF 이미지 선택 손잡이, 크기 상태 저장과 재페이지 처리

