import assert from 'node:assert/strict';
import test from 'node:test';

import { createDataService, memoryPort } from '../dist/panel/dataService.js';
import { buildPageTree, visibleTreeRows } from '../dist/shared/pageTree.js';
import { filterExcerpts, hostOf, matchPage } from '../dist/shared/scope.js';

test('empty storage is seeded once with five pages', async () => {
  const service = createDataService(memoryPort());
  const first = await service.load();
  assert.equal(first.seeded, true);
  assert.equal(first.pages.length, 5);
  assert.equal(first.notes.filter((note) => !note.deletedAt).length, 2);
  assert.equal(first.excerpts.filter((row) => !row.deletedAt).length, 2);
  assert.equal(first.collections.filter((row) => !row.deletedAt).length, 2);
  assert.equal(first.tasks.filter((row) => !row.deletedAt).length, 2);

  const second = await service.load();
  assert.deepEqual(
    second.pages.map((page) => page.id),
    first.pages.map((page) => page.id),
  );
  assert.equal(second.notes.length, first.notes.length);
});

test('note create, update, and soft delete stay on the same path', async () => {
  const service = createDataService(memoryPort());
  let state = await service.load();
  const before = state.pages.length;
  const collectionId = state.collections[0].id;

  state = await service.createNote(state, {
    url: 'https://www.google.com/?q=1',
    title: 'Google',
    text: 'hello',
    visibility: 'private',
    collectionId,
    keywords: ['q'],
  });
  assert.equal(state.pages.length, before);
  const page = matchPage(state, 'https://google.com/');
  assert.ok(page);
  let notes = state.notes.filter((note) => note.pageId === page.id && !note.deletedAt);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].text, 'hello');

  state = await service.updateNote(state, notes[0].id, {
    text: 'hello 2',
    visibility: 'public',
    collectionId,
    keywords: ['q'],
  });
  notes = state.notes.filter((note) => note.pageId === page.id && !note.deletedAt);
  assert.equal(notes[0].text, 'hello 2');
  assert.equal(notes[0].visibility, 'public');

  state = await service.deleteNote(state, notes[0].id);
  const stored = state.notes.find((note) => note.id === notes[0].id);
  assert.ok(stored?.deletedAt);
  assert.equal(state.notes.filter((note) => note.pageId === page.id && !note.deletedAt).length, 0);

  state = await service.createNote(state, {
    url: 'https://example.com/post',
    title: 'Example',
    text: 'elsewhere',
    visibility: 'private',
    collectionId,
    keywords: [],
  });
  assert.equal(state.pages.length, before + 1);
  assert.equal(hostOf(matchPage(state, 'https://example.com/post').url), 'example.com');

  const root = matchPage(state, 'https://chatgpt.com/');
  assert.ok(root);
  const rootCount = state.notes.filter((note) => note.pageId === root.id && !note.deletedAt).length;
  state = await service.createNote(state, {
    url: 'https://chatgpt.com/c/abc',
    title: 'Thread',
    text: 'thread only',
    visibility: 'private',
    collectionId,
    keywords: [],
  });
  const child = matchPage(state, 'https://www.chatgpt.com/c/abc');
  assert.ok(child);
  assert.notEqual(child.id, root.id);
  assert.equal(matchPage(state, 'https://chatgpt.com/')?.id, root.id);
  assert.equal(state.notes.filter((note) => note.pageId === root.id && !note.deletedAt).length, rootCount);
  assert.equal(state.notes.find((note) => note.pageId === child.id && !note.deletedAt)?.text, 'thread only');
});

