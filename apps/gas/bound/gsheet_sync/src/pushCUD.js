/**
 * pushCUD.js — Push (Create / Update / Delete) 엔진
 *
 * pull_runner.js 의 PULL_SPECS_BY_GID 패턴과 동일하게 PUSH_SPECS_BY_GID 레지스트리를 사용.
 * 전역 변수(PROP_LOADING 등)는 main.js, HTTP 헬퍼는 http.js, 시트 헬퍼는 sheet_util.js 에 정의.
 *
 * 새 모델 추가 방법:
 *   1. models/<model>.js 에 <MODEL>_PUSH_SPEC 작성 (NOTES_PUSH_SPEC 패턴 참조)
 *   2. registerPushSpecs_() 에 PUSH_SPECS_BY_GID[gid] = <MODEL>_PUSH_SPEC 추가
 *   3. 끝 — push 엔진(runPushForSpec_)은 모델 무관
 */

// ============================================================
// PUSH SPEC REGISTRY
// ============================================================

/** Pull 의 PULL_SPECS_BY_GID 와 대칭. registerPushSpecs_() 에서 채움. */
var PUSH_SPECS_BY_GID = {};

/**
 * 파일 로드 순서와 무관하게 런타임에 등록.
 * main.js onOpen, pushChangesFromSheet, onEdit 에서 호출.
 */
function registerPushSpecs_() {
  PUSH_SPECS_BY_GID[NOTES_SHEET_GID] = NOTES_PUSH_SPEC;
  // 향후: PUSH_SPECS_BY_GID[POSTS_SHEET_GID] = POSTS_PUSH_SPEC;
}

// ============================================================
// TRIGGERS
// ============================================================

/**
 * onEdit simple trigger — watch 범위 내 셀 수정 시 last_updated_at 자동 갱신.
 *
 * - PROP_LOADING === 'true': pull 진행 중이면 skip
 * - ID열·last_updated_at열 수정은 무시
 * - 붙여넣기 등 다행 범위 편집 지원
 * - GAS simple trigger: 스크립트 자체의 setValue 는 onEdit 를 재발화하지 않음(무한 루프 없음)
 */
function onEdit(e) {
  try {
    if (PropertiesService.getScriptProperties().getProperty(PROP_LOADING) === 'true') return;
    registerPushSpecs_();
    var sh   = e.range.getSheet();
    var spec = PUSH_SPECS_BY_GID[sh.getSheetId()];
    if (!spec) return;

    var editRow   = e.range.getRow();
    var editLastR = e.range.getLastRow();
    var editColS  = e.range.getColumn();
    var editColE  = e.range.getLastColumn();

    // 수정 범위의 모든 열이 ID열 또는 last_updated_at열이면 무시
    var allProtected = true;
    for (var c = editColS; c <= editColE; c++) {
      if (c !== spec.idCol && c !== spec.lastUpdatedAtCol) { allProtected = false; break; }
    }
    if (allProtected) return;

    var storedLastRow = Number(
      PropertiesService.getScriptProperties().getProperty('data_last_row_' + spec.sheetGid)
      || String(spec.layout.dataFirstRow - 1)
    );
    var watchLastRow = storedLastRow + spec.extraCreateRows;
    var now = new Date();

    for (var r = Math.max(editRow, spec.layout.dataFirstRow);
             r <= Math.min(editLastR, watchLastRow); r++) {
      sh.getRange(r, spec.lastUpdatedAtCol).setValue(now);
    }
  } catch (err) { /* silent — onEdit 오류로 사용자 작업 방해 방지 */ }
}

/**
 * onOpen 에서 호출 — 등록된 모든 push spec 시트의 ID열을 스캔해
 * 마지막 데이터 행을 'data_last_row_<gid>' 로 ScriptProperties 에 저장.
 * push / onEdit 의 watch 범위 계산 기준.
 */
function initDataRangeOnOpen_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties();
  registerPushSpecs_();
  for (var gid in PUSH_SPECS_BY_GID) {
    if (!Object.prototype.hasOwnProperty.call(PUSH_SPECS_BY_GID, gid)) continue;
    var spec = PUSH_SPECS_BY_GID[gid];
    var sh   = getSheetBySheetId_(ss, Number(gid));
    if (!sh) continue;
    var lastRow     = sh.getLastRow();
    var dataLastRow = spec.layout.dataFirstRow - 1;
    if (lastRow >= spec.layout.dataFirstRow) {
      var ids = sh.getRange(spec.layout.dataFirstRow, spec.idCol,
                            lastRow - spec.layout.dataFirstRow + 1, 1).getValues();
      for (var i = ids.length - 1; i >= 0; i--) {
        if (ids[i][0] !== '' && ids[i][0] != null) {
          dataLastRow = spec.layout.dataFirstRow + i;
          break;
        }
      }
    }
    props.setProperty('data_last_row_' + gid, String(dataLastRow));
  }
}

// ============================================================
// MENU ENTRY
// ============================================================

