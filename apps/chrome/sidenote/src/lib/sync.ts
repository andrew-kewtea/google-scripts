import {
  CACHE_CAP,
  CACHE_PAGE_SIZE,
  type Collection,
  type ContextThread,
  type Note,
  type PageExcerpt,
  type PageRecord,
  type Project,
  type SidenoteState,
  type TagRecord,
  type Task,
  type TaskStatus,
  type UserAction,
  type UserGroup,
  type Visibility,
} from '../shared/types.js';
import { canonicalUrl, pageKey, type UrlRule } from '../shared/urlKey.js';

export type OutboxEntity =
  | 'url'
  | 'url_about'
  | 'note'
  | 'note_url_ref'
  | 'collection'
  | 'context'
  | 'web_history'
  | 'task'
  | 'project'
  | 'tag'
  | 'group'
  | 'settings';

export type OutboxEntry = {
  id: string;
  entity: OutboxEntity;
  op: 'create' | 'update' | 'delete';
  localId: string;
  body: Record<string, unknown>;
  updatedAt: number;
};

export function isTempId(id: string): boolean {
  return id.startsWith('tmp_');
}

export function shouldPost(id: string): boolean {
  return isTempId(id);
}

export function appendOutbox(outbox: OutboxEntry[], entries: OutboxEntry[]): OutboxEntry[] {
  return coalesceOutbox([...outbox, ...entries]);
}

/** One pending operation per entity and local id. Edits of a tmp_ row stay a single create. */
export function coalesceOutbox(entries: OutboxEntry[]): OutboxEntry[] {
  const grouped = new Map<string, OutboxEntry>();
  const order: string[] = [];
  for (const item of entries) {
    const key = `${item.entity}:${item.localId}`;
    const prior = grouped.get(key);
    if (!prior) {
      grouped.set(key, item);
      order.push(key);
      continue;
    }
    if (item.op === 'delete' && prior.op === 'create' && isTempId(item.localId)) {
      grouped.delete(key);
      continue;
    }
    const op = prior.op === 'create' && item.op !== 'delete' ? 'create' : item.op;
    grouped.set(key, {
      ...item,
      id: op === 'create' ? prior.id : item.id,
      op,
      body: item.op === 'delete' ? {} : item.body,
      updatedAt: item.updatedAt,
    });
  }
  return order.flatMap((key) => {
    const row = grouped.get(key);
    return row ? [row] : [];
  });
}

/** The body still names a tmp_ id whose create is waiting later in this queue. */
export function blocksOnTemp(item: OutboxEntry, queue: OutboxEntry[]): boolean {
  const ids = queue
    .filter((row) => row !== item && row.op === 'create' && isTempId(row.localId))
    .map((row) => row.localId);
  if (!ids.length) return false;
  const blob = JSON.stringify(item.body);
  return ids.some((id) => blob.includes(JSON.stringify(id)));
}

export function planMutation(before: SidenoteState, after: SidenoteState): OutboxEntry[] {
  const entries: OutboxEntry[] = [];
  const knownPages = new Set(before.pages.map((page) => page.id));
  for (const page of after.pages) {
    if (!knownPages.has(page.id)) {
      entries.push(entry('url', 'create', page.id, { normalized_url: canonicalUrl(page.url) }, page.updatedAt));
      entries.push(
        entry('url_about', 'create', `${page.id}:about`, {
          url_id: page.id,
          title: page.title,
          patterns: page.patterns,
        }, page.updatedAt),
      );
    }
  }
  pushRows(entries, 'collection', before.collections, after.collections, (row) => collectionBody(row, after));
  pushNoteRows(entries, before, after);
  for (const note of after.notes) {
    const previous = before.notes.find((item) => item.id === note.id);
    if (previous || note.deletedAt) continue;
    const page = after.pages.find((item) => item.id === note.pageId);
    if (!page) continue;
    entries.push(
      entry('note_url_ref', 'create', `${note.id}:url`, noteRefBody(note, page.id), note.updatedAt),
    );
  }
  pushRows(entries, 'context', before.contexts, after.contexts, (row) => ({ name: row.name, access_level: 'private' }));
  pushRows(entries, 'web_history', before.excerpts, after.excerpts, (row) => ({
    url_id: row.scope.pageId,
    context_id: row.contextId,
    user_action: row.userAction,
    text: row.text,
    excerpt: row.excerpt ?? null,
    range: row.range ?? null,
    access_level: 'private',
  }));
  pushRows(entries, 'task', before.tasks, after.tasks, (row) => ({
    title: row.title,
    project_id: row.projectId,
    status: row.status,
  }));
  pushRows(entries, 'project', before.projects, after.projects, (row) => ({ title: row.name }));
  pushRows(entries, 'tag', before.tags, after.tags, (row) => tagBody(row, after));
  pushRows(entries, 'group', before.groups, after.groups, (row) => ({ name: row.name, uname: row.handle }));
  const readBefore = readAccessHandles(before);
  const readAfter = readAccessHandles(after);
  if (readBefore.join('\n') !== readAfter.join('\n')) {
    entries.push(entry('settings', 'update', 'read-access', { active_usergroup_unames: readAfter }, Date.now()));
  }
  if (
    before.settings.language !== after.settings.language ||
    before.settings.timeZone !== after.settings.timeZone ||
    before.settings.theme !== after.settings.theme
  ) {
    entries.push(
      entry('settings', 'update', 'me', {
        language: syncLanguage(after.settings.language),
        timezone: after.settings.timeZone,
        theme: { journal: after.settings.theme },
      }, Date.now()),
    );
  }
  return entries;
}

