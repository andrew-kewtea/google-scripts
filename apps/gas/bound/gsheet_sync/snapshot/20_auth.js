/**
 * 설정 시트(gid=0) 기준 signup / login / refresh access.
 *
 * 상수: ``10_constants.js`` 의 ``API_PREFIX``·``PATH_*`` 사용.
 * 시트 헬퍼: ``sheet_util.js`` · HTTP: ``http.js``
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
