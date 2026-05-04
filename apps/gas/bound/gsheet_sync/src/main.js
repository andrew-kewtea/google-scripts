/**
 * fast2 admin — settings(gid=0): signup / login / refresh access. notes 등: pull 등.
 *
 * ID 구분 (헷갈리기 쉬움):
 * - 스프레드시트 파일 ID: URL `/spreadsheets/d/<이 값>/edit` 의 긴 문자열
 *   (예: `12BfAX_yY11sO88Y_Tg30pizHuouS6H5sCj51KujjnzI`). 파일 전체를 가리킴.
 * - 탭(subsheet) ID: URL 해시 `#gid=<숫자>` 와 동일하며 `Sheet#getSheetId()` 와 같음.
 *   탭 이름을 바꿔도 유지됨.
 *
 * 실행 시간·할당량 (추후 확장 시 참고):
 * - 메뉴/버튼 실행 시 UrlFetch 타임아웃·전체 실행 시간 한계 존재.
 * - UrlFetchApp 일일 할당량은 계정 정책 따름 — 대량 호출 시 배치·트리거 분할 검토.
 *
 * BASE(E7) + 경로는 Swagger(/docs) 및 fast2 main.py 의 API_V1_PREFIX 와 동일.
 */

/** 탭(subsheet) ID = URL `#gid=` · `getSheetId()`. 스프레드시트 파일 ID 아님. */
var SETTINGS_SHEET_GID = 0;

/**
 * 리소스 탭 — Pull(list) 시 활성 시트 gid 로 어떤 API/레이아웃을 쓸지 결정.
 * 모델(탭) 추가 시: gid 상수 + model 문자열 + ``pullListFromSheet`` 분기 + ``runPull*`` 구현.
 */
var NOTES_SHEET_GID = 2037974657;
var NOTES_RESOURCE_MODEL = 'notes';

/** signup: name E2 … bypass E6, base E7, 메시지 E8 */
var CELL_SIGNUP_NAME = 'E2';
var CELL_SIGNUP_EMAIL = 'E3';
var CELL_SIGNUP_PASSWORD = 'E4';
var CELL_SIGNUP_PASSWORD_CONFIRM = 'E5';
var CELL_SIGNUP_DEV_BYPASS = 'E6';
var CELL_API_BASE_URL = 'E7';
var CELL_SIGNUP_MESSAGE = 'E8';

/** login: creds G2–G3, tokens G5–G7 */
var CELL_LOGIN_EMAIL = 'G2';
var CELL_LOGIN_PASSWORD = 'G3';
var CELL_OUT_ACCESS = 'G5';
var CELL_OUT_REFRESH = 'G6';
var CELL_OUT_EXPIRE_REFRESH = 'G7';

var PATH_SIGNUP = '/api/v1/auth/signup';
var PATH_LOGIN = '/api/v1/auth/login';
/** POST 본문 ``{ refresh_token }`` → 새 ``access_token`` (``/auth/refresh`` 와 동일). */
var PATH_AUTH_TOKEN = '/api/v1/auth/token';

