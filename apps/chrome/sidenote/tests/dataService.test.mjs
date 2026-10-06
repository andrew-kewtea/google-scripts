import assert from 'node:assert/strict';
import test from 'node:test';

import { createDataService, createEmptyState, memoryPort, normalizeState, QuotaError, tagUsage } from '../dist/panel/dataService.js';
import { pageContextFromSearch } from '../dist/panel/session.js';
import { CREATE_BLOCK_BYTES } from '../dist/shared/types.js';
import { ancestorPaths, buildPageTree, visibleTreeRows } from '../dist/shared/pageTree.js';
import { filterExcerpts, hostOf, matchPage } from '../dist/shared/scope.js';

test('empty storage starts empty and is not seeded again', async () => {
  const service = createDataService(memoryPort());
  const first = await service.load();
  assert.equal(first.seeded, false);
  assert.equal(first.pages.length, 0);
  assert.equal(first.notes.length, 0);
  assert.equal(first.excerpts.length, 0);

  const second = await service.load();
  assert.equal(second.pages.length, 0);
  assert.equal(second.notes.length, 0);
});

test('note create, update, and soft delete stay on the same path', async () => {
  const service = createDataService(memoryPort());
  let state = await service.load();
  state = await service.createCollection(state, 'Inbox');
  const collectionId = state.collections[0].id;

  state = await service.createNote(state, {
    url: 'https://www.google.com/?q=1',
    title: 'Google',
    text: 'hello',
    visibility: 'private',
    collectionId,
    tagIds: [],
  });
  assert.equal(state.pages.length, 1);
  const page = matchPage(state, 'https://google.com/');
  assert.ok(page);
  let notes = state.notes.filter((note) => note.pageId === page.id && !note.deletedAt);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].text, 'hello');

  state = await service.updateNote(state, notes[0].id, {
    text: 'hello 2',
    visibility: 'public',
    collectionId,
    tagIds: [],
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
    tagIds: [],
  });
  assert.equal(state.pages.length, 2);
  assert.equal(hostOf(matchPage(state, 'https://example.com/post').url), 'example.com');

  const root = matchPage(state, 'https://chatgpt.com/');
  assert.equal(root, undefined);
  state = await service.createNote(state, {
    url: 'https://chatgpt.com/',
    title: 'ChatGPT',
    text: 'home',
    visibility: 'private',
    collectionId,
    tagIds: [],
  });
  const home = matchPage(state, 'https://chatgpt.com/');
  assert.ok(home);
  state = await service.createNote(state, {
    url: 'https://chatgpt.com/c/abc',
    title: 'Thread',
    text: 'thread only',
    visibility: 'private',
    collectionId,
    tagIds: [],
  });
  const child = matchPage(state, 'https://www.chatgpt.com/c/abc');
  assert.ok(child);
  assert.notEqual(child.id, home.id);
  assert.equal(matchPage(state, 'https://chatgpt.com/')?.id, home.id);
  assert.equal(state.notes.filter((note) => note.pageId === home.id && !note.deletedAt).length, 1);
  assert.equal(state.notes.find((note) => note.pageId === child.id && !note.deletedAt)?.text, 'thread only');
});

test('page excerpts filter by action and highlights are highlight rows', async () => {
  const service = createDataService(memoryPort());
  let state = await service.load();
  state = await service.createNote(state, {
    url: 'https://www.bbc.com/future/article/20260930-metas-new-ai-is-about-to-break-the-internet',
    title: 'Muse',
    text: 'page',
    visibility: 'private',
    collectionId: null,
    tagIds: [],
  });
  const bbc = matchPage(
    state,
    'https://www.bbc.com/future/article/20260930-metas-new-ai-is-about-to-break-the-internet?utm=1',
  );
  assert.ok(bbc);
  assert.ok(filterExcerpts(state, bbc.id, 'read').every((row) => row.userAction === 'read'));
  assert.ok(filterExcerpts(state, bbc.id, 'highlights').every((row) => row.userAction === 'highlight'));

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
    userAction: 'highlight',
    text: 'Copied line',
    excerpt: 'Copied line',
    range: { textQuote: 'Copied line', startOffset: 0, endOffset: 11 },
  });

  const highlights = filterExcerpts(state, bbc.id, 'highlights');
  assert.ok(highlights.some((row) => row.text === 'Copied line'));
  assert.equal(filterExcerpts(state, bbc.id, 'form').length, 1);
  assert.equal(highlights.filter((row) => row.userAction === 'form').length, 0);
});

