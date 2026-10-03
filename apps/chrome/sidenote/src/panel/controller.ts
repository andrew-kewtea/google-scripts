import { matchPage } from '../shared/scope.js';
import type { SectionKey, SidenoteState, Visibility } from '../shared/types.js';
import type { DataService } from './dataService.js';
import { nextColor } from './dataService.js';
import { panelWidth, renderPanel } from './render.js';
import { createSession, pageContextFromSearch, type Session } from './session.js';

export type PanelHandle = {
  replace(next: SidenoteState): void;
};

function contextDead(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  if (/context invalidated/i.test(message)) return true;
  try {
    return !chrome.runtime?.id;
  } catch {
    return true;
  }
}

export function startPanel(service: DataService, initial: SidenoteState): PanelHandle {
  let state = initial;
  const session = createSession();
  const page = pageContextFromSearch(location.search);
  session.url = page.url;
  session.title = page.title;
  const root = document.getElementById('app');
  if (!root) return { replace() {} };
  const app = root;

  app.addEventListener('click', (event) => {
    void guard(() => onClick(event));
  });
  app.addEventListener('keydown', (event) => {
    void guard(() => onKey(event));
  });
  app.addEventListener('change', (event) => {
    void guard(() => onChange(event));
  });
  document.addEventListener('pointerdown', (event) => {
    if (!session.menu) return;
    const target = event.target;
    if (!(target instanceof Node) || app.contains(target)) return;
    session.menu = null;
    draw();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (session.menu) {
      session.menu = null;
      draw();
      return;
    }
    if (session.patternsOpen || session.projectsOpen || session.limitsOpen) {
      session.patternsOpen = false;
      session.projectsOpen = false;
      session.limitsOpen = false;
      draw();
    }
  });
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    const data = event.data as { type?: string; url?: string; title?: string } | null;
    if (!data) return;
    if (data.type === 'sidenote:show') {
      if (!state.ui.expanded) return;
      state = { ...state, ui: { ...state.ui, expanded: false } };
      applyExpanded(false);
      void service.setUi(state, { expanded: false });
      return;
    }
    if (data.type !== 'sidenote:page') return;
    const url = data.url ?? '';
    const title = data.title ?? '';
    if (!url || (url === session.url && title === session.title)) return;
    session.url = url;
    session.title = title;
    draw();
  });

  draw();

  return {
    replace(next) {
      if (JSON.stringify(next) === JSON.stringify(state)) return;
      const columnOnly = sameExceptExpanded(state, next);
      state = next;
      if (columnOnly && app.querySelector('.col2-wrap')) {
        applyExpanded(state.ui.expanded);
        return;
      }
      draw();
    },
  };

  async function guard(work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      if (!contextDead(error)) throw error;
      session.notice = 'This panel was disconnected by an extension reload. Click the sidenote icon to open it again, then save.';
      draw();
    }
  }

  async function onClick(event: Event): Promise<void> {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const el = target.closest<HTMLElement>('[data-action]');
    if (!el || !app.contains(el)) {
      if (session.menu) {
        session.menu = null;
        draw();
      }
      return;
    }
    const action = el.dataset.action ?? '';
    if (session.menu && action !== 'toggle-menu' && !el.closest('.menu')) session.menu = null;
    if (action === 'stop') {
      event.stopPropagation();
      return;
    }
    syncSession();
    const id = el.dataset.id ?? '';

    switch (action) {
      case 'toggle-expand':
        state = await service.setUi(state, { expanded: !state.ui.expanded });
        applyExpanded(state.ui.expanded);
        return;
      case 'close-second':
        state = await service.setUi(state, { expanded: false });
        applyExpanded(false);
        return;
      case 'close-panel':
        if (window.parent !== window) window.parent.postMessage({ type: 'sidenote:close' }, '*');
        return;
      case 'dismiss-notice':
        session.notice = '';
        break;
      case 'toggle-section': {
        const section = el.dataset.section as SectionKey;
        state = await service.setUi(state, {
          sections: { ...state.ui.sections, [section]: !state.ui.sections[section] },
        });
        break;
      }
      case 'toggle-tree':
        state = await service.setUi(state, {
          treeOpen: toggleId(state.ui.treeOpen ?? [], el.dataset.path ?? ''),
        });
        break;
      case 'edit-about':
        openAbout();
        break;
      case 'cancel-about':
        session.aboutEditing = false;
        break;
      case 'save-about':
        if (!session.url) break;
        state = await service.saveAbout(state, session.url, session.aboutTitle, session.aboutTags);
        session.aboutEditing = false;
        break;
      case 'remove-about-tag':
        session.aboutTags = session.aboutTags.filter((tag) => tag !== el.dataset.tag);
        break;
      case 'open-patterns':
        openPatterns();
        break;
      case 'close-patterns':
        session.patternsOpen = false;
        break;
      case 'remove-pattern':
        session.patterns.splice(Number(el.dataset.index), 1);
        break;
      case 'save-patterns':
        if (session.patternInput.trim()) session.patterns.push(session.patternInput.trim());
        session.patternInput = '';
        if (session.url) {
          state = await service.savePatterns(
            state,
            session.url,
            session.title,
            session.patterns,
            session.ignoreQuery,
          );
        }
        session.patternsOpen = false;
        break;
      case 'add-note':
        session.noteKey = 'new';
        session.noteText = '';
        session.noteVisibility = 'private';
        session.noteCollectionId = state.collections.find((item) => !item.deletedAt)?.id ?? '';
        session.noteKeywords = [];
        session.noteKw = '';
        session.focusId = 'note-text';
        break;
      case 'edit-note':
        openNote(id);
        break;
      case 'cancel-note':
        session.noteKey = null;
        break;
      case 'save-note':
        await saveNote();
        break;
      case 'delete-note':
        state = await service.deleteNote(state, id);
        session.noteKey = null;
        break;
      case 'remove-keyword':
        session.noteKeywords = session.noteKeywords.filter((word) => word !== el.dataset.word);
        break;
      case 'toggle-menu':
        toggleMenu(el.dataset.menu ?? '', id);
        break;
      case 'set-note-sort':
        if (el.dataset.sort === 'time' || el.dataset.sort === 'page') {
          state = await service.setUi(state, { noteSort: el.dataset.sort });
        }
        session.menu = null;
        break;
      case 'set-note-vis':
        await setNoteVisibility(id, (el.dataset.vis ?? 'private') as Visibility);
        session.menu = null;
        break;
      case 'set-history-filter':
        if (
          el.dataset.filter === 'all' ||
          el.dataset.filter === 'read' ||
          el.dataset.filter === 'link' ||
          el.dataset.filter === 'form' ||
          el.dataset.filter === 'highlights'
        ) {
          state = await service.setUi(state, { historyFilter: el.dataset.filter, historyShown: 10 });
        }
        session.menu = null;
        break;
      case 'select-excerpt':
        if (session.excerptEditing && session.selectedExcerptId === id) return;
        session.selectedExcerptId = id;
        session.excerptEditing = false;
        break;
      case 'edit-excerpt': {
        const row = state.excerpts.find((item) => item.id === id);
        session.selectedExcerptId = id;
        session.excerptEditing = true;
        session.excerptText = row?.text ?? '';
        session.focusId = 'excerpt-text';
        break;
      }
      case 'cancel-excerpt':
        session.excerptEditing = false;
        break;
      case 'save-excerpt':
        state = await service.updateExcerpt(state, id, session.excerptText);
        session.excerptEditing = false;
        break;
      case 'delete-excerpt':
        state = await service.deleteExcerpt(state, id);
        session.selectedExcerptId = null;
        session.excerptEditing = false;
        break;
      case 'show-more-history':
        state = await service.setUi(state, { historyShown: state.ui.historyShown + 10 });
        break;
      case 'add-history':
        session.historyDraft = true;
        session.historyText = '';
        session.focusId = 'history-text';
        break;
      case 'cancel-history':
        session.historyDraft = false;
        break;
      case 'save-history':
        await saveHistory();
        break;
      case 'set-col-sort':
        if (el.dataset.sort === 'recency' || el.dataset.sort === 'size') {
          state = await service.setUi(state, { collectionSort: el.dataset.sort });
        }
        session.menu = null;
        break;
      case 'add-collection':
        session.newCollection = true;
        session.collectionName = '';
        session.focusId = 'collection-name';
        break;
      case 'toggle-collection':
        state = await service.setUi(state, { openCollections: toggleId(state.ui.openCollections, id) });
        break;
      case 'show-more-collections':
        state = await service.setUi(state, {
          collectionsShown: state.ui.collectionsShown + state.settings.display.collections,
        });
        break;
      case 'set-task-sort':
        if (el.dataset.sort === 'recency' || el.dataset.sort === 'size') {
          state = await service.setUi(state, { taskSort: el.dataset.sort });
        }
        session.menu = null;
        break;
      case 'add-task':
        session.newTask = true;
        session.taskKey = null;
        session.taskTitle = '';
        session.taskProjectId = '';
        session.focusId = 'new-task-title';
        break;
      case 'edit-task':
        openTask(id);
        break;
      case 'cancel-task':
        session.taskKey = null;
        session.newTask = false;
        break;
      case 'save-task':
        state = await service.updateTask(state, id, {
          title: session.taskTitle,
          projectId: session.taskProjectId || null,
          status: session.taskStatus,
          due: session.taskDue,
        });
        session.taskKey = null;
        break;
      case 'create-task':
        state = await service.createTask(state, {
          title: session.taskTitle,
          projectId: session.taskProjectId || null,
          refUrl: session.url || undefined,
        });
        session.newTask = false;
        break;
      case 'delete-task':
        state = await service.deleteTask(state, id);
        session.taskKey = null;
        break;
      case 'toggle-project':
        state = await service.setUi(state, { openProjects: toggleId(state.ui.openProjects, id) });
        break;
      case 'show-more-tasks':
        state = await service.setUi(state, {
          tasksShown: state.ui.tasksShown + state.settings.display.tasks,
        });
        break;
      case 'open-projects':
        session.projectsOpen = true;
        session.projectName = '';
        session.focusId = 'project-name';
        break;
      case 'close-projects':
        session.projectsOpen = false;
        break;
      case 'cycle-color': {
        const project = state.projects.find((item) => item.id === id);
        if (project) state = await service.updateProject(state, id, { color: nextColor(project.color) });
        break;
      }
      case 'delete-project':
        state = await service.deleteProject(state, id);
        break;
      case 'toggle-settings':
        state = await service.setUi(state, { openSettings: toggleId(state.ui.openSettings, id) });
        break;
      case 'open-limits':
        session.limitsOpen = true;
        session.limitsCollections = state.settings.display.collections;
        session.limitsNotes = state.settings.display.notesPerCollection;
        session.limitsTasks = state.settings.display.tasks;
        break;
      case 'close-limits':
        session.limitsOpen = false;
        break;
      case 'save-limits':
        state = await service.saveDisplay(state, {
          collections: session.limitsCollections,
          notesPerCollection: session.limitsNotes,
          tasks: session.limitsTasks,
        });
        session.limitsOpen = false;
        break;
      case 'login-local':
        session.notice = 'Sign-in is not connected. Notes stay on this device.';
        session.accountPassword = '';
        break;
      case 'add-tag':
        session.newTag = true;
        session.tagName = '';
        session.focusId = 'tag-name';
        break;
      case 'set-tag-vis':
        state = await service.updateTag(state, id, (el.dataset.vis ?? 'private') as Visibility);
        session.menu = null;
        break;
      case 'add-group':
        session.newGroup = true;
        session.groupName = '';
        session.focusId = 'group-name';
        break;
      default:
        return;
    }
    draw();
  }

  async function onKey(event: KeyboardEvent): Promise<void> {
    if (event.key !== 'Enter') return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    syncSession();
    if (target.id === 'about-tag-input') {
      pushWord(session.aboutTags, session.tagInput);
      session.tagInput = '';
    } else if (target.id === 'note-kw') {
      pushWord(session.noteKeywords, session.noteKw);
      session.noteKw = '';
    } else if (target.id === 'pattern-input') {
      if (session.patternInput.trim()) session.patterns.push(session.patternInput.trim());
      session.patternInput = '';
    } else if (target.id === 'collection-name') {
      state = await service.createCollection(state, session.collectionName);
      session.newCollection = false;
      session.collectionName = '';
    } else if (target.id === 'project-name') {
      state = await service.createProject(state, session.projectName);
      session.projectName = '';
    } else if (target.id === 'tag-name') {
      state = await service.createTag(state, session.tagName);
      session.newTag = false;
      session.tagName = '';
    } else if (target.id === 'group-name') {
      state = await service.createGroup(state, session.groupName);
      session.newGroup = false;
      session.groupName = '';
    } else if (target.id === 'task-title') {
      state = await service.updateTask(state, session.taskKey ?? '', {
        title: session.taskTitle,
        projectId: session.taskProjectId || null,
        status: session.taskStatus,
        due: session.taskDue,
      });
      session.taskKey = null;
    } else {
      return;
    }
    event.preventDefault();
    draw();
  }

  async function onChange(event: Event): Promise<void> {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.dataset.projectId) {
      state = await service.updateProject(state, target.dataset.projectId, { name: target.value });
      draw();
      return;
    }
    if (target instanceof HTMLSelectElement && target.dataset.setting) {
      const key = target.dataset.setting;
      if (key === 'language' && (target.value === 'en' || target.value === 'ko' || target.value === 'ja')) {
        state = await service.saveSettings(state, { language: target.value });
      } else if (key === 'timeZone') {
        state = await service.saveSettings(state, { timeZone: target.value });
      } else if (key === 'theme' && (target.value === 'system' || target.value === 'light' || target.value === 'dark')) {
        state = await service.saveSettings(state, { theme: target.value });
      }
      draw();
      return;
    }
    if (target instanceof HTMLSelectElement && target.dataset.groupStatus) {
      const status = target.value;
      if (status === 'active' || status === 'inactive' || status === 'archived') {
        state = await service.updateGroup(state, target.dataset.groupStatus, { status });
        draw();
      }
      return;
    }
    if (target instanceof HTMLInputElement && target.dataset.groupRead) {
      state = await service.updateGroup(state, target.dataset.groupRead, { readAccess: target.checked });
      draw();
    }
  }

  function applyExpanded(expanded: boolean): void {
    const wrap = app.querySelector('.col2-wrap');
    if (wrap) wrap.classList.toggle('open', expanded);
    const button = app.querySelector<HTMLButtonElement>('[data-action="toggle-expand"]');
    if (button) {
      const label = expanded ? 'Collapse' : 'Expand';
      button.title = label;
      button.setAttribute('aria-label', label);
      const glyph = button.querySelector('.ms');
      if (glyph) glyph.textContent = expanded ? 'chevron_left' : 'chevron_right';
    }
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'sidenote:layout', width: panelWidth(expanded) }, '*');
    }
  }

  function draw(): void {
    const previous = collectPanes(app);
    app.innerHTML = renderPanel(state, session);
    playPaneTransitions(app, previous);
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'sidenote:layout', width: panelWidth(state.ui.expanded) }, '*');
    }
    const focusId = session.focusId;
    session.focusId = null;
    if (focusId) document.getElementById(focusId)?.focus();
    placeMenus();
  }

  function syncSession(): void {
    assign('about-title', (value) => {
      session.aboutTitle = value;
    });
    assign('about-tag-input', (value) => {
      session.tagInput = value;
    });
    assign('pattern-input', (value) => {
      session.patternInput = value;
    });
    const ignore = document.getElementById('pattern-ignore');
    if (ignore instanceof HTMLInputElement) session.ignoreQuery = ignore.checked;
    document.querySelectorAll<HTMLInputElement>('[data-pattern-index]').forEach((input) => {
      const index = Number(input.dataset.patternIndex);
      if (Number.isInteger(index)) session.patterns[index] = input.value;
    });
    assign('note-text', (value) => {
      session.noteText = value;
    });
    assign('note-collection', (value) => {
      session.noteCollectionId = value;
    });
    assign('note-kw', (value) => {
      session.noteKw = value;
    });
    assign('excerpt-text', (value) => {
      session.excerptText = value;
    });
    assign('history-text', (value) => {
      session.historyText = value;
    });
    assign('collection-name', (value) => {
      session.collectionName = value;
    });
    assign('task-title', (value) => {
      session.taskTitle = value;
    });
    assign('new-task-title', (value) => {
      session.taskTitle = value;
    });
    assign('task-project', (value) => {
      session.taskProjectId = value;
    });
    assign('new-task-project', (value) => {
      session.taskProjectId = value;
    });
    assign('task-status', (value) => {
      if (value === 'active' || value === 'inactive' || value === 'draft') session.taskStatus = value;
    });
    assign('task-due', (value) => {
      session.taskDue = value;
    });
    assign('project-name', (value) => {
      session.projectName = value;
    });
    assign('account-email', (value) => {
      session.accountEmail = value;
    });
    assign('account-password', (value) => {
      session.accountPassword = value;
    });
    assign('tag-name', (value) => {
      session.tagName = value;
    });
    assign('group-name', (value) => {
      session.groupName = value;
    });
    assignNumber('limits-collections', (value) => {
      session.limitsCollections = value;
    });
    assignNumber('limits-notes', (value) => {
      session.limitsNotes = value;
    });
    assignNumber('limits-tasks', (value) => {
      session.limitsTasks = value;
    });
  }

  function openAbout(): void {
    const page = session.url ? matchPage(state, session.url) : undefined;
    session.aboutEditing = true;
    session.aboutTitle = page?.title || session.title;
    session.aboutTags = [...(page?.tags ?? [])];
    session.tagInput = '';
    session.focusId = 'about-title';
  }

  function openPatterns(): void {
    const page = session.url ? matchPage(state, session.url) : undefined;
    session.patternsOpen = true;
    session.patterns = [...(page?.patterns ?? [])];
    session.patternInput = '';
    session.ignoreQuery = page?.ignoreQuery ?? true;
    session.focusId = 'pattern-input';
  }

  function openNote(id: string): void {
    const note = state.notes.find((item) => item.id === id);
    if (!note) return;
    session.noteKey = id;
    session.noteText = note.text;
    session.noteVisibility = note.visibility;
    session.noteCollectionId = note.collectionId;
    session.noteKeywords = [...note.keywords];
    session.noteKw = '';
    session.focusId = 'note-text';
  }

  function openTask(id: string): void {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) return;
    session.newTask = false;
    session.taskKey = id;
    session.taskTitle = task.title;
    session.taskProjectId = task.projectId ?? '';
    session.taskStatus = task.status;
    session.taskDue = task.due ?? '';
    session.focusId = 'task-title';
  }

  async function saveHistory(): Promise<void> {
    const text = session.historyText.trim();
    if (!text) return;
    if (!session.url) {
      session.notice = 'Open a page before saving history.';
      return;
    }
    state = await service.addManualExcerpt(state, { url: session.url, title: session.title, text });
    session.historyDraft = false;
    session.historyText = '';
  }

  async function saveNote(): Promise<void> {
    const input = {
      text: session.noteText,
      visibility: session.noteVisibility,
      collectionId: session.noteCollectionId,
      keywords: session.noteKeywords,
    };
    if (session.noteKey === 'new') {
      if (!session.url) {
        session.notice = 'Open a page before saving a note.';
        return;
      }
      state = await service.createNote(state, { ...input, url: session.url, title: session.title });
    } else if (session.noteKey) {
      state = await service.updateNote(state, session.noteKey, input);
    }
    session.noteKey = null;
  }

  async function setNoteVisibility(id: string, visibility: Visibility): Promise<void> {
    if (session.noteKey === id) {
      session.noteVisibility = visibility;
      return;
    }
    const note = state.notes.find((item) => item.id === id && !item.deletedAt);
    if (!note) return;
    state = await service.updateNote(state, id, {
      text: note.text,
      visibility,
      collectionId: note.collectionId,
      keywords: note.keywords,
    });
  }

  function toggleMenu(kind: string, id: string): void {
    if (session.menu?.kind === kind && session.menu.id === id) session.menu = null;
    else session.menu = { kind, id };
  }
}

