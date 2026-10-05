import { createDemoState } from '../shared/demoData.js';
import { hostOf, matchPage, scopeKey } from '../shared/scope.js';
import type {
  Collection,
  ContextThread,
  DisplayLimits,
  ExcerptInput,
  Note,
  NoteCreate,
  NoteInput,
  PageExcerpt,
  PageRecord,
  Project,
  Settings,
  SidenoteState,
  TagRecord,
  Task,
  TaskStatus,
  UiState,
  UserAction,
  UserGroup,
  Visibility,
} from '../shared/types.js';

export type StoragePort = {
  get(): Promise<SidenoteState | null>;
  set(state: SidenoteState): Promise<void>;
};

export type DataService = {
  load(): Promise<SidenoteState>;
  saveAbout(state: SidenoteState, url: string, title: string, tags: string[]): Promise<SidenoteState>;
  savePatterns(
    state: SidenoteState,
    url: string,
    title: string,
    patterns: string[],
    ignoreQuery: boolean,
  ): Promise<SidenoteState>;
  createNote(state: SidenoteState, input: NoteCreate): Promise<SidenoteState>;
  updateNote(state: SidenoteState, id: string, input: NoteInput): Promise<SidenoteState>;
  deleteNote(state: SidenoteState, id: string): Promise<SidenoteState>;
  addExcerpt(state: SidenoteState, input: ExcerptInput): Promise<SidenoteState>;
  addManualExcerpt(
    state: SidenoteState,
    input: {
      url: string;
      title: string;
      text: string;
      userAction: UserAction;
      contextId: string | null;
      tagIds: string[];
      excerpt?: string;
    },
  ): Promise<SidenoteState>;
  updateExcerpt(
    state: SidenoteState,
    id: string,
    input: { text: string; contextId: string | null; tagIds: string[] },
  ): Promise<SidenoteState>;
  updateExcerptContent(state: SidenoteState, id: string, excerpt: string): Promise<SidenoteState>;
  deleteExcerpt(state: SidenoteState, id: string): Promise<SidenoteState>;
  createContext(state: SidenoteState, name: string): Promise<SidenoteState>;
  setContextTasks(state: SidenoteState, id: string, taskIds: string[]): Promise<SidenoteState>;
  createCollection(state: SidenoteState, name: string): Promise<SidenoteState>;
  createTask(
    state: SidenoteState,
    input: { title: string; projectId: string | null; due?: string; refUrl?: string },
  ): Promise<SidenoteState>;
  updateTask(
    state: SidenoteState,
    id: string,
    input: { title: string; projectId: string | null; status: TaskStatus; due?: string },
  ): Promise<SidenoteState>;
  deleteTask(state: SidenoteState, id: string): Promise<SidenoteState>;
  createProject(state: SidenoteState, name: string): Promise<SidenoteState>;
  updateProject(state: SidenoteState, id: string, patch: { name?: string; color?: string }): Promise<SidenoteState>;
  deleteProject(state: SidenoteState, id: string): Promise<SidenoteState>;
  saveSettings(state: SidenoteState, patch: Partial<Settings>): Promise<SidenoteState>;
  saveDisplay(state: SidenoteState, display: DisplayLimits): Promise<SidenoteState>;
  createTag(state: SidenoteState, name: string): Promise<SidenoteState>;
  deleteTag(state: SidenoteState, id: string): Promise<SidenoteState>;
  updateTag(state: SidenoteState, id: string, visibility: Visibility): Promise<SidenoteState>;
  createGroup(state: SidenoteState, name: string): Promise<SidenoteState>;
  updateGroup(state: SidenoteState, id: string, patch: Partial<UserGroup>): Promise<SidenoteState>;
  setUi(state: SidenoteState, patch: Partial<UiState>): Promise<SidenoteState>;
};

const PALETTE = ['#c9a35a', '#7fa3d6', '#8fb08a', '#b49ac9', '#cf7d6e', '#8b877e'];

export function memoryPort(initial: SidenoteState | null = null): StoragePort {
  let value = initial;
  return {
    async get() {
      return value ? structuredClone(value) : null;
    },
    async set(state) {
      value = structuredClone(state);
    },
  };
}

