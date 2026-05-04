/**
 * 스프레드시트 헬퍼 + 목록 탭 테이블 영역 초기화/상태 표시.
 * Pull 시 Bearer·BASE 는 settings 탭(main.js CELL_* 상수)과 http.js 규약을 따른다.
 */

/**
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {number} sheetId URL ``#gid=`` 과 동일한 탭 ID
 */
function getSheetBySheetId_(ss, sheetId) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === sheetId) {
      return sheets[i];
    }
  }
  return null;
}

function readTrimmed_(sh, a1) {
  return String(sh.getRange(a1).getDisplayValue() || '').trim();
}

function readTrimmedAt_(sh, row, col) {
  return String(sh.getRange(row, col).getDisplayValue() || '').trim();
}

/**
 * 데이터 본문만 비움(헤더·쿼리·메시지 영역 미변경).
 * ``getRange(firstRow, 1, numRows, numCols)`` 규약: 세 번째 인자는 행 개수, 네 번째는 열 개수.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} firstRow 데이터 첫 행(예: notes 9행)
 * @param {number} numCols 채우는 열 개수
 */
function clearTabularRange_(sheet, firstRow, numCols) {
  var last = sheet.getMaxRows();
  if (last < firstRow) return;
  var numRows = last - firstRow + 1;
  sheet.getRange(firstRow, 1, numRows, numCols).clearContent();
}

/**
 * Pull 한 줄 결과 + 동기 시각(예: notes G4 메시지, I4 타임스탬프).
 */
function writePullStatus_(sheet, messageA1, syncedAtA1, messageText) {
  sheet.getRange(messageA1).setValue(messageText);
  sheet.getRange(syncedAtA1).setValue(new Date());
}

/**
 * 한 행에 나열된 시트 표시값을 ``paramKeys`` 순으로 query string 에 붙임(빈 값 제외).
 * Vue ``useListQuery.buildParams`` 가 만드는 쿼리 키와 동일해야 한다.
 *
 * @param {function(string,string): string} normalizeValueForKey
 */
function buildListQueryStringFromKeys_(
  sheet,
  keys,
  valueRow,
  startCol,
  normalizeValueForKey
) {
  var parts = [];
  for (var i = 0; i < keys.length; i++) {
    var paramKey = keys[i];
    var val = readTrimmedAt_(sheet, valueRow, startCol + i);
    if (!val) continue;
    val = normalizeValueForKey(paramKey, val);
    parts.push(encodeURIComponent(paramKey) + '=' + encodeURIComponent(val));
  }
  return parts.length ? '?' + parts.join('&') : '';
}