const PANE = '.about-body, .sec-body, .sub-body';

function paneKey(el: Element): string | null {
  if (el.classList.contains('about-body')) return 'about';
  const prev = el.previousElementSibling;
  if (!(prev instanceof HTMLElement)) return null;
  if (el.classList.contains('sec-body') && prev.dataset.section) return `sec:${prev.dataset.section}`;
  const trigger = prev.matches('[data-action]') ? prev : prev.querySelector('[data-action]');
  if (trigger instanceof HTMLElement && trigger.dataset.action && trigger.dataset.id) {
    return `sub:${trigger.dataset.action}:${trigger.dataset.id}`;
  }
  return null;
}

function collectPanes(root: ParentNode): Map<string, boolean> {
  const panes = new Map<string, boolean>();
  root.querySelectorAll(PANE).forEach((el) => {
    const key = paneKey(el);
    if (key) panes.set(key, el.classList.contains('open'));
  });
  return panes;
}

function playPaneTransitions(root: HTMLElement, previous: Map<string, boolean>): void {
  if (previous.size === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const pending: HTMLElement[] = [];
  root.querySelectorAll(PANE).forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const key = paneKey(el);
    if (!key || !previous.has(key) || previous.get(key) === el.classList.contains('open')) return;
    el.classList.toggle('open');
    pending.push(el);
  });
  if (pending.length === 0) return;
  void root.offsetWidth;
  for (const el of pending) el.classList.toggle('open');
}

