# 저장 충돌 방지와 릴리스 검증

- 상태: Active
- 최종 검토일: 2026-10-22
- 관련 코드: [task-service.js](../../../js/task-service.js), [modal-controller.js](../../../js/modal-controller.js), [firestore.rules](../../../firestore.rules), [package.json](../../../package.json)
- 관련 검사: [task-crud-smoke.js](../../../scripts/task-crud-smoke.js), [task-form-smoke.js](../../../scripts/task-form-smoke.js), [firestore-rules.test.js](../../../scripts/firestore-rules.test.js)

## 저장 계약

- 업무 상세 창은 열 당시 원본과 초기 폼 값을 각각 보존한다. 제출 시 변경한 필드만 전달한다. 변경하지 않은 하위 과제 배열은 전송하지 않는다.
- `db_updateTask(id, patch, { expectedTask })`는 트랜잭션에서 최신 문서와 원본의 변경 대상 필드를 비교한다. 다른 필드의 변경은 보존하고, 같은 필드 충돌이나 삭제는 거절한다. 원본 생략 시 현재 로컬 업무를 기준으로 비교한다.
- 하위 과제 배열을 수정하면 배열 전체를 하나의 충돌 단위로 취급한다. 충돌 시 폼 입력을 유지하며 자동 덮어쓰기는 하지 않는다. 트랜잭션 저장은 서버 연결이 필요하다.
- 업무·트래커 폼은 요청 처리 중 반복 제출을 막고 실패 시 잠금을 해제한다.
- 완료 To-do 복사는 사용자·트래커·To-do에서 만든 고정 문서 ID로 트랜잭션 생성한다. 이미 있으면 기존 메모와 댓글을 덮어쓰지 않는다. 예전 무작위 ID 메모는 `sourceTodoId` 조회로 계속 중복을 확인한다.
- 메모 조회 오류는 0건과 구분한다. 오류 캐시는 자동 재시도를 반복하지 않고 사용자의 재시도로 해제한다. 메모 목록 필터는 사용자·트래커별 메모리 상태로 유지한다.

## 검증과 배포 순서

1. `npm run test:release`: JS 구문 검사, CSS 빌드, 스모크·Rules 테스트, 메모·To-do headless Chrome 검사, `git diff --check`.
2. Rules 검증은 `demo-task-tracker-security` 에뮬레이터에서만 실행한다. Java 및 Chrome이 필요하며 Chrome 경로는 `CHROME_PATH`로 지정할 수 있다.
3. 운영 배포 시 변경된 `firestore.rules`를 먼저 배포한다. 새 복사 트랜잭션에는 승인 사용자의 존재하지 않는 메모 단건 읽기 허용이 필요하다. 기존 문서 읽기·목록 조회 권한은 유지한다.
4. Rules 배포 후 새 클라이언트를 게시한다. JS/CSS 변경 시 `index.html` 캐시 버전을 함께 갱신한다.

에뮬레이터 검증 성공은 운영 Rules 배포 완료를 의미하지 않는다. Firebase CLI 디버그 로그에는 환경 정보가 포함될 수 있으므로 전체 로그 대신 결과 요약을 공유한다.
