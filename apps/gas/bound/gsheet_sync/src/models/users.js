/**
 * users Pull/Push 스pec — ``GET {API_PREFIX}/users`` (목록 경로 끝 슬래시 없음).
 * listQuery: notes 와 동일하되 E열 필터만 ``status`` 로 전송(Tag/q 대신).
 * 탭 레이아웃: 메시지·동기 시각 F4/H4.
 *
 * Swagger/OpenAPI( ``schemas/user.py`` ) 타입명 · 배포 docs 의 서버 base 와 맞출 것:
 *
 * **목록** ``GET {API_PREFIX}/users``
 * - 쿼리 스키마: ``UserListRequest`` — ``page``, ``size``, ``sort``, ``order``, ``q`` 등이 문서에 묶여 있음.
 *   시트 파라미터 행에는 필요 시 ``view`` 를 더 넣을 수 있음(현재 키 배열에는 없음).
 * - 응답: ``UserListResponse`` — ``items``, ``total`` 및 ``page``, ``size``, ``sort``, ``order``(다른 리소스 ``ListResponse`` 계열과 동일).
 *   ``list_envelope.js`` 의 ``parseListEnvelope_`` 가 추가 필드를 이미 수용한다.
 * - ``items[]`` 요소: ``UserSummary``. 목록 JSON 에는 ``password`` / ``google`` / ``phone`` / ``role`` 등이 빠짐(민감·상세 필드).
 *   이 스크립트의 ``userToSheetRow_`` 도 해당 열을 쓰지 않음.
 *
 * **단건** ``GET {API_PREFIX}/users/{user_id}``
 * - 응답: ``UserDetail``( ``phone``, ``role`` 등 포함). 이 프로젝트는 목록 Pull 만 구현 — 단건 연동 시 여기 참고.
 *
 * **생성** ``POST {API_PREFIX}/users``
 * - 본문: ``UserCreate``. ``email``·``phone``·``google`` 중 하나 필수. 스프레드시트에서는 보통 ``email`` 열만 채움.
 *
 * **부분 수정** ``PATCH {API_PREFIX}/users/{user_id}``
 * - 본문: ``UserPatch``. ``extra="ignore"``. 저장 시 ``role`` → DB ``scopes``(리포지토리 preprocess).
 *
 * **삭제** ``DELETE {API_PREFIX}/users/{user_id}`` — 경로·204 바디 없음 은 그대로.
 *
 * ``main.py`` 의 ``config.API_PREFIX`` 가 바뀌면 여기 ``API_PREFIX``( ``10_constants.js`` )와 Swagger 의 서버 URL 을 맞춘다.
 */

var USERS_RESOURCE_MODEL = 'users';
var USERS_SHEET_GID = 217092462;

/** 10 데이터 열 + 상태 열 K(11). */
var USERS_EXTRA_CREATE_ROWS = 5;
var USERS_PUSH_STATUS_COL = 11;

var USERS_LIST_QUERY_PARAM_KEYS = [
  'last_updated_atFrom',
  'last_updated_atTo',
  'status',
  'size',
  'page',
  'sort',
  'order',
];

var USERS_LIST_QUERY_EPOCH_PARAM_KEYS = {
  last_updated_atFrom: true,
  last_updated_atTo: true,
};
var USERS_LIST_QUERY_VALUE_ROW = 6;
var USERS_LIST_QUERY_START_COL = 3;

var USERS_LIST_SORT_ALIASES = {
  id: 'id',
  name: 'name',
  email: 'email',
  uname: 'uname',
  status: 'status',
  createdat: 'created_at',
  lastupdatedat: 'last_updated_at',
  language: 'language',
  isdraft: 'is_draft',
  ownerid: 'owner_id',
  orgid: 'org_id',
};

var normalizeUsersListQueryValueForKey_ = makeListSortParamNormalizer_(
  USERS_LIST_SORT_ALIASES
);

var PATH_USERS_LIST = API_PREFIX + '/users';

var USERS_PULL_MESSAGE_A1 = 'F4';
var USERS_PULL_SYNCED_AT_A1 = 'H4';

var USERS_DATA_FIRST_ROW = 9;
var USERS_DATA_NUM_COLS = 10;

function userToSheetRow_(u) {
  var draftRaw = pick_(u, ['is_draft', 'isDraft']);
  var isDraft = draftRaw === '' ? '' : Boolean(draftRaw);
  return [
    pick_(u, ['id']),
    formatSheetDateTime_(pick_(u, ['last_updated_at', 'lastUpdatedAt', 'updated_at'])),
    pick_(u, ['name']),
    pick_(u, ['uname']),
    pick_(u, ['email']),
    pick_(u, ['status']),
    pick_(u, ['language']),
    isDraft,
    pick_(u, ['owner_id', 'ownerId']),
    pick_(u, ['org_id', 'orgId']),
  ];
}

var USERS_PULL_SPEC = {
  resourceLabel: USERS_RESOURCE_MODEL,
  sheetGid: USERS_SHEET_GID,
  listPath: PATH_USERS_LIST,
  buildQueryString: function (sheet) {
    return buildListQueryStringFromKeys_(
      sheet,
      USERS_LIST_QUERY_PARAM_KEYS,
      USERS_LIST_QUERY_VALUE_ROW,
      USERS_LIST_QUERY_START_COL,
      normalizeUsersListQueryValueForKey_,
      USERS_LIST_QUERY_EPOCH_PARAM_KEYS
    );
  },
  layout: {
    dataFirstRow: USERS_DATA_FIRST_ROW,
    numCols: USERS_DATA_NUM_COLS,
    messageA1: USERS_PULL_MESSAGE_A1,
    syncedAtA1: USERS_PULL_SYNCED_AT_A1,
  },
  mapItemToRow: userToSheetRow_,
};

var USERS_PUSH_SPEC = {
  resourceLabel: USERS_RESOURCE_MODEL,
  sheetGid: USERS_SHEET_GID,
  /** ``POST /users`` 는 끝 슬래시 없음. DELETE/PATCH 는 ``push.js`` 가 ``…/users/<id>`` 로 조합한다. */
  basePath: API_PREFIX + '/users',
  layout: {
    dataFirstRow: USERS_DATA_FIRST_ROW,
    numCols: USERS_DATA_NUM_COLS,
    syncedAtA1: USERS_PULL_SYNCED_AT_A1,
    summaryA1: USERS_PULL_MESSAGE_A1,
    pushStatusCol: USERS_PUSH_STATUS_COL,
  },
  idCol: 1,
  lastUpdatedAtCol: 2,
  extraCreateRows: USERS_EXTRA_CREATE_ROWS,
  /** ``buildRequestBody_`` JSON 은 ``UserCreate`` / ``UserPatch`` 스네이크 키. 생략 필드는 보내지 않음. POST 성공 응답은 ``UserDetail``. */
  requestCols: [
    { col: 3, field: 'name', required: true },
    { col: 4, field: 'uname', transform: 'text' },
    { col: 5, field: 'email', transform: 'text' },
    { col: 6, field: 'status', transform: 'text' },
    { col: 7, field: 'language', transform: 'text' },
    { col: 8, field: 'is_draft', transform: 'bool' },
    { col: 9, field: 'owner_id', transform: 'int' },
    { col: 10, field: 'org_id', transform: 'int' },
  ],
  defaults: {},
};