test('a page matches its own path, including www and query strings', async () => {
  const service = createDataService(memoryPort());
  let state = await service.load();
  const pages = [
    ['https://www.google.com/', 'Google'],
    ['https://drive.google.com/', 'Drive'],
    ['https://mail.google.com/', 'Gmail'],
    ['https://chatgpt.com/', 'ChatGPT'],
    ['https://www.bbc.com/future/article/20260930-metas-new-ai-is-about-to-break-the-internet', 'Muse'],
  ];
  for (const [url, title] of pages) {
    state = await service.createNote(state, {
      url,
      title,
      text: title,
      visibility: 'private',
      collectionId: null,
      tagIds: [],
    });
  }
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
    ['bbc.com', 'future/', 'article/', '20260930-metas-new-a...', 'other'],
  );
  const leaf = open.find((row) => row.label === '20260930-metas-new-a...');
  assert.equal(leaf?.current, true);
  assert.equal(leaf?.count, 1);
  assert.equal(buildPageTree(entries, 'https://chatgpt.com/')?.children.length, 0);
  assert.deepEqual(ancestorPaths(current), ['bbc.com', 'bbc.com/future', 'bbc.com/future/article']);
  assert.deepEqual(ancestorPaths('https://chatgpt.com/'), []);

  const thread = 'https://chatgpt.com/c/6ac065b4-de50-83ee-90ca-b40812ef7e5d';
  const titled = buildPageTree([{ url: thread, notes: 1, title: '플로우 고객사 매출 조사' }], thread);
  assert.ok(titled);
  const threadRows = visibleTreeRows(titled, ['chatgpt.com', 'chatgpt.com/c'], thread);
  const threadLeaf = threadRows.find((row) => row.current);
  assert.equal(threadLeaf?.label, '6ac065b4-de50-83ee-9... (플로우 고객사 매출 조사)');
});

test('soft-deleted excerpts drop out of the history filter', async () => {
  const service = createDataService(memoryPort());
  let state = await service.load();
  state = await service.addManualExcerpt(state, {
    url: 'https://www.bbc.com/future/article/20260930-metas-new-ai-is-about-to-break-the-internet',
    title: 'Muse',
    text: 'highlighted',
    userAction: 'highlight',
    contextId: null,
    tagIds: [],
  });
  const bbc = matchPage(state, 'https://www.bbc.com/future/article/20260930-metas-new-ai-is-about-to-break-the-internet?x=1');
  assert.ok(bbc);
  const before = filterExcerpts(state, bbc.id, 'highlights');
  assert.equal(before.length, 1);
  const target = before[0];
  state = await service.deleteExcerpt(state, target.id);
  const stored = state.excerpts.find((row) => row.id === target.id);
  assert.ok(stored?.deletedAt);
  assert.equal(
    filterExcerpts(state, bbc.id, 'highlights').some((row) => row.id === target.id),
    false,
  );
});

test('a typed history row is stored on the page and drops out of both lists when deleted', async () => {
  const service = createDataService(memoryPort());
  let state = await service.load();
  const before = state.excerpts.filter((row) => !row.deletedAt).length;
  state = await service.addManualExcerpt(state, {
    url: 'https://chatgpt.com/c/abc',
    title: 'Thread',
    text: '  remembered this  ',
    userAction: 'link',
    contextId: null,
    tagIds: [],
  });
  const page = matchPage(state, 'https://chatgpt.com/c/abc');
  assert.ok(page);
  const mine = state.excerpts.find((row) => row.text === 'remembered this');
  assert.ok(mine);
  assert.equal(mine.userAction, 'link');
  assert.equal(mine.contextId, null);
  assert.equal(mine.scope.pageId, page.id);
  assert.equal(filterExcerpts(state, page.id, 'all').some((row) => row.id === mine.id), true);
  assert.equal(state.excerpts[0].id, mine.id);
  assert.equal(state.excerpts.filter((row) => !row.deletedAt).length, before + 1);

  const skipped = await service.addManualExcerpt(state, {
    url: 'https://chatgpt.com/c/abc',
    title: 'Thread',
    text: '   ',
    userAction: 'read',
    contextId: null,
    tagIds: [],
  });
  assert.equal(skipped.excerpts.filter((row) => !row.deletedAt).length, before + 1);

  state = await service.deleteExcerpt(state, mine.id);
  assert.equal(filterExcerpts(state, page.id, 'all').some((row) => row.id === mine.id), false);
  assert.equal(state.excerpts.filter((row) => !row.deletedAt && row.id === mine.id).length, 0);
});

