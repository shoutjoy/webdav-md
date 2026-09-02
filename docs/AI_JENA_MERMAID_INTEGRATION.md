# AI JENA Mermaid 직접 생성 적용 안내

2026-09-01 사용자 요청으로 사전 검증/자동 재수정 방식을 폐기했다. 현재 WebDAV MDPRO에 적용했으며 다른 앱은 아래 내용을 이식한다.

## 적용 방법

1. AI JENA 시스템 지침에 짧은 Mermaid 작성 규칙을 직접 포함한다. 별도 guard 스크립트나 자료 조회를 요구하지 않는다.
2. 최종 본문의 내부 [ANSWER], [/ANSWER] 구분 태그를 정리한다. 코드 예제 안의 리터럴은 보존한다.
3. 생성 완료 및 이어서 작성에서 사전 검증과 자동 수정 요청을 실행하지 않는다.
4. 문서 삽입 시 검증 모듈 유무나 문법 오류를 이유로 막지 않는다. 선택 범위와 Undo/Redo는 유지한다.
5. 저장된 assistant 메시지의 notice에서 폐기된 Mermaid 검증 경고만 제거한다. 다른 오류/출력 한도 안내는 유지한다.
6. 생성 중지와 뒤늦은 응답 무시 처리는 유지한다. 캐시 버전을 갱신하고 재빌드한다.

## 작성 규칙 예시

Mermaid는 N1, N2 같은 단순 ID를 사용하고 라벨을 큰따옴표로 감싼다. 노드와 연결은 별도 줄에 선언한다. subgraph와 코드 블록을 닫고, 요청하지 않은 HTML·아이콘·클릭 동작은 생략한다. 완결된 mermaid 코드 블록을 직접 작성한다.

구현 참고: mdpro/AI_App/aiChat/ai-chat.js의 MERMAID_GENERATION_RULE, stripAnswerProtocolTags, sanitizeAssistantMessage, insertIntoCurrentDocument.

## 이전 방식에서 제거할 항목

- ai-jena-mermaid-guard.js 로딩과 AIJenaMermaidGuard 의존성
- checkMermaidAnswer, loadMermaidForValidation 호출
- 검증 실패 시 삽입 차단과 추가 AI 수정 요청
- 기존 검증 모듈을 복사하라는 이 문서의 이전 안내

일반 미리보기용 Mermaid 렌더러는 제거하지 않는다. 문법 오류가 있는 결과는 미리보기에서 여전히 실패할 수 있다. 사용자가 AI에 수정을 요청하거나 코드를 직접 편집한다. 오류 없는 코드를 보장하는 방식은 아니며 검증으로 인한 대기와 차단을 없애는 방식이다.