export function stateBytes(state: SidenoteState): number {
  return new TextEncoder().encode(JSON.stringify(state)).length;
}

export function createDataService(port: StoragePort): DataService {
  async function commit(next: SidenoteState): Promise<SidenoteState> {
    await port.set(next);
    return next;
  }

  return {
    async load() {
      const existing = await port.get();
      if (!existing) return commit(createDemoState());
      const normalized = normalizeState(existing);
      if (normalized.changed) return commit(normalized.state);
      return normalized.state;
    },

    async saveAbout(state, url, title, tags) {
      const next = withPage(state, url, title);
      const page = matchPage(next, url);
      if (!page) return commit(next);
      return commit(replacePage(next, page.id, { title: title.trim() || page.title, tags, updatedAt: Date.now() }));
    },

    async savePatterns(state, url, title, patterns, ignoreQuery) {
      const next = withPage(state, url, title);
      const page = matchPage(next, url);
      if (!page) return commit(next);
      const cleaned = [...new Set(patterns.map((item) => item.trim()).filter(Boolean))];
      return commit(replacePage(next, page.id, { patterns: cleaned, ignoreQuery, updatedAt: Date.now() }));
    },

    async createNote(state, input) {
      const text = input.text.trim();
      if (!text) return commit(state);
      const next = withPage(state, input.url, input.title);
      const page = matchPage(next, input.url);
      if (!page) return commit(next);
      const now = Date.now();
      const note: Note = {
        id: newId(),
        pageId: page.id,
        text,
        visibility: input.visibility,
        collectionId: liveCollectionId(next, input.collectionId),
        tagIds: cleanIds(input.tagIds),
        createdAt: now,
        updatedAt: now,
      };
      return commit({ ...next, notes: [note, ...next.notes] });
    },

    async updateNote(state, id, input) {
      const text = input.text.trim();
      if (!text) return this.deleteNote(state, id);
      return commit({
        ...state,
        notes: state.notes.map((note) =>
          note.id === id && !note.deletedAt
            ? {
                ...note,
                text,
                visibility: input.visibility,
                collectionId: liveCollectionId(state, input.collectionId),
                tagIds: cleanIds(input.tagIds),
                updatedAt: Date.now(),
              }
            : note,
        ),
      });
    },

    async deleteNote(state, id) {
      const now = Date.now();
      return commit({
        ...state,
        notes: state.notes.map((note) => (note.id === id ? { ...note, deletedAt: now, updatedAt: now } : note)),
      });
    },

    async addExcerpt(state, input) {
      const page = state.pages.find((item) => item.id === input.pageId);
      if (!page) return commit(state);
      const now = Date.now();
      const row: PageExcerpt = {
        id: newId(),
        scope: { url: input.url, pageId: page.id, key: scopeKey(input.url) },
        userAction: input.userAction,
        text: input.text,
        excerpt: input.excerpt,
        range: input.range,
        contextId: null,
        tagIds: [],
        createdAt: now,
        updatedAt: now,
      };
      return commit({ ...state, excerpts: [row, ...state.excerpts] });
    },

    async addManualExcerpt(state, input) {
      const text = input.text.trim();
      if (!text || !input.url || !ENTRY_ACTIONS.includes(input.userAction)) return commit(state);
      const next = withPage(state, input.url, input.title);
      const page = matchPage(next, input.url);
      if (!page) return commit(next);
      const now = Date.now();
      const excerpt = input.excerpt?.trim();
      const row: PageExcerpt = {
        id: newId(),
        scope: { url: input.url, pageId: page.id, key: scopeKey(input.url) },
        userAction: input.userAction,
        text,
        excerpt: excerpt || undefined,
        editedByUser: true,
        contextId: liveContextId(next, input.contextId),
        tagIds: cleanIds(input.tagIds),
        createdAt: now,
        updatedAt: now,
      };
      return commit({ ...next, excerpts: [row, ...next.excerpts] });
    },

    async updateExcerpt(state, id, input) {
      const text = input.text.trim();
      const now = Date.now();
      return commit({
        ...state,
        excerpts: state.excerpts.map((row) =>
          row.id === id && !row.deletedAt
            ? {
                ...row,
                text: text || row.text,
                contextId: liveContextId(state, input.contextId),
                tagIds: cleanIds(input.tagIds),
                editedByUser: true,
                updatedAt: now,
              }
            : row,
        ),
      });
    },

    async updateExcerptContent(state, id, excerpt) {
      const now = Date.now();
      const text = excerpt.trim();
      return commit({
        ...state,
        excerpts: state.excerpts.map((row) =>
          row.id === id && !row.deletedAt
            ? { ...row, excerpt: text || undefined, editedByUser: true, updatedAt: now }
            : row,
        ),
      });
    },

    async deleteExcerpt(state, id) {
      const now = Date.now();
      return commit({
        ...state,
        excerpts: state.excerpts.map((row) =>
          row.id === id ? { ...row, deletedAt: now, updatedAt: now } : row,
        ),
      });
    },

    async createContext(state, name) {
      const trimmed = name.trim();
      if (!trimmed) return commit(state);
      const row: ContextThread = {
        id: newId(),
        name: trimmed,
        taskIds: [],
        updatedAt: Date.now(),
      };
      return commit({ ...state, contexts: [row, ...state.contexts] });
    },

    async setContextTasks(state, id, taskIds) {
      const live = new Set(state.tasks.filter((task) => !task.deletedAt).map((task) => task.id));
      const next = [...new Set(taskIds.filter((taskId) => live.has(taskId)))];
      return commit({
        ...state,
        contexts: state.contexts.map((context) =>
          context.id === id && !context.deletedAt ? { ...context, taskIds: next, updatedAt: Date.now() } : context,
        ),
      });
    },

    async createCollection(state, name) {
      const trimmed = name.trim();
      if (!trimmed) return commit(state);
      const row: Collection = {
        id: newId(),
        name: trimmed,
        visibility: 'private',
        updatedAt: Date.now(),
      };
      return commit({ ...state, collections: [row, ...state.collections] });
    },

    async createTask(state, input) {
      const title = input.title.trim();
      if (!title) return commit(state);
      const now = Date.now();
      const row: Task = {
        id: newId(),
        localNo: nextLocalNo(state.tasks),
        title,
        projectId: input.projectId,
        status: 'draft',
        due: input.due || undefined,
        refUrl: input.refUrl,
        updatedAt: now,
      };
      return commit({ ...state, tasks: [row, ...state.tasks] });
    },

    async updateTask(state, id, input) {
      const title = input.title.trim();
      if (!title) return this.deleteTask(state, id);
      const now = Date.now();
      return commit({
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === id && !task.deletedAt
            ? {
                ...task,
                title,
                projectId: input.projectId,
                status: input.status,
                due: input.due || undefined,
                updatedAt: now,
              }
            : task,
        ),
      });
    },

    async deleteTask(state, id) {
      const now = Date.now();
      return commit({
        ...state,
        tasks: state.tasks.map((task) => (task.id === id ? { ...task, deletedAt: now, updatedAt: now } : task)),
      });
    },

    async createProject(state, name) {
      const now = Date.now();
      const row: Project = {
        id: newId(),
        name: name.trim() || 'Untitled',
        color: PALETTE[state.projects.filter((item) => !item.deletedAt).length % PALETTE.length] ?? PALETTE[0],
        order: state.projects.length,
        updatedAt: now,
      };
      return commit({ ...state, projects: [...state.projects, row] });
    },

    async updateProject(state, id, patch) {
      const now = Date.now();
      return commit({
        ...state,
        projects: state.projects.map((project) => {
          if (project.id !== id || project.deletedAt) return project;
          const name = patch.name === undefined ? project.name : patch.name.trim() || 'Untitled';
          return { ...project, name, color: patch.color ?? project.color, updatedAt: now };
        }),
      });
    },

    async deleteProject(state, id) {
      const now = Date.now();
      return commit({
        ...state,
        projects: state.projects.map((project) =>
          project.id === id ? { ...project, deletedAt: now, updatedAt: now } : project,
        ),
        tasks: state.tasks.map((task) =>
          task.projectId === id ? { ...task, projectId: null, updatedAt: now } : task,
        ),
      });
    },

    async saveSettings(state, patch) {
      return commit({ ...state, settings: { ...state.settings, ...patch } });
    },

    async saveDisplay(state, display) {
      return commit({
        ...state,
        settings: {
          ...state.settings,
          display: {
            collections: clampLimit(display.collections),
            notesPerCollection: clampLimit(display.notesPerCollection),
            tasks: clampLimit(display.tasks),
          },
        },
      });
    },

    async createTag(state, name) {
      const trimmed = name.trim().replace(/^#/, '');
      if (!trimmed) return commit(state);
      if (state.tags.some((tag) => !tag.deletedAt && tag.name.toLowerCase() === trimmed.toLowerCase())) {
        return commit(state);
      }
      const row: TagRecord = {
        id: newId(),
        name: trimmed,
        visibility: 'private',
        updatedAt: Date.now(),
      };
      return commit({ ...state, tags: [...state.tags, row] });
    },

    async deleteTag(state, id) {
      if (tagUsage(state, id) > 0) return commit(state);
      const now = Date.now();
      return commit({
        ...state,
        tags: state.tags.map((tag) => (tag.id === id ? { ...tag, deletedAt: now, updatedAt: now } : tag)),
      });
    },

    async updateTag(state, id, visibility) {
      return commit({
        ...state,
        tags: state.tags.map((tag) => (tag.id === id ? { ...tag, visibility, updatedAt: Date.now() } : tag)),
      });
    },

    async createGroup(state, name) {
      const active = state.groups.filter((group) => !group.deletedAt);
      if (active.length >= 3) return commit(state);
      const trimmed = name.trim();
      if (!trimmed) return commit(state);
      const handle = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 16) || 'group';
      const row: UserGroup = {
        id: newId(),
        name: trimmed,
        handle,
        readAccess: false,
        status: 'active',
        updatedAt: Date.now(),
      };
      return commit({ ...state, groups: [...state.groups, row] });
    },

    async updateGroup(state, id, patch) {
      return commit({
        ...state,
        groups: state.groups.map((group) =>
          group.id === id ? { ...group, ...patch, id: group.id, updatedAt: Date.now() } : group,
        ),
      });
    },

    async setUi(state, patch) {
      return commit({ ...state, ui: { ...state.ui, ...patch } });
    },
  };
}

