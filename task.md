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
5. **모바일 연간 간트 막대 정렬 보정**
   * 본 태스크/서브 태스크 막대 두께를 동일하게 계산하고, 각 업무 그룹을 왼쪽 패딩 뒤에서부터 채우도록 `js/calendar-mobile-renderer.js` 배치 로직 보정 완료.
   * 그룹 안에서는 서브 태스크를 왼쪽부터 배치하고 본 태스크를 오른쪽에 두도록 조정했으며, 그룹 단위 사이에 고정 간격을 추가해 구분감을 개선 완료.
   * `index.html`의 `calendar-mobile-renderer.js` 캐시 버전을 `v20260711-v13`로 갱신하고 `npm run build:css`, `node --check`, `jsdom` 레이아웃 스모크 검증 완료.
6. **모바일 연간 보기 밀집 처리**
   * 연간 태스크가 12개를 초과하면 월별 요약 카드와 주요 업무 간트 모드로 자동 전환되도록 `js/calendar-mobile-renderer.js` 보완 완료.
   * 주요 업무는 지연, 높은 우선순위, 진행 중, 대기, 완료 순으로 최대 12개만 간트에 표시하고 전체 건수는 헤더에 `주요 n/전체` 형태로 표시.
   * 월별 요약 카드는 탭 시 해당 월의 월간 보기로 이동하며, `index.html`의 `calendar-mobile-renderer.js` 캐시 버전을 `v20260711-v14`로 갱신.
7. **태스크 입력 모달 모바일/데스크톱 레이아웃 개선**
   * 태스크 입력 모달을 모바일 바텀시트 형태로 유지하면서 데스크톱 폭을 `sm:max-w-2xl`로 확장하고, 날짜/상태 입력을 모바일 1열·데스크톱 2열로 조정 완료.
   * `분류 및 메모`, `하위 과제` 영역을 접힘 섹션으로 분리하고, 기존 업무 편집 시 값이 있는 섹션만 자동으로 펼치도록 `modal-controller.js` 보완 완료.
   * 저장/취소 영역을 모바일에서도 접근하기 쉽도록 sticky 하단 액션으로 조정하고 `modal-controller.js` 캐시 버전을 `v20260711-v11`로 갱신.
8. **월별 요약 화면 모바일 밀도 개선**
   * `js/calendar-summary-renderer.js`의 월별 요약 KPI를 모바일 친화적인 2x2 카드형(`전체`, `지연`, `진행`, `완료율`)으로 재구성 완료.
   * 상태별 업무 섹션을 접힘 구조로 변경하고, `지연`/`진행`은 기본 펼침, `대기`/`완료`는 기본 접힘으로 월별 요약 길이를 축소 완료.
   * 이번 달 진행 메모는 최신 3개만 기본 노출하고 나머지는 `전체 보기` 접힘 영역으로 이동하도록 보완 완료.
   * 업무 카드는 제목, 기간, 담당자, 하위/메모 건수, 진척도 중심으로 축약하고 상세 하위업무/최신 메모 내용은 카드 기본 화면에서 제거 완료.
   * `index.html`의 `calendar-summary-renderer.js` 캐시 버전을 `v20260711-v11`로 갱신하고 `node --check`, `npm run build:css`, `jsdom` 렌더러 스모크 검증 완료.
9. **모바일 연간 보기 밀집 레이아웃 시뮬레이션 검수 및 보정**
   * 390px 모바일 폭 기준 `jsdom` 검수에서 업무 12개와 하위업무가 섞인 경우 연간 간트 막대가 오른쪽으로 크게 잘리는 배치 위험을 확인 완료.
   * `js/calendar-mobile-renderer.js`에 lane/하위업무 막대 폭을 사전 추정하는 밀집 판정 로직을 추가해, 화면 폭을 초과하면 본 업무 중심 간트로 자동 전환하도록 보정 완료.
   * 업무가 더 많은 경우에는 기존 우선순위 기준으로 주요 업무만 표시하고 월별 요약 버튼 12개를 유지하도록 보완 완료.
   * `index.html`의 `calendar-mobile-renderer.js` 캐시 버전을 `v20260711-v15`로 갱신하고 `node --check`, `npm run build:css`, 390px `jsdom` 밀집 스모크 검증 완료.
10. **월별 요약 메모 리뷰 우선순위 조정**
   * 월별 요약의 목적을 한 달 동안 작성된 진행 메모 리뷰로 보고, `js/calendar-summary-renderer.js`에서 메모 섹션을 최상단으로 이동 완료.
   * KPI 대시보드는 메모 영역 아래의 한 줄 요약 바 형태로 축약해 화면 점유 공간을 최소화 완료.
   * `index.html`의 `calendar-summary-renderer.js` 캐시 버전을 `v20260711-v12`로 갱신.
