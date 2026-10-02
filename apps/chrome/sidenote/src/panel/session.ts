import type { TaskStatus, Visibility } from '../shared/types.js';

export type Session = {
  url: string;
  title: string;
  menu: { kind: string; id: string } | null;
  focusId: string | null;
  aboutEditing: boolean;
  aboutTitle: string;
  aboutTags: string[];
  tagInput: string;
  patternsOpen: boolean;
  patterns: string[];
  patternInput: string;
  ignoreQuery: boolean;
  noteKey: string | null;
  noteText: string;
  noteVisibility: Visibility;
  noteCollectionId: string;
  noteKeywords: string[];
  noteKw: string;
  selectedExcerptId: string | null;
  excerptEditing: boolean;
  excerptText: string;
  newCollection: boolean;
  collectionName: string;
  newTask: boolean;
  taskKey: string | null;
  taskTitle: string;
  taskProjectId: string;
  taskStatus: TaskStatus;
  taskDue: string;
  projectsOpen: boolean;
  projectName: string;
  limitsOpen: boolean;
  limitsCollections: number;
  limitsNotes: number;
  limitsTasks: number;
  accountEmail: string;
  accountPassword: string;
  notice: string;
  newTag: boolean;
  tagName: string;
  newGroup: boolean;
  groupName: string;
};

export function createSession(): Session {
  return {
    url: '',
    title: '',
    menu: null,
    focusId: null,
    aboutEditing: false,
    aboutTitle: '',
    aboutTags: [],
    tagInput: '',
    patternsOpen: false,
    patterns: [],
    patternInput: '',
    ignoreQuery: true,
    noteKey: null,
    noteText: '',
    noteVisibility: 'private',
    noteCollectionId: '',
    noteKeywords: [],
    noteKw: '',
    selectedExcerptId: null,
    excerptEditing: false,
    excerptText: '',
    newCollection: false,
    collectionName: '',
    newTask: false,
    taskKey: null,
    taskTitle: '',
    taskProjectId: '',
    taskStatus: 'draft',
    taskDue: '',
    projectsOpen: false,
    projectName: '',
    limitsOpen: false,
    limitsCollections: 10,
    limitsNotes: 3,
    limitsTasks: 10,
    accountEmail: '',
    accountPassword: '',
    notice: '',
    newTag: false,
    tagName: '',
    newGroup: false,
    groupName: '',
  };
}
