# 📋 Smart Task Flow - Task Board (인수인계 현황)

이 파일은 세션 간의 작업 진행 상황을 기록하여 다음 대화에서 업무 흐름을 그대로 이어받기 위한 작업 인수인계용 파일입니다.

---

## 📌 현재 작업 상태
- **상태**: 개발 및 유지보수 준비 완료 (대기 중)
- **대상 프로젝트**: [Smart Task Flow](file:///home/booyoul/projects/task-tracker-main)

---

## ✅ 완료된 작업
1. **컨텍스트 최적화 환경 구축**
   * 글로벌 설정 [config/AGENTS.md](file:///home/booyoul/.gemini/config/AGENTS.md)에 컨텍스트 rot 방지 규칙 정의 완료.
2. **워크스페이스 연동 규칙 수립**
   * 프로젝트 내 [.agents/AGENTS.md](file:///home/booyoul/projects/task-tracker-main/.agents/AGENTS.md)에 세션 간 인수인계용 `task.md` 관리 규칙 명문화 및 반영 완료.
3. **사전 분석 완료**
   * [token_optimization_guide.md](file:///home/booyoul/projects/task-tracker-main/token_optimization_guide.md) 파일을 정독하여 프로젝트 전역 스코프 구조 및 파일 참조 맵 숙지 완료.

---

## 🚀 다음 진행할 작업 (Next Steps)
### 1. 캘린더 및 간트 차트 실시간 통합 필터링 구현
- [x] **필터 연동 설계**: 테이블 뷰 필터 상태(`state.js` 또는 `app.js` 내 필터 변수)의 캘린더 렌더러 연계 설계 완료
- [x] **캘린더 렌더러 수정**: `calendar-day-renderer.js`, `calendar-month-renderer.js` 등에서 tasks 필터링 적용 완료
- [x] **KPI 요약 동기화**: `calendar-summary-renderer.js` 내 통계 수치 필터 반영 보완 완료
- [x] **동적 이벤트 갱신**: 필터 입력(검색어/담당자 등) 시 캘린더 화면이 실시간 재렌더링되도록 바인딩 완료
- [x] **로컬 검증**: 브라우저 상에서 필터 적용 시 간트 차트 및 달력의 업무 카드가 정상 필터링되는지 최종 검증 완료

### 2. 태스크 상세 변경 이력(Activity Log) 추적 및 타임라인 뷰 추가
- [/] **데이터 스키마 설계**: `activity_logs`에 들어갈 필드(변경자, 변경 시간, 이전 값, 이후 값 등) 정의 및 스키마 검증 준비
- [ ] **DB 연동 구현**: `task-service.js`에서 태스크 CRUD 발생 시 변경 로그 생성 및 Firestore 주입 헬퍼 연동
- [ ] **로그 조회 기능**: 특정 태스크 ID에 해당하는 최근 변경 이력을 Firestore에서 가져오는 API 추가
- [ ] **모달 UI 구현**: 태스크 상세 정보 모달창 하단에 세련된 타임라인(Timeline) 형식의 변경 이력 리스트 렌더링
- [ ] **로컬 검증**: 태스크 정보 수정 시 정상적으로 로그가 남고 모달 재진입 시 타임라인에 표시되는지 검증

### 2. 코드 품질 및 기술 부채 개선 백로그 (에이전트 권장)
- [x] **마스터 어드민(Master Admin) 판정 로직 일관성 개선**
  * `bootstrap-service.js`, `auth-service.js`, `admin-approvals.js`에 흩어져 하드코딩된 마스터 어드민 이메일 검사 로직을 공통 함수(`isMasterAdmin`)로 `state.js` 또는 `auth-service.js`로 단일화 및 모듈화.
- [x] **사용자 로그아웃 시 어드민 실시간 리스너 해제 누락 보완**
  * `admin-approvals.js`에서 생성되는 `unsubscribeAdminUsers`와 `unsubscribeApprovedUsers` 리스너를 해제하는 `stopAdminListeners()` 함수를 추가 정의하고, 로그아웃(또는 세션 만료) 시 `stopRealtimeListeners`와 함께 호출하여 Firebase 권한 에러 및 메모리 릭 예방.
- [x] **`db_deleteTracker` 삭제 권한 토스트 문구 오류 수정**
  * `task-service.js`의 `db_deleteTracker` 권한 없음 예외 처리 시 `'트래커 수정 권한이 없습니다.'`로 표시되는 토스트를 `'트래커 삭제 권한이 없습니다.'`로 정상화.
- [x] **루트 디렉토리 임시/레거시 리팩토링 스크립트 정리**
  * 마이그레이션이 끝난 후 방치된 `refactor.js`, `migrate.js`, `test-modal.js` 파일 정리 또는 아카이브 처리.

---

## ⚠️ 개발 주의 사항
1. **무음 오버라이드(Silent Override) 주의**: 함수나 변수를 수정/추가하기 전에 반드시 프로젝트 전역에서 `grep_search`를 돌려 중복 선언 여부를 검사하십시오.
2. **부분 로드 필수**: `js/app.js` 및 `index.html`을 분석할 때는 절대 전체 파일을 조회하지 말고, 특정 라인 범위만 선별 조회하여 토큰을 절약하십시오.
