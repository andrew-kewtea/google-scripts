apps/gas/bound/gsheet_sync/src — 코드 구조 (리팩터 후)
================================================================================
아래 표는 현재 clasp rootDir (= src/) 기준 파일 역할입니다. clasp push 시 같은 프로젝트에 합쳐집니다.

| 파일 Path | 역할 |
|-----------|------|
| http.js | API BASE 정규화, UrlFetchApp POST(JSON)/GET(Bearer), parseJsonSafe_, formatHttpResult_ |
| sheet_util.js | getSheetBySheetId_, readTrimmed_/readTrimmedAt_, clearTabularRange_, writePullStatus_, buildListQueryStringFromKeys_ |
| list_envelope.js | extractItemsFromListEnvelope_, parseListEnvelope_ — items/total 및 서버 에코(page/size/sort/order) 정규화, 구형 응답 폴백 포함 |
| pull_runner.js | runPullList_(resourceSheet, spec) — settings G5 Bearer·GET·데이터 행 채우기·상태 셀·선택 onSuccessExtra |
| models/notes.js | notes 전용 레이아웃·리스트 쿼리 행렬·행 매핑(noteToSheetRow_ 등)·NOTES_PULL_SPEC |
| main.js | onOpen 메뉴, signup/login/refresh(access), PULL_SPECS_BY_GID + registerPullSpecs_(파일 로드 순 회피로 Pull 시점 등록), 기타 CELL_* 설정 |

등록 순서 참고:
- 새 모델(posts 등)은 models/*.js 에 *_PULL_SPEC 을 만들고 main.js 의 registerPullSpecs_() 안에 한 줄 추가하면 됩니다.
- clasp는 파일 이름 알파벳 순으로 스크립트가 합쳐질 수 있어, 전역 변수 초기값에서 NOTES_PULL_SPEC 을 즉시 참조하지 않도록 register 시점 분리되어 있습니다.

기존 배포/clasp 명령·시트 레이아웃 주의는 readme.txt 와 동일하게 따르면 됩니다.
