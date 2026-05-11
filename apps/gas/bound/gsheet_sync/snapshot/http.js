/**
 * UrlFetch 래핑 및 JSON 직렬화/역직렬화.
 * 설정 탭 BASE 셀(CELL_API_BASE_URL) 상수는 main.js 에 정의.
 */

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

/**
 * ngrok 무료 도메인은 가끔 경고/랜딩 HTML을 돌려줄 수 있음.
 * UrlFetchApp 에도 동일 헤더를 붙이면 차단·HTML 응답 이슈를 줄이기 위해
 * httpPostJson_ / httpGetBearer_ / http*Bearer_ 요청마다 headers 에 합쳐 사용.
 * ngrok 이 아닌 BASE_URL 에서도 무해하므로 항상 포함.
 */
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

function formatHttpResult_(code, raw, json) {
  var head = 'HTTP ' + code;
  if (json && typeof json === 'object') {
    return head + '\n' + JSON.stringify(json, null, 2);
  }
  return head + '\n' + raw;
}

/**
 * ``REQUEST_VALIDATION_ERROR`` 등에서 FastAPI 가 넣는 ``details.errors`` ( ``[{loc,msg,type}]`` )를 스프레드시트에 읽기 쉬운 몇 줄로 붙인다.
 */
function formatValidationErrorsAppendix_(details) {
  if (!details || typeof details !== 'object') return '';
  var errs = details.errors;
  if (!Array.isArray(errs) || !errs.length) return '';
  var lines = [];
  for (var i = 0; i < errs.length && i < 8; i++) {
    var e = errs[i];
    if (!e || typeof e !== 'object') continue;
    var loc = Array.isArray(e.loc) ? e.loc.filter(Boolean).join('.') : '';
    var msg = e.msg != null ? String(e.msg) : '';
    if (!msg && e.type != null) msg = String(e.type);
    var one = (loc ? loc + ': ' : '') + msg;
    if (one) lines.push(one);
  }
  return lines.join('\n');
}

/**
 * 백엔드 공통 오류 JSON( ``controllers/deps/exception_handlers.api_error_payload`` ):
 * ``{ detail, code, details }`` 가 있으면 ``detail`` + ``code`` 한 줄 요약.
 * ``details.errors`` 가 있으면(422 등) 그 아래에 필드별 메시지를 덧붙인다.
 * 성공 응답·레거시 본문은 ``formatHttpResult_`` 로 폴백한다.
 */
function formatApiErrorBrief_(code, raw, json) {
  var head = 'HTTP ' + code;
  if (json && typeof json === 'object' && json.detail != null) {
    var d = String(json.detail);
    var c = json.code != null ? String(json.code) : '';
    var line = head + ': ' + d + (c ? ' [' + c + ']' : '');
    var appendix = formatValidationErrorsAppendix_(json.details);
    if (appendix) line += '\n' + appendix;
    return line;
  }
  return formatHttpResult_(code, raw, json);
}

function parseJsonSafe_(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

// --- Authenticated mutation helpers (POST / PATCH / DELETE with Bearer) ---

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