export function pageDateOf(ms: number, timeZone: string): string {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
  return formatted.slice(0, 10);
}

export function serverIdOf(entity: string, body: unknown): string {
  if (!isRecord(body)) return '';
  if (entity === 'note' && isRecord(body.note) && body.note.id != null) return String(body.note.id);
  if (entity === 'collection' && isRecord(body.collection) && body.collection.id != null) {
    return String(body.collection.id);
  }
  return body.id == null ? '' : String(body.id);
}

export function applyCreatedTaskStatus(state: SidenoteState, taskId: string, body: unknown): SidenoteState {
  if (!isRecord(body)) return state;
  const status = taskStatus(body.status);
  return {
    ...state,
    tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, status } : task)),
  };
}

export function applyServerId(state: SidenoteState, outbox: OutboxEntry[], localId: string, serverId: string): {
  state: SidenoteState;
  outbox: OutboxEntry[];
} {
  const next = rewriteState(state, localId, serverId);
  return {
    state: next,
    outbox: outbox.map((item) => ({
      ...item,
      op: item.localId === localId && item.op === 'create' && !isTempId(serverId) ? 'update' : item.op,
      localId: item.localId === localId ? serverId : item.localId,
      body: rewriteValue(item.body, localId, serverId) as Record<string, unknown>,
    })),
  };
}

export function mergeWinner<T extends { updatedAt?: number; deletedAt?: number; last_updated_at?: number; is_deleted?: boolean }>(
  local: T,
  remote: T,
): T {
  const localDeleted = Boolean(local.deletedAt) || local.is_deleted === true;
  const remoteDeleted = Boolean(remote.deletedAt) || remote.is_deleted === true;
  if (localDeleted || remoteDeleted) {
    return localDeleted ? local : remote;
  }
  const localAt = local.updatedAt ?? (local.last_updated_at ? local.last_updated_at * 1000 : 0);
  const remoteAt = remote.updatedAt ?? (remote.last_updated_at ? remote.last_updated_at * 1000 : 0);
  return remoteAt >= localAt ? remote : local;
}

export function listQuery(
  entity:
    | 'notes'
    | 'collections'
    | 'contexts'
    | 'web-histories'
    | 'tasks'
    | 'projects'
    | 'tags'
    | 'urls'
    | 'url-abouts'
    | 'note-url-refs'
    | 'context-tasks'
    | 'url-match-rules'
    | 'groups',
  input: { page?: number; sort?: 'recency' | 'size'; since?: number; owner?: string },
): string {
  const page = input.page ?? 1;
  const params = new URLSearchParams({
    page: String(page),
    size: String(CACHE_PAGE_SIZE),
    order: 'desc',
  });
  if (entity === 'notes' && input.sort === 'size') params.set('sort', 'size_bytes');
  else params.set('sort', 'last_updated_at');
  if (entity === 'notes') params.set('has_url', '1');
  if (input.since !== undefined) params.set('last_updated_atFrom', String(input.since));
  if (entity === 'collections') {
    const bare = (input.owner || '').replace(/^@/, '').trim();
    if (!bare) return '';
    const journalParams = new URLSearchParams({
      page: String(page),
      size: String(CACHE_PAGE_SIZE),
    });
    return `/journals/@${encodeURIComponent(bare)}/collections?${journalParams.toString()}`;
  }
  if (entity === 'groups') {
    params.set('sort', 'created_at');
    return `/usergroups/?${params.toString()}`;
  }
  return `/${entity}/?${params.toString()}`;
}

