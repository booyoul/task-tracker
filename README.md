# Smart Task Flow (Task Tracker)

Smart Task Flow는 Firestore 실시간 데이터베이스 연동과 풍부한 UI 뷰를 제공하는 고도화된 프로젝트 및 협업 업무 일정 관리 도구(Task Tracker)입니다. 
기존 Production Enhanced 버전에 트래커 순서 관리(Ordering) 및 회원가입 승인 관리 등 사내 운영을 위한 최신 개선 사항들이 통합되었습니다.

## 🚀 주요 기능 및 개선 사항

### 1. 트래커 순서 관리 (Tracker Ordering)
- **실시간 정렬**: 트래커 목록 문서에 `order` 필드를 추가하여 모든 기기에서 정렬을 일관되게 유지합니다.
- **Drag & Drop 지원**: 트래커 드롭다운 UI 내에서 마우스 드래그를 통해 트래커 간의 순서를 손쉽게 변경할 수 있습니다.
- **버튼 제어**: 순서 이동 버튼(▲ / ▼)을 통해서도 직관적인 순서 변경이 가능합니다.
- **일괄 동기화**: 순서 변경 시 Firestore `WriteBatch`를 이용하여 전체 트래커의 순서를 원자적(Atomic)으로 일괄 저장합니다.
- **자동 보정 (Fallback)**: 기존 트래커 문서에 `order` 필드가 누락되어 있을 경우, 앱 초기 구동 시 기본 순서 값을 자동으로 산정하여 보정합니다.

### 2. 가입 및 어드민 승인 프로세스 (Auth & User Approval)
- **이메일 필터링 및 인증**: 사내 이메일 도메인 필터링 규격 기반 가입 및 Google Auth 로그인을 제공합니다.
- **어드민 가입 승인**: 사용자가 가입 신청을 하면 `status: pending`, `role: user` 상태로 대기하며, 관리자 권한을 가진 사용자(`role: admin`)가 대시보드(어드민 모달)에서 명시적으로 승인 처리해야 정식 이용이 가능합니다.
- **실시간 비활성 처리**: 가입 거절 또는 권한 정지 시, 실시간으로 세션 및 권한이 동기화되어 즉각적인 쓰기 차단이 실행됩니다.

### 3. 고도화된 캘린더 및 Monthly KPI (v2 패치 완료)
- **하위 업무(Sub-task) 기간 한정 반영**: sub-task 판단 시 시작일/종료일 fallback 규칙을 제거하고, 실제 입력된 기간(startDate ~ dueDate)이 해당하는 월에 포함될 때만 월별 하위 업무 건수로 정밀하게 계산합니다.
- **Gantt 캘린더 통합**: 일별/월별 뷰 및 KPI 보고서 화면 제공. 산업별 커스텀 컬러 테마(`useIndustryColor`)를 지원합니다.

### 4. 다양한 작업 관리 뷰 (Unified Views)
- **테이블 & 모바일 리스트 뷰**: 상세 태스크의 메타데이터 조회 및 인라인 수정 지원.
- **칸반 보드 뷰**: 상태 드래그 앤 드롭을 통한 직관적인 진행 상황(Todo, In Progress, Done) 변경.

### 5. 데이터 백업 및 보정
- **내보내기/가져오기**: CSV 및 Excel 형식의 데이터를 로컬로 다운로드하거나 복원할 수 있습니다.
- **스키마 보정 및 무결성 검증**: 앱 실행 시 유효성 검증 규칙(`schema-service.js`)에 따라 데이터 모델을 자동 정합성 체크 및 정규화합니다.
- **쓰기 실패 안전성**: Firestore가 쓰기를 거부하거나 네트워크 오류가 발생하면 로컬 업무·트래커 상태와 삭제 이력을 변경하지 않고 성공 메시지도 표시하지 않습니다.

---

## 🛠️ 개발 및 실행 방법

### 의존성 설치
본 프로젝트는 Tailwind CSS v4 컴파일러 및 로컬 개발용 패키지를 필요로 합니다.
```bash
npm install
```

### 로컬 개발 서버 구동
로컬 웹 서버를 실행하여 브라우저에서 확인할 수 있습니다.
```bash
npm run dev
```
- 브라우저 접속 주소: `http://localhost:3000`

### CSS 빌드 (Tailwind CSS v4)
마크업 수정 후 Tailwind CSS 스타일 유틸리티를 컴파일하려면 아래 명령어를 실행하십시오.
```bash
npm run build:css
```

### Firestore Rules 로컬 검증

Java 21과 프로젝트 의존성을 설치한 뒤 실제 Firestore Emulator에서 권한 규칙을 검증합니다. 테스트는 `demo-` 프로젝트 ID만 사용하며 운영 Firebase에는 연결하지 않습니다.

```bash
npm run test:rules
```

보안 계약 검사, CRUD 실패 안전성, Firestore Rules 테스트, 모바일 스모크를 모두 실행하려면 다음을 사용합니다.

```bash
npm test
```

---

## 📦 배포 안내

GitHub Pages 또는 정적 호스팅 서비스의 웹 루트 폴더에 아래의 구성 요소를 업로드하십시오.
- `index.html`
- `dist/output.css`
- `js/` 디렉토리 전체
- `favicon.ico`
- `.nojekyll` (GitHub Pages 배포 시 폴더/파일 생략 방지용)

---

## 🔒 권장 Firestore Rules (보안 규칙)

운영 규칙의 단일 소스는 `firestore.rules`입니다. 이 규칙은 다음을 서버에서 강제합니다.

- 승인된 사용자만 트래커, 업무, 메모 및 변경 이력을 읽을 수 있습니다.
- 일반 사용자는 가입 시 자신의 문서를 `pending`/`user`로만 생성할 수 있고 `role`과 `status`를 직접 변경할 수 없습니다.
- 업무와 트래커는 작성자 또는 관리자만 수정·삭제할 수 있습니다.
- 진행 메모와 변경 이력의 작성자 ID는 로그인한 UID와 일치해야 합니다.
- 소유자가 없는 레거시 데이터는 관리자만 수정할 수 있습니다.

규칙을 변경한 후 `npm run smoke:security`와 `npm run test:rules`를 모두 실행하십시오.
