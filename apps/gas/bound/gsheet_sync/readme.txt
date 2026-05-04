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