test('old note keywords become settings tags', () => {
  const demo = createEmptyState();
  const legacy = {
    ...demo,
    notes: [
      {
        id: 'n1',
        pageId: 'p1',
        text: 'one',
        visibility: 'private',
        collectionId: null,
        keywords: ['muse'],
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'n2',
        pageId: 'p1',
        text: 'two',
        visibility: 'private',
        collectionId: null,
        keywords: ['fresh-word'],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    excerpts: [
      {
        id: 'e1',
        scope: { url: 'https://example.com/', pageId: 'p1', key: 'example.com' },
        userAction: 'read',
        text: 'seen',
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    ui: {
      ...demo.ui,
      sections: { ...demo.ui.sections, globalHistory: true },
    },
  };
  delete legacy.ui.sections.contexts;
  delete legacy.ui.contextSort;
  delete legacy.ui.contextsShown;
  delete legacy.ui.contextItemsShown;
  delete legacy.ui.openContexts;
  const { state, changed } = normalizeState(legacy);
  assert.equal(changed, true);
  const muse = state.tags.find((tag) => tag.name === 'muse');
  const fresh = state.tags.find((tag) => tag.name === 'fresh-word');
  assert.ok(muse);
  assert.ok(fresh);
  assert.equal(state.notes[0].tagIds[0], muse.id);
  assert.equal(state.notes[0].keywords, undefined);
  assert.equal(state.notes[1].tagIds[0], fresh.id);
  assert.equal(state.excerpts.every((row) => row.contextId === null && Array.isArray(row.tagIds)), true);
  assert.equal(state.ui.sections.contexts, true);
  assert.equal(state.ui.sections.globalHistory, undefined);
  assert.ok(Array.isArray(state.contexts));
});

test('context tasks stay on the context and are not copied onto history', async () => {
  const service = createDataService(memoryPort());
  let state = await service.load();
  state = await service.addManualExcerpt(state, {
    url: 'https://chatgpt.com/',
    title: 'ChatGPT',
    text: 'loose',
    userAction: 'play',
    contextId: null,
    tagIds: [],
  });
  const loose = state.excerpts.find((row) => row.text === 'loose');
  assert.ok(loose);
  assert.equal(loose.contextId, null);

  state = await service.createContext(state, 'Research');
  const context = state.contexts.find((item) => item.name === 'Research');
  assert.ok(context);
  state = await service.createTask(state, { title: 'Follow up', projectId: null });
  const taskId = state.tasks.find((task) => !task.deletedAt)?.id;
  assert.ok(taskId);
  state = await service.createTag(state, 'muse');
  const tagId = state.tags[0].id;
  state = await service.setContextTasks(state, context.id, [taskId]);
  assert.deepEqual(state.contexts.find((item) => item.id === context.id)?.taskIds, [taskId]);
  assert.equal(state.excerpts.find((row) => row.id === loose.id)?.contextId, null);
  assert.equal(state.excerpts.find((row) => row.id === loose.id)?.taskIds, undefined);

  state = await service.addManualExcerpt(state, {
    url: 'https://chatgpt.com/',
    title: 'ChatGPT',
    text: 'inside',
    userAction: 'link',
    contextId: context.id,
    tagIds: [tagId],
    excerpt: 'body',
  });
  const inside = state.excerpts.find((row) => row.text === 'inside');
  assert.ok(inside);
  assert.equal(inside.contextId, context.id);
  assert.equal(inside.userAction, 'link');
  assert.equal(inside.excerpt, 'body');
  assert.deepEqual(inside.tagIds, [tagId]);
  assert.equal(inside.taskIds, undefined);
  assert.deepEqual(state.contexts.find((item) => item.id === context.id)?.taskIds, [taskId]);
});

test('old history kinds collapse, unused tags delete, and a note can stay uncategorized', async () => {
  const demo = createEmptyState();
  const sample = {
    id: 'e1',
    scope: { url: 'https://example.com/a', pageId: 'p1', key: 'example.com/a' },
    userAction: 'read',
    text: 'seen',
    contextId: null,
    tagIds: [],
    createdAt: 1,
    updatedAt: 1,
  };
  demo.excerpts = [
    sample,
    { ...sample, id: 'old-copy', userAction: 'copy', text: 'copied' },
    { ...sample, id: 'old-manual', userAction: 'manual', text: 'typed by hand' },
    { ...sample, id: 'old-click', userAction: 'click', text: 'left via link' },
  ];
  demo.notes = [
    {
      id: 'n-muse',
      pageId: 'p1',
      text: 'tagged',
      visibility: 'private',
      collectionId: null,
      keywords: ['muse'],
      createdAt: 1,
      updatedAt: 1,
    },
  ];
  const normalized = normalizeState(demo);
  assert.equal(normalized.changed, true);
  assert.equal(normalized.state.excerpts.find((row) => row.id === 'old-copy')?.userAction, 'highlight');
  assert.ok(normalized.state.excerpts.find((row) => row.id === 'old-manual')?.deletedAt);
  assert.equal(normalized.state.excerpts.find((row) => row.id === 'old-click')?.userAction, 'link');
  assert.equal(normalized.state.excerpts.find((row) => row.id === 'old-click')?.deletedAt, undefined);

  const service = createDataService(memoryPort(normalized.state));
  let state = await service.load();
  state = await service.createTag(state, 'spare');
  const spare = state.tags.find((tag) => tag.name === 'spare');
  assert.ok(spare);
  assert.equal(tagUsage(state, spare.id), 0);
  state = await service.deleteTag(state, spare.id);
  assert.ok(state.tags.find((tag) => tag.id === spare.id)?.deletedAt);
  const muse = state.tags.find((tag) => tag.name === 'muse');
  assert.ok(muse);
  assert.ok(tagUsage(state, muse.id) > 0);
  const kept = await service.deleteTag(state, muse.id);
  assert.equal(kept.tags.find((tag) => tag.id === muse.id)?.deletedAt, undefined);

  state = await service.createNote(state, {
    url: 'https://chatgpt.com/',
    title: 'ChatGPT',
    text: 'loose note',
    visibility: 'private',
    collectionId: null,
    tagIds: [],
  });
  assert.equal(state.notes.find((note) => note.text === 'loose note')?.collectionId, null);
});

test('creates stop once local storage reaches 20MB', async () => {
  const service = createDataService(memoryPort());
  let state = await service.load();
  state = await service.createNote(state, {
    url: 'https://example.com/small',
    title: 'Small',
    text: 'fits',
    visibility: 'private',
    collectionId: null,
    tagIds: [],
  });
  assert.equal(state.notes.filter((note) => !note.deletedAt).length, 1);

  const full = createEmptyState();
  full.notes = [
    {
      id: 'huge',
      pageId: 'p',
      text: 'x'.repeat(CREATE_BLOCK_BYTES),
      visibility: 'private',
      collectionId: null,
      tagIds: [],
      createdAt: 1,
      updatedAt: 1,
    },
  ];
  const blocked = createDataService(memoryPort(full));
  const loaded = await blocked.load();
  await assert.rejects(
    () =>
      blocked.createNote(loaded, {
        url: 'https://example.com/more',
        title: 'More',
        text: 'nope',
        visibility: 'private',
        collectionId: null,
        tagIds: [],
      }),
    QuotaError,
  );
  const again = await blocked.load();
  assert.equal(again.notes.some((note) => note.text === 'nope'), false);
});

test('deleting a collection keeps the notes and clears their collection', async () => {
  const service = createDataService(memoryPort());
  let state = await service.load();
  state = await service.createCollection(state, 'Inbox');
  const collectionId = state.collections.find((item) => !item.deletedAt)?.id ?? '';
  state = await service.createNote(state, {
    url: 'https://example.com/kept',
    title: 'Kept',
    text: 'stay',
    visibility: 'private',
    collectionId,
    tagIds: [],
  });
  state = await service.deleteCollection(state, collectionId);
  assert.ok(state.collections.find((item) => item.id === collectionId)?.deletedAt);
  assert.equal(state.notes.find((note) => note.text === 'stay')?.collectionId, null);
});

test('the collections limit keeps the newest collection', async () => {
  const service = createDataService(memoryPort());
  let state = await service.load();
  state = await service.saveDisplay(state, { ...state.settings.display, collections: 1 });
  state = await service.createCollection(state, 'Old');
  state = await service.createCollection(state, 'New');
  const live = state.collections.filter((item) => !item.deletedAt);
  assert.equal(live.length, 1);
  assert.equal(live[0].name, 'New');
});

test('panel reads the page address and title baked into its iframe query', () => {
  const params = new URLSearchParams({
    url: 'https://chatgpt.com/c/abc',
    title: 'WSL2 홈 경로 보기',
  });
  assert.deepEqual(pageContextFromSearch(`?${params}`), {
    url: 'https://chatgpt.com/c/abc',
    title: 'WSL2 홈 경로 보기',
  });
  assert.deepEqual(pageContextFromSearch(''), { url: '', title: '' });
});