/**
 * GET /api/v1/notes/ 쿼리: C6..I6 표시값만 사용(빈 칸 생략). 키는 fast2 ``utils/list_query.py`` 규약과
 * ``note_controller.ALLOWED_FILTER_FIELDS`` 키와 일치해야 함.
 *
 * - 구간 필터: ``{컬럼명}From`` → gte, ``{컬럼명}To`` → lte (Vue useListQuery ranges와 동일).
 *   ``last_updated_at`` 은 DB/모델(CommonMixin) 필드명; 값은 unix 초(문자열)가 안전.
 * - ``page``, ``size``, ``sort``, ``order``, ``q`` 는 list_query 예약어(컬럼 필터로 해석되지 않음).
 * - ``sort`` 값은 ALLOWED_FILTER_FIELDS 의 키와 동일해야 함 (예: last_updated_at).
 *   시트에 LastUpdatedAt 같은 표기를 써도 ``normalizeNotesListQueryValueForKey_`` 가 snake_case 로 치환.
 *
 * 태그(Tag) 필터 — GAS 쪽 미지원(의도적 임시 매핑):
 * - 시트 E열 라벨이 Tag여도, 노트 목록 API에는 ``tag`` / ``tag_id`` 등 허용 필터가 없어
 *   ``?tag=...`` 는 400(Unsupported filter field)이다.
 * - 그래서 E열 쿼리 키는 당분간 ``q`` 로 둔다(제목·내용 전역 검색). 태그만으로 좁히려면 서버 작업 후
 *   아래 배열의 세 번째 문자열만 실제 쿼리 키로 바꾸면 된다.
 *
 * 서버(fast2)에서 태그 필터를 지원할 때 할 일 요약:
 * - ``note_controller.ALLOWED_FILTER_FIELDS`` 에 태그 조건에 쓸 컬럼/표현 추가
 *   (단순 컬럼이 아니면 ``NoteRepository.search_paginated_for_user`` 에서
 *   ``build_conditions_from_request`` 의 ``skip_keys`` + 별도 WHERE 분기로
 *   TagAssociation 조인·서브쿼리 등 처리).
 * - OpenAPI/Swagger에 쿼리 파라미터 문서화.
 * - 확정한 쿼리 키 이름(예: ``tag_id``, ``tag``)에 맞춰 이 파일의 ``NOTES_LIST_QUERY_PARAM_KEYS[2]`` 수정.
 */
var NOTES_LIST_QUERY_PARAM_KEYS = [
  'last_updated_atFrom',
  'last_updated_atTo',
  'q',
  'size',
  'page',
  'sort',
  'order',
];
var NOTES_LIST_QUERY_VALUE_ROW = 6;
var NOTES_LIST_QUERY_START_COL = 3;

var PATH_NOTES_LIST = '/api/v1/notes/';

/** pull 후 메시지·동작 시각 (notes 탭). */
var NOTES_PULL_MESSAGE_A1 = 'G4';
var NOTES_PULL_SYNCED_AT_A1 = 'I4';

/** A8 헤더 가정, A9부터 ID…Owner_id (9열) */
var NOTES_DATA_FIRST_ROW = 9;
var NOTES_DATA_NUM_COLS = 9;

/** ScriptProperties keys (onEdit loading 플래그 / data range 경계 저장) */
var PROP_LOADING        = 'loading';
var PROP_NOTES_LAST_ROW = 'notes_data_last_row';

/** notes push: 데이터 하단 create 대기 행 수 */
var NOTES_EXTRA_CREATE_ROWS = 5;
/** notes push: 행별 결과 기록 열 (J = 10) */
var NOTES_PUSH_STATUS_COL = 10;
/** notes push: summary 메시지 셀 */
var NOTES_PUSH_MESSAGE_A1 = 'G5';

function onOpen() {
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

function signupFromSheet() {
  try {
    var sh = requireActiveSheetIsSettings_();
    runSignup_(sh);
  } catch (err) {
    SpreadsheetApp.getUi().alert(String(err.message || err));
  }
}

function loginFromSheet() {
  try {
    var sh = requireActiveSheetIsSettings_();
    runLogin_(sh);
  } catch (err) {
    SpreadsheetApp.getUi().alert(String(err.message || err));
  }
}

/**
 * settings(gid=0) 전용 — G6 refresh_token 으로 POST /api/v1/auth/token 후 G5 access 갱신.
 * access 만료(401 Signature has expired 등) 시 사용.
 */
function refreshAccessTokenFromSheet() {
  try {
    var sh = requireActiveSheetIsSettings_();
    runRefreshAccess_(sh);
  } catch (err) {
    SpreadsheetApp.getUi().alert(String(err.message || err));
  }
}

/**
 * 메뉴 «Pull (list)»: **현재 활성 탭**의 gid 에 맞는 list API 호출.
 * 지원 gid 는 아래 분기에만 추가하면 됨 (메뉴 항목은 계속 하나).
 */
function pullListFromSheet() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var gid = sh.getSheetId();
  if (gid === NOTES_SHEET_GID) {
    runPullNotesList_(sh);
    return;
  }
  SpreadsheetApp.getUi().alert(
    'Pull(list)는 이 탭에서 정의되어 있지 않습니다.\n' +
      '활성 gid=' +
      gid +
      '\n등록된 모델: ' +
      NOTES_RESOURCE_MODEL +
      ' (gid=' +
      NOTES_SHEET_GID +
      ')'
  );
}