export function nextColor(current: string): string {
  const index = PALETTE.indexOf(current);
  return PALETTE[(index + 1) % PALETTE.length] ?? PALETTE[0];
}

function withPage(state: SidenoteState, url: string, title: string): SidenoteState {
  if (!hostOf(url) || matchPage(state, url)) return state;
  const page: PageRecord = {
    id: newId(),
    title: title.trim() || hostOf(url),
    url,
    patterns: [],
    ignoreQuery: true,
    tags: [],
    updatedAt: Date.now(),
  };
  return { ...state, pages: [...state.pages, page] };
}

function replacePage(state: SidenoteState, id: string, patch: Partial<PageRecord>): SidenoteState {
  return {
    ...state,
    pages: state.pages.map((page) => (page.id === id ? { ...page, ...patch } : page)),
  };
}

const ENTRY_ACTIONS: UserAction[] = ['read', 'play', 'link', 'form', 'highlight'];

function cleanIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function liveContextId(state: SidenoteState, id: string | null): string | null {
  if (!id) return null;
  return state.contexts.some((context) => context.id === id && !context.deletedAt) ? id : null;
}

function liveCollectionId(state: SidenoteState, id: string | null): string | null {
  if (!id) return null;
  return state.collections.some((collection) => collection.id === id && !collection.deletedAt) ? id : null;
}

