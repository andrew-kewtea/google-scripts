

clasp + TypeScript(대규모에 유리) vs native GAS(단순함) 장단점


(1) clasp 사용법
.clasp.json
  "scriptId": "1hSOCHFTgJwGHhXSqbJ3S5PriogI-a-8TdVXjfiXASRPjCjzxk3SVW8Hr",
  "rootDir": "dist",
.claspignore: 업로드 제외 규칙 정의

appsscript.json은 항상 dist로 복사되도록 유지(이미 되어 있음)

clasp pull (clone) 현재 위치에 Code.gs 및 appsscript.json 생성
clasp pull/push/open/status

clasp open
현재 프로젝트(현재 .clasp.json의 scriptId)를 브라우저의 Apps Script 에디터로 열기
코드 편집/실행/로그 확인을 웹에서 바로 할 때 사용
clasp status
로컬 기준으로 push 대상 파일 상태를 보여줌
어떤 파일이 push될지, 무시(.claspignore)되는지 점검할 때 유용
안전 점검 용도로 clasp push 전에 자주 씀

(2) pnpm 사용법
root에 있는 package.json
 "scripts": { "build": "pnpm -r build", "dev": "pnpm -r dev",
    "lint": "pnpm -r lint", "test": "pnpm -r test"
  }
루트에 워크스페이스 설정 있음: pnpm-workspace.yaml
루트 package.json은 pnpm -r ...로 전체 패키지 순회 실행하도록 되어 있음
루트에서 pnpm run build: 워크스페이스 각 패키지의 build를 순회 실행

subproject별 package 설치시: 해당 서브프로젝트 디렉토리에서 pnpm add -D ..
서브프로젝트에서 pnpm run build: 그 폴더의 package.json 스크립트만 실행
pnpm install(전체 루트에서)
 - 의존성 동기화, lockfile 기준으로 설치/동기화, 보통 git pull 후 이걸 1회 실행하면 됨
pnpm up -r (워크스페이스 전체)(신중할것) 각각 subproject에서 pnpm up해보고 문제 있으면 
Git으로 복구 (가장 확실)
package.json, pnpm-lock.yaml을 이전 커밋으로 되돌리면 끝
이후 pnpm install로 lockfile 상태 복원(핵심은: pnpm-lock.yaml도 코드처럼 버전관리하는 겁)

의존성 추가 명령
npm: npm install <pkg> / npm install -D <pkg>
pnpm: pnpm add <pkg> / pnpm add -D <pkg>
lockfile
npm: package-lock.json
pnpm: pnpm-lock.yaml

(3)typescript로 개발 할때 가이드
//typescript로 개발하여 compile변환하여 gappscript upload

개별 typescript방식 subproject에 있는 package.json
"scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "build": "pnpm exec tsc -p tsconfig.json && cp appsscript.json dist/appsscript.json",
    "push": "pnpm run build && clasp push"
  },

build에서 dist/main.js + dist/appsscript.json 생성
clasp push는 dist만 반영


//언제 TS가 특히 유리한가 (예시)
Google Apps Script (3가지)
시트 ETL/정합성 처리: 여러 시트 컬럼을 객체 모델로 매핑하고 검증할 때(컬럼 인덱스 실수 방지, nullable 처리 명확화).
외부 API 연동 자동화: UrlFetchApp 응답 JSON 스키마가 복잡할 때(응답 타입 정의, 필드 누락 조기 검출).
공용 유틸이 늘어나는 업무 스크립트: 권한체크/로깅/에러처리 공통 모듈이 쌓일 때(리팩토링 안정성).
Chrome Extension SW (3가지)
메시지 라우팅 복잡한 확장: popup/content/background 간 메시지 타입이 많을 때(메시지 계약 타입화).
권한/API 조합 많은 확장: chrome.tabs, storage, scripting 등을 같이 쓸 때(비동기 흐름과 API 사용 오타 감소).
중장기 유지보수 제품형 확장: 기능 토글/설정 화면/도메인별 처리 로직 분기 커질 때(리팩토링 비용 절감).



실무에서 많이 쓰는 NPM 패키지 (추천)
@google/clasp
로컬↔Apps Script 동기화 표준 CLI (pull/push/run/logs)
@types/google-apps-script
TypeScript 안 쓴다고 해도, JSDoc + 타입 힌트용으로 유용 (에디터 자동완성 개선)
eslint, eslint-plugin-googleappsscript
GAS 전역객체(SpreadsheetApp 등) 린트 인식 + 코드 품질 관리