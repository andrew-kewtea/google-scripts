/**
 * 전역 API 경로·레지스트리·스크립트 속성 키.
 * 로드: 알파벳/번호 순상 다른 파일보다 먼저 두어 auth·models 의 ``API_PREFIX`` 등이 안전하다.
 */

/** 리스트·리소스 경로 루트. 환경별로 바뀌는 것은 주로 settings E7 도메인. */
var API_PREFIX = '/api/v1';

var PATH_SIGNUP = API_PREFIX + '/auth/signup';
var PATH_LOGIN = API_PREFIX + '/auth/login';
/** POST 본문 ``{ refresh_token }`` → 새 ``access_token``. */
var PATH_AUTH_TOKEN = API_PREFIX + '/auth/token';

/** Pull(list): 활성 탭 gid → spec. ``registerPullSpecs_`` 에서 채움(파일 로드 순서와 무관). */
var PULL_SPECS_BY_GID = {};

/** Push: ``registerPushSpecs_`` 에서 채움. */
var PUSH_SPECS_BY_GID = {};

/** Push / Pull 진행 중 onEdit 등에서 사용하는 ScriptProperties 키. */
var PROP_LOADING = 'loading';
