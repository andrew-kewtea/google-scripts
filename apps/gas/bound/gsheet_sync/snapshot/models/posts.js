/**
 * posts Pull/Push 스펙 — ``{API_PREFIX}/posts/`` (notes 와 동일한 listQuery 줄 C6:I6).
 * 탭 레이아웃: 메시지·동기 시각 F4/H4 (관리 스프레드시트 템플릿).
 */

var POSTS_RESOURCE_MODEL = 'posts';
var POSTS_SHEET_GID = 1453895874;

var POSTS_EXTRA_CREATE_ROWS = 5;
var POSTS_PUSH_STATUS_COL = 10;

var POSTS_LIST_QUERY_PARAM_KEYS = [
  'last_updated_atFrom',
  'last_updated_atTo',
  'q',
  'size',
  'page',
  'sort',
  'order',
];

var POSTS_LIST_QUERY_EPOCH_PARAM_KEYS = {
  last_updated_atFrom: true,
  last_updated_atTo: true,
};
var POSTS_LIST_QUERY_VALUE_ROW = 6;
var POSTS_LIST_QUERY_START_COL = 3;

var POSTS_LIST_SORT_ALIASES = {
  id: 'id',
  title: 'title',
  content: 'content',
  createdat: 'created_at',
  lastupdatedat: 'last_updated_at',
  orgid: 'org_id',
  ownerid: 'owner_id',
  editbyid: 'edit_by_id',
  isdeleted: 'is_deleted',
  isdraft: 'is_draft',
  accesslevel: 'access_level',
};

var normalizePostsListQueryValueForKey_ = makeListSortParamNormalizer_(
  POSTS_LIST_SORT_ALIASES
);

var PATH_POSTS_LIST = API_PREFIX + '/posts/';

var POSTS_PULL_MESSAGE_A1 = 'F4';
var POSTS_PULL_SYNCED_AT_A1 = 'H4';

var POSTS_DATA_FIRST_ROW = 9;
var POSTS_DATA_NUM_COLS = 9;

function postToSheetRow_(post) {
  var id = pick_(post, ['id']);
  var updatedRaw = pick_(post, ['last_updated_at', 'lastUpdatedAt', 'updated_at']);
  var title = pick_(post, ['title']);
  var content = pick_(post, ['content']);
  var accessLevel = pick_(post, ['access_level', 'accessLevel']);
  var tagsStr =
    post.tags_display != null && String(post.tags_display).trim() !== ''
      ? String(post.tags_display)
      : formatTagsForSheet_(post.tags);
  var attachN = 0;
  if (post.attachments_num != null) attachN = Number(post.attachments_num);
  else if (post.associations_num != null) attachN = Number(post.associations_num);
  else attachN = attachmentCount_(post);
  var draftRaw = pick_(post, ['is_draft', 'isDraft']);
  var isDraft = draftRaw === '' ? '' : Boolean(draftRaw);
  var ownerId = pickOwnerId_(post);
  return [
    id,
    formatSheetDateTime_(updatedRaw),
    title,
    String(content || ''),
    accessLevel,
    tagsStr,
    attachN,
    isDraft,
    ownerId,
  ];
}

var POSTS_PULL_SPEC = {
  resourceLabel: POSTS_RESOURCE_MODEL,
  sheetGid: POSTS_SHEET_GID,
  listPath: PATH_POSTS_LIST,
  buildQueryString: function (sheet) {
    return buildListQueryStringFromKeys_(
      sheet,
      POSTS_LIST_QUERY_PARAM_KEYS,
      POSTS_LIST_QUERY_VALUE_ROW,
      POSTS_LIST_QUERY_START_COL,
      normalizePostsListQueryValueForKey_,
      POSTS_LIST_QUERY_EPOCH_PARAM_KEYS
    );
  },
  layout: {
    dataFirstRow: POSTS_DATA_FIRST_ROW,
    numCols: POSTS_DATA_NUM_COLS,
    messageA1: POSTS_PULL_MESSAGE_A1,
    syncedAtA1: POSTS_PULL_SYNCED_AT_A1,
  },
  mapItemToRow: postToSheetRow_,
};

var POSTS_PUSH_SPEC = {
  resourceLabel: POSTS_RESOURCE_MODEL,
  sheetGid: POSTS_SHEET_GID,
  basePath: API_PREFIX + '/posts/',
  layout: {
    dataFirstRow: POSTS_DATA_FIRST_ROW,
    numCols: POSTS_DATA_NUM_COLS,
    syncedAtA1: POSTS_PULL_SYNCED_AT_A1,
    summaryA1: POSTS_PULL_MESSAGE_A1,
    pushStatusCol: POSTS_PUSH_STATUS_COL,
  },
  idCol: 1,
  lastUpdatedAtCol: 2,
  extraCreateRows: POSTS_EXTRA_CREATE_ROWS,
  requestCols: [
    { col: 3, field: 'title', required: true },
    { col: 4, field: 'content', transform: 'text' },
    { col: 5, field: 'access_level', transform: 'text' },
    { col: 8, field: 'is_draft', transform: 'bool' },
  ],
  defaults: {},
};
