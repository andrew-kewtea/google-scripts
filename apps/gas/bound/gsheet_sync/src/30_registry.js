/**
 * Pull/Push 스펙 런타임 등록.
 *
 * 누가 호출하는가
 * - ``main.js`` : ``onOpen`` → ``registerPullSpecs_`` · ``registerPushSpecs_`` ; ``pullListFromSheet`` → ``registerPullSpecs_`` ; ``formatRegisteredPullModels_`` (미등록 탭 안내)
 * - ``main.js`` : ``pushChangesFromSheet`` (내부에서 ``registerPushSpecs_`` · ``push.js`` 의 ``runPushForSpec_``)
 * - ``push.js``  : ``onEdit`` · ``initDataRangeOnOpen_`` → ``registerPushSpecs_``
 * - ``smoke_test.js`` : HTTP 스모크 전 스펙·토큰 준비 시 ``registerPullSpecs_`` 등
 *
 * 모델 스펙 객체(``NOTES_PULL_SPEC`` 등)는 ``models/*.js`` 에 정의. 파일 합친 뒤에는 전역에 존재하고,
 * 위 함수들은 실행 시점에만 대입하므로 선언 순서 이슈를 피한다.
 */

function registerPullSpecs_() {
  PULL_SPECS_BY_GID[NOTES_SHEET_GID] = NOTES_PULL_SPEC;
}

function registerPushSpecs_() {
  PUSH_SPECS_BY_GID[NOTES_SHEET_GID] = NOTES_PUSH_SPEC;
}

function formatRegisteredPullModels_() {
  registerPullSpecs_();
  var parts = [];
  for (var gid in PULL_SPECS_BY_GID) {
    if (!Object.prototype.hasOwnProperty.call(PULL_SPECS_BY_GID, gid)) continue;
    var sp = PULL_SPECS_BY_GID[gid];
    parts.push(String(sp.resourceLabel || 'model') + ' (gid=' + gid + ')');
  }
  return parts.join(', ');
}
