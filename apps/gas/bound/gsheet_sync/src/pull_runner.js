/**
 * ``spec`` 으로 list GET → 시트 채우기. 인증만 settings 탭(``SETTINGS_SHEET_GID``, ``CELL_OUT_ACCESS``).
 */

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} resourceSheet Pull 대상 모델 탭
 * @param {{ listPath:string, buildQueryString:function(GoogleAppsScript.Spreadsheet.Sheet):string,
 *           layout:{dataFirstRow:number,numCols:number,messageA1:string,syncedAtA1:string},
 *           mapItemToRow:function(Object): Array,
 *           onSuccessExtra?: function(GoogleAppsScript.Spreadsheet.Sheet,Object): void }} spec
 */
function runPullList_(resourceSheet, spec) {
  var props = PropertiesService.getScriptProperties();
  var msg = '';
  try {
    props.setProperty(PROP_LOADING, 'true');
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var settingsSh = getSheetBySheetId_(ss, SETTINGS_SHEET_GID);
    if (!settingsSh) {
      throw new Error(
        'settings 탭(gid=' + SETTINGS_SHEET_GID + ')을 찾을 수 없습니다.'
      );
    }
    var base = getApiBase_(settingsSh);
    var token = readTrimmed_(settingsSh, CELL_OUT_ACCESS);
    if (!token) {
      throw new Error('access token이 비었습니다. settings 탭에서 Log in 하세요 (G5).');
    }

    var q = spec.buildQueryString(resourceSheet);
    var url = base + spec.listPath + q;

    var resp = httpGetBearer_(url, token);
    var code = resp.getResponseCode();
    var raw = resp.getContentText();
    var json = parseJsonSafe_(raw);

    if (code < 200 || code >= 300) {
      msg = formatHttpResult_(code, raw, json);
    } else {
      var env = parseListEnvelope_(json);
      var rows = [];
      for (var i = 0; i < env.items.length; i++) {
        rows.push(spec.mapItemToRow(env.items[i]));
      }

      clearTabularRange_(
        resourceSheet,
        spec.layout.dataFirstRow,
        spec.layout.numCols
      );

      if (rows.length) {
        resourceSheet
          .getRange(
            spec.layout.dataFirstRow,
            1,
            rows.length,
            spec.layout.numCols
          )
          .setValues(rows);
      }

      // push / onEdit 에서 watch 범위 계산에 사용. key = 'data_last_row_<gid>'
      props.setProperty(
        'data_last_row_' + spec.sheetGid,
        String(rows.length > 0
          ? spec.layout.dataFirstRow + rows.length - 1
          : spec.layout.dataFirstRow - 1)
      );

      msg = 'OK — ' + rows.length + '건 (total=' + env.total + ')';

      if (spec.onSuccessExtra) {
        spec.onSuccessExtra(resourceSheet, env);
      }
    }
  } catch (e) {
    msg = String(e.message || e);
  } finally {
    props.setProperty(PROP_LOADING, 'false');
  }

  writePullStatus_(
    resourceSheet,
    spec.layout.messageA1,
    spec.layout.syncedAtA1,
    msg
  );

  if (msg.indexOf('OK —') !== 0) {
    SpreadsheetApp.getUi().alert(msg);
  }
}
