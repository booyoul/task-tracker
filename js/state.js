// --- (2) Global State Variables ---
        let trackers = [
            { id: "tracker-1", name: "기본 업무 트래커", desc: "실시간 업무 배정, 기한 관리 및 진척도 모니터링 시스템", order: 1 },
            { id: "tracker-2", name: "🚀 글로벌 프로젝트 2.0", desc: "해외 비즈니스 로드맵 및 다국어 서비스 빌드 스페이스", order: 2 }
        ];
        let currentTrackerId = "tracker-1";

        const getTodayStr = () => {
            const d = new Date();
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        };
        const getFutureDateStr = (days) => {
            const d = new Date(); d.setDate(d.getDate() + days);
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        };

        const escapeHTML = (str) => {
            if (!str) return '';
            return str.toString().replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
        };

        const getMockTasks = () => [
            {
                id: "mock-1",
                trackerId: "tracker-1",
                title: "글로벌 비즈니스 전략 캠페인 수립",
                assignee: "김다은",
                startDate: getTodayStr(),
                dueDate: getFutureDateStr(14),
                priority: "HIGH",
                status: "PROGRESS",
                notes: "글로벌 제안서 및 다국어 타임라인 정렬 필수",
                order: 1,
                subTasks: [
                    { id: "sub-1-1", title: "인플루언서 타겟 국가별 분석", status: "COMPLETED", startDate: getTodayStr(), dueDate: getFutureDateStr(3), assignee: "김다은" },
                    { id: "sub-1-2", title: "영문 소개 프레젠테이션 피드백 조율", status: "PENDING", startDate: getFutureDateStr(4), dueDate: getFutureDateStr(10), assignee: "이준우" }
                ]
            },
            {
                id: "mock-2",
                trackerId: "tracker-1",
                title: "신규 하이브리드 앱 UI 다크모드 대응 고도화",
                assignee: "이준우",
                startDate: getTodayStr(),
                dueDate: getFutureDateStr(5),
                priority: "NORMAL",
                status: "PENDING",
                notes: "디자인 가이드 정렬 및 기기별 대응 테스트",
                order: 2,
                subTasks: [
                    { id: "sub-2-1", title: "색상 리소스 표준 토큰 분류", status: "PENDING", startDate: getTodayStr(), dueDate: getFutureDateStr(4), assignee: "이준우" }
                ]
            },
            {
                id: "mock-3",
                trackerId: "tracker-1",
                title: "전사 데이터 클라우드 인프라 아키텍처 다각화",
                assignee: "박현석",
                startDate: getTodayStr(),
                dueDate: getFutureDateStr(24), 
                priority: "HIGH",
                status: "PROGRESS",
                notes: "AWS 멀티 리전 백업 시나리오 검증 및 마이그레이션",
                order: 3,
                subTasks: [
                    { id: "sub-3-1", title: "레거시 데이터 정합성 검증 필터 생성", status: "COMPLETED", startDate: getTodayStr(), dueDate: getFutureDateStr(8), assignee: "박현석" },
                    { id: "sub-3-2", title: "부하 테스트 시뮬레이션 가동", status: "PENDING", startDate: getFutureDateStr(10), dueDate: getFutureDateStr(18), assignee: "한지민" }
                ]
            }
        ];

        let tasks = getMockTasks(); 
        let deletionHistory = []; 
        let selectedTaskIds = new Set(); 
        let confirmActionCb = null; 
        
        let currentViewMode = 'TABLE'; 
        let currentCalDate = new Date(); 
        let currentCalMode = 'DAY'; 
        let isCalSubTaskVisible = true; // 캘린더에서 하위 업무 표시 토글 상태
        let currentSubTasks = []; 
        let editingSubTaskIndex = -1; 
        let expandedTaskIds = new Set();
        let unsubscribeTasks = null;
        let unsubscribeTrackers = null;
        let isAuthReady = false;
        let lastSaveState = 'idle';
        let draggedTrackerId = null; 

        const AVATAR_COLORS = [
            'bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-sky-100 text-sky-700', 
            'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-violet-100 text-violet-700', 'bg-teal-100 text-teal-700'
        ];
