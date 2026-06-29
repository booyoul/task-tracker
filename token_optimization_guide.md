# 🪙 Task Tracker 토큰 최적화 및 프로젝트 유지보수 가이드 (Token Optimization & Maintenance Guide)

이 문서는 Smart Task Flow (Task Tracker) 프로젝트의 아키텍처와 파일 간 결합도를 분석하여, **AI 에이전트가 새로운 대화(채팅)에서 최소한의 토큰만 소모하면서 안전하고 신속하게 유지보수를 수행하도록 규정하는 사전 지침서**입니다.

---

## 🚨 새 대화 시작 시 AI 에이전트 행동 강령 (Agent Protocol)
> [!IMPORTANT]
> **AI 에이전트는 새로운 대화 세션을 시작할 때, 소스 코드를 건드리기 전에 무조건 이 가이드 파일(`token_optimization_guide.md`)을 최우선으로 로드(`view_file`)하여 숙지해야 합니다.**
> 이 파일을 읽지 않은 채 `js/app.js` 나 `index.html` 전체를 읽는 무분별한 `view_file` 호출은 금지됩니다.

---

## 1. 프로젝트 아키텍처 및 모듈 맵 (Architecture Map)
본 프로젝트는 현대식 ES Module을 사용하지 않고, HTML에서 `<script defer>` 태그를 이용해 브라우저의 **전역 스코프(Global Scope)**에 객체와 함수를 순차적으로 주입하여 연동하는 레거시 결합 아키텍처를 가지고 있습니다.

### 스크립트 로드 순서 및 의존성 관계
`index.html` 하단(503~518라인)의 스크립트 적재 순서입니다. 하위 스크립트는 상위 스크립트에서 선언된 전역 변수나 함수에 의존합니다.
1. `firebase.js` (Firebase 초기화 - `type="module"`)
2. `state.js` (전역 변수 `tasks`, `trackers`, `currentTrackerId` 등 상태 선언)
3. `date-risk-utils.js` (날짜 및 위험 요소 판단 유틸)
4. `schema-service.js` (데이터 검증 및 스키마 보정)
5. `calendar-utils.js` / `calendar-day-renderer.js` / `calendar-month-renderer.js` / `calendar-summary-renderer.js` (Gantt 캘린더 및 통계 KPI)
6. `table-mobile-renderer.js` (모바일/리스트 뷰 렌더러)
7. `kanban-renderer.js` (칸반 보드 렌더러)
8. `modal-controller.js` (모달 UI 제어 및 마크업 바인딩)
9. `event-bindings.js` (전역 클릭, 핫키, Drag & Drop 등 이벤트 바인딩)
10. `bootstrap-service.js` (시작 시 데이터 무결성 체크 및 초기화)
11. `app.js` (핵심 비즈니스 로직, 화면 토글, 전역 렌더러 `updateUI`)
12. `task-service.js` (Firestore CRUD 및 데이터 실시간 수신)
13. `export-service.js` (CSV / 엑셀 백업 및 파일 가져오기/내보내기)

### 공유되는 전역 상태 (Shared Globals in `js/state.js`)
- `trackers`: 활성화된 트래커 리스트
- `tasks`: 현재 로드된 전체 업무 목록 (실시간 수신 상태)
- `currentTrackerId`: 현재 활성화된 트래커 ID
- `updateUI()`, `updateTrackerUI()`: `js/app.js`에서 선언된 화면 강제 렌더러 함수들

---

## 2. 작업 도메인별 관련 파일 참조 맵 (Feature-to-File Reference Map)
특정 기능을 유지보수하거나 변경해야 할 때, **전체 파일을 뒤지지 말고 아래의 매핑 표를 참조하여 꼭 필요한 파일만 선별해서 조회**하십시오.

