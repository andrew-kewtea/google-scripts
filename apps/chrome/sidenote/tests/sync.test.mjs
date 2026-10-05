import assert from 'node:assert/strict';
import test from 'node:test';

import { createEmptyState } from '../dist/panel/dataService.js';
import {
  absorbPull,
  appendOutbox,
  applyServerId,
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
  assert.equal(plan[3].body.collection_id, 'tmp_col');
});

test('a note payload without a url ref is not cached', () => {
  assert.equal(noteFromRemote({ id: 4, content: 'orphan' }, null), null);
  assert.equal(noteFromRemote({ id: 5, content: 'kept' }, { url_id: 9 }).pageId, '9');
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
  const outbox = [{ id: '1', entity: 'note_url_ref', op: 'create', localId: 'tmp_ref', body: { note_id: 'tmp_note', collection_id: 'tmp_col' }, updatedAt: 1 }];
  const applied = applyServerId(state, outbox, 'tmp_note', '42');
  assert.equal(applied.state.notes[0].id, '42');
  assert.equal(applied.outbox[0].body.note_id, '42');
  const collections = applyServerId(applied.state, applied.outbox, 'tmp_col', '7');
  assert.equal(collections.state.notes[0].collectionId, '7');
  assert.equal(collections.outbox[0].body.collection_id, '7');
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

test('a 10 minute pull adds last_updated_atFrom', () => {
  const params = new URLSearchParams(listQuery('web-histories', { since: 1_700_000_000 }).split('?')[1]);
  assert.equal(params.get('last_updated_atFrom'), '1700000000');
  assert.equal(params.get('size'), '20');
});
