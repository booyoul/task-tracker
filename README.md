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
    
    // [공통 헬퍼 함수]
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    // [관리자 권한 판정 헬퍼 함수]
    // 1. 일반 /users 컬렉션 경로에서의 관리자 판정
    function isAdmin() {
      return isAuthenticated() && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // 2. 환경변수 기반 컬렉션(useEnvFirebase=true) 경로에서의 관리자 판정
    function isEnvAdmin(envAppId) {
      return isAuthenticated() && 
        exists(/databases/$(database)/documents/artifacts/$(envAppId)/public/data/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/artifacts/$(envAppId)/public/data/users/$(request.auth.uid)).data.role == 'admin';
    }

    // 1. 기본적으로 모든 읽기/쓰기를 거부합니다.
    match /{document=**} {
      allow read, write: if false;
    }

    // 2. 트래커 컬렉션 접근 권한
    match /trackers/{trackerId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.createdBy == request.auth.uid || isAdmin());
    }

    // 3. 업무(Tasks) 컬렉션 접근 권한
    match /tasks/{taskId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated();
    }
    
    // 4. 일반 사용자(users) 컬렉션 접근 권한
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && isOwner(userId);
      allow update: if isAuthenticated() && (isOwner(userId) || isAdmin());
      allow delete: if isAuthenticated() && isAdmin();
    }

    // 5. 환경(Env)별 중첩된 데이터 구조에 대응하는 규칙들 (useEnvFirebase = true일 때)
    match /artifacts/{envAppId}/public/data/trackers/{trackerId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.createdBy == request.auth.uid || isEnvAdmin(envAppId));
    }

    match /artifacts/{envAppId}/public/data/tasks/{taskId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated();
    }

    match /artifacts/{envAppId}/public/data/users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && isOwner(userId);
      allow update: if isAuthenticated() && (isOwner(userId) || isEnvAdmin(envAppId));
      allow delete: if isAuthenticated() && isEnvAdmin(envAppId);
    }
  }
}
```
