# Smart Task Flow - Production Enhanced Version

이 버전은 기존 3파일 분리 구조에 운영 안정성 개선을 추가한 버전입니다.

## 반영 사항

1. Firebase Auth 준비 상태 가드 추가
2. Firestore `set(..., { merge: true })` 기반 저장 안정화
3. `createdAt`, `updatedAt`, `deletedAt` timestamp 필드 추가
4. Task / Tracker soft delete 적용
5. Tracker명 변경 시 관련 task의 `trackerName` snapshot 보정
6. Tasks / Trackers `onSnapshot()` 실시간 동기화 유지
7. 삭제 복원(Undo)을 hard-create가 아닌 soft-delete 복원 방식으로 변경
8. CSV Object URL 정리
9. Tooltip HTML 주입 가능성 완화
10. GitHub Pages용 `.nojekyll` 포함

## 권장 Firestore Rules

테스트가 끝난 뒤에는 최소한 아래와 같이 인증 사용자만 접근하도록 제한하세요.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 배포

`index.html`, `js/`, `.nojekyll`을 GitHub repository root에 업로드하세요.
