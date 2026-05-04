build에서 dist/main.js + dist/appsscript.json 생성
clasp push는 dist만 반영


sheet_naim_connect/src/main.ts 기능
“시트 A열이 1인 행만 추출 → 서버 전송 성공분만 A열을 0으로 갱신”
package.json 기준으로는 런타임 의존성은 없고, 개발 의존성 1개만
 - "@types/google-apps-script":  타입체크/자동완성용 (실행 시 서버에 배포되는 라이브러리 아님)

clasp clone <scriptId>
src/*.ts를 source of truth
clasp pull은 별도 스냅샷 폴더(snapshot)에서 참고용으로만 쓰는 패턴이 충돌을 줄입니다.

typescript 테스트
타입/빌드 검증: pnpm exec tsc -p tsconfig.json (현재 프로젝트에 맞음)

dist는 “빌드/푸시 전용”
snapshot은 “원격 백업 전용” 으로 완전히 분리하는 게 가장 덜 헷갈립니다.


snapshot 폴더에 자체 .clasp.json이 없어서, clasp가 상위 폴더(ts_gsheet_sync)의 .clasp.json을 찾아 사용함
상위 .clasp.json에 rootDir: "dist"가 있어서 pull 결과가 ../dist/*로 내려감
clasp pull은 원격 Apps Script 파일명을 그대로 가져옵니다.
지금 원격에 파일명이 main 계열이라 main.js로 내려온 것.
예전에 Code.js였다면 그때 원격 파일명이 Code였던 상태였던 거예요.


clasp 프로젝트로 만들기
가장 쉬운 방법: snapshot 안에서 clasp clone <SCRIPT_ID>
(이러면 snapshot/.clasp.json 생성 + 현재 폴더로 pull)