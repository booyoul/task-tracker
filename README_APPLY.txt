적용 방법:
1) 이 ZIP의 index.html을 기존 index.html에 덮어씁니다.
2) js/monthly-kpi-unified-patch.js를 GitHub의 js 폴더에 추가합니다.
3) 기존 js/app.js는 그대로 유지합니다.
4) firebase.js/state.js는 ZIP 파일과 기존 파일이 같으면 굳이 바꾸지 않아도 됩니다.
5) 브라우저에서 Ctrl+Shift+R 후 콘솔에 아래 로그가 보이면 적용 완료입니다.
   Smart Task Flow monthly KPI unified patch v20260625-unified-patch-v2 loaded

이번 v2 핵심:
- sub-task 판단 시 startDate/dueDate fallback을 사용하지 않습니다.
- sub-task의 실제 startDate 또는 dueDate가 해당 월에 있을 때만 해당 월 하위 업무로 계산합니다.
- 따라서 5월에 실제 sub-task가 1개라면 KPI와 badge가 1건으로 표시됩니다.