export function nextListPage(page: number): number {
  return page + 1;
}

export function trimCache<T extends { id: string }>(rows: T[], keep: Set<string>): T[] {
  if (rows.length <= CACHE_CAP) return rows;
  const pinned = rows.filter((row) => keep.has(row.id));
  const rest = rows.filter((row) => !keep.has(row.id));
  return [...pinned, ...rest].slice(0, Math.max(CACHE_CAP, pinned.length));
}

export function mergeListed<T extends { id: string; updatedAt: number; deletedAt?: number }>(
  local: T[],
  remote: T[],
  keep: Set<string>,
): T[] {
  const byId = new Map(local.map((row) => [row.id, row]));
  for (const row of remote) {
    const current = byId.get(row.id);
    byId.set(row.id, current ? mergeWinner(current, row) : row);
  }
  return trimCache([...byId.values()], keep);
}

export function noteFromRemote(row: Record<string, unknown>, ref: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!ref || ref.url_id === undefined || ref.url_id === null) return null;
  return {
    id: String(row.id),
    pageId: String(ref.url_id),
    text: typeof row.content === 'string' ? row.content : '',
    collectionId: collectionSlugOf(ref),
  };
}

function collectionSlugOf(ref: Record<string, unknown>): string | null {
  if (typeof ref.collection_slug !== 'string') return null;
  const slug = ref.collection_slug.trim();
  if (!slug || slug === 'journal') return null;
  return slug;
}

export type PullBag = {
  urls?: unknown;
  urlAbouts?: unknown;
  notes?: unknown;
  noteUrlRefs?: unknown;
  collections?: unknown;
  contexts?: unknown;
  contextTasks?: unknown;
  webHistories?: unknown;
  tasks?: unknown;
  projects?: unknown;
  tags?: unknown;
  groups?: unknown;
  preferences?: unknown;
  matchRules?: unknown;
};

export function absorbPull(state: SidenoteState, bag: PullBag, keep: Set<string> = new Set()): SidenoteState {
  let next = state;
  const tags = listItems(bag.tags).flatMap(tagFromRemote);
  if (bag.tags !== undefined) next = { ...next, tags: mergeListed(next.tags, tags, keep) };

  const contexts = listItems(bag.contexts).flatMap(contextFromRemote);
  if (bag.contexts !== undefined) next = { ...next, contexts: mergeListed(next.contexts, contexts, keep) };
  if (bag.contextTasks !== undefined) next = { ...next, contexts: applyContextTasks(next.contexts, listItems(bag.contextTasks)) };

  const projects = listItems(bag.projects).flatMap((row) => projectFromRemote(row, state.projects));
  if (bag.projects !== undefined) next = { ...next, projects: mergeListed(next.projects, projects, keep) };

  const tasks = listItems(bag.tasks).flatMap((row) => taskFromRemote(row, state.tasks));
  if (bag.tasks !== undefined) next = { ...next, tasks: mergeListed(next.tasks, tasks, keep) };

  const collections = listItems(bag.collections).flatMap((row) => collectionFromRemote(row, next.groups));
  if (bag.collections !== undefined) next = { ...next, collections: mergeListed(next.collections, collections, keep) };

  if (bag.urls !== undefined || bag.urlAbouts !== undefined) {
    next = { ...next, pages: mergeListed(next.pages, pagesFromRemote(state.pages, bag), keep) };
  }

  const notes = notesFromRemote(bag, next.notes, next.tags, next.groups);
  if (bag.notes !== undefined) next = { ...next, notes: mergeListed(next.notes, notes, keep) };

  const excerpts = listItems(bag.webHistories).flatMap((row) => excerptFromRemote(row, next.pages));
  if (bag.webHistories !== undefined) next = { ...next, excerpts: mergeListed(next.excerpts, excerpts, keep) };

  const groups = listItems(bag.groups).flatMap(groupFromRemote);
  if (bag.groups !== undefined) next = { ...next, groups: mergeListed(next.groups, groups, keep) };

  if (bag.matchRules !== undefined) next = { ...next, urlRules: rulesFromRemote(listItems(bag.matchRules)) };
  if (bag.preferences !== undefined) {
    next = {
      ...next,
      settings: settingsFromRemote(next.settings, bag.preferences),
      groups: applyReadAccess(next.groups, bag.preferences),
    };
  }
  return next;
}

