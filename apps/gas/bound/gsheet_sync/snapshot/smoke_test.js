/**
 * Apps Script 편집기에서 직접 실행하는 스모크·통합 검증.
 * UI 메뉴 없이 ``실행`` → 보기 ``실행 로그``(또는 Logger)로 확인.
 *
 * ``clasp push`` 후 스프레드시트가 바인딩된 프로젝트에서 실행한다.
 * (통합 테스트는 settings E7·G5 에 값이 있어야 한다.)
 */

/**
 * 1) 순수에 가까운 유틸: pick · sort 정규화 · 목록 envelope 파싱.
 * API/시트 없이 동작.
 */
function smokeTestUtils_() {
  var p = pick_({ a: '', b: 2 }, ['a', 'b']);
  Logger.log('pick expects 2: ' + (p === 2));

  var norm = makeListSortParamNormalizer_({ lastupdatedat: 'last_updated_at' });
  var s = norm('sort', 'LastUpdatedAt');
  Logger.log("sort norm expects last_updated_at: " + (s === 'last_updated_at'));

  var env = parseListEnvelope_({ items: [{ id: 1 }], total: 99 });
  Logger.log('envelope total expects 99: ' + (env.total === 99 && env.items.length === 1));
}

/**
 * 2) settings 시트만 읽기: BASE URL·액세스 토큰 존재 여부(토큰은 앞 8자만).
 * 네트워크 없음.
 */
function smokeTestSettingsRead_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = getSheetBySheetId_(ss, SETTINGS_SHEET_GID);
  if (!sh) {
    Logger.log('FAIL: settings sheet gid=' + SETTINGS_SHEET_GID);
    return;
  }
  var base = getApiBase_(sh);
  var tok = readTrimmed_(sh, CELL_OUT_ACCESS);
  var masked = tok ? String(tok).slice(0, 8) + '…' : '(empty)';
  Logger.log('api base len=' + base.length + ' token preview=' + masked);
}

/**
 * 3) HTTP 통합: settings 토큰으로 notes list GET (시트의 쿼리 행 그대로).
 * Pull 메뉴와 동일 URL 규약. ``registerPullSpecs_`` 필요.
 */
function smokeTestNotesListHttp_() {
  registerPullSpecs_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var settingsSh = getSheetBySheetId_(ss, SETTINGS_SHEET_GID);
  var notesSh = getSheetBySheetId_(ss, NOTES_SHEET_GID);
  if (!settingsSh || !notesSh) {
    Logger.log('FAIL: settings or notes sheet not found');
    return;
  }
  var base = getApiBase_(settingsSh);
  var token = readTrimmed_(settingsSh, CELL_OUT_ACCESS);
  if (!token) {
    Logger.log('FAIL: access token empty (settings G5)');
    return;
  }
  var q = NOTES_PULL_SPEC.buildQueryString(notesSh);
  var url = base + NOTES_PULL_SPEC.listPath + q;
  var resp = httpGetBearer_(url, token);
  var code = resp.getResponseCode();
  var raw = resp.getContentText();
  var json = parseJsonSafe_(raw);
  var env = code >= 200 && code < 300 ? parseListEnvelope_(json) : null;
  Logger.log(
    'GET ' + NOTES_PULL_SPEC.listPath + ' → HTTP ' + code +
      (env ? ' items=' + env.items.length + ' total=' + env.total : ' body=' + String(raw).slice(0, 200))
  );
}
