/**
 * Fast2 Admin — 메뉴·진입점.
 *
 * 메뉴 항목 → 구현 파일·함수:
 * - 1) Sign up → ``20_auth.js`` — ``signupFromSheet``
 * - 2) Log in → ``20_auth.js`` — ``loginFromSheet``
 * - 3) Refresh access token → ``20_auth.js`` — ``refreshAccessTokenFromSheet``
 *
 * Pull(list): 아래 ``pullListFromSheet`` — 엔진 ``pull.js`` ``runPullList_`` · 스펙 ``models/*.js`` · 등록 ``30_registry.js``.
 * Push: 아래 ``pushChangesFromSheet`` — 엔진 ``push.js`` ``runPushForSpec_`` 등.
 *
 * ID 구분: 스프레드시트 파일 ID( URL ``/d/<id>/`` ) vs 탭 ID( ``#gid=`` ).
 *
 * URL 조합: BASE = settings ``E7``; path = ``API_PREFIX`` (``10_constants.js``) + 모델 경로.
 */

function onOpen() {
  registerPullSpecs_(); // 30_registry.js:14
  registerPushSpecs_(); // 30_registry.js:18
  try { initDataRangeOnOpen_(); } catch (e) { /* 권한 없을 때 silent */ }
  SpreadsheetApp.getUi()
    .createMenu('Fast2 Admin')
    .addItem('1) Sign up', 'signupFromSheet')
    .addItem('2) Log in', 'loginFromSheet')
    .addItem('3) Refresh access token', 'refreshAccessTokenFromSheet')
    .addSeparator()
    .addItem('Pull (list)', 'pullListFromSheet')
    .addItem('Push (create/update/delete)', 'pushChangesFromSheet')
    .addToUi();
}

/** 메뉴 «Pull (list)»: 현재 탭 gid 가 레지스트리에 있으면 해당 spec 으로 list GET. */
function pullListFromSheet() {
  registerPullSpecs_(); // 30_registry.js:14
  var sh = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var gid = sh.getSheetId();
  var spec = PULL_SPECS_BY_GID[gid];
  if (spec) {
    runPullList_(sh, spec); // pull.js:14
    return;
  }
  SpreadsheetApp.getUi().alert(
    'Pull(list)는 이 탭에서 정의되어 있지 않습니다.\n' +
      '활성 gid=' +
      gid +
      '\n등록된 모델: ' +
      formatRegisteredPullModels_() // 30_registry.js:22
  );
}

/** 메뉴 «Push (create/update/delete)». */
function pushChangesFromSheet() {
  registerPushSpecs_(); // 30_registry.js:18
  var sh   = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var spec = PUSH_SPECS_BY_GID[sh.getSheetId()];
  if (!spec) {
    SpreadsheetApp.getUi().alert(
      'Push는 이 탭에서 정의되어 있지 않습니다.\n활성 gid=' + sh.getSheetId()
    );
    return;
  }

  var ss         = SpreadsheetApp.getActiveSpreadsheet();
  var settingsSh = getSheetBySheetId_(ss, SETTINGS_SHEET_GID);
  if (!settingsSh) {
    writePullStatus_( // sheet_util.js:46
      sh,
      spec.layout.summaryA1,
      spec.layout.syncedAtA1,
      '오류: settings 탭을 찾을 수 없습니다.'
    );
    return;
  }

  var base, token;
  try {
    base  = getApiBase_(settingsSh);
    token = readTrimmed_(settingsSh, CELL_OUT_ACCESS);
    if (!token) throw new Error('access token이 비었습니다. settings 탭에서 Log in 하세요 (G5).');
  } catch (err) {
    writePullStatus_( // sheet_util.js:46
      sh,
      spec.layout.summaryA1,
      spec.layout.syncedAtA1,
      'Push 초기화 오류: ' + String(err.message || err)
    );
    return;
  }

  runPushForSpec_(sh, spec, base, token); // push.js:73
}