/**
 * 메뉴 «Push (create/update/delete)»: 활성 탭 gid 에 등록된 push spec 으로 CUD 처리.
 * 결과는 셀(summary + 행별 J열)에 기록. alert 없음(초기화 오류 제외).
 * Push 후 자동 Pull 은 당분간 주석 처리 — 결과 확인 후 수동으로 Pull.
 */
function pushChangesFromSheet() {
  registerPushSpecs_();
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
    sh.getRange(spec.layout.summaryA1).setValue('오류: settings 탭을 찾을 수 없습니다.');
    return;
  }

  var base, token;
  try {
    base  = getApiBase_(settingsSh);
    token = readTrimmed_(settingsSh, CELL_OUT_ACCESS);
    if (!token) throw new Error('access token이 비었습니다. settings 탭에서 Log in 하세요 (G5).');
  } catch (err) {
    sh.getRange(spec.layout.summaryA1).setValue('Push 초기화 오류: ' + String(err.message || err));
    return;
  }

  runPushForSpec_(sh, spec, base, token);

  // 자동 Pull — 당분간 주석 처리 (push 결과 J열 확인 후 수동으로 Pull)
  // runPullList_(sh, PULL_SPECS_BY_GID[sh.getSheetId()]);
}

// ============================================================
// PUSH ENGINE
// ============================================================

/**
 * spec 에 따라 CUD 분류 → 실행 → 결과 기록.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} spec  PUSH_SPECS_BY_GID 값
 * @param {string} base  API base URL
 * @param {string} token Bearer access token
 */
function runPushForSpec_(sheet, spec, base, token) {
  var syncedAtRaw = sheet.getRange(spec.layout.syncedAtA1).getValue();
  var syncedAt    = syncedAtRaw instanceof Date
    ? syncedAtRaw : (syncedAtRaw ? new Date(syncedAtRaw) : null);

  var classified = classifyPushRows_(sheet, spec, syncedAt);
  var creates    = classified.creates;
  var updates    = classified.updates;
  var deletes    = classified.deletes;

  if (!creates.length && !updates.length && !deletes.length) {
    sheet.getRange(spec.layout.summaryA1).setValue('변경사항 없음 — Push 대상 없음');
    return;
  }

  clearPushStatusCol_(sheet, spec);

  var cOk = 0, uOk = 0, dOk = 0, errCount = 0;

  // --- DELETE ---
  for (var d = 0; d < deletes.length; d++) {
    var item = deletes[d];
    var resp = httpDeleteBearer_(
      base + spec.basePath + encodeURIComponent(String(item.id)), token);
    var code = resp.getResponseCode();
    if (code >= 200 && code < 300) {
      dOk++;
      writePushRowResult_(sheet, item.rowIndex, spec, 'DELETE OK');
    } else {
      errCount++;
      writePushRowResult_(sheet, item.rowIndex, spec,
        'DELETE FAIL HTTP ' + code + ': ' + resp.getContentText().slice(0, 120));
    }
  }

  // --- CREATE ---
  for (var c = 0; c < creates.length; c++) {
    var item = creates[c];
    var body = buildRequestBody_(item.rowData, spec);
    if (body === null) {
      errCount++;
      writePushRowResult_(sheet, item.rowIndex, spec, 'CREATE SKIP: 필수 필드 누락');
      continue;
    }
    var resp = httpPostBearer_(base + spec.basePath, token, body);
    var code = resp.getResponseCode();
    if (code >= 200 && code < 300) {
      cOk++;
      var created = parseJsonSafe_(resp.getContentText()) || {};
      var newId   = created.id != null ? created.id : null;
      if (newId != null) sheet.getRange(item.rowIndex, spec.idCol).setValue(newId);
      writePushRowResult_(sheet, item.rowIndex, spec,
        'CREATE OK' + (newId != null ? '  id=' + newId : ''));
    } else {
      errCount++;
      writePushRowResult_(sheet, item.rowIndex, spec,
        'CREATE FAIL HTTP ' + code + ': ' + resp.getContentText().slice(0, 120));
    }
  }

  // --- UPDATE (PATCH) ---
  for (var u = 0; u < updates.length; u++) {
    var item = updates[u];
    var body = buildRequestBody_(item.rowData, spec) || {};
    // last_updated_at 은 요청에 포함하지 않음 — 서버가 자체 갱신
    var url  = base + spec.basePath + encodeURIComponent(String(item.id));
    var resp = httpPatchBearer_(url, token, body);
    var code = resp.getResponseCode();
    if (code >= 200 && code < 300) {
      uOk++;
      writePushRowResult_(sheet, item.rowIndex, spec, 'PATCH OK');
    } else {
      errCount++;
      writePushRowResult_(sheet, item.rowIndex, spec,
        'PATCH FAIL HTTP ' + code + ': ' + resp.getContentText().slice(0, 120));
    }
  }

  var summary = '생성 ' + cOk + '건  수정 ' + uOk + '건  삭제 ' + dOk + '건'
    + (errCount > 0 ? '  오류 ' + errCount + '건 (J열 확인)' : '');
  sheet.getRange(spec.layout.summaryA1).setValue(summary);
}