export function tagUsage(state: SidenoteState, id: string): number {
  const tag = state.tags.find((item) => item.id === id);
  if (!tag) return 0;
  return (
    state.notes.filter((note) => !note.deletedAt && note.tagIds.includes(id)).length +
    state.excerpts.filter((row) => !row.deletedAt && row.tagIds.includes(id)).length +
    state.pages.filter((page) => page.tags.includes(tag.name)).length
  );
}

const CANONICAL_ACTIONS = new Set<UserAction>(['read', 'play', 'link', 'form', 'highlight']);

function canonicalAction(action: string): { next: UserAction; drop: boolean } {
  if (action === 'copy' || action === 'select') return { next: 'highlight', drop: false };
  if (action === 'click') return { next: 'link', drop: false };
  if (CANONICAL_ACTIONS.has(action as UserAction)) return { next: action as UserAction, drop: false };
  return { next: 'read', drop: true };
}

type StoredNote = Note & { keywords?: string[] };
type StoredState = SidenoteState & {
  contexts?: ContextThread[];
  notes: StoredNote[];
  excerpts: Array<PageExcerpt & { contextId?: string | null; tagIds?: string[] }>;
  ui: UiState & {
    contextSort?: UiState['contextSort'];
    contextsShown?: number;
    contextItemsShown?: Record<string, number>;
    collectionItemsShown?: Record<string, number>;
    taskItemsShown?: Record<string, number>;
    openContexts?: string[];
    sections: UiState['sections'] & { globalHistory?: boolean; contexts?: boolean };
  };
};

