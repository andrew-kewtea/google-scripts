import type {
  Collection,
  ContextThread,
  Note,
  PageExcerpt,
  Project,
  SidenoteState,
  Task,
  UserAction,
} from '../shared/types.js';

export function liveNotes(state: SidenoteState, pageId: string | undefined): Note[] {
  if (!pageId) return [];
  const rows = state.notes.filter((note) => note.pageId === pageId && !note.deletedAt);
  if (state.ui.noteSort === 'page') {
    return [...rows].sort((a, b) => (a.anchor?.offset ?? 1_000_000) - (b.anchor?.offset ?? 1_000_000));
  }
  return [...rows].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function liveExcerpts(rows: PageExcerpt[], shown: number): { items: PageExcerpt[]; more: boolean } {
  const sorted = [...rows].sort((a, b) => b.createdAt - a.createdAt);
  return { items: sorted.slice(0, shown), more: sorted.length > shown };
}

export type ContextGroup = {
  id: string;
  name: string;
  context: ContextThread | null;
  items: PageExcerpt[];
};

export function contextGroups(state: SidenoteState): ContextGroup[] {
  const live = state.excerpts.filter((row) => !row.deletedAt);
  const contexts = state.contexts.filter((context) => !context.deletedAt);
  const itemsFor = (id: string | null) =>
    live.filter((row) => (row.contextId ?? null) === id).sort((a, b) => b.createdAt - a.createdAt);
  const sorted = [...contexts].sort((a, b) => {
    if (state.ui.contextSort === 'size') return itemsFor(b.id).length - itemsFor(a.id).length || b.updatedAt - a.updatedAt;
    return b.updatedAt - a.updatedAt;
  });
  const groups: ContextGroup[] = sorted.map((context) => ({
    id: context.id,
    name: context.name,
    context,
    items: itemsFor(context.id),
  }));
  const loose = itemsFor(null);
  if (loose.length) {
    groups.push({ id: 'uncategorized', name: 'Uncategorized', context: null, items: loose });
  }
  return groups;
}

export function noteCount(state: SidenoteState, pageId: string): number {
  return state.notes.filter((note) => note.pageId === pageId && !note.deletedAt).length;
}

export function liveCollections(state: SidenoteState): Collection[] {
  const rows = state.collections.filter((item) => !item.deletedAt);
  const count = (id: string) => state.notes.filter((note) => !note.deletedAt && note.collectionId === id).length;
  if (state.ui.collectionSort === 'size') {
    return [...rows].sort((a, b) => count(b.id) - count(a.id) || b.updatedAt - a.updatedAt);
  }
  return [...rows].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function notesInCollection(state: SidenoteState, collectionId: string): Note[] {
  return state.notes
    .filter((note) => !note.deletedAt && note.collectionId === collectionId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export type CollectionGroup = {
  id: string;
  name: string;
  collection: Collection | null;
  notes: Note[];
};

export function collectionGroups(state: SidenoteState): CollectionGroup[] {
  const groups: CollectionGroup[] = liveCollections(state).map((collection) => ({
    id: collection.id,
    name: collection.name,
    collection,
    notes: notesInCollection(state, collection.id),
  }));
  const loose = state.notes
    .filter((note) => !note.deletedAt && !note.collectionId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  if (loose.length) {
    groups.push({ id: 'uncategorized', name: 'Uncategorized', collection: null, notes: loose });
  }
  return groups;
}

export function pageSize(setting: number): number {
  if (!Number.isFinite(setting)) return 10;
  return Math.min(10, Math.max(1, Math.round(setting)));
}

export function expandShown(setting: number): number {
  const page = pageSize(setting);
  return Math.min(20, page * 2);
}

export function listWindow(total: number, stored: number | undefined, setting: number): { count: number; more: boolean } {
  const page = pageSize(setting);
  const expanded = stored !== undefined && stored > page;
  const count = Math.min(total, expanded ? Math.min(20, page * 2) : page);
  const more = total > count && !expanded && count < 20;
  return { count, more };
}

export type TaskGroup = {
  id: string;
  name: string;
  color: string;
  project: Project | null;
  tasks: Task[];
};

export function taskGroups(state: SidenoteState): TaskGroup[] {
  const tasks = state.tasks.filter((task) => !task.deletedAt);
  const projects = state.projects.filter((project) => !project.deletedAt);
  const inProject = (id: string) => tasks.filter((task) => task.projectId === id);
  const recency = (rows: Task[]) => rows.reduce((max, task) => Math.max(max, task.updatedAt), 0);
  const sorted = [...projects].sort((a, b) => {
    if (state.ui.taskSort === 'size') return inProject(b.id).length - inProject(a.id).length || a.order - b.order;
    return recency(inProject(b.id)) - recency(inProject(a.id)) || a.order - b.order;
  });
  const groups: TaskGroup[] = sorted.map((project) => ({
    id: project.id,
    name: project.name,
    color: project.color,
    project,
    tasks: inProject(project.id).sort((a, b) => b.localNo - a.localNo),
  }));
  const loose = tasks.filter((task) => !task.projectId).sort((a, b) => b.localNo - a.localNo);
  groups.push({
    id: 'uncategorized',
    name: 'Uncategorized',
    color: '#b3ada1',
    project: null,
    tasks: loose,
  });
  return groups;
}

export function actionIcon(action: UserAction): string {
  switch (action) {
    case 'read':
      return 'menu_book';
    case 'play':
      return 'play_arrow';
    case 'link':
      return 'link';
    case 'form':
      return 'keyboard';
    case 'highlight':
      return 'ink_highlighter';
  }
}

export function actionLabel(action: UserAction): string {
  if (action === 'form') return 'Type & select';
  return action.charAt(0).toUpperCase() + action.slice(1);
}

export const ENTRY_ACTIONS: UserAction[] = ['read', 'play', 'link', 'form', 'highlight'];

export function filterIcon(filter: string): string {
  switch (filter) {
    case 'read':
      return 'menu_book';
    case 'link':
      return 'link';
    case 'play':
      return 'play_arrow';
    case 'form':
      return 'keyboard';
    case 'highlights':
      return 'ink_highlighter';
    default:
      return 'filter_list';
  }
}