/** 트리거/구버전 호환 — ``pullListFromSheet`` 와 동일. */
function pullNotesListFromSheet() {
  pullListFromSheet();
}

/**
 * notes 모델 — settings 의 base + G5 Bearer 로 GET list, 활성 notes 시트 A9~ 에 채우고 G4/I4 갱신.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} notesSheet 활성 시트(이미 gid 가 notes 임을 호출부에서 보장)
 */
function runPullNotesList_(notesSheet) {
  var props = PropertiesService.getScriptProperties();
  var msg = '';
  try {
    props.setProperty(PROP_LOADING, 'true');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var settingsSh = getSheetBySheetId_(ss, SETTINGS_SHEET_GID);
    if (!settingsSh) {
      throw new Error('settings 탭(gid=' + SETTINGS_SHEET_GID + ')을 찾을 수 없습니다.');
    }
    var base = getApiBase_(settingsSh);
    var token = readTrimmed_(settingsSh, CELL_OUT_ACCESS);
    if (!token) {
      throw new Error('access token이 비었습니다. settings 탭에서 Log in 하세요 (G5).');
    }
    var q = buildNotesListQueryString_(notesSheet);
    var url = base + PATH_NOTES_LIST + q;
    var resp = httpGetBearer_(url, token);
    var code = resp.getResponseCode();
    var raw = resp.getContentText();
    var json = parseJsonSafe_(raw);
    if (code < 200 || code >= 300) {
      msg = formatHttpResult_(code, raw, json);
    } else {
      var list = extractNotesList_(json);
      var rows = [];
      for (var i = 0; i < list.length; i++) {
        rows.push(noteToSheetRow_(list[i]));
      }
      clearNotesDataRange_(notesSheet);
      if (rows.length) {
        notesSheet
          .getRange(
            NOTES_DATA_FIRST_ROW,
            1,
            rows.length,
            NOTES_DATA_NUM_COLS
          )
          .setValues(rows);
      }
      props.setProperty(PROP_NOTES_LAST_ROW,
        String(rows.length > 0 ? NOTES_DATA_FIRST_ROW + rows.length - 1 : NOTES_DATA_FIRST_ROW - 1));
      msg = 'OK — ' + rows.length + '건';
    }
  } catch (e) {
    msg = String(e.message || e);
  } finally {
    props.setProperty(PROP_LOADING, 'false');
  }
  writeNotesPullStatus_(notesSheet, msg);
  if (msg.indexOf('OK —') !== 0) {
    SpreadsheetApp.getUi().alert(msg);
  }
}

function requireActiveSheetIsSettings_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sh.getSheetId() !== SETTINGS_SHEET_GID) {
    throw new Error(
      '1) Sign up / 2) Log in / 3) Refresh access token 은 settings 탭(gid=' +
        SETTINGS_SHEET_GID +
        ')에서만 실행할 수 있습니다.'
    );
  }
  return sh;
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {number} sheetId 탭 ID (`#gid=` / `getSheetId()`). 스프레드시트 파일 ID 문자열 아님.
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

function normalizeBaseUrl_(raw) {
  var s = String(raw || '').trim();
  if (!s) {
    throw new Error(
      'API base URL이 비었습니다. settings!' + CELL_API_BASE_URL + ' 에 설정하세요.'
    );
  }
  return s.replace(/\/+$/, '');
}

function getApiBase_(sh) {
  return normalizeBaseUrl_(readTrimmed_(sh, CELL_API_BASE_URL));
}

