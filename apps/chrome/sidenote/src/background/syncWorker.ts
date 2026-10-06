import { GOOGLE_CLIENT_ID } from '../lib/api.js';
import { apiRequest } from '../lib/http.js';
import { absorbPull, applyCreatedTaskStatus, applyServerId, blocksOnTemp, coalesceOutbox, isTempId, listQuery, serverIdOf, type OutboxEntry, type PullBag } from '../lib/sync.js';
import { AUTH_KEY, OUTBOX_KEY, STORAGE_KEY, SYNC_PERIOD_MINUTES, SYNCED_KEY, type SidenoteState } from '../shared/types.js';
import type { AuthRecord } from '../lib/auth.js';

const ALARM = 'sidenote-sync';

export function installSync(): void {
  void chrome.alarms.create(ALARM, { periodInMinutes: SYNC_PERIOD_MINUTES });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) void runSync({ reason: 'alarm' });
  });
  chrome.runtime.onStartup.addListener(() => {
    void runSync({ reason: 'startup' });
  });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== 'object' || message.type !== 'sidenote:sync') return;
    const reason = typeof message.reason === 'string' ? message.reason : 'refresh';
    const entity = typeof message.entity === 'string' ? message.entity : undefined;
    const page = typeof message.page === 'number' ? message.page : undefined;
    void runSync({ reason, entity, page }).then(
      () => sendResponse({ ok: true }),
      () => sendResponse({ ok: false }),
    );
    return true;
  });
}

let syncChain: Promise<void> = Promise.resolve();

