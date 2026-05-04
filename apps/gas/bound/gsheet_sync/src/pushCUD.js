/**
 * pushCUD.js — Push (Create / Update / Delete) engine
 *
 * 이 파일의 전역 변수(PROP_LOADING 등)는 main.js 에서 선언됨.
 * GAS 는 같은 rootDir 내 모든 .js 가 전역 스코프를 공유하므로 그대로 참조 가능.
 *
 * 모델 추가 방법:
 *   1. getPushSpec_() 에 새 gid 분기 추가
 *   2. getPullSpec_() 에 새 gid 분기 추가 (pull 전용 함수 참조)
 *   3. main.js pullListFromSheet() 에 분기 추가 + runPull*() 구현
 */

// ============================================================
// PUSH SPEC
// ============================================================

/**
 * gid 에 해당하는 push spec 반환. 모델 추가 시 분기만 추가.
 *
 * Push spec 필드:
 *   name            - 모델명 (로그/디버그용)
 *   basePath        - REST base path (list = basePath, item = basePath + id)
 *   dataFirstRow    - 데이터 시작 행 (1-based)
 *   numCols         - 읽어올 열 수
 *   idCol           - ID 열 번호 (1-based)
 *   lastUpdatedAtCol - last_updated_at 열 번호 (1-based); 요청 body 에는 포함 안 함
 *   syncedAtCell    - last pull 시각 셀 (A1 표기)
 *   summaryCell     - push 전체 결과 기록 셀 (A1 표기)
 *   pushStatusCol   - 행별 결과 기록 열 번호 (1-based)
 *   extraCreateRows - 데이터 하단 create 대기 행 수
 *   requestCols     - API 요청에 포함할 열 정의 배열
 *     { col, field, required?, transform? }
 *     transform: 'text' | 'bool' | 'csv' | undefined
 *   defaults        - create/patch body 에 기본 적용할 필드 { field: value }
 */
function getPushSpec_(gid) {
  if (gid === NOTES_SHEET_GID) {
    return {
      name:             'notes',
      basePath:         '/api/v1/notes/',
      dataFirstRow:     NOTES_DATA_FIRST_ROW,
      numCols:          NOTES_DATA_NUM_COLS,
      idCol:            1,
      lastUpdatedAtCol: 2,
      syncedAtCell:     NOTES_PULL_SYNCED_AT_A1,
      summaryCell:      NOTES_PUSH_MESSAGE_A1,
      pushStatusCol:    NOTES_PUSH_STATUS_COL,
      extraCreateRows:  NOTES_EXTRA_CREATE_ROWS,
      requestCols: [
        { col: 3, field: 'title',        required: true           },
        { col: 4, field: 'content',      transform: 'text'        },
        { col: 5, field: 'content_type', transform: 'text'        },
        { col: 8, field: 'is_draft',     transform: 'bool'        },
        // col 6 Tags: 관계형 필드. 서버 지원 후 { col: 6, field: 'tags', transform: 'csv' } 추가
        // col 7 Attachments, col 9 Owner_id: 읽기 전용 — 수정해도 반영 안 됨
      ],
      defaults: {},
      // 향후 posts 예시:
      // requestCols: [
      //   { col: 3, field: 'title',  required: true },
      //   { col: 4, field: 'body',   transform: 'text' },
      //   { col: 5, field: 'status', transform: 'text' },
      // ],
    };
  }
  // 향후: if (gid === POSTS_SHEET_GID) { return { name: 'posts', ... }; }
  return null;
}

// ============================================================
// PULL SPEC (main.js 기존 함수 참조 래퍼)
// pull 도 spec 객체로 통일할 때 이 함수에서 반환하도록 확장
// ============================================================

/**
 * gid 에 해당하는 pull spec 반환.
 * toSheetRow / extractList / buildQueryString 은 main.js 의 기존 함수를 참조.
 */
function getPullSpec_(gid) {
  if (gid === NOTES_SHEET_GID) {
    return {
      name:             'notes',
      dataFirstRow:     NOTES_DATA_FIRST_ROW,
      numCols:          NOTES_DATA_NUM_COLS,
      messageCell:      NOTES_PULL_MESSAGE_A1,
      syncedAtCell:     NOTES_PULL_SYNCED_AT_A1,
      toSheetRow:       noteToSheetRow_,
      extractList:      extractNotesList_,
      buildQueryString: buildNotesListQueryString_,
    };
  }
  return null;
}

