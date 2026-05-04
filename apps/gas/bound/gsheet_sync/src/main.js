/**
 * fast2 admin — 설정 탭(gid, 아래 참고) 입력으로 POST /api/v1/auth/signup · /login 호출.
 *
 * ID 구분 (헷갈리기 쉬움):
 * - 스프레드시트 파일 ID: URL `/spreadsheets/d/<이 값>/edit` 의 긴 문자열
 *   (예: `12BfAX_yY11sO88Y_Tg30pizHuouS6H5sCj51KujjnzI`). 파일 전체를 가리킴.
 * - 탭(subsheet) ID: URL 해시 `#gid=<숫자>` 와 동일하며 `Sheet#getSheetId()` 와 같음.
 *   탭 이름을 바꿔도 유지됨. 본 스크립트의 SETTINGS_SHEET_GID 는 이 숫자만 의미함.
 *
 * 실행 시간·할당량 (추후 확장 시 참고):
 * - 메뉴/버튼 실행 시 UrlFetch 타임아웃·전체 실행 시간 한계 존재.
 * - UrlFetchApp 일일 할당량은 계정 정책 따름 — 대량 호출 시 배치·트리거 분할 검토.
 *
 * BASE(E7) + 경로는 Swagger(/docs) 및 fast2 main.py 의 API_V1_PREFIX 와 동일.
 */

/** 탭(subsheet) ID = URL `#gid=` · `getSheetId()`. 스프레드시트 파일 ID 아님. 보통 첫 탭은 0. */
var SETTINGS_SHEET_GID = 0;

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

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Fast2 Admin')
    .addItem('1) Sign up', 'signupFromSheet')
    .addItem('2) Log in', 'loginFromSheet')
    .addToUi();
}

function signupFromSheet() {
  try {
    runSignup_();
    // SpreadsheetApp.getUi().alert('Sign up 요청을 마쳤습니다. E8을 확인하세요.');
  } catch (err) {
    SpreadsheetApp.getUi().alert(String(err.message || err));
  }
}

function loginFromSheet() {
  try {
    runLogin_();
    // SpreadsheetApp.getUi().alert('Login 요청을 마쳤습니다. G5–G7을 확인하세요.');
  } catch (err) {
    SpreadsheetApp.getUi().alert(String(err.message || err));
  }
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

function getSettingsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = getSheetBySheetId_(ss, SETTINGS_SHEET_GID);
  if (!sh) {
    throw new Error('탭을 찾을 수 없습니다 (gid=' + SETTINGS_SHEET_GID + ')');
  }
  return sh;
}

function readTrimmed_(sh, a1) {
  return String(sh.getRange(a1).getDisplayValue() || '').trim();
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

function runSignup_() {
  var sh = getSettingsSheet_();
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

function runLogin_() {
  var sh = getSettingsSheet_();
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
