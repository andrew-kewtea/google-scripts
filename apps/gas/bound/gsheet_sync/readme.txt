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
src/ 코드 구조 (clasp rootDir = src)
================================================================================
프로젝트는 여러 .js 로 나뉘어 있으며 push 시 한 스크립트로 합쳐짐. 파일별 역할 표는 readme2.txt.

| Path            | 요약 |
|-----------------|------|
| main.js         | 메뉴, auth, PULL_SPECS_BY_GID + registerPullSpecs_() |
| http.js         | UrlFetch, BASE, JSON |
| sheet_util.js   | 시트 읽기/초기화, 공통 list 쿼리 문자열 |
| list_envelope.js| items/total (+ page 등) 파싱 |
| pull_runner.js  | runPullList_(sheet, spec) |
| models/notes.js | notes 전용 layout·쿼리·NOTES_PULL_SPEC |

registerPullSpecs_(): clasp 가 파일을 알파벳 순으로 합칠 수 있어, Pull 메뉴 실행 시점에
PULL_SPECS_BY_GID 에 spec 을 넣는다. 새 모델은 이 함수 안에 한 줄 등록.


================================================================================
다른 모델(posts, tasks, users 등) Pull 탭 추가 절차
================================================================================
서버에 GET /api/v1/<리소스>/ 가 있고, 응답이 { items, total, ... } 형태(또는 list_envelope.js 가
흡수하는 구형 래핑)일 때 아래 순서로 확장하면 된다.

1) 스프레드시트
   - 새 탭 만들고 브라우저 URL 에서 #gid=숫자 를 확인한다.
   - 그 숫자를 코드의 *_SHEET_GID 에 넣는다(탭 이름 변경과 무관).

2) models/<이름>.js 를 새로 작성 (notes.js 를 템플릿으로 복사 권장)
   - RESOURCE 라벨(알림용): resourceLabel, 예: 'posts'.
   - listPath: 예 '/api/v1/posts/'
   - 쿼리: PARAM_KEYS 배열, 값이 있는 시트 행/열 시작 칸(useListQuery / list_query 규약과 동일 키).
     sort 정규화가 필요하면 normalize*ForKey 함수만 모델별로 유지.
   - layout: dataFirstRow, numCols, messageA1, syncedAtA1 (Pull 메시지·동기 시각 셀).
   - mapItemToRow: API 객체 한 건 → 시트 한 행 배열 (열 순서는 해당 탭 헤더와 맞출 것).

3) main.js 의 registerPullSpecs_() 안에 한 줄 추가
   - PULL_SPECS_BY_GID[POSTS_SHEET_GID] = POSTS_PULL_SPEC;

4) clasp push 후 해당 탭을 연 상태에서 메뉴 «Pull (list)» 테스트.
   - 인증은 항상 settings 탭의 G5 access Bearer 를 쓴다(변경 없음).

추가(선택): 응답 에코 필드를 다른 셀에 쓰려면 spec.onSuccessExtra(sheet, env) 를 구현한다
(pull_runner.js).


================================================================================
앞으로 할 일 (src/ + 시트 + fast2)
================================================================================
- Push / update: 노트 create·patch·put(또는 form)을 시트에 맞춰 연동. 메뉴는 «Pull (list)»처럼
  단일 항목 유지하고, 새 동작도 활성 탭 gid 레지스트리 패턴과 맞추는 편이 좋음.
- 태그: 목록 API에 tags_display 또는 tags 배열이 내려오도록 fast2 쪽 조정 시 시트 Tags 열이
  채워짐. 쿼리로 태그만 필터하려면 ALLOWED_FILTER_FIELDS·저장소 분기 등 서버 작업 필요
  (models/notes.js 상단 주석 참고).
- 토큰: access 만료(401 Signature has expired 등) 시 Fast2 Admin «3) Refresh access token»
  (settings 탭, G6 refresh → POST /api/v1/auth/token → G5 갱신). refresh 도 만료되면 2) Log in.
- 배포: 스크립트 저장소 push 후에도 웹앱/배포가 특정 버전에 고정되어 있으면 clasp version +
  update-deployment 로 맞출 것.

================================================================================
주의사항
================================================================================
- 시트 gid: NOTES_SHEET_GID 등은 URL `#gid=` 와 같아야 함. 파일을 복제하거나 탭이 바뀌면
  숫자가 달라질 수 있으니 해당 models/*.js 의 상수를 갱신할 것.
- Apps Script getRange(row, column, numRows, numColumns): 세·네 번째 인자는 «끝 행/열»이 아니라
  «행 개수·열 개수». setValues 시 데이터 행 수와 반드시 일치시킬 것.
- List 쿼리(sort 등): fast2 는 snake_case 필드명만 허용(last_updated_at). 시트에 PascalCase를
  쓰면 models/notes.js 의 sort 별칭 치환이 있으나, 서버·시트·코드 중 한곳은 OpenAPI와 맞출 것.
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