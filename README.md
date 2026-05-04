# google-scripts
google apps script and chrome extension development



clasp pull  ( 이파일과 main.ts를 수동으로 비교해야) =(clasp clone <scriptId>)
.....코드 편집.....
pnpm run build
clasp push


pnpm run build는 TypeScript 컴파일만 해서 dist/main.js를 만듭니다.
그 다음 clasp push가 dist 파일을 Apps Script API 형식으로 업로드할 때,
.js/.gs 모두 서버 스크립트 파일(SERVER_JS) 로 취급합니다.
그래서 Apps Script 웹 에디터에서는 보통 *.gs 형태로 보일 수 있습니다(표현 방식 차이).
즉:

로컬: main.js
원격 Apps Script: 서버 스크립트 파일(보통 main.gs처럼 보임)
Code.gs라는 이름을 꼭 원하면 로컬 파일 basename을 Code로 맞추는 방식(Code.ts -> Code.js)이 가장 단순합니다.

dist에 없는 기존 Code.gs는 최종적으로 사라지는 쪽으로 동작합니다.
즉 정상 흐름이면 원격에 main.gs(또는 main.js 표시)만 남고 Code.gs는 없어집니다.

appsscript.json의 dependencies는 언제 추가하나?
맞습니다. 추가할 일이 있습니다. 주로 2가지 상황입니다.

Advanced Google Services 사용 시

예: Drive, Sheets, Gmail의 Advanced Service API 사용
dependencies.enabledAdvancedServices에 서비스/버전 추가 필요
Apps Script 라이브러리 사용 시

다른 Script 프로젝트를 라이브러리로 참조할 때
dependencies.libraries에 libraryId, userSymbol, version 등 설정


[npm -pnpm 사용법]
(1)루트에서
pnpm init
수동으로 pnpm-workspace.yaml 생성(packages 경로들)
//버전 확인, 없으면 설치 : npm install -g pnpm, pnpm --version
pnpm install
(2)각 해당 폴더에서, 처음에만 pnpm init, pnpm install
# GAS면
  (1) pnpm add -D @types/google-apps-script  # GAS 코드에서 자동완성/타입체크
# Chrome extension이면
   (2) # pnpm add -D @types/chrome

그 다음부터는 pnpm add ""


[clasp 사용법]
(권한 설정) https://script.google.com/home/usersettings
(설치)
npm install -g @google/clasp   : 3.3.0
clasp -v
각 subprojects에서 :e.g. apps/gas/bound/sheet_naim_connect 
clasp login
clasp clone <SCRIPT_ID>   1hSOCHFTgJwGHhXSqbJ3S5PriogI-a-8TdVXjfiXASRPjCjzxk3SVW8Hr
clasp pull or push, .....clasp run hello,...clasp version "xyz"...clasp logs

pull하면 appsscript.json과 Code.js가 내려옴

web에서 gsheet, docs에서 appsscript를 먼저 생성 하고 clone 하는 것이 좀더 편리

(typescript compiler)
(설치)
컴파일러(typescript)는 공통으로 루트에, GAS 타입은 각 패키지에 둡니다.
1)(루트 1회)pnpm add -Dw typescript; pnpm install 
-Dw = 루트(workspace) devDependency로 설치
모든 서브 프로젝트가 같은 tsc 버전 사용
2) 각 GAS 패키지마다: pnpm add -D @types/google-apps-script


공용 tsconfig 1개로 다 처리하지 말고
필요하면 루트 tsconfig.base.json 상속

1) gas: 보통 tsc 또는 esbuild로 컴파일해서 clasp push
   - GAS 런타임 제약에 주의 할것
   - 보통 src 작성 -> dist 생성 -> clasp는 dist 기준 push로 운영
2) chrome extensions
   - service_worker, content script, popup에 사용
   - esbuild/vite/webpack과 같이 사용. 그래서 noEmit: true로 타입체크만 하고, 실제 산출은 번들러가 담당하는 패턴이 일반적

tsconfig.json: see 각각 samples
{
  "compilerOptions": {
    "target": "ES5",
    "module": "none"
  }
}

(실행) pnpm exec tsc -p tsconfig.json  (현재 폴더안에 있어야함)
src 파일: apps/gas/bound/sheet_naim_connect/src/main.ts

컴파일 결과가 dist에 나오게 설정했다면, .clasp.json의 rootDir를 dist로 맞추고
그 다음: clasp push

tsconfig은 src/dist를 기대하고, .clasp.json은 루트를 보고 있어서 둘이 살짝 어긋난 상태


src/main.ts (개발 코드)
appsscript.json (원본 manifest)
dist/main.js (빌드 결과)
dist/appsscript.json (push용 manifest 복사본)
.clasp.json의 rootDir는 "dist"


1.src 폴더 만들고 Code.js 내용을 src/main.ts로 옮김
2..clasp.json의 rootDir를 dist로 변경
3.빌드 시 appsscript.json을 dist로 복사하는 스크립트 추가
(dist를 “컴파일 결과만”이 아니라 **“push 대상 완성본”**으로 쓰는 패턴)
4.pnpm exec tsc -p tsconfig.json 실행(일회성/직접 실행)
5.clasp push 실행

clasp push는 대략 이렇게 동작:

1..clasp.json 읽음
2.rootDir 기준으로 파일 수집 (dist)
3..claspignore 규칙 적용
4.허용 확장자(scriptExtensions, htmlExtensions, jsonExtensions) 중심으로 업로드
5.원격 GAS 프로젝트 파일을 갱신

src/main.ts면 기본 출력은 dist/main.js (see tsconfig.json)
clasp는 **현재 작업 디렉토리의 .clasp.json**을 읽습니다. 그 안의 rootDir 기준으로 push 대상을 잡습니다.
clasp pull도 같은 .clasp.json을 사용- pull로 받은 JS를 TS로 “자동 역변환”해주지는 않습니다.
source of truth = src/*.ts
원격 웹 에디터 수정은 가급적 안 함
필요 시 pull은 참고용(diff 확인)으로만 보고, TS 코드에 반영은 수동
즉, 네, “자동 TS 복원”은 없어서 원격에서 JS를 자주 직접 고치면 작업이 꼬입니다.

pnpm run <script>: package.json에 스크립트 정의해 반복 실행
package.json 스크립트 추천
scripts를 이렇게 두면 실수 줄어듭니다:
pnpm test, pnpm build, pnpm push

build: pnpm exec tsc -p tsconfig.json && cp appsscript.json dist/appsscript.json
push: pnpm run build && clasp push