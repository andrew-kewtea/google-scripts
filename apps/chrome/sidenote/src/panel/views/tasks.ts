import type { SidenoteState, Task, TaskStatus } from '../../shared/types.js';
import { esc, formatDue, icon } from '../format.js';
import { taskGroups } from '../present.js';
import type { Session } from '../session.js';
import { anchor, menuBox, menuItem, menuOpen } from './menu.js';

const STATUS: Record<TaskStatus, [string, string]> = {
  active: ['Active', '#8fb08a'],
  inactive: ['Inactive', '#b3ada1'],
  draft: ['Draft', '#d2a85a'],
};

export function tasksSection(state: SidenoteState, session: Session): string {
  const open = state.ui.sections.tasks;
  const groups = taskGroups(state);
  const flat = groups.flatMap((group) => group.tasks);
  const shownIds = new Set(flat.slice(0, Math.max(state.settings.display.tasks, state.ui.tasksShown)).map((task) => task.id));
  const more = flat.length > shownIds.size;
  const sort = state.ui.taskSort;
  const menu = menuOpen(session, 'task-sort', 'tasks')
    ? menuBox(
        'task-sort',
        'tasks',
        menuItem('set-task-sort', 'data-sort="recency"', 'By recency', sort === 'recency') +
          menuItem('set-task-sort', 'data-sort="size"', 'By size', sort === 'size'),
      )
    : '';
  const blocks = groups
    .map((group) => {
      const tasks = group.tasks.filter((task) => shownIds.has(task.id));
      if (tasks.length === 0 && group.id === 'uncategorized') return '';
      return projectBlock(state, session, group.id, group.name, group.color, tasks);
    })
    .join('');
  const creator = session.newTask ? newTaskForm(state, session) : '';
  return `<section class="section">
    <button type="button" class="sec-head" data-action="toggle-section" data-section="tasks" aria-expanded="${open}">
      <span class="sec-title">Tasks</span><span class="count">${flat.length}</span>
      ${icon(open ? 'expand_less' : 'expand_more')}
    </button>
    <div class="sec-body${open ? ' open' : ''}" ${open ? '' : 'inert'}>
      <div class="toolbar">
        <button type="button" class="mini" data-action="open-projects" title="Projects" aria-label="Projects">${icon('tune')}</button>
        ${anchor(
          'task-sort',
          'tasks',
          `<button type="button" class="icon-btn" data-action="toggle-menu" data-menu="task-sort" data-id="tasks" title="Sort" aria-label="Sort">${icon('sort')}${icon('arrow_drop_down')}</button>`,
          menu,
        )}
        <button type="button" class="icon-btn" data-action="add-task" title="New task" aria-label="New task">${icon('add')}</button>
      </div>
      ${creator}${blocks}
      ${more ? `<button type="button" class="pill" data-action="show-more-tasks">Show more</button>` : ''}
    </div>
    ${session.projectsOpen ? projectsModal(state, session) : ''}
  </section>`;
}

function projectBlock(
  state: SidenoteState,
  session: Session,
  id: string,
  name: string,
  color: string,
  tasks: Task[],
): string {
  const open = state.ui.openProjects.includes(id);
  const rows = tasks.map((task) => (session.taskKey === task.id ? taskEditor(state, session, task) : taskRow(task))).join('');
  return `<div class="sub">
    <button type="button" class="sub-head" data-action="toggle-project" data-id="${esc(id)}" aria-expanded="${open}">
      <span class="dot" style="background:${esc(color)}"></span>
      <span class="sub-name">${esc(name)}</span>
      <span class="count">${tasks.length}</span>
      ${icon(open ? 'expand_less' : 'expand_more')}
    </button>
    <div class="sub-body${open ? ' open' : ''}"><div>${rows}</div></div>
  </div>`;
}