function ngrokHeaders_() {
  return { 'ngrok-skip-browser-warning': 'true' };
}

function httpPostJson_(url, bodyObj) {
  var opts = {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify(bodyObj),
    headers: ngrokHeaders_(),
  };
  return UrlFetchApp.fetch(url, opts);
}

function httpGetBearer_(url, bearerToken) {
  var headers = Object.assign({}, ngrokHeaders_(), {
    Authorization: 'Bearer ' + String(bearerToken || ''),
  });
  return UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    headers: headers,
  });
}

/**
 * C6..I6 표시값을 NOTES_LIST_QUERY_PARAM_KEYS 순으로 붙임(빈 값 제외).
 * @param {GoogleAppsScript.Spreadsheet.Sheet} notesSheet
 */
function buildNotesListQueryString_(notesSheet) {
  var keys = NOTES_LIST_QUERY_PARAM_KEYS;
  var row = NOTES_LIST_QUERY_VALUE_ROW;
  var startCol = NOTES_LIST_QUERY_START_COL;
  var parts = [];
  for (var i = 0; i < keys.length; i++) {
    var paramKey = keys[i];
    var val = readTrimmedAt_(notesSheet, row, startCol + i);
    if (!val) continue;
    val = normalizeNotesListQueryValueForKey_(paramKey, val);
    parts.push(encodeURIComponent(paramKey) + '=' + encodeURIComponent(val));
  }
  return parts.length ? '?' + parts.join('&') : '';
}

/**
 * ``sort`` 등 시트 표기와 fast2 ``ALLOWED_FILTER_FIELDS`` 키를 맞춤.
 * LastUpdatedAt / lastUpdatedAt → last_updated_at
 */
function normalizeNotesListQueryValueForKey_(paramKey, raw) {
  if (paramKey !== 'sort') return raw;
  var s = String(raw || '').trim();
  if (!s) return s;
  var compact = s.replace(/_/g, '').replace(/\s+/g, '').toLowerCase();
  var sortAliases = {
    id: 'id',
    title: 'title',
    content: 'content',
    contenttype: 'content_type',
    createdat: 'created_at',
    lastupdatedat: 'last_updated_at',
    orgid: 'org_id',
    ownerid: 'owner_id',
    editbyid: 'edit_by_id',
    isdeleted: 'is_deleted',
    isdraft: 'is_draft',
    accesslevel: 'access_level',
  };
  if (sortAliases[compact]) return sortAliases[compact];
  return s;
}

function writeNotesPullStatus_(notesSheet, message) {
  notesSheet.getRange(NOTES_PULL_MESSAGE_A1).setValue(message);
  notesSheet.getRange(NOTES_PULL_SYNCED_AT_A1).setValue(new Date());
}

function clearNotesDataRange_(notesSheet) {
  var last = notesSheet.getMaxRows();
  if (last < NOTES_DATA_FIRST_ROW) return;
  /** getRange(r, c, numRows, numColumns) — 네 번째 인자는 열 개수, 세 번째는 행 개수. */
  var numRows = last - NOTES_DATA_FIRST_ROW + 1;
  notesSheet
    .getRange(NOTES_DATA_FIRST_ROW, 1, numRows, NOTES_DATA_NUM_COLS)
    .clearContent();
}

/**
 * 서버 본문에서 노트 배열 추출 (스키마 차이 흡수).
 * @param {Object|null} json
 * @return {Object[]}
 */
function extractNotesList_(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.items)) return json.items;
  if (Array.isArray(json.data)) return json.data;
  if (json.data && Array.isArray(json.data.items)) return json.data.items;
  if (Array.isArray(json.results)) return json.results;
  if (Array.isArray(json.notes)) return json.notes;
  return [];
}

/**
 * API 노트 객체 → 시트 한 행 [ID, LastUpdatedAt, Title, Content, Content.Type, Tags, Attachments, IsDraft, Owner_id]
 * 필드명은 서버에 맞춰 여기서 조정.
 */