| 작업 내용 | 담당 파일 경로 (Clickable Link) |
| :--- | :--- |
| **기본 UI 구조 및 모달 창 HTML 마크업** | [index.html](file:///home/booyoul/projects/task-tracker-main/index.html) |
| **전역 상태, 더미 데이터, DOMPurify 보안 설정** | [state.js](file:///home/booyoul/projects/task-tracker-main/js/state.js) |
| **Firestore 데이터 쓰기/수정/삭제 및 리스너 등록** | [task-service.js](file:///home/booyoul/projects/task-tracker-main/js/task-service.js) / [firebase.js](file:///home/booyoul/projects/task-tracker-main/js/firebase.js) |
| **화면 모드 토글, 필터 검색, 통계 및 요약 요약 계산** | [app.js](file:///home/booyoul/projects/task-tracker-main/js/app.js) |
| **업무 상세 리스트 뷰, 모바일 뷰, 인라인 수정** | [table-mobile-renderer.js](file:///home/booyoul/projects/task-tracker-main/js/table-mobile-renderer.js) |
| **Gantt 캘린더 렌더링, 일별/월별/보고서 화면 그리기** | `calendar-*.js` 시리즈 / [calendar-utils.js](file:///home/booyoul/projects/task-tracker-main/js/calendar-utils.js) |
| **칸반 보드 UI 및 렌더러** | [kanban-renderer.js](file:///home/booyoul/projects/task-tracker-main/js/kanban-renderer.js) |
| **신규 업무 등록, 수정 모달 및 담당자 멀티 셀렉트 제어** | [modal-controller.js](file:///home/booyoul/projects/task-tracker-main/js/modal-controller.js) |
| **마우스 클릭, 포커스 필터 변경, 일괄 처리 이벤트 바인딩** | [event-bindings.js](file:///home/booyoul/projects/task-tracker-main/js/event-bindings.js) |
| **D-Day 계산, 위험(Risk) 분류 기준** | [date-risk-utils.js](file:///home/booyoul/projects/task-tracker-main/js/date-risk-utils.js) |
| **트래커 및 업무 데이터 정합성 검증 스키마** | [schema-service.js](file:///home/booyoul/projects/task-tracker-main/js/schema-service.js) |
| **데이터 CSV 백업 및 복원** | [export-service.js](file:///home/booyoul/projects/task-tracker-main/js/export-service.js) |

---

## 3. 토큰 최소화 필수 지침 (Token Minimization Rules)

### ① 전체 파일 조회 금지 (`view_file` 최소화)
- `app.js` (70KB, 1100+ lines) 및 `index.html` (46KB)은 한 번에 전체를 읽어들이면 컨텍스트를 과도하게 낭비하여 토큰 비용이 극대화됩니다.
- **규칙**:
  1. `grep_search`를 사용해 수정하려는 키워드나 함수의 라인 범위를 먼저 특정합니다.
  2. `view_file` 호출 시 `StartLine`과 `EndLine`을 명시하여 해당 타겟 구간만 부분 로드합니다.

### ② 부분 편집 도구 필수 사용 (`replace_file_content`)
- 파일 전체를 덮어쓰는 `write_to_file`은 코드 변경량이 작을 때도 전체를 반환하여 막대한 아웃풋 토큰을 소모합니다.
- **규칙**:
  - 소스 코드를 수정할 때는 절대적으로 `replace_file_content` 또는 `multi_replace_file_content` 도구만을 사용합니다.
  - 타겟을 유일하게 매칭시키기 위해 앞뒤 맥락의 줄바꿈과 띄어쓰기를 2~3줄씩 명시하여 교체 대상을 좁힙니다.

### ③ 새로운 대형 기능의 독자적 모듈화 (Modularization Strategy)
- 기존 파일(특히 `app.js`)에 대규모 로직을 무리하게 덧붙이면 추후 코드 가독성과 토큰 소모율이 나빠집니다.
- **규칙**:
  - 추가되는 신규 피처 및 대형 비즈니스/렌더링 로직은 `js/` 디렉토리 아래 독립적인 파일(예: `js/new-feature.js`)로 추가 생성하십시오.
  - `index.html` 하단에 `<script defer src="./js/new-feature.js"></script>`로 태그를 삽입한 후 전역 네임스페이스를 통해 필요한 부분만 바인딩하십시오.

### ④ `grep_search` 활용
- 클래스명, DOM ID, UI 구성 요소를 탐색할 때 소스 코드 전체를 열지 말고 `grep_search`의 `MatchPerLine: true`로 관련 참조 줄을 먼저 한눈에 스캔하여 불필요한 IO를 차단합니다.

---

## 4. 변경 시 유의점 및 검증 규칙 (Verification Rules)
1. **스크립트 주입 순서 검토**: 스크립트를 추가할 경우 전역 상태가 정의되는 `state.js` 아래, 화면 메인 루프가 돌아가는 `app.js` 이전에 적절히 위치했는지 순서를 철저히 검증하십시오.
2. **브라우저 캐시 방지**: `index.html` 수정 시 로드되는 스크립트 경로 뒤의 버전을 쿼리스트링 파라미터(`?v=버전코드`) 형태로 동시 업데이트해 브라우저 캐싱을 방지해야 합니다.
3. **TailwindCSS 빌드 무결성**: 마크업을 변경한 뒤에는 `npm run build:css`를 가동하여 컴파일 오류나 경고가 발생하지 않는지 검증하고 변경 사항을 커밋하십시오.
