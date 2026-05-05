# 모델 추가·레이아웃·레지스트리 (`readme.txt` 와 별도)

## 소스 레이아웃(요약)

- `10_constants.js` — `API_PREFIX`, `PATH_*`, `PULL_SPECS_BY_GID` / `PUSH_SPECS_BY_GID` 빈 객체, `PROP_LOADING`
- `20_auth.js` — settings gid, 셀 주소, signup/login/refresh
- `30_registry.js` — `registerPullSpecs_`, `registerPushSpecs_` — 모델 스펙을 gid 에 연결
- `utils/api_object.js` — `pick_`, `formatSheetDateTimeWithTz_`, `formatSheetDateTime_`
- `utils/list_query_sort.js` — `makeListSortParamNormalizer_(aliasMap)`
- `models/<name>.js` — `*_PULL_SPEC`, `*_PUSH_SPEC`, 행 매핑, 쿼리 키, `extraCreateRows`, `pushStatusCol`
- `pull.js` / `push.js` — 엔진·트리거
- `main.js` — 메뉴
- `smoke_test.js` — 편집기에서 실행하는 스모크(선택)

## 새 모델(예: posts) 추가 체크리스트

1. 스프레드시트에 탭을 만들고 **gid**(URL `#gid=`)를 확인한다.
2. `src/models/posts.js`를 `notes.js`를 복사해 이름·경로·열 수·쿼리 키·`sort` alias 만 바꾼다.
3. `30_registry.js`의 `registerPullSpecs_` / `registerPushSpecs_` 안에 `PULL_SPECS_BY_GID[POSTS_SHEET_GID] = POSTS_PULL_SPEC` 등 한 줄씩 추가한다.
4. fast2 API의 list 필터 키·허용 `sort` 필드와 시트 쿼리 행이 맞는지 맞춘다.

## UI 없는 테스트

### Node (로컬, 네트워크·스프레드시트 불필요)

```bash
pnpm test
```

또는 `node tests/node/run.mjs`. `pick_`, `makeListSortParamNormalizer_`, `parseListEnvelope_`는 `src/` 실제 코드를 VM에 올려 검증한다.

### GAS 편집기 스모크 (`clasp push` 후)

1. 스프레드시트에서 **확장 프로그램 → Apps Script**로 프로젝트를 연다.
2. 함수 선택에서 예: `smokeTestUtils_` 선택 후 **실행**.
3. **실행 로그** 또는 상단 **보기 → 로그**에서 `Logger` 출력을 확인한다.

`smoke_test.js` 권장 함수:

- `smokeTestUtils_` — pick / sort 정규화 / envelope, API 없음.
- `smokeTestSettingsRead_` — settings E7·G5만 읽고 마스킹 로그, 네트워크 없음.
- `smokeTestNotesListHttp_` — settings의 BASE+G5 토큰으로 notes list GET (통합).

로컬에서 `pnpm test` 후 `clasp push` 하면 된다. (`rootDir`가 `src`이면 `readme_mode.txt`와 `tests/`는 업로드되지 않음.)

## 파일 합침 순서

번호 접두사 `10_`, `20_`, `30_`로 상수·auth·레지스트리가 먼저 오게 했다. 나머지는 알파벳 순이며, 스펙 전역은 `register*` 실행 시점에만 쓰이므로 대부분 안전하다. 모델 파일에서 **다른 파일의 `var`를 읽는 초기화**를 추가할 때는 순서를 확인한다.