function taskRow(task: Task): string {
  const [label, color] = STATUS[task.status];
  return `<button type="button" class="task" data-action="edit-task" data-id="${esc(task.id)}">
    <span class="task-no">${task.localNo}</span>
    <span class="ellipsis">${esc(task.title)}</span>
    <span class="status"><span class="dot" style="background:${color}"></span>${esc(label)}</span>
    <span class="muted">${esc(formatDue(task.due))}</span>
  </button>`;
}

function taskEditor(state: SidenoteState, session: Session, task: Task): string {
  return `<div class="task-edit" data-action="stop">
    <input id="task-title" value="${esc(session.taskTitle)}" aria-label="Task title">
    ${projectSelect(state, 'task-project', session.taskProjectId)}
    ${statusSelect(session.taskStatus)}
    <input id="task-due" type="date" value="${esc(session.taskDue)}" aria-label="Due">
    <div class="btn-row">
      <button type="button" class="btn" data-action="save-task" data-id="${esc(task.id)}">Save</button>
      <button type="button" class="btn" data-action="cancel-task">Cancel</button>
      <button type="button" class="btn danger" data-action="delete-task" data-id="${esc(task.id)}">Delete</button>
    </div>
  </div>`;
}

function newTaskForm(state: SidenoteState, session: Session): string {
  return `<div class="editor">
    <input id="new-task-title" value="${esc(session.taskTitle)}" placeholder="Task title" aria-label="Task title">
    ${projectSelect(state, 'new-task-project', session.taskProjectId)}
    <div class="btn-row">
      <button type="button" class="btn" data-action="create-task">Create</button>
      <button type="button" class="btn" data-action="cancel-task">Cancel</button>
    </div>
  </div>`;
}

function projectSelect(state: SidenoteState, id: string, current: string): string {
  const projects = state.projects.filter((project) => !project.deletedAt);
  const options = [
    `<option value="" ${current === '' ? 'selected' : ''}>Uncategorized</option>`,
    ...projects.map(
      (project) =>
        `<option value="${esc(project.id)}" ${project.id === current ? 'selected' : ''}>${esc(project.name)}</option>`,
    ),
  ].join('');
  return `<select id="${esc(id)}" aria-label="Project">${options}</select>`;
}

function statusSelect(current: TaskStatus): string {
  const options = (['active', 'inactive', 'draft'] as TaskStatus[])
    .map((status) => `<option value="${status}" ${status === current ? 'selected' : ''}>${STATUS[status][0]}</option>`)
    .join('');
  return `<select id="task-status" aria-label="Status">${options}</select>`;
}

function projectsModal(state: SidenoteState, session: Session): string {
  const rows = state.projects
    .filter((project) => !project.deletedAt)
    .sort((a, b) => a.order - b.order)
    .map((project) => {
      const count = state.tasks.filter((task) => !task.deletedAt && task.projectId === project.id).length;
      return `<div class="project-row">
        <button type="button" class="dot-btn" data-action="cycle-color" data-id="${esc(project.id)}" title="Color" aria-label="Change color"><span class="dot" style="background:${esc(project.color)}"></span></button>
        <input data-project-id="${esc(project.id)}" value="${esc(project.name)}" aria-label="Project name">
        <span class="muted">${count}</span>
        <button type="button" data-action="delete-project" data-id="${esc(project.id)}" aria-label="Delete project">${icon('close')}</button>
      </div>`;
    })
    .join('');
  return `<div class="modal-back" data-action="close-projects">
    <div class="modal modal-wide" data-action="stop" role="dialog" aria-label="Projects">
      <div class="modal-head"><span>Projects</span>
        <button type="button" data-action="close-projects" aria-label="Close">${icon('close')}</button>
      </div>
      <div class="modal-body">
        ${rows}
        <input id="project-name" value="${esc(session.projectName)}" placeholder="New project · Enter">
        <p class="hint">Tasks of a deleted project move to Uncategorized.</p>
      </div>
      <div class="btn-row modal-actions">
        <button type="button" class="btn" data-action="close-projects">Done</button>
      </div>
    </div>
  </div>`;
}