function pushRows<T extends { id: string; updatedAt: number; deletedAt?: number }>(
  entries: OutboxEntry[],
  entity: OutboxEntity,
  before: T[],
  after: T[],
  bodyOf: (row: T) => Record<string, unknown>,
): void {
  const previous = new Map(before.map((row) => [row.id, row]));
  for (const row of after) {
    const prior = previous.get(row.id);
    if (!prior) {
      if (!row.deletedAt) entries.push(entry(entity, 'create', row.id, bodyOf(row), row.updatedAt));
      continue;
    }
    if (row.deletedAt && !prior.deletedAt) {
      entries.push(entry(entity, 'delete', row.id, {}, row.updatedAt));
      continue;
    }
    if (JSON.stringify(prior) !== JSON.stringify(row)) {
      entries.push(entry(entity, shouldPost(row.id) ? 'create' : 'update', row.id, bodyOf(row), row.updatedAt));
    }
  }
}

function entry(
  entity: OutboxEntity,
  op: OutboxEntry['op'],
  localId: string,
  body: Record<string, unknown>,
  updatedAt: number,
): OutboxEntry {
  return { id: `${entity}:${localId}:${op}`, entity, op, localId, body, updatedAt };
}

function accessOf(visibility: string): string {
  return visibility === 'public' ? 'public' : 'private';
}

function slugOf(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (slug.length < 2 || slug === 'journal') return 'collection';
  return slug;
}

function syncLanguage(language: string): 'en' | 'ko' {
  return language === 'ko' ? 'ko' : 'en';
}

function readAccessHandles(state: SidenoteState): string[] {
  return state.groups.filter((group) => !group.deletedAt && group.readAccess).map((group) => group.handle);
}

function journalAccess(visibility: string, state: SidenoteState): { access: 'private' | 'public'; access_groups?: string[] } {
  if (visibility === 'public') return { access: 'public' };
  if (visibility.startsWith('group:')) {
    const id = visibility.slice('group:'.length);
    const handle = state.groups.find((group) => group.id === id)?.handle;
    return handle ? { access: 'private', access_groups: [handle] } : { access: 'private' };
  }
  return { access: 'private' };
}

function collectionBody(row: Collection, state: SidenoteState): Record<string, unknown> {
  return { name: row.name, slug: slugOf(row.name), ...journalAccess(row.visibility, state) };
}

function tagBody(row: TagRecord, state: SidenoteState): Record<string, unknown> {
  const body: Record<string, unknown> = { name: row.name, ...journalAccess(row.visibility, state) };
  if (!isTempId(row.id) && /^\d+$/.test(row.id)) body.id = Number(row.id);
  return body;
}

function noteWriteBody(note: Note, state: SidenoteState, includeDate: boolean): Record<string, unknown> {
  const tags = note.tagIds.flatMap((id) => {
    const name = state.tags.find((tag) => tag.id === id && !tag.deletedAt)?.name;
    return name ? [name] : [];
  });
  const body: Record<string, unknown> = {
    title: note.text.slice(0, 80),
    body: note.text,
    tags,
    ...journalAccess(note.visibility, state),
  };
  if (note.collectionId) body.collection_slug = note.collectionId;
  if (includeDate) body.page_date = pageDateOf(note.createdAt || note.updatedAt, state.settings.timeZone);
  return body;
}

function noteRefBody(note: Note, pageId: string): Record<string, unknown> {
  const body: Record<string, unknown> = { note_id: note.id, url_id: pageId };
  if (note.collectionId) body.collection_slug = note.collectionId;
  return body;
}

function pushNoteRows(entries: OutboxEntry[], before: SidenoteState, after: SidenoteState): void {
  const previous = new Map(before.notes.map((row) => [row.id, row]));
  for (const row of after.notes) {
    const prior = previous.get(row.id);
    if (!prior) {
      if (!row.deletedAt) entries.push(entry('note', 'create', row.id, noteWriteBody(row, after, true), row.updatedAt));
      continue;
    }
    if (row.deletedAt && !prior.deletedAt) {
      entries.push(entry('note', 'delete', row.id, {}, row.updatedAt));
      continue;
    }
    if (JSON.stringify(prior) !== JSON.stringify(row)) {
      entries.push(entry('note', shouldPost(row.id) ? 'create' : 'update', row.id, noteWriteBody(row, after, shouldPost(row.id)), row.updatedAt));
    }
  }
}