test('page excerpts filter by action and highlights include copy and select', async () => {
  const service = createDataService(memoryPort());
  let state = await service.load();
  const bbc = matchPage(
    state,
    'https://www.bbc.com/future/article/20260930-metas-new-ai-is-about-to-break-the-internet',
  );
  assert.ok(bbc);
  assert.ok(filterExcerpts(state, bbc.id, 'read').every((row) => row.userAction === 'read'));
  assert.ok(
    filterExcerpts(state, bbc.id, 'highlights').every(
      (row) => row.userAction === 'copy' || row.userAction === 'select',
    ),
  );

  state = await service.addExcerpt(state, {
    pageId: bbc.id,
    url: bbc.url,
    userAction: 'form',
    text: 'Typed in search',
    excerpt: 'batch',
  });
  state = await service.addExcerpt(state, {
    pageId: bbc.id,
    url: bbc.url,
    userAction: 'copy',
    text: 'Copied line',
    excerpt: 'Copied line',
    range: { textQuote: 'Copied line', startOffset: 0, endOffset: 11 },
  });

  const highlights = filterExcerpts(state, bbc.id, 'highlights');
  assert.ok(highlights.some((row) => row.userAction === 'copy'));
  assert.ok(highlights.some((row) => row.userAction === 'select'));
  assert.equal(filterExcerpts(state, bbc.id, 'form').length, 1);
  assert.equal(highlights.filter((row) => row.userAction === 'form').length, 0);
});

test('a page matches its own path, including www and query strings', async () => {
  const service = createDataService(memoryPort());
  const state = await service.load();
  const samePath = [
    ['https://www.google.com/?q=a', 'google.com'],
    ['https://drive.google.com/', 'drive.google.com'],
    ['https://mail.google.com/?authuser=0', 'mail.google.com'],
    ['https://chatgpt.com/', 'chatgpt.com'],
    [
      'https://www.bbc.com/future/article/20260930-metas-new-ai-is-about-to-break-the-internet?utm=1',
      'bbc.com',
    ],
  ];
  for (const [url, host] of samePath) {
    const page = matchPage(state, url);
    assert.ok(page, url);
    assert.equal(hostOf(page.url), host);
  }
  assert.equal(matchPage(state, 'https://example.com/'), undefined);
  assert.equal(matchPage(state, 'https://www.google.com/search?q=a'), undefined);
  assert.equal(matchPage(state, 'https://chatgpt.com/c/abc'), undefined);
  assert.equal(matchPage(state, 'https://drive.google.com/drive/u/0'), undefined);
});

test('about tree is the current host path, collapsed to the domain', () => {
  const entries = [
    { url: 'https://www.google.com/', notes: 0 },
    { url: 'https://mail.google.com/', notes: 1 },
    {
      url: 'https://www.bbc.com/future/article/20260930-metas-new-ai-is-about-to-break-the-internet',
      notes: 1,
    },
    { url: 'https://www.bbc.com/future/article/other', notes: 2 },
  ];
  const current = 'https://www.bbc.com/future/article/20260930-metas-new-ai-is-about-to-break-the-internet';
  const root = buildPageTree(entries, current);
  assert.ok(root);
  assert.equal(root.segment, 'bbc.com');
  const collapsed = visibleTreeRows(root, [], current);
  assert.deepEqual(
    collapsed.map((row) => row.label),
    ['bbc.com'],
  );
  assert.equal(collapsed[0].count, 3);

  const open = visibleTreeRows(root, ['bbc.com', 'bbc.com/future', 'bbc.com/future/article'], current);
  assert.deepEqual(
    open.map((row) => row.label),
    ['bbc.com', 'future/', 'article/', '20260930-metas-new-ai-is-about-to-break-the-internet', 'other'],
  );
  const leaf = open.find((row) => row.label === '20260930-metas-new-ai-is-about-to-break-the-internet');
  assert.equal(leaf?.current, true);
  assert.equal(leaf?.count, 1);
  assert.equal(buildPageTree(entries, 'https://chatgpt.com/')?.children.length, 0);
});

test('soft-deleted excerpts drop out of the history filter', async () => {
  const service = createDataService(memoryPort());
  let state = await service.load();
  const bbc = matchPage(
    state,
    'https://www.bbc.com/future/article/20260930-metas-new-ai-is-about-to-break-the-internet',
  );
  assert.ok(bbc);
  const before = filterExcerpts(state, bbc.id, 'highlights');
  assert.ok(before.length >= 1);
  const target = before[0];
  state = await service.deleteExcerpt(state, target.id);
  const stored = state.excerpts.find((row) => row.id === target.id);
  assert.ok(stored?.deletedAt);
  assert.equal(
    filterExcerpts(state, bbc.id, 'highlights').some((row) => row.id === target.id),
    false,
  );
});