function noteToSheetRow_(note) {
  var id = pick_(note, ['id']);
  var updatedRaw = pick_(note, ['last_updated_at', 'lastUpdatedAt', 'updated_at']);
  var title = pick_(note, ['title']);
  var contentPack = normalizeNoteContent_(note);
  var tagsStr =
    note.tags_display != null && String(note.tags_display).trim() !== ''
      ? String(note.tags_display)
      : formatTagsForSheet_(note.tags);
  var attachN = attachmentCount_(note);
  var draftRaw = pick_(note, ['is_draft', 'isDraft']);
  var isDraft = draftRaw === '' ? '' : Boolean(draftRaw);
  var ownerId = pickOwnerId_(note);
  return [
    id,
    formatSheetDateTime_(updatedRaw),
    title,
    contentPack.text,
    contentPack.type,
    tagsStr,
    attachN,
    isDraft,
    ownerId,
  ];
}

function pick_(obj, keys) {
  if (!obj || typeof obj !== 'object') return '';
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (obj[k] != null && obj[k] !== '') return obj[k];
  }
  return '';
}

function normalizeNoteContent_(note) {
  var topType = pick_(note, ['content_type', 'contentType']);
  var c = note.content;
  if (c != null && typeof c === 'object') {
    var type = pick_(c, ['type', 'content_type']);
    var text = pick_(c, ['text', 'body', 'plain', 'markdown']);
    return {
      type: String(type || topType || ''),
      text: String(text || ''),
    };
  }
  if (c != null) {
    return { type: String(topType || ''), text: String(c) };
  }
  return { type: String(topType || ''), text: '' };
}

function formatTagsForSheet_(tags) {
  if (!tags) return '';
  if (!Array.isArray(tags)) return String(tags);
  var names = [];
  for (var i = 0; i < tags.length; i++) {
    var t = tags[i];
    if (t == null) continue;
    if (typeof t === 'string') {
      names.push(t);
      continue;
    }
    var n = pick_(t, ['name', 'label', 'tag', 'title', 'slug']);
    if (n !== '') names.push(String(n));
    else if (t.id != null) names.push(String(t.id));
  }
  return names.join(', ');
}

function attachmentCount_(note) {
  if (note == null) return 0;
  if (note.attachments_num != null) return Number(note.attachments_num);
  if (note.attachment_count != null) return Number(note.attachment_count);
  if (Array.isArray(note.attachments)) return note.attachments.length;
  return 0;
}

function pickOwnerId_(note) {
  var oid = pick_(note, ['owner_id', 'user_id']);
  if (oid !== '') return oid;
  if (note.owner && note.owner.id != null) return note.owner.id;
  if (note.user && note.user.id != null) return note.user.id;
  return '';
}

function formatSheetDateTime_(v) {
  if (v === '' || v == null) return '';
  var ms = v;
  if (typeof v === 'number' && v > 0 && v < 1e12) {
    ms = v * 1000;
  }
  var d = ms instanceof Date ? ms : new Date(ms);
  if (isNaN(d.getTime())) return String(v);
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  return Utilities.formatDate(d, tz, 'yyyy-MM-dd HH:mm:ss');
}

function formatHttpResult_(code, raw, json) {
  var head = 'HTTP ' + code;
  if (json && typeof json === 'object') {
    return head + '\n' + JSON.stringify(json, null, 2);
  }
  return head + '\n' + raw;
}

