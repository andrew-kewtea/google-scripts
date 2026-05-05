/**
 * API 객체에서 필드 후보를 꺼내고, 날짜를 시트 표시 문자열로 만든다.
 * 모델 매핑(``noteToSheetRow_`` 등)에서 재사용.
 */

function pick_(obj, keys) {
  if (!obj || typeof obj !== 'object') return '';
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (obj[k] != null && obj[k] !== '') return obj[k];
  }
  return '';
}

/**
 * unix 초 또는 ms 또는 Date → ``Utilities.formatDate`` 문자열.
 * Node 테스트 등에서는 ``timeZone`` 을 넘기고 GAS 전역 대체.
 *
 * @param {*} v
 * @param {string} timeZone e.g. ``Asia/Seoul``
 */
function formatSheetDateTimeWithTz_(v, timeZone) {
  if (v === '' || v == null) return '';
  var ms = v;
  if (typeof v === 'number' && v > 0 && v < 1e12) {
    ms = v * 1000;
  }
  var d = ms instanceof Date ? ms : new Date(ms);
  if (isNaN(d.getTime())) return String(v);
  return Utilities.formatDate(d, timeZone, 'yyyy-MM-dd HH:mm:ss');
}

/** 활성 스프레드시트 타임존으로 ``formatSheetDateTimeWithTz_`` 위임 */
function formatSheetDateTime_(v) {
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  return formatSheetDateTimeWithTz_(v, tz);
}
