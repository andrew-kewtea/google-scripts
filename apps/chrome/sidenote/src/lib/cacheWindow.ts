import type { Collection, ContextThread, Project, SidenoteState, Task } from '../shared/types.js';

export function applyDisplayWindow(state: SidenoteState, keep: Set<string>): SidenoteState {
  const limits = state.settings.display;
  const collections = windowRows(sortCollections(state), limits.collections, keep);
  const liveCollections = new Set(collections.filter((row) => !row.deletedAt).map((row) => row.id));
  const knownCollections = new Set(state.collections.map((row) => row.id));
  const notes = windowChildren(
    state.notes,
    (note) => childBucket(note.collectionId, liveCollections, knownCollections),
    limits.notesPerCollection,
    keep,
    (note) => note.updatedAt,
  );
  const contexts = windowRows(sortContexts(state), limits.contexts, keep);
  const liveContexts = new Set(contexts.filter((row) => !row.deletedAt).map((row) => row.id));
  const knownContexts = new Set(state.contexts.map((row) => row.id));
  const excerpts = windowChildren(
    state.excerpts,
    (row) => childBucket(row.contextId, liveContexts, knownContexts),
    limits.historyPerContext,
    keep,
    (row) => row.updatedAt || row.createdAt,
  );
  const projects = windowRows(sortProjects(state), limits.projects, keep);
  const liveProjects = new Set(projects.filter((row) => !row.deletedAt).map((row) => row.id));
  const knownProjects = new Set(state.projects.map((row) => row.id));
  const tasks = windowChildren(
    state.tasks,
    (task) => childBucket(task.projectId, liveProjects, knownProjects),
    limits.tasksPerProject,
    keep,
    (task) => task.updatedAt,
  );
  return { ...state, collections, notes, contexts, excerpts, projects, tasks };
}

function childBucket(parentId: string | null, liveParents: Set<string>, knownParents: Set<string>): string {
  if (!parentId) return 'uncategorized';
  if (liveParents.has(parentId) || !knownParents.has(parentId)) return parentId;
  return '';
}

function windowRows<T extends { id: string; deletedAt?: number }>(sorted: T[], limit: number, keep: Set<string>): T[] {
  const pinned = sorted.filter((row) => row.deletedAt || keep.has(row.id));
  const rest = sorted.filter((row) => !row.deletedAt && !keep.has(row.id));
  return [...pinned, ...rest.slice(0, limit)];
}

function windowChildren<T extends { id: string; deletedAt?: number }>(
  rows: T[],
  bucketOf: (row: T) => string,
  limit: number,
  keep: Set<string>,
  recency: (row: T) => number,
): T[] {
  const groups = new Map<string, T[]>();
  const pinned: T[] = [];
  for (const row of rows) {
    if (row.deletedAt || keep.has(row.id)) {
      pinned.push(row);
      continue;
    }
    const name = bucketOf(row);
    if (!name) continue;
    const list = groups.get(name) ?? [];
    list.push(row);
    groups.set(name, list);
  }
  const kept = [...pinned];
  for (const list of groups.values()) {
    list.sort((a, b) => recency(b) - recency(a));
    kept.push(...list.slice(0, limit));
  }
  return kept;
}

function sortCollections(state: SidenoteState): Collection[] {
  const count = (id: string) => state.notes.filter((note) => !note.deletedAt && note.collectionId === id).length;
  return [...state.collections].sort((a, b) => {
    if (state.ui.collectionSort === 'size') return count(b.id) - count(a.id) || b.updatedAt - a.updatedAt;
    return b.updatedAt - a.updatedAt;
  });
}

function sortContexts(state: SidenoteState): ContextThread[] {
  const count = (id: string) => state.excerpts.filter((row) => !row.deletedAt && row.contextId === id).length;
  return [...state.contexts].sort((a, b) => {
    if (state.ui.contextSort === 'size') return count(b.id) - count(a.id) || b.updatedAt - a.updatedAt;
    return b.updatedAt - a.updatedAt;
  });
}

function sortProjects(state: SidenoteState): Project[] {
  const tasks = state.tasks.filter((task) => !task.deletedAt);
  const inProject = (id: string) => tasks.filter((task) => task.projectId === id);
  const recency = (rows: Task[]) => rows.reduce((max, task) => Math.max(max, task.updatedAt), 0);
  return [...state.projects].sort((a, b) => {
    if (state.ui.taskSort === 'size') return inProject(b.id).length - inProject(a.id).length || a.order - b.order;
    return recency(inProject(b.id)) - recency(inProject(a.id)) || a.order - b.order;
  });
}