export function runSync(request: { reason?: string; entity?: string; page?: number } = {}): Promise<void> {
  const run = syncChain.then(() => runSyncBody(request));
  syncChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function runSyncBody(request: { reason?: string; entity?: string; page?: number }): Promise<void> {
  const authBag = await chrome.storage.local.get(AUTH_KEY);
  let auth = authBag[AUTH_KEY] as AuthRecord | undefined;
  if (!auth?.accessToken || !auth.refreshToken) return;
  auth = await ensureUname(auth);
  const stored = await chrome.storage.local.get([OUTBOX_KEY, STORAGE_KEY]);
  let state = stored[STORAGE_KEY] as SidenoteState | undefined;
  let queue = coalesceOutbox((Array.isArray(stored[OUTBOX_KEY]) ? stored[OUTBOX_KEY] : []) as OutboxEntry[]);
  const failed: OutboxEntry[] = [];
  const waiting: OutboxEntry[] = [];
  let idle = 0;
  while (queue.length && state) {
    const item = queue[0];
    const path = pathFor(item, auth.uname);
    if (!path || blocksOnTemp(item, queue)) {
      queue = [...queue.slice(1), item];
      idle += 1;
      if (idle >= queue.length) {
        waiting.push(...queue);
        queue = [];
        break;
      }
      continue;
    }
    idle = 0;
    let result;
    try {
      result = await apiRequest(fetch, auth, path, {
        method: item.op === 'delete' ? 'DELETE' : item.op === 'update' ? 'PATCH' : 'POST',
        body: item.op === 'delete' ? undefined : item.body,
      });
    } catch {
      waiting.push(...queue);
      queue = [];
      break;
    }
    if (result.auth) auth = result.auth;
    if (result.reauth) {
      await chrome.storage.local.remove(AUTH_KEY);
      await chrome.storage.local.set({ 'sidenote.reauth': true });
      waiting.push(...queue);
      break;
    }
    if (result.status < 200 || result.status >= 300) {
      failed.push(item);
      queue = queue.slice(1);
      continue;
    }
    const serverId = serverIdOf(item.entity, result.body);
    if (serverId && isTempId(item.localId)) {
      const applied = applyServerId(state, queue.slice(1), item.localId, serverId);
      state = applied.state;
      queue = applied.outbox;
      if (item.entity === 'task') state = applyCreatedTaskStatus(state, serverId, result.body);
      if (item.entity === 'tag' && item.body.access && item.body.access !== 'private') {
        queue = [
          {
            ...item,
            op: 'update',
            localId: serverId,
            body: { ...item.body, id: Number(serverId) },
          },
          ...queue,
        ];
      }
    } else {
      queue = queue.slice(1);
    }
  }
  const signedIn = await signedInStored();
  await chrome.storage.local.set({
    [OUTBOX_KEY]: coalesceOutbox([...failed, ...waiting]),
    ...(state ? { [STORAGE_KEY]: state } : {}),
    ...(signedIn && auth ? { [AUTH_KEY]: auth } : {}),
  });
  if (signedIn && auth?.accessToken) await pullWindows(auth, request);
}

async function signedInStored(): Promise<boolean> {
  const bag = await chrome.storage.local.get(AUTH_KEY);
  const stored = bag[AUTH_KEY] as AuthRecord | undefined;
  return Boolean(stored?.accessToken && stored?.refreshToken);
}

async function pullWindows(auth: AuthRecord, request: { reason?: string; entity?: string; page?: number }): Promise<void> {
  const stored = await chrome.storage.local.get([STORAGE_KEY, OUTBOX_KEY, SYNCED_KEY]);
  const state = stored[STORAGE_KEY] as SidenoteState | undefined;
  if (!state) {
    if (await signedInStored()) await chrome.storage.local.set({ [AUTH_KEY]: auth });
    return;
  }
  const since = request.reason === 'alarm' && typeof stored[SYNCED_KEY] === 'number' ? (stored[SYNCED_KEY] as number) : undefined;
  const queue = (Array.isArray(stored[OUTBOX_KEY]) ? stored[OUTBOX_KEY] : []) as OutboxEntry[];
  const keep = new Set(queue.map((item) => item.localId));
  const pageFor = (entity: string) => (request.reason === 'more' && request.entity === entity ? request.page ?? 2 : 1);
  const specs: { key: keyof PullBag; entity: string; path: string }[] = [
    { key: 'tags', entity: 'tags', path: listQuery('tags', { since }) },
    { key: 'groups', entity: 'groups', path: listQuery('groups', { since, page: pageFor('groups') }) },
    { key: 'preferences', entity: 'settings', path: '/users/me/preferences' },
    { key: 'urls', entity: 'urls', path: listQuery('urls', { since, page: pageFor('urls') }) },
    { key: 'urlAbouts', entity: 'url-abouts', path: listQuery('url-abouts', { since, page: pageFor('url-abouts') }) },
    { key: 'matchRules', entity: 'url-match-rules', path: listQuery('url-match-rules', { since }) },
    { key: 'notes', entity: 'notes', path: listQuery('notes', { since, page: pageFor('notes') }) },
    { key: 'noteUrlRefs', entity: 'note-url-refs', path: listQuery('note-url-refs', { since, page: pageFor('notes') }) },
    { key: 'collections', entity: 'collections', path: listQuery('collections', { since, owner: auth.uname, page: pageFor('collections') }) },
    { key: 'contexts', entity: 'contexts', path: listQuery('contexts', { since, page: pageFor('contexts') }) },
    { key: 'contextTasks', entity: 'context-tasks', path: listQuery('context-tasks', { since, page: pageFor('contexts') }) },
    { key: 'webHistories', entity: 'web-histories', path: listQuery('web-histories', { since, page: pageFor('web-histories') }) },
    { key: 'tasks', entity: 'tasks', path: listQuery('tasks', { since, page: pageFor('tasks') }) },
    { key: 'projects', entity: 'projects', path: listQuery('projects', { since, page: pageFor('projects') }) },
  ];
  const bag: PullBag = {};
  for (const spec of specs) {
    if (!spec.path || !includeSpec(spec.entity, request)) continue;
    const result = await apiRequest(fetch, auth, spec.path);
    if (result.reauth) {
      await chrome.storage.local.remove(AUTH_KEY);
      await chrome.storage.local.set({ 'sidenote.reauth': true });
      return;
    }
    if (result.auth) auth = result.auth;
    if (result.status >= 200 && result.status < 300) bag[spec.key] = result.body;
  }
  const merged = absorbPull(state, bag, keep);
  const signedIn = await signedInStored();
  await chrome.storage.local.set({
    ...(signedIn ? { [AUTH_KEY]: auth } : {}),
    [STORAGE_KEY]: merged,
    [SYNCED_KEY]: Math.floor(Date.now() / 1000),
  });
}

function includeSpec(entity: string, request: { reason?: string; entity?: string }): boolean {
  if (request.reason !== 'more' || !request.entity) return true;
  if (entity === request.entity) return true;
  if (request.entity === 'notes') return entity === 'note-url-refs' || entity === 'urls' || entity === 'url-abouts';
  if (request.entity === 'web-histories') return entity === 'urls';
  if (request.entity === 'contexts') return entity === 'context-tasks';
  return false;
}

function pathFor(item: OutboxEntry, uname: string | undefined): string {
  if (item.entity === 'settings') return '/users/me/preferences';
  const owner = journalOwner(uname);
  if (item.entity === 'collection' || item.entity === 'note') {
    if (!owner) return '';
    const root = item.entity === 'collection' ? `/journals/${owner}/collections` : `/journals/${owner}/notes`;
    return item.op === 'create' ? root : `${root}/${encodeURIComponent(item.localId)}`;
  }
  if (item.entity === 'group' && item.op !== 'create') {
    const handle = typeof item.body.uname === 'string' && item.body.uname ? item.body.uname : item.localId;
    return `/usergroups/${encodeURIComponent(handle)}`;
  }
  const root = rootFor(item.entity);
  if (item.op === 'create') return root;
  return `${root}/${item.localId}`;
}

function journalOwner(uname: string | undefined): string {
  const bare = (uname || '').replace(/^@/, '').trim();
  return bare ? `@${encodeURIComponent(bare)}` : '';
}

async function ensureUname(auth: AuthRecord): Promise<AuthRecord> {
  const result = await apiRequest(fetch, auth, '/auth/me');
  if (result.auth) auth = result.auth;
  if (result.status >= 200 && result.status < 300 && result.body && typeof result.body === 'object' && 'uname' in result.body) {
    const raw = (result.body as { uname?: unknown }).uname;
    if (typeof raw === 'string' && raw.replace(/^@/, '').trim()) {
      return { ...auth, uname: raw.replace(/^@/, '').trim() };
    }
  }
  if (auth.uname) return { ...auth, uname: auth.uname.replace(/^@/, '').trim() };
  return auth;
}

function rootFor(entity: OutboxEntry['entity']): string {
  switch (entity) {
    case 'url':
      return '/urls/';
    case 'url_about':
      return '/url-abouts/';
    case 'note':
      return '';
    case 'note_url_ref':
      return '/note-url-refs/';
    case 'context':
      return '/contexts/';
    case 'web_history':
      return '/web-histories/';
    case 'task':
      return '/tasks/';
    case 'project':
      return '/projects/';
    case 'tag':
      return '/tags/';
    case 'group':
      return '/usergroups/';
    default:
      return '/notes/';
  }
}

export function googleAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