function parseJsonSafe_(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

/** JWT payload exp(sec) → ISO; 실패 시 빈 문자열 */
function jwtExpIso_(jwt) {
  var parts = String(jwt || '').split('.');
  if (parts.length !== 3) return '';
  try {
    var jsonStr = Utilities.newBlob(
      Utilities.base64DecodeWebSafe(parts[1])
    ).getDataAsString();
    var payload = JSON.parse(jsonStr);
    if (payload.exp == null) return '';
    return new Date(Number(payload.exp) * 1000).toISOString();
  } catch (e) {
    return '';
  }
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sh settings 시트 (활성 검증은 호출부)
 */
function runSignup_(sh) {
  var base = getApiBase_(sh);

  var name = readTrimmed_(sh, CELL_SIGNUP_NAME);
  var email = readTrimmed_(sh, CELL_SIGNUP_EMAIL);
  var password = readTrimmed_(sh, CELL_SIGNUP_PASSWORD);
  var passwordConfirm = readTrimmed_(sh, CELL_SIGNUP_PASSWORD_CONFIRM);
  var bypass = readTrimmed_(sh, CELL_SIGNUP_DEV_BYPASS);

  if (password !== passwordConfirm) {
    sh.getRange(CELL_SIGNUP_MESSAGE).setValue(
      'password 와 password_confirmed 가 일치하지 않습니다.'
    );
    throw new Error('비밀번호 확인이 일치하지 않습니다.');
  }

  /** SignupRequest — password_confirmed 는 서버 스키마 없음 */
  var body = {
    name: name,
    email: email,
    password: password,
    verify_method: 'email_link',
  };
  if (bypass) {
    body.dev_activation_bypass_secret = bypass;
  }

  var resp = httpPostJson_(base + PATH_SIGNUP, body);
  var code = resp.getResponseCode();
  var raw = resp.getContentText();
  var json = parseJsonSafe_(raw);
  sh.getRange(CELL_SIGNUP_MESSAGE).setValue(formatHttpResult_(code, raw, json));
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sh settings 시트 (활성 검증은 호출부)
 */
function runLogin_(sh) {
  var base = getApiBase_(sh);

  var email = readTrimmed_(sh, CELL_LOGIN_EMAIL);
  var password = readTrimmed_(sh, CELL_LOGIN_PASSWORD);

  var body = {
    login_type: 'email_password',
    email: email,
    password: password,
  };

  var resp = httpPostJson_(base + PATH_LOGIN, body);
  var code = resp.getResponseCode();
  var raw = resp.getContentText();
  var json = parseJsonSafe_(raw);

  if (code >= 200 && code < 300 && json && json.refresh_token) {
    sh.getRange(CELL_OUT_ACCESS).setValue(json.access_token || '');
    sh.getRange(CELL_OUT_REFRESH).setValue(json.refresh_token || '');
    var expIso = jwtExpIso_(json.refresh_token);
    sh.getRange(CELL_OUT_EXPIRE_REFRESH).setValue(
      expIso || '(JWT exp 없음 또는 디코드 실패)'
    );
  } else {
    sh.getRange(CELL_OUT_ACCESS).setValue('');
    sh.getRange(CELL_OUT_REFRESH).setValue('');
    sh.getRange(CELL_OUT_EXPIRE_REFRESH).setValue('fail');
    throw new Error('Login 실패 — G7에 fail 표시됨.');
  }
}

/**
 * POST /api/v1/auth/token — RefreshTokenRequest { refresh_token }.
 * 응답 TokenResponse: access_token 갱신, refresh_token 은 동일 echo(서버 정책).
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sh settings 시트
 */
function runRefreshAccess_(sh) {
  var base = getApiBase_(sh);
  var refresh = readTrimmed_(sh, CELL_OUT_REFRESH);
  if (!refresh) {
    throw new Error('refresh token이 비었습니다. settings G6 확인 후 Log in 으로 발급하세요.');
  }

  var resp = httpPostJson_(base + PATH_AUTH_TOKEN, {
    refresh_token: refresh,
  });
  var code = resp.getResponseCode();
  var raw = resp.getContentText();
  var json = parseJsonSafe_(raw);

  if (code >= 200 && code < 300 && json && json.access_token) {
    sh.getRange(CELL_OUT_ACCESS).setValue(json.access_token);
    if (json.refresh_token) {
      sh.getRange(CELL_OUT_REFRESH).setValue(json.refresh_token);
    }
    return;
  }
  throw new Error(formatHttpResult_(code, raw, json));
}
