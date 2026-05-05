/**
 * notes Pull/Push 스펙·시트 레이아웃·``{API_PREFIX}/notes/`` list_query 규약.
 * ``API_PREFIX`` 는 ``10_constants.js``.
 *
 * 새 모델 추가: ``readme_mode.txt`` · ``30_registry.js`` 에 gid 등록.
 */

var NOTES_RESOURCE_MODEL = 'notes';
var NOTES_SHEET_GID = 2037974657;

/** Push 레이아웃: 데이터 하단 create 대기 행 수, 행별 결과 열(J=10). */
var NOTES_EXTRA_CREATE_ROWS = 5;
var NOTES_PUSH_STATUS_COL = 10;

/**
 * GET {API_PREFIX}/notes/ 쿼리: C6..I6 표시값만 사용(빈 칸 생략).
 * 태그(Tag): 시트 라벨이 Tag여도 E열 값은 현재 ``q`` 로 매핑.
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

var NOTES_LIST_SORT_ALIASES = {
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

var normalizeNotesListQueryValueForKey_ = makeListSortParamNormalizer_(
  NOTES_LIST_SORT_ALIASES
);

var PATH_NOTES_LIST = API_PREFIX + '/notes/';

var NOTES_PULL_MESSAGE_A1 = 'G4';
var NOTES_PULL_SYNCED_AT_A1 = 'I4';

var NOTES_DATA_FIRST_ROW = 9;
var NOTES_DATA_NUM_COLS = 9;

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

var NOTES_PULL_SPEC = {
  resourceLabel: NOTES_RESOURCE_MODEL,
  sheetGid: NOTES_SHEET_GID,
  listPath: PATH_NOTES_LIST,
  buildQueryString: function (sheet) {
    return buildListQueryStringFromKeys_(
      sheet,
      NOTES_LIST_QUERY_PARAM_KEYS,
      NOTES_LIST_QUERY_VALUE_ROW,
      NOTES_LIST_QUERY_START_COL,
      normalizeNotesListQueryValueForKey_
    );
  },
  layout: {
    dataFirstRow: NOTES_DATA_FIRST_ROW,
    numCols: NOTES_DATA_NUM_COLS,
    messageA1: NOTES_PULL_MESSAGE_A1,
    syncedAtA1: NOTES_PULL_SYNCED_AT_A1,
  },
  mapItemToRow: noteToSheetRow_,
};

var NOTES_PUSH_SPEC = {
  resourceLabel:    NOTES_RESOURCE_MODEL,
  sheetGid:         NOTES_SHEET_GID,
  basePath:         API_PREFIX + '/notes/',
  layout: {
    dataFirstRow:   NOTES_DATA_FIRST_ROW,
    numCols:        NOTES_DATA_NUM_COLS,
    syncedAtA1:     NOTES_PULL_SYNCED_AT_A1,
    summaryA1:      NOTES_PULL_MESSAGE_A1,
    pushStatusCol:  NOTES_PUSH_STATUS_COL,
  },
  idCol:            1,
  lastUpdatedAtCol: 2,
  extraCreateRows:  NOTES_EXTRA_CREATE_ROWS,
  requestCols: [
    { col: 3, field: 'title',        required: true      },
    { col: 4, field: 'content',      transform: 'text'   },
    { col: 5, field: 'content_type', transform: 'text'   },
    { col: 8, field: 'is_draft',     transform: 'bool'   },
  ],
  defaults: {},
};
