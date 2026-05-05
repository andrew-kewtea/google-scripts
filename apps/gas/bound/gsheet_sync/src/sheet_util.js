/**
 * 스프레드시트 헬퍼 + 목록 탭 테이블 영역 초기화/상태 표시.
 * Pull 시 Bearer·BASE 는 settings 탭(``20_auth.js`` CELL_* 상수)과 http.js 규약을 따른다.
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
 * ``YYYY-MM-DD HH:mm`` 등의 느슨한 문자열 → Date (로컬 컴포넌트 생성).
 * 실패 시 null.
 */
function tryParseLooseDateString_(s) {
  var m = String(s).trim().match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );
  if (m) {
    var sec = m[6] != null && m[6] !== '' ? parseInt(m[6], 10) : 0;
    return new Date(
      parseInt(m[1], 10),
      parseInt(m[2], 10) - 1,
      parseInt(m[3], 10),
      parseInt(m[4], 10),
      parseInt(m[5], 10),
      sec
    );
  }
  var d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}

/**
 * list 쿼리용: 셀을 DB ``unix timestamp`` 초(정수) 문자열로 읽는다.
 * - Date (시트/날짜 형식) → ``Math.floor(ms/1000)``
 * - 숫자: ``1e12`` 미만이면 초, 이상이면 ms 로 보고 초로 환산
 * - 숫자만 이루어진 문자열 → 그대로 (이미 epoch 초)
 * - ``2026-05-05 10:10:00`` 형 문자열 → 파싱 후 초 (스크립트 타임존 기준; 스프레드시트와 맞추려면 프로젝트 TZ 권장)
 *
 * @returns {string} 비었거나 변환 불가면 ``''``
 */
function readCellAsUnixSecondsForQuery_(sheet, row, col) {
  var v = sheet.getRange(row, col).getValue();
  if (v === '' || v == null) return '';

  if (v instanceof Date) {
    var ms = v.getTime();
    if (isNaN(ms)) return '';
    return String(Math.floor(ms / 1000));
  }
  if (typeof v === 'number' && !isNaN(v)) {
    var n = Math.floor(v);
    if (n <= 0) return '';
    if (n < 1e12) return String(n);
    return String(Math.floor(n / 1000));
  }
  if (typeof v === 'string') {
    var s = v.trim();
    if (!s) return '';
    if (/^\d+$/.test(s)) return s;
    var d = tryParseLooseDateString_(s);
    if (d && !isNaN(d.getTime())) {
      return String(Math.floor(d.getTime() / 1000));
    }
  }
  return '';
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
 * @param {Object<string, boolean>=} epochSecondParamKeys  키가 true 이면 ``readCellAsUnixSecondsForQuery_`` 로 읽음 (Date·BIGINT 호환)
 */
function buildListQueryStringFromKeys_(
  sheet,
  keys,
  valueRow,
  startCol,
  normalizeValueForKey,
  epochSecondParamKeys
) {
  var epoch = epochSecondParamKeys || null;
  var parts = [];
  for (var i = 0; i < keys.length; i++) {
    var paramKey = keys[i];
    var val =
      epoch && epoch[paramKey]
        ? readCellAsUnixSecondsForQuery_(sheet, valueRow, startCol + i)
        : readTrimmedAt_(sheet, valueRow, startCol + i);
    if (!val) continue;
    val = normalizeValueForKey(paramKey, val);
    parts.push(encodeURIComponent(paramKey) + '=' + encodeURIComponent(val));
  }
  return parts.length ? '?' + parts.join('&') : '';
}