function sameExceptExpanded(current: SidenoteState, next: SidenoteState): boolean {
  const rest = (value: SidenoteState): string => JSON.stringify({ ...value, ui: { ...value.ui, expanded: false } });
  return rest(current) === rest(next);
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function pushWord(list: string[], raw: string): void {
  const word = raw.trim().replace(/^#/, '');
  if (word && !list.includes(word)) list.push(word);
}

function assign(id: string, apply: (value: string) => void): void {
  const el = document.getElementById(id);
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    apply(el.value);
  }
}

function assignNumber(id: string, apply: (value: number) => void): void {
  const el = document.getElementById(id);
  if (el instanceof HTMLInputElement && el.value !== '') apply(Number(el.value));
}

function placeMenus(): void {
  const margin = 8;
  document.querySelectorAll<HTMLElement>('.menu').forEach((menu) => {
    const trigger = menu.parentElement?.querySelector('button');
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = menu.offsetWidth || 180;
    const height = menu.offsetHeight || 180;
    let left = rect.right - width;
    if (left < margin) left = margin;
    if (left + width > window.innerWidth - margin) left = Math.max(margin, window.innerWidth - margin - width);
    const top =
      window.innerHeight - rect.bottom < height + margin
        ? Math.max(margin, rect.top - height - 4)
        : rect.bottom + 4;
    menu.style.left = `${left}px`;
    menu.style.right = 'auto';
    menu.style.top = `${top}px`;
  });
}
