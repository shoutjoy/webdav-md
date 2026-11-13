# 2026-11-13 그림 캡션 기본 접기

- 변경 ID: MDPRO-20261113-FIGURE-CAPTION-FOLD
- 원본 C:\CusorApps\WebDav-MD\webdav-md, 미커밋. 대상 C:\CusorApps\MDPRO\MDproViewer 미이식.
- 요청: 그림 캡션은 닫아 없애지 않고 제목/토글을 남겨 접고 펼치며 기본 접힘.

## 구현과 보존

`mdpro/index.html`: figure-caption-panel ID/기존 전체 컨트롤 유지. 입력 영역만 새 figure-caption-body.hidden으로 감싸고 헤더의 닫기를 figure-caption-toggle(aria-controls/aria-expanded) 펼치기 버튼으로 변경. 취소도 접는 기존 함수 경로 사용. `삽입 후 닫기` 체크박스는 기존 이미지 창 닫기 기능으로 보존.

`mdpro/js/app.js/toggleCaptionInsertPanel`: figure만 별도 분기. 숨김 여부는 body에서 판정하고 panel은 표시 유지. 펼칠 때 기존 prepareCaptionPanel로 여섯 형식/번호/입력/미리보기 초기화. 접을 때 입력 노드를 삭제하지 않으며 버튼에 포커스 복귀. 표 캡션 분기는 기존 동작 유지. 출력 HTML/번호 재정렬/수식/인쇄 파이프라인 미변경.

`mdpro/imageDB/image_insert.js/openImageInsertModal`: 이전 figure,true 자동 펼치기를 false로 바꿔 이미지 창을 열 때 항상 기본 접힘. app figureCaptionFold=20261113-1/image_insert v20261113-caption-fold-1로 캐시 갱신.

## 검증

app.js/image_insert.js/ai-chat.js 문법 검사 통과. `node --test tests/tableCaptionRenumber.test.mjs` 6개 통과. npm run build 통과(기존 chunk 경고), git diff --check 통과.

Chrome390×844 이미지 창 열기/재열기 시 body.hidden true와 펼치기 제목 확인. 첫 실제 클릭은 초기 sidebar가 가려 실패하여 별도 세션에서 문서 패널 닫기 버튼을 누른 후 재검증: 펼치기 실제 클릭 aria-expanded true/형식6개, 다시 실제 클릭 false/hidden true. 증거 artifacts/figure-caption-fold-390.png. 실제 휴대폰/키보드/그림 캡션 새 삽입 결과는 이번에 미검증.

## 대상 비교와 Tauri

Viewer의 imageDB/image_insert.js에서 openImageInsertModal이 figure,true를 호출하고 index.html에 동일 figure-caption-panel이 있는 것을 읽어 확인. 원본 독립 코드 유지, 전체 파일 복사 금지. figure 분기와 노드 wrapper만 대상에 적응 필요. 대상 웹 검증/frontend/native/설치 모두 대기. Tauri 빌드 요청 없음, 대상 빌드 시 Docs/mdpro-development/TAURI_BUILD.md 준수. 대기 ID는 본 문서 ID.

## 복사할 구현 프롬프트

```text
C:\CusorApps\MDPRO\MDproViewer에서 AGENTS.md와 WebDAV docs/mdpro-development/changes/2026-11-13-figure-caption-fold.md를 읽고 그림 캡션 기본 접기를 구현해줘. 기존 figure-caption-panel의 제목과 토글은 유지하고 입력 영역만 접히게 하며 이미지 창을 열 때 기본 접힘으로 해줘. 기존 형식6개/번호/텍스트/미리보기/재정렬/취소/삽입/삽입 후 닫기를 보존하고 표 캡션 동작은 유지해줘. 전체 파일 복사 없이 대상 함수/초기화에 적응하고 390px 실제 펼치기/접기/재열기와 형식 노출을 검증해줘. 문서·목록·Tauri 대기를 갱신하고 이번에는 Tauri 빌드·설치를 하지 마.
```

## 후속 수정: 모바일 이미지 삽입 압축 팝업 (2026-11-13)

- 사용자 첨부 배치 기준으로 모바일767px 이하에서 업로드/붙여넣기2열, 스케치/Crop/imgBB/내부저장/Gallery/toPC/캡처7개 도구3열, URL입력/MD·HTML삽입/삽입후닫기 및 기본 접힌 그림 캡션 유지.
- `MobileUI/editor-menus.css`: 이미지 popup 좌우8px/최대540px, 상단12px, 높이auto와 모바일 내비/줌바를 제외한 max-height, 내부 스크롤. 초기 검증의620px 고정높이에서 여백이 남아 최종 auto로 보완. 도구 높이30px/글자10px/간격6px, 헤더·URL버튼·캡션 간격 축소. 기존 모든 ID/이벤트 유지.
- `imageDB/image_insert.js/openImageInsertModal`: 모바일에서는 imageInsertDockRight=false로 시작하여 첨부처럼 popup으로 열기. 명시적 Dock 버튼 기능 유지. 열 때 scroll-content의 scrollTop=0. desktop 기본값/기능 변경 없음. index CSS v20261113-6/image JS mobile-compact-1 캐시 갱신.
- Chrome390×844: 로딩 전 API 호출/검사 selector quoting 오류는 재시도. 로딩 대기 후 open API로 실제 창 열기, x8/y12/폭374/초기높이620, 도구3열112px/7개/캡션hidden true 확인. `artifacts/image-insert-compact-390.png` 직접 검토. 최종 높이auto 보완은 실화면 재검증 안 함. 휴대폰/가상 키보드·업로드 외부서비스 미검증.
- image_insert/ai-chat 문법·웹 빌드 통과. diff --check CRLF 경고는 LF 정리 후 통과. 출력·수식·인쇄 미변경.
- Viewer의 기존 이미지 open/패널은 앞 절 비교 참고. 신규 모바일 압축 규칙 대상 이식/실행 미확인. Viewer 웹/frontend/native/설치 대기, 빌드 요청 없음.

```text
C:\CusorApps\MDPRO\MDproViewer에서 AGENTS.md와 본 문서 모바일 이미지 삽입 압축 팝업 절을 읽고 모바일 창을 첨부처럼 업로드/붙여넣기2열·도구7개3열·URL입력·기본접힌 그림캡션으로 열어줘. 창은 좌우8px/최대540px/높이auto와 하단내비를 피한 max-height·내부스크롤로 만들고 모바일 초기popup/스크롤상단을 적용해줘. 모든 기존 기능과 명시적Dock을 유지하고 전체 파일 복사 없이 대상 구조에 적응해줘. 390px 실제 배치/내부스크롤/기능 도달 및 desktop 보존을 검증하고 문서·색인·Tauri 대기를 갱신하되 빌드·설치는 하지 마.
```