11. **월별 메모 리뷰 UX 강화**
   * `js/calendar-summary-renderer.js`에서 월별 메모 렌더 전에 `taskTitle`, `isSubTask`, `author`, `searchText`, `createdAtTime` 파생 데이터를 구성해 카드 렌더와 필터가 공유하도록 개선 완료.
   * 메모 섹션 제목 아래에 `전체`/`본 업무`/`하위 업무` 세그먼트, 작성자 선택 필터, 메모 전용 검색 입력, `총 n건 · 본 업무 n · 하위 업무 n · 작성자 n명` 미니 통계를 추가 완료.
   * 메모 검색은 제목, 본문, 작성자, 연결 업무명을 기준으로 월별 메모 목록만 클라이언트 필터링하며 기존 전역 업무 검색과 별개로 동작하도록 분리 완료.
   * 메모 카드는 3줄 미리보기를 기본으로 유지하고, 긴 본문은 카드 안의 `더 보기`/`접기` 버튼으로 확장되며 클릭 이벤트가 상세 패널로 전파되지 않도록 보완 완료.
   * 필터/검색/펼침 상태는 현재 렌더 클로저 안에서만 유지되며 월 이동 또는 트래커 변경으로 재렌더되면 초기화되도록 구현 완료.
   * `index.html`의 `calendar-summary-renderer.js` 캐시 버전을 `v20260711-v13`로 갱신하고 `node --check`, `npm run build:css`, `git diff --check`, jsdom 메모 필터 스모크 검증 완료.
12. **모바일 월별 요약 라이트 테마 배경 보정**
   * 모바일 요약 화면에서 `cal-mobile-content`가 데스크톱 요약 렌더러에 의해 재작성될 때 밝은 테마 배경이 어둡게 보일 수 있는 문제를 보정 완료.
   * `js/calendar-summary-renderer.js`에서 모바일 요약 컨테이너를 별도 감지해 `bg-white`, `pb-24`를 유지하고 다크 배경은 `dark:bg-slate-950`에서만 적용되도록 분리 완료.
   * `index.html`의 `calendar-summary-renderer.js` 캐시 버전을 `v20260711-v14`로 갱신하고 `node --check`, `npm run build:css`, jsdom 모바일 배경 클래스 스모크 검증 완료.
13. **Tailwind 다크 모드 기준 보정**
   * 밝은 테마에서도 OS/브라우저 다크 선호 설정 때문에 `dark:` 유틸리티가 적용되어 모바일 요약 배경이 어둡게 남는 원인을 확인 완료.
   * `src/input.css`에 `@custom-variant dark (&:where(.dark, .dark *));`를 추가해 Tailwind `dark:` 유틸리티가 시스템 설정이 아닌 앱의 `.dark` 클래스에만 반응하도록 보정 완료.
   * `index.html`의 `dist/output.css` 캐시 버전을 `v20260711-v2`로 갱신하고 `npm run build:css`, `node --check`, CSS dark variant 검사로 `prefers-color-scheme` 제거 및 `.dark` selector 컴파일을 검증 완료.
14. **모바일 연간 보기 월별 요약 박스 제거**
   * 모바일 캘린더 `년간` 보기에서 태스크가 많을 때 상단에 표시되던 월별 건수 요약 카드 영역을 제거 완료.
   * `js/calendar-mobile-renderer.js`의 compact year 월별 카드 렌더링 블록과 카드 전용 월별 통계 헬퍼를 정리하되, 월 축 탭으로 해당 월 일별 보기로 이동하는 동작은 유지.
   * `index.html`의 `calendar-mobile-renderer.js` 캐시 버전을 `v20260711-v16`으로 갱신.
15. **데스크톱 월별 요약 메모 필터 버튼 줄바꿈 방지**
   * 컴퓨터 뷰의 캘린더 `월별 요약` 메모 필터 세그먼트에서 `본 업무`, `하위 업무` 버튼 텍스트가 두 줄로 접히지 않도록 `whitespace-nowrap`과 최소 폭을 추가 완료.
   * `index.html`의 `calendar-summary-renderer.js` 캐시 버전을 `v20260711-v15`로 갱신.

---

