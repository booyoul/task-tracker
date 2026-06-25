# Smart Task Flow - Split Version

이 패키지는 기존 `code_artifact (1).html`의 하단 inline JavaScript를 3개 JS 파일로 분리한 버전입니다.

## 구조

```text
index.html
js/
  firebase.js
  state.js
  app.js
```

## GitHub Pages 배포 방법

1. 기존 GitHub repository에 `index.html`과 `js/` 폴더를 그대로 업로드합니다.
2. 반드시 `index.html`과 `js` 폴더가 같은 위치에 있어야 합니다.
3. GitHub Pages URL로 접속하여 Console 오류가 없는지 확인합니다.

## 주의

- Firebase CDN script는 기존처럼 `index.html` head에 유지했습니다.
- JS 로드 순서는 `firebase.js` → `state.js` → `app.js` 입니다. 순서를 바꾸면 전역 변수/함수 참조 오류가 날 수 있습니다.
- 현재 Firebase API key는 원본 코드와 동일하게 유지되어 있으므로, 실제 운영 시 Firebase Security Rules를 반드시 점검하세요.
