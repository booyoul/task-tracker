# Smart Task Flow - Improved Split Version

기존 `code_artifact (1).html`을 `index.html + js/firebase.js + js/state.js + js/app.js` 구조로 분리하고, 운영 안정성을 위한 보완을 적용한 버전입니다.

## 이번 보완 사항

1. `index.html`의 로컬 JS 로딩에 `defer` 적용
2. Firebase persistence 오류 메시지 보완
3. Firestore `onSnapshot()` 기반 실시간 동기화 추가
4. Tooltip 렌더링 시 사용자 입력 HTML 주입 가능성 완화
5. 담당자 필터 option 처리 개선
6. Firestore 저장/스냅샷 경쟁 상황에서 중복 insert 가능성 완화
7. CSV export 후 Object URL 정리
8. 페이지 종료 시 Firestore realtime listener 정리
9. GitHub Pages 호환을 위한 `.nojekyll` 추가

## 배포

`index.html`, `js/` 폴더, `.nojekyll`을 GitHub repository root에 업로드하세요.