function applyReadAccess(groups: UserGroup[], body: unknown): UserGroup[] {
  if (!isRecord(body) || !Array.isArray(body.active_usergroup_unames)) return groups;
  const names = new Set(body.active_usergroup_unames.filter((item): item is string => typeof item === 'string'));
  return groups.map((group) => ({ ...group, readAccess: names.has(group.handle) }));
}

function rewriteState(state: SidenoteState, from: string, to: string): SidenoteState {
  const swap = (id: string | null | undefined): string | null | undefined => (id === from ? to : id);
  return {
    ...state,
    pages: state.pages.map((page) => (page.id === from ? { ...page, id: to } : { ...page, tagIds: page.tagIds.map((id) => (id === from ? to : id)) })),
    notes: state.notes.map((note) => ({
      ...note,
      id: note.id === from ? to : note.id,
      pageId: note.pageId === from ? to : note.pageId,
      collectionId: swap(note.collectionId) ?? null,
      tagIds: note.tagIds.map((id) => (id === from ? to : id)),
      visibility: note.visibility === `group:${from}` ? `group:${to}` : note.visibility,
    })),
    excerpts: state.excerpts.map((row) => ({
      ...row,
      id: row.id === from ? to : row.id,
      contextId: swap(row.contextId) ?? null,
      tagIds: row.tagIds.map((id) => (id === from ? to : id)),
      scope: { ...row.scope, pageId: row.scope.pageId === from ? to : row.scope.pageId },
    })),
    collections: state.collections.map((row) => (row.id === from ? { ...row, id: to } : row)),
    contexts: state.contexts.map((row) => ({
      ...row,
      id: row.id === from ? to : row.id,
      taskIds: row.taskIds.map((id) => (id === from ? to : id)),
    })),
    projects: state.projects.map((row) => (row.id === from ? { ...row, id: to } : row)),
    tasks: state.tasks.map((row) => ({
      ...row,
      id: row.id === from ? to : row.id,
      projectId: swap(row.projectId) ?? null,
      memberIds: row.memberIds?.map((id) => (id === from ? to : id)),
    })),
    tags: state.tags.map((row) => (row.id === from ? { ...row, id: to } : row)),
    groups: state.groups.map((row) => (row.id === from ? { ...row, id: to } : row)),
  };
}