// ============================================================
// TRIGGERS
// ============================================================

/**
 * onEdit simple trigger — 데이터 범위 내 셀 수정 시 last_updated_at 자동 갱신.
 *
 * - PROP_LOADING === 'true' 이면 skip (pull 진행 중 사용자 편집 무시)
 * - ID열·last_updated_at열 수정은 무시
 * - 붙여넣기 등 다행 범위 편집 지원
 * - GAS simple trigger: 스크립트 자체의 setValue 는 onEdit 를 재발화하지 않으므로
 *   last_updated_at 기록 시 무한 루프 없음
 */
function onEdit(e) {
  try {
    if (PropertiesService.getScriptProperties().getProperty(PROP_LOADING) === 'true') return;
    var sh   = e.range.getSheet();
    var spec = getPushSpec_(sh.getSheetId());
    if (!spec) return;

    var editRow    = e.range.getRow();
    var editLastR  = e.range.getLastRow();
    var editColS   = e.range.getColumn();
    var editColE   = e.range.getLastColumn();

    // 수정된 범위의 모든 열이 ID열 또는 last_updated_at열이면 무시
    var allProtected = true;
    for (var c = editColS; c <= editColE; c++) {
      if (c !== spec.idCol && c !== spec.lastUpdatedAtCol) { allProtected = false; break; }
    }
    if (allProtected) return;

    var storedLastRow = Number(
      PropertiesService.getScriptProperties().getProperty(PROP_NOTES_LAST_ROW)
      || String(spec.dataFirstRow - 1)
    );
    var watchLastRow = storedLastRow + spec.extraCreateRows;
    var now = new Date();

    for (var r = Math.max(editRow, spec.dataFirstRow);
             r <= Math.min(editLastR, watchLastRow); r++) {
      sh.getRange(r, spec.lastUpdatedAtCol).setValue(now);
    }
  } catch (err) { /* onEdit 오류는 사용자 경험 방해 방지를 위해 silent */ }
}

/**
 * onOpen 에서 호출 — notes 시트 ID열을 스캔해 마지막 데이터 행을 ScriptProperties 에 저장.
 * push / onEdit 에서 watch 범위 계산에 사용.
 */
function initDataRangeOnOpen_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = getSheetBySheetId_(ss, NOTES_SHEET_GID);
  if (!sh) return;
  var lastRow     = sh.getLastRow();
  var dataLastRow = NOTES_DATA_FIRST_ROW - 1;
  if (lastRow >= NOTES_DATA_FIRST_ROW) {
    var ids = sh.getRange(NOTES_DATA_FIRST_ROW, 1,
                          lastRow - NOTES_DATA_FIRST_ROW + 1, 1).getValues();
    for (var i = ids.length - 1; i >= 0; i--) {
      if (ids[i][0] !== '' && ids[i][0] != null) {
        dataLastRow = NOTES_DATA_FIRST_ROW + i;
        break;
      }
    }
  }
  PropertiesService.getScriptProperties()
    .setProperty(PROP_NOTES_LAST_ROW, String(dataLastRow));
}

// ============================================================
// MENU ENTRY
// ============================================================

/**
 * 메뉴 «Push (create/update/delete)»: 활성 탭의 push spec 으로 CUD 처리.
 * 결과는 셀(summary + 행별 J열)에 기록하며 alert 없음.
 * Push 후 자동 Pull 은 당분간 주석 처리 — 결과 확인 후 수동으로 Pull.
 */
