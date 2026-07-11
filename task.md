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
4. **모바일 캘린더 연간 보기 Look & Feel 개선**
   * `js/calendar-mobile-renderer.js`의 모바일 연간 간트 렌더러를 데스크탑 연간 보기와 유사한 막대 색상, 테두리, 월 축, 오늘 강조, 빈 상태 스타일로 정리 완료.
   * 기존 모바일 연간 렌더러의 미정의 변수(`mainCls`, `assignees`, `statusIcon`) 사용 위험을 제거하고, `calendarUxState`의 하위업무/산업색상 옵션을 반영하도록 보완 완료.
   * `index.html`의 `calendar-mobile-renderer.js` 캐시 버전을 `v20260711-v11`로 갱신하고 `npm run build:css`, `node --check`, `jsdom` 렌더러 스모크 검증 완료.

---

## 🚀 다음 진행할 작업 (Next Steps)
### 0. 모바일 캘린더 연간 보기 실제 기기 검수
- [ ] 실제 모바일 브라우저 폭에서 `년간` 탭을 열어 막대 간 겹침, 터치 목표 크기, 긴 업무명 truncation 상태를 육안 확인
- [ ] 필요 시 업무/하위업무가 매우 많은 트래커에서 모바일 연간 뷰의 레인 밀도 보정 추가

### 1. 캘린더 및 간트 차트 실시간 통합 필터링 구현
- [x] **필터 연동 설계**: 테이블 뷰 필터 상태(`state.js` 또는 `app.js` 내 필터 변수)의 캘린더 렌더러 연계 설계 완료
- [x] **캘린더 렌더러 수정**: `calendar-day-renderer.js`, `calendar-month-renderer.js` 등에서 tasks 필터링 적용 완료
- [x] **KPI 요약 동기화**: `calendar-summary-renderer.js` 내 통계 수치 필터 반영 보완 완료
- [x] **동적 이벤트 갱신**: 필터 입력(검색어/담당자 등) 시 캘린더 화면이 실시간 재렌더링되도록 바인딩 완료
- [x] **로컬 검증**: 브라우저 상에서 필터 적용 시 간트 차트 및 달력의 업무 카드가 정상 필터링되는지 최종 검증 완료

### 2. 태스크 상세 변경 이력(Activity Log) 추적 및 타임라인 뷰 추가
- [x] **데이터 스키마 설계**: `activity_logs`에 들어갈 필드(변경자, 변경 시간, 이전 값, 이후 값 등) 정의 및 스키마 검증 준비 완료
- [x] **DB 연동 구현**: `task-service.js`에서 태스크 CRUD 발생 시 변경 로그 생성 및 Firestore 주입 헬퍼 연동 완료
- [x] **로그 조회 기능**: 특정 태스크 ID에 해당하는 최근 변경 이력을 Firestore에서 가져오는 API 추가 완료
- [x] **모달 UI 구현**: 태스크 상세 정보 모달창 하단에 세련된 타임라인(Timeline) 형식의 변경 이력 리스트 렌더링 완료
- [x] **로컬 검증**: 태스크 정보 수정 시 정상적으로 로그가 남고 모달 재진입 시 타임라인에 표시되는지 검증 완료

### 3. 트래커별 미니멀 KPI 목표 배지 구현 (Option A)
- [x] **데이터 스키마 추가**: 트래커 데이터 구조에 `targetKpi` 설정값 바인딩 및 기본값 80% 주입 완료
- [x] **DB CRUD 연동**: `task-service.js`에서 `targetKpi` 저장이 가능하도록 `db_updateTracker` 등 연동 보완 완료
- [x] **헤더 배지 마크업 삽입**: `index.html` 내 트래커 타이틀 옆에 `#tracker-kpi-badge-container` 마크업 주입 완료
- [x] **자동 상태 판정 및 렌더러 구현**: `app.js` 내 `renderTrackerKpiBadge` 함수 작성 완료 (SVG 서클 게이지 및 On/At/Off Track 분기)
- [x] **설정 수정 팝업 바인딩**: 배지 클릭 시 Prompt를 띄워 목표치를 수정하고 Firestore에 실시간 저장하는 핸들러 연결 완료
- [x] **로컬 검증**: 목표치 수정에 따라 실시간으로 배지 상태(On Track 등)가 변하는지 검증 완료 (성공적인 연동 확인)

### 4. 트래커별 커스텀 KPI 매니저 및 전용 입력 모달창 구현
- [x] **데이터 스키마 고도화**: 트래커 데이터 로드 시 `kpiTitle`, `kpiTarget`, `kpiUnit`, `kpiType`, `kpiCurrent` 기본값 주입 연동 완료
- [x] **전용 KPI 설정 모달 마크업**: `index.html`에 세련된 `#modal-kpi-settings` 모달창 마크업 주입 완료
- [x] **모달 컨트롤러 구현**: `modal-controller.js` 내 모달 노출/바인딩 및 저장 기능 (`saveKpiSettings`) 개발 완료
- [x] **KPI 타입별 자동 판정 렌더러 보완**: `app.js` 내 배지 렌더링 로직을 커스텀 KPI 타입에 맞춰 분기 리팩토링 완료
- [x] **로컬 검증**: 수동/자동 KPI 종류별로 배지 수치와 상태(On Track 등)가 부드럽게 갱신되는지 최종 검증 완료 (완벽한 양방향 동기화)

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