export function normalizeState(raw: SidenoteState): { state: SidenoteState; changed: boolean } {
  const stored = raw as StoredState;
  let changed = false;
  const tags = [...(stored.tags ?? [])];
  const byName = new Map<string, string>();
  for (const tag of tags) {
    if (!tag.deletedAt) byName.set(tag.name.toLowerCase(), tag.id);
  }
  const ensureTag = (name: string): string => {
    const trimmed = name.trim().replace(/^#/, '');
    if (!trimmed) return '';
    const found = byName.get(trimmed.toLowerCase());
    if (found) return found;
    const id = newId();
    tags.push({ id, name: trimmed, visibility: 'private', updatedAt: Date.now() });
    byName.set(trimmed.toLowerCase(), id);
    changed = true;
    return id;
  };
  const notes = (stored.notes ?? []).map((note: StoredNote) => {
    const keywords = note.keywords;
    const tagIds = note.tagIds ?? keywords?.map(ensureTag).filter(Boolean) ?? [];
    if (keywords || !note.tagIds) changed = true;
    const next: StoredNote = { ...note, tagIds };
    delete next.keywords;
    return next as Note;
  });
  const now = Date.now();
  const excerpts = (stored.excerpts ?? []).map((row) => {
    const action = canonicalAction(String(row.userAction));
    if (row.contextId === undefined || !row.tagIds || action.next !== row.userAction || (action.drop && !row.deletedAt)) {
      changed = true;
    }
    return {
      ...row,
      userAction: action.next,
      contextId: row.contextId ?? null,
      tagIds: row.tagIds ?? [],
      deletedAt: action.drop ? row.deletedAt ?? now : row.deletedAt,
    };
  });
  if (!stored.contexts) changed = true;
  const sections = { ...stored.ui.sections };
  if (sections.contexts === undefined) {
    sections.contexts = true;
    changed = true;
  }
  if ('globalHistory' in sections) {
    delete sections.globalHistory;
    changed = true;
  }
  const ui: UiState = {
    ...stored.ui,
    sections,
    contextSort: stored.ui.contextSort ?? 'recency',
    contextsShown: stored.ui.contextsShown ?? 10,
    contextItemsShown: stored.ui.contextItemsShown ?? {},
    collectionItemsShown: stored.ui.collectionItemsShown ?? {},
    taskItemsShown: stored.ui.taskItemsShown ?? {},
    openContexts: stored.ui.openContexts ?? [],
  };
  if (
    stored.ui.contextSort === undefined ||
    stored.ui.contextsShown === undefined ||
    stored.ui.contextItemsShown === undefined ||
    stored.ui.collectionItemsShown === undefined ||
    stored.ui.taskItemsShown === undefined ||
    stored.ui.openContexts === undefined
  ) {
    changed = true;
  }
  if (tags.length !== (stored.tags ?? []).length) changed = true;
  return {
    changed,
    state: { ...stored, notes, excerpts, tags, contexts: stored.contexts ?? [], ui },
  };
}

function nextLocalNo(tasks: Task[]): number {
  return tasks.reduce((max, task) => Math.max(max, task.localNo), 0) + 1;
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) return 10;
  return Math.min(50, Math.max(1, Math.round(value)));
}

function newId(): string {
  return crypto.randomUUID();
}