## 🚀 다음 진행할 작업 (Next Steps)
### 1. 모바일 캘린더 연간 보기 실제 브라우저 육안 확인 (QA)
- [ ] 실제 모바일 브라우저 또는 DevTools 모바일 폭에서 `년간` 탭을 열어 막대 간 겹침, 터치 목표 크기, 긴 업무명 truncation 상태 최종 확인
- [ ] 실제 데이터에서 본 업무 중심 전환 문구(`총 n개 · 본 업무`, `주요 n/전체`)가 자연스러운지 확인

### 2. 캘린더 및 간트 차트 실시간 통합 필터링 구현
- [x] **필터 연동 설계**: 테이블 뷰 필터 상태(`state.js` 또는 `app.js` 내 필터 변수)의 캘린더 렌더러 연계 설계 완료
- [x] **캘린더 렌더러 수정**: `calendar-day-renderer.js`, `calendar-month-renderer.js` 등에서 tasks 필터링 적용 완료
- [x] **KPI 요약 동기화**: `calendar-summary-renderer.js` 내 통계 수치 필터 반영 보완 완료
- [x] **동적 이벤트 갱신**: 필터 입력(검색어/담당자 등) 시 캘린더 화면이 실시간 재렌더링되도록 바인딩 완료
- [x] **로컬 검증**: 브라우저 상에서 필터 적용 시 간트 차트 및 달력의 업무 카드가 정상 필터링되는지 최종 검증 완료

### 3. 태스크 상세 변경 이력(Activity Log) 추적 및 타임라인 뷰 추가
- [x] **데이터 스키마 설계**: `activity_logs`에 들어갈 필드(변경자, 변경 시간, 이전 값, 이후 값 등) 정의 및 스키마 검증 준비 완료
- [x] **DB 연동 구현**: `task-service.js`에서 태스크 CRUD 발생 시 변경 로그 생성 및 Firestore 주입 헬퍼 연동 완료
- [x] **로그 조회 기능**: 특정 태스크 ID에 해당하는 최근 변경 이력을 Firestore에서 가져오는 API 추가 완료
- [x] **모달 UI 구현**: 태스크 상세 정보 모달창 하단에 세련된 타임라인(Timeline) 형식의 변경 이력 리스트 렌더링 완료
- [x] **로컬 검증**: 태스크 정보 수정 시 정상적으로 로그가 남고 모달 재진입 시 타임라인에 표시되는지 검증 완료

### 4. 트래커별 미니멀 KPI 목표 배지 구현 (Option A)
- [x] **데이터 스키마 추가**: 트래커 데이터 구조에 `targetKpi` 설정값 바인딩 및 기본값 80% 주입 완료
- [x] **DB CRUD 연동**: `task-service.js`에서 `targetKpi` 저장이 가능하도록 `db_updateTracker` 등 연동 보완 완료
- [x] **헤더 배지 마크업 삽입**: `index.html` 내 트래커 타이틀 옆에 `#tracker-kpi-badge-container` 마크업 주입 완료
- [x] **자동 상태 판정 및 렌더러 구현**: `app.js` 내 `renderTrackerKpiBadge` 함수 작성 완료 (SVG 서클 게이지 및 On/At/Off Track 분기)
- [x] **설정 수정 팝업 바인딩**: 배지 클릭 시 Prompt를 띄워 목표치를 수정하고 Firestore에 실시간 저장하는 핸들러 연결 완료
- [x] **로컬 검증**: 목표치 수정에 따라 실시간으로 배지 상태(On Track 등)가 변하는지 검증 완료 (성공적인 연동 확인)

### 5. 트래커별 커스텀 KPI 매니저 및 전용 입력 모달창 구현
- [x] **데이터 스키마 고도화**: 트래커 데이터 로드 시 `kpiTitle`, `kpiTarget`, `kpiUnit`, `kpiType`, `kpiCurrent` 기본값 주입 연동 완료
- [x] **전용 KPI 설정 모달 마크업**: `index.html`에 세련된 `#modal-kpi-settings` 모달창 마크업 주입 완료
- [x] **모달 컨트롤러 구현**: `modal-controller.js` 내 모달 노출/바인딩 및 저장 기능 (`saveKpiSettings`) 개발 완료
- [x] **KPI 타입별 자동 판정 렌더러 보완**: `app.js` 내 배지 렌더링 로직을 커스텀 KPI 타입에 맞춰 분기 리팩토링 완료
- [x] **로컬 검증**: 수동/자동 KPI 종류별로 배지 수치와 상태(On Track 등)가 부드럽게 갱신되는지 최종 검증 완료 (완벽한 양방향 동기화)

### 6. 코드 품질 및 기술 부채 개선 백로그 (에이전트 권장)
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
