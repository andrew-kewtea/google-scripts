import type { SidenoteState } from '../../shared/types.js';
import { esc, icon } from '../format.js';
import { contextGroups, taskGroups } from '../present.js';
import type { Session } from '../session.js';
import { anchor, menuBox, menuItem, menuOpen } from './menu.js';
import { excerptRow } from './history.js';

export function contextsSection(state: SidenoteState, session: Session): string {
  const open = state.ui.sections.contexts;
  const groups = contextGroups(state);
  const sort = state.ui.contextSort;
  const menu = menuOpen(session, 'context-sort', 'contexts')
    ? menuBox(
        'context-sort',
        'contexts',
        menuItem('set-context-sort', 'data-sort="recency"', 'By recency', sort === 'recency') +
          menuItem('set-context-sort', 'data-sort="size"', 'By size', sort === 'size'),
      )
    : '';
  const list = groups.map((group) => contextBlock(state, session, group.id)).join('');
  const adder = session.newContext
    ? `<div class="editor">
        <input id="context-name" value="${esc(session.contextName)}" placeholder="Context name" aria-label="Context name">
        <div class="btn-row">
          <button type="button" class="btn" data-action="create-context">Create</button>
          <button type="button" class="btn" data-action="cancel-context">Cancel</button>
        </div>
      </div>`
    : '';
  return `<section class="section">
    <button type="button" class="sec-head" data-action="toggle-section" data-section="contexts" aria-expanded="${open}">
      <span class="sec-title">Context</span><span class="vis-lock" title="Private">${icon('lock')}</span><span class="count">${groups.length}</span>
      ${icon(open ? 'expand_less' : 'expand_more')}
    </button>
    <div class="sec-body${open ? ' open' : ''}" ${open ? '' : 'inert'}>
      <div class="toolbar">
        <button type="button" class="icon-btn" data-action="add-context" title="New context" aria-label="New context">${icon('add')}</button>
        ${anchor(
          'context-sort',
          'contexts',
          `<button type="button" class="icon-btn" data-action="toggle-menu" data-menu="context-sort" data-id="contexts" title="Sort" aria-label="Sort">${icon('sort')}${icon('arrow_drop_down')}</button>`,
          menu,
        )}
      </div>
      ${adder}${list}
    </div>
  </section>`;
}

export function contextTaskModal(state: SidenoteState, session: Session): string {
  if (!session.contextTasksId) return '';
  const context = state.contexts.find((item) => item.id === session.contextTasksId && !item.deletedAt);
  if (!context) return '';
  const groups = taskGroups(state)
    .map((group) => {
      if (group.tasks.length === 0) return '';
      const rows = group.tasks
        .map((task) => {
          const checked = session.contextTaskChecks.includes(task.id) ? 'checked' : '';
          return `<label class="check-row">
            <input type="checkbox" data-context-task="${esc(task.id)}" ${checked}>
            <span>${esc(task.title)}</span>
          </label>`;
        })
        .join('');
      return `<div class="check-group"><div class="meta faint">${esc(group.name)}</div>${rows}</div>`;
    })
    .join('');
  return `<div class="modal-back" data-action="close-context-tasks">
    <div class="modal" data-action="stop" role="dialog" aria-label="Context tasks">
      <div class="modal-head"><span>${esc(context.name)}</span>
        <button type="button" class="icon-btn" data-action="close-context-tasks" title="Close" aria-label="Close">${icon('close')}</button>
      </div>
      <div class="modal-body">${groups || '<p class="empty">No tasks yet.</p>'}</div>
      <div class="btn-row modal-actions">
        <button type="button" class="btn" data-action="save-context-tasks">Save</button>
        <button type="button" class="btn" data-action="close-context-tasks">Cancel</button>
      </div>
    </div>
  </div>`;
}

function contextBlock(state: SidenoteState, session: Session, id: string): string {
  const group = contextGroups(state).find((item) => item.id === id);
  if (!group) return '';
  const open = state.ui.openContexts.includes(id);
  const items = group.items;
  const remove = group.context
    ? `<button type="button" class="icon-btn" data-action="delete-context" data-id="${esc(id)}" title="Remove" aria-label="Remove">${icon('close')}</button>`
    : '';
  const tune =
    group.context
      ? `<button type="button" class="icon-btn" data-action="open-context-tasks" data-id="${esc(id)}" title="Tasks" aria-label="Tasks">${icon('tune')}</button>`
      : '';
  const rows = open ? items.map((row) => excerptRow(state, session, row, 'line')).join('') : '';
  const color = group.context ? '#7fa3d6' : '#b3ada1';
  return `<div class="sub">
    <div class="context-head">
      <button type="button" class="context-name" data-action="toggle-context" data-id="${esc(id)}" aria-expanded="${open}">
        <span class="dot" style="background:${color}"></span>
        <span class="sub-name">${esc(group.name)}</span>
        <span class="count">${group.items.length}</span>
      </button>
      ${remove}
      ${tune}
      <button type="button" class="icon-btn" data-action="toggle-context" data-id="${esc(id)}" title="${open ? 'Collapse' : 'Expand'}" aria-label="${open ? 'Collapse' : 'Expand'}">${icon(open ? 'expand_less' : 'expand_more')}</button>
    </div>
    <div class="sub-body${open ? ' open' : ''}"><div class="context-items">${rows}</div></div>
  </div>`;
}
