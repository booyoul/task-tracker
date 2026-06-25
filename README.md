# Smart Task Flow - Tracker Ordering Version

기존 production enhanced 버전에 트래커 순서 관리 기능을 추가한 버전입니다.

## 추가/개선 사항

1. 트래커 문서에 `order` 필드 추가
2. 트래커 드롭다운에서 Drag & Drop으로 순서 변경
3. ▲ / ▼ 버튼으로도 트래커 순서 변경 가능
4. 순서 변경 시 Firestore batch write로 전체 order 저장
5. 새로고침/다른 브라우저에서도 동일한 트래커 순서 유지
6. 기존 tracker 문서에 order가 없을 경우 앱 시작 시 기본 order 자동 보정
7. Soft delete, timestamp, Auth guard, realtime sync 등 기존 운영 개선 유지

## 배포

`index.html`, `js/`, `.nojekyll`을 GitHub repository root에 업로드하세요.

## 권장 Firestore Rules

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