function pushChangesFromSheet() {
  var sh   = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var spec = getPushSpec_(sh.getSheetId());
  if (!spec) {
    SpreadsheetApp.getUi().alert(
      'Push는 이 탭에서 정의되어 있지 않습니다.\n활성 gid=' + sh.getSheetId()
    );
    return;
  }

  var ss         = SpreadsheetApp.getActiveSpreadsheet();
  var settingsSh = getSheetBySheetId_(ss, SETTINGS_SHEET_GID);
  if (!settingsSh) {
    sh.getRange(spec.summaryCell).setValue('오류: settings 탭을 찾을 수 없습니다.');
    return;
  }

  var base, token;
  try {
    base  = getApiBase_(settingsSh);
    token = readTrimmed_(settingsSh, CELL_OUT_ACCESS);
    if (!token) throw new Error('access token이 비었습니다. settings 탭에서 Log in 하세요 (G5).');
  } catch (err) {
    sh.getRange(spec.summaryCell).setValue('Push 초기화 오류: ' + String(err.message || err));
    return;
  }

  runPushForSpec_(sh, spec, base, token);

  // 자동 Pull — 당분간 주석 처리 (push 결과 J열 확인 후 수동으로 Pull 실행)
  // runPullNotesList_(sh);
}

// ============================================================
// PUSH ENGINE
// ============================================================

/**
 * spec 에 따라 CUD 분류 → 실행 → 결과 기록.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} spec  getPushSpec_() 반환값
 * @param {string} base  API base URL
 * @param {string} token Bearer access token
 */
function runPushForSpec_(sheet, spec, base, token) {
  var syncedAtRaw = sheet.getRange(spec.syncedAtCell).getValue();
  var syncedAt    = syncedAtRaw instanceof Date
    ? syncedAtRaw : (syncedAtRaw ? new Date(syncedAtRaw) : null);

  var classified = classifyPushRows_(sheet, spec, syncedAt);
  var creates    = classified.creates;
  var updates    = classified.updates;
  var deletes    = classified.deletes;

  if (!creates.length && !updates.length && !deletes.length) {
    sheet.getRange(spec.summaryCell).setValue('변경사항 없음 — Push 대상 없음');
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
  sheet.getRange(spec.summaryCell).setValue(summary);
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
  var storedLastRow = Number(props.getProperty(PROP_NOTES_LAST_ROW) || String(spec.dataFirstRow - 1));
  var watchLastRow  = Math.max(storedLastRow, spec.dataFirstRow - 1) + spec.extraCreateRows;
  var numRows       = Math.max(watchLastRow - spec.dataFirstRow + 1, spec.extraCreateRows);

  var allValues = sheet.getRange(spec.dataFirstRow, 1, numRows, spec.numCols).getValues();

  var creates = [], updates = [], deletes = [];

  for (var i = 0; i < allValues.length; i++) {
    var rowData  = allValues[i];
    var rowIndex = spec.dataFirstRow + i;
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
  sheet.getRange(rowIndex, spec.pushStatusCol).setValue(message);
}

function clearPushStatusCol_(sheet, spec) {
  var props         = PropertiesService.getScriptProperties();
  var storedLastRow = Number(props.getProperty(PROP_NOTES_LAST_ROW) || String(spec.dataFirstRow - 1));
  var watchLastRow  = Math.max(storedLastRow, spec.dataFirstRow - 1) + spec.extraCreateRows;
  var numRows       = Math.max(watchLastRow - spec.dataFirstRow + 1, spec.extraCreateRows);
  if (numRows <= 0) return;
  sheet.getRange(spec.dataFirstRow, spec.pushStatusCol, numRows, 1).clearContent();
}

// ============================================================
// HTTP HELPERS (authenticated mutations)
// ============================================================

function httpPostBearer_(url, token, bodyObj) {
  return UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: Object.assign({}, ngrokHeaders_(), {
      Authorization: 'Bearer ' + String(token || ''),
    }),
    payload: JSON.stringify(bodyObj),
  });
}

function httpPatchBearer_(url, token, bodyObj) {
  return UrlFetchApp.fetch(url, {
    method: 'patch',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: Object.assign({}, ngrokHeaders_(), {
      Authorization: 'Bearer ' + String(token || ''),
    }),
    payload: JSON.stringify(bodyObj),
  });
}

function httpDeleteBearer_(url, token) {
  return UrlFetchApp.fetch(url, {
    method: 'delete',
    muteHttpExceptions: true,
    headers: Object.assign({}, ngrokHeaders_(), {
      Authorization: 'Bearer ' + String(token || ''),
    }),
  });
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
 * @returns {*} 변환된 값, 또는 undefined (빈 값이어서 skip)
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
