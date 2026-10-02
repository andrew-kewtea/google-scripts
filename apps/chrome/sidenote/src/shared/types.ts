export type Visibility = 'private' | 'public' | `group:${string}`;

export type UserAction = 'read' | 'link' | 'form' | 'copy' | 'select';

export type HistoryFilter = 'all' | 'read' | 'link' | 'form' | 'highlights';

export type TaskStatus = 'active' | 'inactive' | 'draft';

export type NoteSort = 'time' | 'page';

export type ListSort = 'recency' | 'size';

export type ExcerptScope = {
  url: string;
  pageId: string;
  key: string;
};

export type ExcerptRange = {
  selector?: string;
  startOffset?: number;
  endOffset?: number;
  textQuote?: string;
};

export type PageRecord = {
  id: string;
  title: string;
  url: string;
  patterns: string[];
  ignoreQuery: boolean;
  tags: string[];
  updatedAt: number;
};

export type Note = {
  id: string;
  pageId: string;
  text: string;
  visibility: Visibility;
  collectionId: string;
  keywords: string[];
  anchor?: { selector: string; offset: number; textQuote?: string };
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export type PageExcerpt = {
  id: string;
  scope: ExcerptScope;
  userAction: UserAction;
  text: string;
  excerpt?: string;
  range?: ExcerptRange;
  meta?: {
    href?: string;
    depth?: number;
    durationMs?: number;
    section?: string;
  };
  editedByUser?: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export type Collection = {
  id: string;
  name: string;
  visibility: Visibility;
  updatedAt: number;
  deletedAt?: number;
};

export type Project = {
  id: string;
  name: string;
  color: string;
  order: number;
  updatedAt: number;
  deletedAt?: number;
};

export type Task = {
  id: string;
  localNo: number;
  remoteNo?: number;
  title: string;
  projectId: string | null;
  status: TaskStatus;
  due?: string;
  refUrl?: string;
  updatedAt: number;
  deletedAt?: number;
};

export type TagRecord = {
  id: string;
  name: string;
  visibility: Visibility;
  updatedAt: number;
  deletedAt?: number;
};

export type UserGroup = {
  id: string;
  name: string;
  handle: string;
  readAccess: boolean;
  status: 'active' | 'inactive' | 'archived';
  updatedAt: number;
  deletedAt?: number;
};

export type DisplayLimits = {
  collections: number;
  notesPerCollection: number;
  tasks: number;
};

export type Settings = {
  language: 'en' | 'ko' | 'ja';
  timeZone: string;
  theme: 'system' | 'light' | 'dark';
  display: DisplayLimits;
  accountEmail: string;
};

export type SectionKey = 'about' | 'notes' | 'history' | 'collections' | 'tasks' | 'settings';

export type UiState = {
  expanded: boolean;
  sections: Record<SectionKey, boolean>;
  noteSort: NoteSort;
  historyFilter: HistoryFilter;
  collectionSort: ListSort;
  taskSort: ListSort;
  historyShown: number;
  collectionsShown: number;
  tasksShown: number;
  openCollections: string[];
  openProjects: string[];
  openSettings: string[];
  treeOpen: string[];
};

export type SidenoteState = {
  seeded: boolean;
  pages: PageRecord[];
  notes: Note[];
  excerpts: PageExcerpt[];
  collections: Collection[];
  projects: Project[];
  tasks: Task[];
  tags: TagRecord[];
  groups: UserGroup[];
  settings: Settings;
  ui: UiState;
};

export type NoteInput = {
  text: string;
  visibility: Visibility;
  collectionId: string;
  keywords: string[];
};

export type NoteCreate = NoteInput & {
  url: string;
  title: string;
};

export type ExcerptInput = {
  pageId: string;
  url: string;
  userAction: UserAction;
  text: string;
  excerpt?: string;
  range?: ExcerptRange;
};

export const STORAGE_KEY = 'sidenote.state';

export const LOCAL_QUOTA_BYTES = 10 * 1024 * 1024;
