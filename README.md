# Smart Task Flow - Tracker Sync Fixed

이 버전은 tracker 정보가 다른 브라우저에 동기화되지 않던 문제를 수정한 버전입니다.

## 핵심 수정

1. 기본 tracker를 Firestore `trackers` collection에 자동 보정/생성합니다.
2. tracker 수정 시 `update()` 대신 `set(data, { merge: true })`를 사용합니다.
3. 신규 tracker는 `coll.doc(newId).set(...)` 방식으로 로컬 id와 Firestore document id를 일치시킵니다.
4. tracker 삭제 시 `tracker_` id도 Firestore에서 삭제되도록 수정했습니다.
5. tasks / trackers 모두 `onSnapshot()` 기반으로 실시간 반영됩니다.

## 배포

`index.html`, `js/`, `.nojekyll`을 GitHub repository root에 업로드하세요.
