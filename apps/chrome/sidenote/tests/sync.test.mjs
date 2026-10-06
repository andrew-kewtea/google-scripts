import assert from 'node:assert/strict';
import test from 'node:test';

import { createEmptyState } from '../dist/panel/dataService.js';
import {
  absorbPull,
  appendOutbox,
  applyServerId,
  blocksOnTemp,
  listQuery,
  mergeWinner,
  nextListPage,
  noteFromRemote,
  planMutation,
  shouldPost,
  trimCache,
} from '../dist/lib/sync.js';
import { CACHE_CAP, CACHE_PAGE_SIZE } from '../dist/shared/types.js';

test('a new note queues url, url about, note, and note url ref', () => {
  const before = createEmptyState();
  const after = createEmptyState();
  after.pages = [
    {
      id: 'tmp_page',
      title: 'Example',
      url: 'https://www.example.com/docs/?q=1',
      patterns: ['example.com/docs/*'],
      ignoreQuery: true,
      tagIds: [],
      updatedAt: 10,
    },
  ];
  after.notes = [
    {
      id: 'tmp_note',
      pageId: 'tmp_page',
      text: 'hello',
      visibility: 'private',
      collectionId: 'tmp_col',
      tagIds: [],
      createdAt: 10,
      updatedAt: 10,
    },
  ];
  const plan = planMutation(before, after);
  assert.deepEqual(
    plan.map((item) => item.entity),
    ['url', 'url_about', 'note', 'note_url_ref'],
  );
  assert.equal(plan[0].body.normalized_url, 'https://example.com/docs');
  assert.equal(plan[2].body.body, 'hello');
  assert.equal(plan[2].body.access, 'private');
  assert.equal(plan[2].body.collection_slug, 'tmp_col');
  assert.match(plan[2].body.page_date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal('access_level' in plan[2].body, false);
  assert.equal(plan[3].body.collection_slug, 'tmp_col');
  assert.equal('collection_id' in plan[3].body, false);
});

test('repeated edits of one temp row stay a single create', () => {
  const before = createEmptyState();
  const created = createEmptyState();
  created.tasks = [{ id: 'tmp_task', localNo: 1, title: 'ew test', projectId: null, status: 'draft', updatedAt: 1 }];
  const edited = createEmptyState();
  edited.tasks = [{ ...created.tasks[0], title: 'ew test 2', updatedAt: 2 }];
  const queued = appendOutbox(planMutation(before, created), planMutation(created, edited));
  assert.equal(queued.length, 1);
  assert.equal(queued[0].op, 'create');
  assert.equal(queued[0].localId, 'tmp_task');
  assert.equal(queued[0].body.title, 'ew test 2');
});

test('a queued create becomes an update once the server id arrives', () => {
  const state = createEmptyState();
  state.tasks = [{ id: 'tmp_task', localNo: 1, title: 'ew test', projectId: null, status: 'draft', updatedAt: 2 }];
  const outbox = [{ id: 'task', entity: 'task', op: 'create', localId: 'tmp_task', body: { title: 'ew test 2' }, updatedAt: 2 }];
  const applied = applyServerId(state, outbox, 'tmp_task', '15');
  assert.equal(applied.state.tasks[0].id, '15');
  assert.equal(applied.outbox[0].op, 'update');
  assert.equal(applied.outbox[0].localId, '15');
});

test('a note waits until its temp collection id is resolved', () => {
  const note = { id: 'n', entity: 'note', op: 'create', localId: 'tmp_note', body: { collection_slug: 'tmp_col' }, updatedAt: 1 };
  const collection = { id: 'c', entity: 'collection', op: 'create', localId: 'tmp_col', body: { slug: 'study' }, updatedAt: 1 };
  assert.equal(blocksOnTemp(note, [note, collection]), true);
  assert.equal(blocksOnTemp(collection, [note, collection]), false);
});

test('a note payload without a url ref is not cached', () => {
  assert.equal(noteFromRemote({ id: 4, content: 'orphan' }, null), null);
  const kept = noteFromRemote({ id: 5, content: 'kept' }, { url_id: 9, collection_slug: 'study' });
  assert.equal(kept.pageId, '9');
  assert.equal(kept.collectionId, 'study');
  assert.equal(noteFromRemote({ id: 6, content: 'loose' }, { url_id: 9, collection_slug: 'journal' }).collectionId, null);
  assert.equal(noteFromRemote({ id: 7, content: 'numeric' }, { url_id: 9, collection_id: 4 }).collectionId, null);
});

test('a temporary id becomes the server id and collection links follow', () => {
  const state = createEmptyState();
  state.notes = [
    {
      id: 'tmp_note',
      pageId: 'tmp_page',
      text: 'hello',
      visibility: 'private',
      collectionId: 'tmp_col',
      tagIds: [],
      createdAt: 1,
      updatedAt: 1,
    },
  ];
  const outbox = [{ id: '1', entity: 'note_url_ref', op: 'create', localId: 'tmp_ref', body: { note_id: 'tmp_note', collection_slug: 'tmp_col' }, updatedAt: 1 }];
  const applied = applyServerId(state, outbox, 'tmp_note', '42');
  assert.equal(applied.state.notes[0].id, '42');
  assert.equal(applied.outbox[0].body.note_id, '42');
  assert.equal(applied.outbox[0].op, 'create');
  const collections = applyServerId(applied.state, applied.outbox, 'tmp_col', 'study');
  assert.equal(collections.state.notes[0].collectionId, 'study');
  assert.equal(collections.outbox[0].body.collection_slug, 'study');
});

test('the newer timestamp wins and a delete wins', () => {
  assert.equal(mergeWinner({ updatedAt: 2, text: 'local' }, { updatedAt: 5, text: 'cloud' }).text, 'cloud');
  assert.equal(mergeWinner({ updatedAt: 9, deletedAt: 9 }, { updatedAt: 3 }).deletedAt, 9);
  assert.equal(mergeWinner({ updatedAt: 1 }, { updatedAt: 2, is_deleted: true }).is_deleted, true);
});

test('a row that already has a server id is not posted again', () => {
  assert.equal(shouldPost('tmp_1'), true);
  assert.equal(shouldPost('42'), false);
});

test('logged-out edits stay on the outbox', () => {
  const before = createEmptyState();
  const after = createEmptyState();
  after.tags = [{ id: 'tmp_tag', name: 'muse', visibility: 'private', updatedAt: 3 }];
  const queued = appendOutbox([], planMutation(before, after));
  assert.equal(queued.length, 1);
  assert.equal(queued[0].entity, 'tag');
  assert.equal(shouldPost(queued[0].localId), true);
});

test('pull asks for 20 and show more advances the page', () => {
  const first = new URLSearchParams(listQuery('notes', { sort: 'recency' }).split('?')[1]);
  assert.equal(first.get('size'), String(CACHE_PAGE_SIZE));
  assert.equal(first.get('has_url'), '1');
  assert.equal(first.get('page'), '1');
  const more = new URLSearchParams(listQuery('notes', { page: nextListPage(1), sort: 'size' }).split('?')[1]);
  assert.equal(more.get('page'), '2');
  assert.equal(more.get('sort'), 'size_bytes');
});

test('the 60 cap keeps outbox rows', () => {
  const rows = Array.from({ length: CACHE_CAP + 5 }, (_, index) => ({ id: `row-${index}` }));
  const kept = trimCache(rows, new Set(['row-64']));
  assert.ok(kept.some((row) => row.id === 'row-64'));
  assert.ok(kept.length >= CACHE_CAP);
});

test('a pull drops notes without a url and stores task members', () => {
  const merged = absorbPull(createEmptyState(), {
    notes: {
      items: [
        { id: 4, content: 'orphan', last_updated_at: 10 },
        { id: 5, content: 'kept', access_level: 'private', last_updated_at: 10 },
      ],
    },
    noteUrlRefs: { items: [{ note_id: 5, url_id: 9 }] },
    tasks: { items: [{ id: 3, title: 'Follow', status: 'active', members: [{ user_id: 8 }], last_updated_at: 10 }] },
    contexts: { items: [{ id: 2, name: 'Research', last_updated_at: 10 }] },
  });
  assert.equal(merged.notes.length, 1);
  assert.equal(merged.notes[0].pageId, '9');
  assert.deepEqual(merged.tasks[0].memberIds, ['8']);
  assert.equal(merged.contexts[0].name, 'Research');
});

test('collection pull uses the journal handle without a second @', () => {
  assert.equal(listQuery('collections', { owner: '@jungh_lee1' }).startsWith('/journals/@jungh_lee1/collections?'), true);
  assert.equal(listQuery('collections', {}), '');
});

test('a 10 minute pull adds last_updated_atFrom', () => {
  const params = new URLSearchParams(listQuery('web-histories', { since: 1_700_000_000 }).split('?')[1]);
  assert.equal(params.get('last_updated_atFrom'), '1700000000');
  assert.equal(params.get('size'), '20');
});
