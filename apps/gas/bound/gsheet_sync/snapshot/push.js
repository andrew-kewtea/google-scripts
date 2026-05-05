/**
 * Push (Create / Update / Delete) 엔진·트리거.
 * 메뉴 «Push» 진입점은 ``main.js`` 의 ``pushChangesFromSheet``.
 *
 * 레지스트리: ``30_registry.js`` 의 ``PUSH_SPECS_BY_GID`` · ``registerPushSpecs_``.
 * 상수: ``10_constants.js`` · ``20_auth.js``.
 */

/**
 * onEdit simple trigger — watch 범위 내 셀 수정 시 last_updated_at 자동 갱신.
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
  } catch (err) { /* silent */ }
}

/**
 * onOpen 에서 ``main`` 이 호출 — 등록된 push spec 시트의 data_last_row 복원.
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

function runPushForSpec_(sheet, spec, base, token) {
  var syncedAtRaw = sheet.getRange(spec.layout.syncedAtA1).getValue();
  var syncedAt    = syncedAtRaw instanceof Date
    ? syncedAtRaw : (syncedAtRaw ? new Date(syncedAtRaw) : null);

  var classified = classifyPushRows_(sheet, spec, syncedAt);
  var creates    = classified.creates;
  var updates    = classified.updates;
  var deletes    = classified.deletes;

  if (!creates.length && !updates.length && !deletes.length) {
    writePullStatus_(
      sheet,
      spec.layout.summaryA1,
      spec.layout.syncedAtA1,
      '변경사항 없음 — Push 대상 없음'
    );
    return;
  }

  clearPushStatusCol_(sheet, spec);

  var cOk = 0, uOk = 0, dOk = 0, errCount = 0;

  for (var d = 0; d < deletes.length; d++) {
    var item = deletes[d];
    var resp = httpDeleteBearer_(
      base + spec.basePath + encodeURIComponent(String(item.id)), token);
    var code = resp.getResponseCode();
    if (code >= 200 && code < 300) {
      dOk++;
      writePushRowResult_(sheet, item.rowIndex, spec, -1);
    } else {
      errCount++;
      writePushRowResult_(sheet, item.rowIndex, spec,
        'DELETE FAIL HTTP ' + code + ': ' + resp.getContentText().slice(0, 120));
    }
  }

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
      writePushRowResult_(sheet, item.rowIndex, spec, 1);
    } else {
      errCount++;
      writePushRowResult_(sheet, item.rowIndex, spec,
        'CREATE FAIL HTTP ' + code + ': ' + resp.getContentText().slice(0, 120));
    }
  }

  for (var u = 0; u < updates.length; u++) {
    var item = updates[u];
    var body = buildRequestBody_(item.rowData, spec) || {};
    var url  = base + spec.basePath + encodeURIComponent(String(item.id));
    var resp = httpPatchBearer_(url, token, body);
    var code = resp.getResponseCode();
    if (code >= 200 && code < 300) {
      uOk++;
      writePushRowResult_(sheet, item.rowIndex, spec, 2);
    } else {
      errCount++;
      writePushRowResult_(sheet, item.rowIndex, spec,
        'PATCH FAIL HTTP ' + code + ': ' + resp.getContentText().slice(0, 120));
    }
  }

  var summary = '생성 ' + cOk + '건  수정 ' + uOk + '건  삭제 ' + dOk + '건'
    + (errCount > 0 ? '  오류 ' + errCount + '건 (J열 확인)' : '');
  writePullStatus_(sheet, spec.layout.summaryA1, spec.layout.syncedAtA1, summary);
}

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

function isRowEmptyExceptId_(rowData, spec) {
  for (var i = 0; i < rowData.length; i++) {
    if (i === spec.idCol - 1) continue;
    var v = rowData[i];
    if (v !== '' && v !== null && v !== undefined) return false;
  }
  return true;
}

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
