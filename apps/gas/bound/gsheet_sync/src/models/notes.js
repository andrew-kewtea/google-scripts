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
 * GET {API_PREFIX}/notes/ 쿼리: C6..I6 (빈 칸 생략).
 * TimeFrom/TimeTo: 셀이 Date·숫자(epoch)·``YYYY-MM-DD HH:mm`` 문자열이면 API 로는 unix 초 문자열로 보냄.
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

/** ``buildListQueryStringFromKeys_`` 에 넘겨 ``BIGINT`` 초 비교와 맞춤 */
var NOTES_LIST_QUERY_EPOCH_PARAM_KEYS = {
  last_updated_atFrom: true,
  last_updated_atTo: true,
};
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
  // fast2 NoteSummary / PostSummary — 피벗·연결 집계
  if (note.associations_num != null) return Number(note.associations_num);
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
      normalizeNotesListQueryValueForKey_,
      NOTES_LIST_QUERY_EPOCH_PARAM_KEYS
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
  /**
   * 노트 갱신만 경로와 바디 규칙이 다르다 (당분간 계약).
   * - fast2 ``PATCH /api/v1/notes/`` — URL 에는 note id 를 넣지 않고, JSON 바디의 ``id`` 로 대상을 지정한다 ( ``schemas.note.NotePatch`` ).
   * - 포스트·유저 등은 ``PATCH …/{id}`` 이므로 ``patchBodyIdOnly`` 가 없거나 false 인 스펙은 ``push.js`` 가 ``basePath`` + ``/`` + id 로 만든다.
   * 나중에 서버가 ``PATCH /notes/{id}`` 로 바꾸면 이 플래그와 ``push.js`` 분기를 제거하면 된다.
   */
  patchBodyIdOnly: true,
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
