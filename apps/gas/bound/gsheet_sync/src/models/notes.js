/**
 * notes 목록 Pull 전용 — 시트 레이아웃과 fast2 ``/api/v1/notes/`` list_query 규약.
 * 시트 물리 위치 변경 시 여기 상수와 스프레드시트를 함께 맞춘다.
 *
 * 새 모델(posts 등) 추가 시에는 이 파일 패턴으로 ``models/other.js`` + ``NOTES_PULL_SPEC`` 과 같은 spec 을 작성하고,
 * main.js 의 ``PULL_SPECS_BY_GID`` 에 gid 를 등록한다.
 */

var NOTES_RESOURCE_MODEL = 'notes';
var NOTES_SHEET_GID = 2037974657;

/**
 * GET /api/v1/notes/ 쿼리: C6..I6 표시값만 사용(빈 칸 생략). 키는 fast2 ``utils/list_query.py`` 규약과
 * ``note_controller.ALLOWED_FILTER_FIELDS`` 키와 일치해야 함.
 *
 * - 구간 필터: ``{컬럼명}From`` → gte, ``{컬럼명}To`` → lte (Vue useListQuery ranges와 동일).
 * - ``page``, ``size``, ``sort``, ``order``, ``q`` 예약어.
 *
 * 태그(Tag): 시트 라벨이 Tag여도 E열 값은 현재 ``q`` 로 매핑(서버 tag 필터 미지원 시 400 회피).
 * 서버 확정 후 ``NOTES_LIST_QUERY_PARAM_KEYS[2]`` 를 ``tag_id`` 등으로 바꾸면 된다.
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

/** pull 결과 (메시지 G4, 마지막 동기 시각 I4) */
var NOTES_PULL_MESSAGE_A1 = 'G4';
var NOTES_PULL_SYNCED_AT_A1 = 'I4';

/** 행 8 헤더, 행 9부터 데이터 · 9열 */
var NOTES_DATA_FIRST_ROW = 9;
var NOTES_DATA_NUM_COLS = 9;

/**
 * ``sort`` 시 표기(normalized compact) 와 fast2 ``ALLOWED_FILTER_FIELDS`` snake_case 매핑.
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

/** unix 초 또는 ms → 현재 스프레드시트 타임존 표시 문자열 */
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

/**
 * main.js 의 ``pullListFromSheet`` 레지스트리에 넣을 notes Pull 설정.
 *
 * ``buildQueryString`` / ``layout`` / ``mapItemToRow`` 만 교체하면 동일 패턴으로 다른 리소스도 Pull 가능하다.
 */
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

/**
 * notes Push spec — pushCUD.js 의 ``PUSH_SPECS_BY_GID`` 에 등록됨.
 *
 * layout.syncedAtA1 : pull 의 last synced 시각 셀(I4) — update/create 판별 기준
 * layout.summaryA1  : push 전체 결과 셀 (G5, pull 의 G4 와 구분)
 * layout.pushStatusCol : 행별 결과 열 (J = 10)
 *
 * requestCols: push 요청에 포함할 열만 정의. 나머지(Tags, Attachments, Owner_id)는 읽기 전용.
 * 새 모델 추가 시 이 패턴으로 ``models/<model>.js`` 에 PUSH_SPEC 작성 후
 * pushCUD.js ``registerPushSpecs_`` 에 gid 등록만 하면 됨.
 */
var NOTES_PUSH_SPEC = {
  resourceLabel:    NOTES_RESOURCE_MODEL,
  sheetGid:         NOTES_SHEET_GID,
  basePath:         '/api/v1/notes/',
  layout: {
    dataFirstRow:   NOTES_DATA_FIRST_ROW,
    numCols:        NOTES_DATA_NUM_COLS,
    syncedAtA1:     NOTES_PULL_SYNCED_AT_A1,
    summaryA1:      NOTES_PUSH_MESSAGE_A1,
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
    // col 6 Tags: 관계형 필드. 서버 지원 후 { col: 6, field: 'tags', transform: 'csv' } 추가
    // col 7 Attachments, col 9 Owner_id: 읽기 전용 — 수정해도 반영 안 됨
  ],
  defaults: {},
};
