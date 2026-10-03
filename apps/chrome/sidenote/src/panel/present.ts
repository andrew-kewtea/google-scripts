import type { Collection, Note, PageExcerpt, Project, SidenoteState, Task, UserAction } from '../shared/types.js';

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

export const GLOBAL_HISTORY_LIMIT = 100;

export function recentExcerpts(state: SidenoteState, limit = GLOBAL_HISTORY_LIMIT): PageExcerpt[] {
  return state.excerpts
    .filter((row) => !row.deletedAt)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
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
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, state.settings.display.notesPerCollection);
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
    case 'link':
      return 'link';
    case 'form':
      return 'keyboard';
    case 'copy':
    case 'select':
      return 'ink_highlighter';
    case 'manual':
      return 'edit_note';
  }
}

export function filterIcon(filter: string): string {
  switch (filter) {
    case 'read':
      return 'menu_book';
    case 'link':
      return 'link';
    case 'form':
      return 'keyboard';
    case 'highlights':
      return 'ink_highlighter';
    default:
      return 'filter_list';
  }
}