function listItems(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body.filter(isRecord);
  if (!isRecord(body)) return [];
  for (const key of ['items', 'groups', 'results']) {
    const value = body[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function rowId(row: Record<string, unknown>): string {
  return row.id == null ? '' : String(row.id);
}

function rowAt(row: Record<string, unknown>): number {
  return typeof row.last_updated_at === 'number' ? row.last_updated_at * 1000 : Date.now();
}

function rowDeleted(row: Record<string, unknown>): number | undefined {
  return row.is_deleted === true ? rowAt(row) : undefined;
}

function rowVisibility(row: Record<string, unknown>): 'private' | 'public' {
  return row.access_level === 'public' ? 'public' : 'private';
}

function tagFromRemote(row: Record<string, unknown>): TagRecord[] {
  const id = rowId(row);
  if (!id || typeof row.name !== 'string') return [];
  return [{ id, name: row.name, visibility: rowVisibility(row), updatedAt: rowAt(row), deletedAt: rowDeleted(row) }];
}

function contextFromRemote(row: Record<string, unknown>): ContextThread[] {
  const id = rowId(row);
  if (!id || typeof row.name !== 'string') return [];
  return [{ id, name: row.name, taskIds: [], updatedAt: rowAt(row), deletedAt: rowDeleted(row) }];
}

function applyContextTasks(contexts: ContextThread[], links: Record<string, unknown>[]): ContextThread[] {
  const grouped = new Map<string, string[]>();
  for (const link of links) {
    if (link.is_deleted === true || link.context_id == null || link.task_id == null) continue;
    const id = String(link.context_id);
    grouped.set(id, [...(grouped.get(id) ?? []), String(link.task_id)]);
  }
  return contexts.map((context) => (grouped.has(context.id) ? { ...context, taskIds: grouped.get(context.id) ?? [] } : context));
}

function projectFromRemote(row: Record<string, unknown>, local: Project[]): Project[] {
  const id = rowId(row);
  const name = typeof row.title === 'string' ? row.title : typeof row.name === 'string' ? row.name : '';
  if (!id || !name) return [];
  const previous = local.find((item) => item.id === id);
  return [
    {
      id,
      name,
      color: previous?.color ?? '#6b8f71',
      order: previous?.order ?? local.length,
      updatedAt: rowAt(row),
      deletedAt: rowDeleted(row),
    },
  ];
}

function taskFromRemote(row: Record<string, unknown>, local: Task[]): Task[] {
  const id = rowId(row);
  if (!id || typeof row.title !== 'string') return [];
  const previous = local.find((item) => item.id === id);
  const status = taskStatus(row.status);
  return [
    {
      id,
      localNo: previous?.localNo ?? local.reduce((max, task) => Math.max(max, task.localNo), 0) + 1,
      title: row.title,
      projectId: row.project_id == null ? null : String(row.project_id),
      status,
      memberIds: memberIdsOf(row),
      updatedAt: rowAt(row),
      deletedAt: rowDeleted(row),
    },
  ];
}

function taskStatus(value: unknown): TaskStatus {
  return value === 'inactive' || value === 'draft' || value === 'active' ? value : 'active';
}

function memberIdsOf(row: Record<string, unknown>): string[] | undefined {
  if (!Array.isArray(row.members)) return undefined;
  return row.members.flatMap((member) => {
    if (!isRecord(member)) return [];
    const id = member.user_id ?? member.id;
    return id == null ? [] : [String(id)];
  });
}

function collectionFromRemote(row: Record<string, unknown>, groups: UserGroup[]): Collection[] {
  const id = rowId(row);
  const name = typeof row.name === 'string' ? row.name : typeof row.title === 'string' ? row.title : '';
  if (!id || !name) return [];
  return [{ id, name, visibility: visibilityFromRemote(row, 'private', groups), updatedAt: rowAt(row), deletedAt: rowDeleted(row) }];
}

function visibilityFromRemote(row: Record<string, unknown>, current: Visibility, groups: UserGroup[]): Visibility {
  const named = Array.isArray(row.access_groups)
    ? row.access_groups.filter((item): item is string => typeof item === 'string')
    : [];
  const level = row.access_level ?? row.visibility ?? row.access;
  if (level === 'public') return 'public';
  if (named[0]) {
    const found = groups.find((group) => group.handle === named[0]);
    if (found) return `group:${found.id}`;
  }
  if (level === 'ugroup' && current.startsWith('group:')) return current;
  if ((level === 'private' || level == null) && current.startsWith('group:')) return current;
  return 'private';
}

function pagesFromRemote(local: PageRecord[], bag: PullBag): PageRecord[] {
  const abouts = new Map(listItems(bag.urlAbouts).map((row) => [String(row.url_id ?? ''), row]));
  const fromUrls = listItems(bag.urls).flatMap((row) => {
    const id = rowId(row);
    const url = typeof row.normalized_url === 'string' ? row.normalized_url : '';
    if (!id || !url) return [];
    const about = abouts.get(id);
    const previous = local.find((page) => page.id === id);
    const patterns = Array.isArray(about?.patterns) ? about.patterns.filter((item): item is string => typeof item === 'string') : previous?.patterns ?? [];
    return [
      {
        id,
        title: typeof about?.title === 'string' ? about.title : typeof row.title === 'string' ? row.title : previous?.title ?? '',
        url,
        patterns,
        ignoreQuery: true,
        tagIds: previous?.tagIds ?? [],
        updatedAt: rowAt(about ?? row),
      },
    ];
  });
  if (fromUrls.length) return fromUrls;
  return listItems(bag.urlAbouts).flatMap((about) => {
    const id = about.url_id == null ? '' : String(about.url_id);
    const previous = local.find((page) => page.id === id);
    if (!id || !previous) return [];
    const patterns = Array.isArray(about.patterns) ? about.patterns.filter((item): item is string => typeof item === 'string') : previous.patterns;
    return [{ ...previous, title: typeof about.title === 'string' ? about.title : previous.title, patterns, updatedAt: rowAt(about) }];
  });
}

function notesFromRemote(bag: PullBag, local: Note[], tags: TagRecord[], groups: UserGroup[]): Note[] {
  const refs = new Map(listItems(bag.noteUrlRefs).map((ref) => [String(ref.note_id ?? ''), ref]));
  return listItems(bag.notes).flatMap((row) => {
    const partial = noteFromRemote(row, refs.get(String(row.id ?? '')) ?? null);
    if (!partial) return [];
    const id = String(partial.id);
    const previous = local.find((note) => note.id === id);
    return [
      {
        id,
        pageId: String(partial.pageId),
        text: String(partial.text ?? ''),
        visibility: visibilityFromRemote(row, previous?.visibility ?? 'private', groups),
        collectionId: partial.collectionId == null ? null : String(partial.collectionId),
        tagIds: tagIdsFromRemote(row, previous?.tagIds ?? [], tags),
        createdAt: rowAt(row),
        updatedAt: rowAt(row),
        deletedAt: rowDeleted(row),
      },
    ];
  });
}

function tagIdsFromRemote(row: Record<string, unknown>, current: string[], tags: TagRecord[]): string[] {
  if (!Array.isArray(row.tags)) return current;
  return row.tags.flatMap((name) => {
    if (typeof name !== 'string') return [];
    const found = tags.find((tag) => !tag.deletedAt && tag.name === name);
    return found ? [found.id] : [];
  });
}

function excerptFromRemote(row: Record<string, unknown>, pages: PageRecord[]): PageExcerpt[] {
  const id = rowId(row);
  const urlId = row.url_id == null ? '' : String(row.url_id);
  if (!id || !urlId || typeof row.text !== 'string') return [];
  const page = pages.find((item) => item.id === urlId);
  const url = page?.url ?? '';
  const action = historyAction(row.user_action);
  return [
    {
      id,
      scope: { url, pageId: urlId, key: pageKey(url) },
      userAction: action,
      text: row.text,
      excerpt: typeof row.excerpt === 'string' ? row.excerpt : undefined,
      contextId: row.context_id == null ? null : String(row.context_id),
      tagIds: [],
      editedByUser: row.edited_by_user === true,
      createdAt: rowAt(row),
      updatedAt: rowAt(row),
      deletedAt: rowDeleted(row),
    },
  ];
}

function historyAction(value: unknown): UserAction {
  return value === 'play' || value === 'link' || value === 'form' || value === 'highlight' || value === 'read' ? value : 'read';
}

function groupFromRemote(row: Record<string, unknown>): UserGroup[] {
  const id = rowId(row);
  const name = typeof row.name === 'string' ? row.name : '';
  if (!id || !name) return [];
  const handle = typeof row.uname === 'string' ? row.uname : typeof row.handle === 'string' ? row.handle : name;
  const status = row.status === 'inactive' || row.status === 'archived' ? row.status : 'active';
  return [
    {
      id,
      name,
      handle,
      readAccess: row.read_access !== false,
      status,
      updatedAt: rowAt(row),
      deletedAt: rowDeleted(row),
    },
  ];
}

function rulesFromRemote(rows: Record<string, unknown>[]): UrlRule[] {
  return rows.flatMap((row) => {
    if ((row.kind !== 'path_glob' && row.kind !== 'host_alias') || typeof row.pattern !== 'string') return [];
    return [{ kind: row.kind, pattern: row.pattern }];
  });
}

function settingsFromRemote(settings: SidenoteState['settings'], body: unknown): SidenoteState['settings'] {
  if (!isRecord(body)) return settings;
  const language = body.language === 'ko' ? 'ko' : body.language === 'en' ? 'en' : settings.language;
  const zone = typeof body.timezone === 'string' ? body.timezone : typeof body.time_zone === 'string' ? body.time_zone : settings.timeZone;
  return { ...settings, language, timeZone: zone, theme: themeFromRemote(body.theme, settings.theme) };
}

function themeFromRemote(theme: unknown, fallback: SidenoteState['settings']['theme']): SidenoteState['settings']['theme'] {
  if (theme === 'light' || theme === 'dark' || theme === 'system') return theme;
  if (isRecord(theme) && (theme.journal === 'light' || theme.journal === 'dark' || theme.journal === 'system')) return theme.journal;
  return fallback;
}

function rewriteValue(value: unknown, from: string, to: string): unknown {
  if (value === from) return to;
  if (Array.isArray(value)) return value.map((item) => rewriteValue(item, from, to));
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) next[key] = rewriteValue(item, from, to);
    return next;
  }
  return value;
}