/**
 * watch 범위의 모든 행을 읽어 create / update / delete 로 분류.
 *
 * 분류 규칙:
 *   create : ID 없음 + last_updated_at 있음 + last_updated_at > last_synced_at
 *   update : ID 있음 + last_updated_at > last_synced_at
 *   delete : ID 있음 + ID 제외 나머지 열 전부 비어있음
 *   skip   : 완전 빈 행
 *
 * @returns {{ creates: Array, updates: Array, deletes: Array }}
 */
function classifyPushRows_(sheet, spec, syncedAt) {
  var props         = PropertiesService.getScriptProperties();
  var storedLastRow = Number(
    props.getProperty('data_last_row_' + spec.sheetGid)
    || String(spec.layout.dataFirstRow - 1)
  );
  var watchLastRow = Math.max(storedLastRow, spec.layout.dataFirstRow - 1) + spec.extraCreateRows;
  var numRows      = Math.max(watchLastRow - spec.layout.dataFirstRow + 1, spec.extraCreateRows);

  var allValues = sheet.getRange(spec.layout.dataFirstRow, 1, numRows, spec.layout.numCols).getValues();

  var creates = [], updates = [], deletes = [];

  for (var i = 0; i < allValues.length; i++) {
    var rowData  = allValues[i];
    var rowIndex = spec.layout.dataFirstRow + i;
    var idVal    = rowData[spec.idCol - 1];
    var luVal    = rowData[spec.lastUpdatedAtCol - 1];
    var hasId    = idVal !== '' && idVal != null;
    var hasLU    = luVal !== '' && luVal != null;

    var allEmpty = true;
    for (var j = 0; j < rowData.length; j++) {
      if (rowData[j] !== '' && rowData[j] != null) { allEmpty = false; break; }
    }
    if (allEmpty) continue;

    var luDate  = hasLU ? (luVal instanceof Date ? luVal : new Date(luVal)) : null;
    var isNewer = !syncedAt || (luDate && !isNaN(luDate.getTime()) && luDate > syncedAt);

    if (!hasId) {
      if (hasLU && isNewer) creates.push({ rowIndex: rowIndex, rowData: rowData });
    } else if (isRowEmptyExceptId_(rowData, spec)) {
      deletes.push({ rowIndex: rowIndex, id: idVal });
    } else if (isNewer) {
      updates.push({ rowIndex: rowIndex, rowData: rowData, id: idVal });
    }
  }
  return { creates: creates, updates: updates, deletes: deletes };
}

// ============================================================
// RESULT OUTPUT
// ============================================================

function writePushRowResult_(sheet, rowIndex, spec, message) {
  sheet.getRange(rowIndex, spec.layout.pushStatusCol).setValue(message);
}

function clearPushStatusCol_(sheet, spec) {
  var props         = PropertiesService.getScriptProperties();
  var storedLastRow = Number(
    props.getProperty('data_last_row_' + spec.sheetGid)
    || String(spec.layout.dataFirstRow - 1)
  );
  var watchLastRow = Math.max(storedLastRow, spec.layout.dataFirstRow - 1) + spec.extraCreateRows;
  var numRows      = Math.max(watchLastRow - spec.layout.dataFirstRow + 1, spec.extraCreateRows);
  if (numRows <= 0) return;
  sheet.getRange(spec.layout.dataFirstRow, spec.layout.pushStatusCol, numRows, 1).clearContent();
}

// ============================================================
// ROW HELPERS
// ============================================================

/**
 * ID열을 제외한 모든 셀이 비어있으면 true (delete 판별).
 * 주의: 0, false 도 값으로 취급 — !v 대신 명시적 비교 사용.
 */
function isRowEmptyExceptId_(rowData, spec) {
  for (var i = 0; i < rowData.length; i++) {
    if (i === spec.idCol - 1) continue;
    var v = rowData[i];
    if (v !== '' && v !== null && v !== undefined) return false;
  }
  return true;
}

/**
 * 값 변환 적용.
 * @param {*}      val
 * @param {string} transform  'text' | 'bool' | 'csv' | undefined
 * @returns {*} 변환된 값, 또는 undefined (빈 값 → skip)
 */
function applyTransform_(val, transform) {
  if (val === '' || val == null) return undefined;
  if (!transform || transform === 'text') return String(val);
  if (transform === 'bool') {
    if (typeof val === 'boolean') return val;
    var s = String(val).toLowerCase().trim();
    if (s === 'true'  || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no')  return false;
    return undefined;
  }
  if (transform === 'csv') {
    return String(val).split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  }
  return String(val);
}

/**
 * spec.requestCols 기반으로 API 요청 body 생성.
 * required 필드가 비어있으면 null 반환 → create skip 신호.
 */
function buildRequestBody_(rowData, spec) {
  var body = {};
  var cols = spec.requestCols;
  for (var i = 0; i < cols.length; i++) {
    var def = cols[i];
    var val = rowData[def.col - 1];
    if ((val === '' || val == null) && def.required) return null;
    var transformed = applyTransform_(val, def.transform);
    if (transformed !== undefined) body[def.field] = transformed;
  }
  if (spec.defaults) {
    for (var k in spec.defaults) {
      if (body[k] === undefined) body[k] = spec.defaults[k];
    }
  }
  return body;
}
