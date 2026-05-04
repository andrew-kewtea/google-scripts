google apps script for google sheet fastapi-sqlalchemy


clasp로 로컬에서 gscript 개발 , not typescript 임

clasp login
스냅샷 받기: clasp pull -P snapshot/.clasp.json
개발본 상태 확인: clasp status -P ./.clasp.json
개발본 푸시: clasp push -P ./.clasp.json
(전체 덮어쓰기가 되어서 remote original 파일들은 전체 삭제 됨)

push만 한다고 해서 “모든 배포 URL·모든 배포 설정이 한 번에 새 코드로 바뀐다”는 보장은 없고, 
배포가 버전에 고정되어 있으면 버전 + 배포 업데이트가 한 번 더 필요합니다.
배포 > 배포 관리
clasp version (clasp create-version)
clasp version
✔ Give a description: hello1
Created version 1


clasp deployments -P ./.clasp.json
(프로젝트 루트에 .clasp.json만 있으면 -P는 생략 가능)
Found 2 deployments.
- AKfycbyfFzdpTx0Gmil6ajQrKoKK6Tci7d06I2xxt9rdHTP8 @HEAD
- AKfycbx9M6AMeALZC2HZ59iMi372OvtVZWIAnjs6kc4tkoq-cmEw4HWhFdjDvM6wrVFO9Mg7Kg @1 - hello1

clasp update-deployment <deploymentId> -V <version번호>
clasp update-deployment AKfycbx9M6AMeALZC2HZ59iMi372OvtVZWIAnjs6kc4tkoq-cmEw4HWhFdjDvM6wrVFO9Mg7Kg -V 1

clasp redeploy <deploymentId> -V <version번호>


================================================================================
앞으로 할 일 (src/main.js + 시트 + fast2)
================================================================================
- Push / update: 노트 create·patch·put(또는 form)을 시트에 맞춰 연동. 메뉴는 «Pull (list)»처럼
  단일 항목 + 활성 탭 gid 분기 패턴을 유지하는 편이 좋음.
- 다른 모델 탭: posts, users 등 추가 시 상수(gid, model 이름) + pullListFromSheet 분기 +
  전용 runPull*(시트 레이아웃·API 경로) 구현.
- 태그: 목록 API에 tags_display 또는 tags 배열이 내려오도록 fast2 쪽 조정 시 시트 Tags 열이
  채워짐. 쿼리로 태그만 필터하려면 ALLOWED_FILTER_FIELDS·저장소 분기 등 서버 작업 필요
  (main.js 상단 주석 참고).
- 토큰: access 만료(401 Signature has expired 등) 시 Fast2 Admin «3) Refresh access token»
  (settings 탭, G6 refresh → POST /api/v1/auth/token → G5 갱신). refresh 도 만료되면 2) Log in.
- 배포: 스크립트 저장소 push 후에도 웹앱/배포가 특정 버전에 고정되어 있으면 clasp version +
  update-deployment 로 맞출 것.

================================================================================
주의사항
================================================================================
- 시트 gid: NOTES_SHEET_GID 는 URL `#gid=` 와 같아야 함. 파일을 복제하거나 탭 순서가 바뀌면
  숫자가 달라질 수 있으니 main.js 상수를 갱신할 것.
- Apps Script getRange(row, column, numRows, numColumns): 세·네 번째 인자는 «끝 행/열»이 아니라
  «행 개수·열 개수». setValues 시 데이터 행 수와 반드시 일치시킬 것.
- List 쿼리(sort 등): fast2 는 snake_case 필드명만 허용(last_updated_at). 시트에 PascalCase를
  쓰면 코드 쪽 sort 별칭 치환이 있으나, 서버·시트·코드 중 한곳은 OpenAPI와 맞출 것.
- 시간 필드: API last_updated_at 은 unix 초(정수). 시트 표시는 코드에서 초→현지 시각으로 변환.
  구간 필터는 last_updated_atFrom / last_updated_atTo 형태(list_query 규약).
- settings 탭: 1) Sign up / 2) Log in / 3) Refresh access token 은 활성 시트 gid=0 일 때만 동작.
- Pull (list): 활성 탭 gid 가 등록된 모델과 일치할 때만 동작. 그 외 탭에서는 안내 알림만 표시.
- ngrok: 로컬 API가 꺼지거나 URL이 바뀌면 연결 실패. 요청 헤더 ngrok-skip-browser-warning 유지.
- 보안: access token 을 스크린샷·채팅에 넣지 말 것. 유출 시 재발급·로테이션 권장.
- 실행 기록: UrlFetch 에 muteHttpExceptions 가 있으면 HTTP 4xx 도 스크립트는 «완료»로 남을 수 있음.
  디버깅은 편집기 실행 + 보기>로그, 또는 GCP 표준 프로젝트 연동 Cloud Logging 활용.
- 시트·코드 셀 위치: settings base 는 E7, access token 은 G5, refresh 는 G6, expire 는 G7
  (main.js 의 CELL_*). 시트 레이아웃이 다르면 상수를 맞출 것.

================================================================================
참고 (이전에 메모해 둔 항목)
================================================================================
- 태그 필터/표시: 쿼리 tag 는 서버 미지원 시 400. E열은 임시로 q(전역 검색) 매핑.
- Push / update: 미구현.
- 토큰 갱신: 메뉴 3) 또는 전면 재발급은 Log in.
- ngrok: 로컬 의존.