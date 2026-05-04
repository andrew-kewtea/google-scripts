/**
 * fast2 admin — settings(gid=0): signup / login / refresh access. 다른 탭(notes 등): Pull(list).
 *
 * 구현 분리:
 * - http.js, sheet_util.js, list_envelope.js, pull_runner.js — 공통
 * - models/notes.js — notes 시트 레이아웃·쿼리·행 매핑·``NOTES_PULL_SPEC``
 *
 * ID 구분 (헷갈리기 쉬움):
 * - 스프레드시트 파일 ID: URL ``/spreadsheets/d/<이 값>/edit`` 의 긴 문자열
 * - 탭(subsheet) ID: URL 해시 ``#gid=<숫자>`` · ``Sheet#getSheetId()``. 탭 이름을 바꿔도 유지됨.
 *
 * 실행 시간·할당량 (추후 확장 시 참고):
 * - UrlFetchApp 일일 할당량·실행 시간 한계 — 대량 호출 시 트리거 분할 검토.
 *
 * BASE(E7) + 경로는 Swagger(/docs) 및 fast2 의 API_v1 과 동일.
 */

/** 설정 탭 = URL ``#gid=0`` 과 동일하게 맞춤. */
var SETTINGS_SHEET_GID = 0;

/** signup: name E2 … bypass E6, base E7, 메시지 E8 */
var CELL_SIGNUP_NAME = 'E2';
var CELL_SIGNUP_EMAIL = 'E3';
var CELL_SIGNUP_PASSWORD = 'E4';
var CELL_SIGNUP_PASSWORD_CONFIRM = 'E5';
var CELL_SIGNUP_DEV_BYPASS = 'E6';
var CELL_API_BASE_URL = 'E7';
var CELL_SIGNUP_MESSAGE = 'E8';

/** login: creds G2–G3, tokens G5–G7 (Pull 시 Bearer 로 G5 access 사용) */
var CELL_LOGIN_EMAIL = 'G2';
var CELL_LOGIN_PASSWORD = 'G3';
var CELL_OUT_ACCESS = 'G5';
var CELL_OUT_REFRESH = 'G6';
var CELL_OUT_EXPIRE_REFRESH = 'G7';

var PATH_SIGNUP = '/api/v1/auth/signup';
var PATH_LOGIN = '/api/v1/auth/login';
/** POST 본문 ``{ refresh_token }`` → 새 ``access_token``. */
var PATH_AUTH_TOKEN = '/api/v1/auth/token';

/** Pull(list): 활성 탭 gid → spec. ``registerPullSpecs_`` 에서 채움(파일 로드 순서와 무관). */
var PULL_SPECS_BY_GID = {};

/** Push ScriptProperties key: pull 진행 중 onEdit 차단용 */
var PROP_LOADING = 'loading';

/** Push: notes 설정 상수 (pushCUD.js / models/notes.js 에서 참조) */
var NOTES_EXTRA_CREATE_ROWS = 5;    // 데이터 하단 create 대기 행 수
var NOTES_PUSH_STATUS_COL   = 10;   // J열: 행별 push 결과
var NOTES_PUSH_MESSAGE_A1   = 'G5'; // push 전체 요약 셀

/**
 * Apps Script 는 파일명 알파벳 순으로 합쳐질 수 있어 main.js 가 models/notes.js 보다 먼저 오면
 * 상단에서 ``NOTES_PULL_SPEC`` 을 참조하면 실패한다. 메뉴/`pullListFromSheet` 시점에 등록한다.
 */
function registerPullSpecs_() {
  PULL_SPECS_BY_GID[NOTES_SHEET_GID] = NOTES_PULL_SPEC;
}

function formatRegisteredPullModels_() {
  registerPullSpecs_();
  var parts = [];
  for (var gid in PULL_SPECS_BY_GID) {
    if (!Object.prototype.hasOwnProperty.call(PULL_SPECS_BY_GID, gid)) continue;
    var sp = PULL_SPECS_BY_GID[gid];
    parts.push(String(sp.resourceLabel || 'model') + ' (gid=' + gid + ')');
  }
  return parts.join(', ');
}

function onOpen() {
  registerPullSpecs_();
  registerPushSpecs_();
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
 * settings(gid=0) 전용 — G6 refresh 로 POST ``/auth/token`` 후 G5 access 갱신.
 */
function refreshAccessTokenFromSheet() {
  try {
    var sh = requireActiveSheetIsSettings_();
    runRefreshAccess_(sh);
  } catch (err) {
    SpreadsheetApp.getUi().alert(String(err.message || err));
  }
}

/** 메뉴 «Pull (list)»: 현재 탭 gid 가 레지스트리에 있으면 해당 spec 으로 list GET. */
function pullListFromSheet() {
  registerPullSpecs_();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var gid = sh.getSheetId();
  var spec = PULL_SPECS_BY_GID[gid];
  if (spec) {
    runPullList_(sh, spec);
    return;
  }
  SpreadsheetApp.getUi().alert(
    'Pull(list)는 이 탭에서 정의되어 있지 않습니다.\n' +
      '활성 gid=' +
      gid +
      '\n등록된 모델: ' +
      formatRegisteredPullModels_()
  );
}

/** 트리거·구버전 호환 alias */
function pullNotesListFromSheet() {
  pullListFromSheet();
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
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sh settings 시트
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

function runRefreshAccess_(sh) {
  var base = getApiBase_(sh);
  var refresh = readTrimmed_(sh, CELL_OUT_REFRESH);
  if (!refresh) {
    throw new Error(
      'refresh token이 비었습니다. settings G6 확인 후 Log in 으로 발급하세요.'
    );
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
