# MDPro 인라인 이미지 통합 접기 규칙

## 1. 목적

이 문서는 MDPro 편집기에 삽입된 Base64 인라인 이미지의 접기·펼치기 동작을 유지보수할 때 반드시 지켜야 할 구현 계약이다.

긴 이미지 데이터는 편집 화면을 수십 줄 이상 차지할 수 있다. 특히 HTML 이미지 태그에는 `src`와 `alt` 양쪽에 이미지 데이터가 들어갈 수 있으므로 `data:image/...` 문자열만 따로 접으면 `alt`가 화면에 남거나, 펼친 뒤 다시 접을 수 없는 오류가 발생한다.

## 2. 필수 동작 계약

### IMG-FOLD-001: HTML 이미지 태그 전체가 하나의 접기 단위다

`<img>` 안에 접기 기준 길이 이상의 `data:image/...;base64,...`가 있으면 시작 `<`부터 닫는 `>`까지 전체 태그를 하나의 범위로 접는다.

```html
<img src="data:image/png;base64,..." alt="png;base64,...">
```

위 예시는 `src`와 `alt`를 나누지 않고 하나의 접기 배지로 표시해야 한다.

### IMG-FOLD-002: 최초 삽입 직후 전체가 접혀야 한다

이미지 삽입 직후 커서는 보통 태그의 끝 경계에 위치한다. 끝 경계는 태그 내부가 아니라 태그 밖으로 판정한다.

- 금지: `selection.from >= from && selection.from <= to`
- 기준: `selection.from > from && selection.from < to`

끝 경계를 내부로 판정하면 최초 삽입 후 전체 태그 접기가 취소되고 `src`만 별도로 접히는 오류가 생긴다.

### IMG-FOLD-003: 접기와 펼치기는 전체 태그 단위로 왕복해야 한다

- 접힌 배지 클릭: `src`, `alt`, 기타 속성을 포함한 `<img>` 전체 펼치기
- 펼쳐진 이미지 태그 클릭: `<img>` 전체 다시 접기
- 접기 배지의 이벤트는 상위 편집기 클릭 처리기로 전파하지 않는다.

배지의 `mousedown` 처리에는 `preventDefault()`와 `stopPropagation()`을 모두 적용한다. 전파를 막지 않으면 펼치기와 다시 접기가 같은 이벤트에서 연속 실행될 수 있다.

### IMG-FOLD-004: 중첩 접기를 만들지 않는다

전체 `<img>`가 펼쳐진 동안 내부의 `src="data:image..."`에 독립적인 두 번째 접기 배지를 만들지 않는다.

HTML 이미지 범위는 접힌 상태와 펼쳐진 상태 모두 `coveredRanges`에 등록하고, 독립 data URL 접기 단계에서는 이 범위에 포함된 URL을 건너뛴다.

잘못된 화면은 다음과 같다.

```text
<img src="[src만 접힌 배지]" alt="아주 긴 Base64 데이터...">
```

올바른 화면은 접힘 상태에서는 배지 하나, 펼침 상태에서는 태그 전체 원문이다.

### IMG-FOLD-005: 독립 data URL 동작은 보존한다

HTML `<img>` 태그 밖에 단독으로 존재하는 긴 `data:image/...;base64,...`는 기존처럼 data URL 자체를 접을 수 있다. HTML 이미지 통합 접기 규칙 때문에 독립 data URL 지원을 제거해서는 안 된다.

## 3. 기준 구현 위치

| 역할 | 파일 | 기준 코드 |
| --- | --- | --- |
| CodeMirror 접기 범위·위젯·클릭 처리 | `mdpro/js/editor/codemirror-prototype.mjs` | `DATA_IMAGE_HTML_TAG_RE`, `buildDataImageDecorations()`, `collapseExpandedDataImageTag()` |
| 편집기 모듈 캐시 키 | `mdpro/js/app.js` | `OPTIONAL_SCRIPT_SOURCES.codeMirrorPrototype` |
| 상위 앱 스크립트 캐시 키 | `mdpro/index.html` | `app.js?...&dataImageFold=...` |
| PWA 캐시 세대 | `public/service-worker.js` | `CACHE_VERSION` |
| 회귀 계약 | `tests/mobileEditorScroll.test.mjs` | 전체 태그 범위·중첩 방지·클릭 왕복·캐시 키 검사 |

## 4. 캐시 갱신 규칙

소스만 수정하고 캐시 키를 그대로 두면 실행 화면이 이전 모듈을 계속 사용할 수 있다. 다음 세 위치를 한 변경에서 함께 갱신한다.

1. `mdpro/js/app.js`의 `codeMirrorPrototype` 쿼리 버전
2. `mdpro/index.html`의 `dataImageFold` 쿼리 버전
3. `public/service-worker.js`의 `CACHE_VERSION`

브라우저에서 실제 로드된 `<script src>`를 확인하여 새 `codemirror-prototype.mjs` 버전과 새 `app.js` 쿼리 값이 보일 때만 런타임 반영을 주장한다.

## 5. 필수 회귀 시나리오

다음 입력은 `src`와 `alt`가 모두 길어야 한다.

```html
<img src="data:image/png;base64,AAAA..." alt="png;base64,BBBB...">
```

검증 순서:

1. 입력 직후 접기 배지가 정확히 하나인지 확인한다.
2. 화면에 `<img src=` 또는 긴 `alt=` 데이터가 남지 않는지 확인한다.
3. 배지를 클릭한다.
4. `src`와 `alt`를 포함한 태그 전체가 펼쳐지는지 확인한다.
5. 펼친 상태에서 `src`에 별도 접기 배지가 생기지 않는지 확인한다.
6. 펼쳐진 태그의 `src`, `alt`, 태그 끝 부분 중 하나를 클릭한다.
7. 전체 태그가 다시 배지 하나로 접히는지 확인한다.
8. 위 3~7단계를 한 번 더 반복하여 왕복 동작이 일회성 상태에 의존하지 않는지 확인한다.

## 6. 검증 명령

```powershell
node --check mdpro/js/editor/codemirror-prototype.mjs
node --test tests/mobileEditorScroll.test.mjs
npm run build
git diff --check
```

정적 검사와 빌드 성공만으로 완료 처리하지 않는다. 로컬 서버에서 새 캐시 버전을 불러온 별도 탭으로 접기 → 전체 펼치기 → 전체 다시 접기를 직접 실행해야 한다.

## 7. 변경 금지 원칙

- 이미지 원문이나 Base64 데이터를 삭제·변환하여 접힌 것처럼 보이게 하지 않는다.
- `src`와 `alt`를 별도 접기 상태로 관리하지 않는다.
- 접힘 여부를 저장 문서 내용에 기록하지 않는다. 접기는 편집기 표시 상태일 뿐이다.
- 이미지 삽입·저장·내보내기 원문을 접기 UI 때문에 변경하지 않는다.
- 테스트 통과만으로 실제 브라우저 반영을 주장하지 않는다.

## 8. 완료 판정

다음 조건을 모두 만족해야 완료다.

- HTML 인라인 이미지가 배지 하나로 접힌다.
- 한 번의 동작으로 전체 태그가 펼쳐진다.
- 한 번의 동작으로 전체 태그가 다시 접힌다.
- 펼침 상태에서 `src`만 따로 접히지 않는다.
- 독립 data URL 접기는 유지된다.
- 관련 테스트, 구문 검사, 빌드가 통과한다.
- 새 캐시 키가 실제 브라우저에서 로드된다.
- 실제 브라우저 왕복 동작이 확인된다.
