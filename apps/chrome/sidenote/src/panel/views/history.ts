import { filterExcerpts, hostOf, matchPage } from '../../shared/scope.js';
import type { HistoryFilter, PageExcerpt, SidenoteState, UserAction } from '../../shared/types.js';
import { clipText, esc, formatDay, formatWhen, icon, rowActs } from '../format.js';
import { ENTRY_ACTIONS, actionIcon, actionLabel, filterIcon, liveExcerpts } from '../present.js';
import type { Session } from '../session.js';
import { anchor, menuBox, menuItem, menuOpen } from './menu.js';

const FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'read', label: 'Read' },
  { id: 'play', label: 'Play' },
  { id: 'link', label: 'Links' },
  { id: 'form', label: 'Type & select' },
  { id: 'highlights', label: 'Highlights' },
];

export function historySection(state: SidenoteState, session: Session): string {
  const open = state.ui.sections.history;
  const page = session.url ? matchPage(state, session.url) : undefined;
  const all = page ? filterExcerpts(state, page.id, 'all') : [];
  const filtered = page ? filterExcerpts(state, page.id, state.ui.historyFilter) : [];
  const { items, more } = liveExcerpts(filtered, state.ui.historyShown);
  const filter = state.ui.historyFilter;
  const menu = menuOpen(session, 'history-filter', 'history')
    ? menuBox(
        'history-filter',
        'history',
        FILTERS.map((item) => {
          const count = item.id === 'all' ? all.length : page ? filterExcerpts(state, page.id, item.id).length : 0;
          return menuItem(
            'set-history-filter',
            `data-filter="${item.id}"`,
            `${item.label}  ${count}`,
            filter === item.id,
          );
        }).join(''),
      )
    : '';
  const rows = items.map((row) => excerptRow(state, session, row, 'band')).join('');
  const draft = session.historyDraft ? historyDraft(state, session) : '';
  const empty = items.length === 0 && !session.historyDraft ? `<p class="empty">No history for this page.</p>` : '';
  const moreBtn = more ? `<button type="button" class="pill" data-action="show-more-history">Show more</button>` : '';
  return `<section class="section">
    <button type="button" class="sec-head" data-action="toggle-section" data-section="history" aria-expanded="${open}">
      <span class="sec-title">History</span><span class="count">${filtered.length}</span>
      <span class="rec" title="Recording"></span>
      ${icon(open ? 'expand_less' : 'expand_more')}
    </button>
    <div class="sec-body${open ? ' open' : ''}" ${open ? '' : 'inert'}>
      <div class="toolbar">
        <button type="button" class="icon-btn" data-action="add-history" title="Add history" aria-label="Add history">${icon('add')}</button>
        ${anchor(
          'history-filter',
          'history',
          `<button type="button" class="icon-btn${filter === 'all' ? '' : ' on'}" data-action="toggle-menu" data-menu="history-filter" data-id="history" title="Filter" aria-label="Filter">${icon(filterIcon(filter))}${icon('arrow_drop_down')}</button>`,
          menu,
        )}
      </div>
      ${draft}${rows}${empty}${moreBtn}
    </div>
  </section>`;
}

export function excerptModal(session: Session): string {
  if (!session.excerptModalId) return '';
  return `<div class="modal-back" data-action="close-excerpt">
    <div class="modal" data-action="stop" role="dialog" aria-label="History content">
      <div class="modal-head"><span>Content</span>
        <button type="button" class="icon-btn" data-action="close-excerpt" title="Close" aria-label="Close">${icon('close')}</button>
      </div>
      <div class="modal-body">
        <textarea id="excerpt-modal-text" placeholder="Content">${esc(session.excerptModalText)}</textarea>
      </div>
      <div class="btn-row modal-actions">
        <button type="button" class="btn" data-action="save-excerpt-modal">Save</button>
        <button type="button" class="btn" data-action="close-excerpt">Cancel</button>
      </div>
    </div>
  </div>`;
}

export function excerptRow(state: SidenoteState, session: Session, row: PageExcerpt, layout: 'band' | 'line'): string {
  const editing = session.excerptEditing && session.selectedExcerptId === row.id;
  if (editing) return excerptEditor(state, session, row);
  return layout === 'line' ? excerptLine(state, row) : excerptView(state, row);
}

function historyDraft(state: SidenoteState, session: Session): string {
  return `<article class="note">
    <div class="meta"><span>New</span><span class="vis-lock" title="Private">${icon('lock')}</span></div>
    <div class="band-line">
      <input id="history-text" value="${esc(session.historyText)}" placeholder="Add to this page’s history…">
      ${typeSelect(session.historyType)}
      ${dotButton('draft', Boolean(session.historyExcerpt.trim()))}
    </div>
    <div class="edit-line">
      ${contextSelect(state, 'history-context', session.historyContextId)}
      ${tagControls(state, session.historyTagIds, 'history')}
    </div>
    <div class="btn-row">
      <button type="button" class="btn" data-action="save-history">Save</button>
      <button type="button" class="btn" data-action="cancel-history">Cancel</button>
    </div>
  </article>`;
}

function excerptEditor(state: SidenoteState, session: Session, row: PageExcerpt): string {
  const filled = Boolean(row.excerpt?.trim() || (session.excerptModalId === row.id && session.excerptModalText.trim()));
  return `<article class="note">
    <div class="meta"><span>${esc(formatWhen(row.updatedAt, state.settings.timeZone))}</span><span class="vis-lock" title="Private">${icon('lock')}</span></div>
    <div class="band-line">
      <input id="history-edit-text" value="${esc(session.historyEditText)}" aria-label="Summary">
      <span class="trail" title="${esc(actionLabel(row.userAction))}">${icon(actionIcon(row.userAction))}</span>
      ${dotButton(row.id, filled)}
    </div>
    <div class="edit-line">
      ${contextSelect(state, 'history-edit-context', session.historyEditContextId)}
      ${tagControls(state, session.historyEditTagIds, 'edit')}
    </div>
    <div class="btn-row">
      <button type="button" class="btn" data-action="save-history-edit" data-id="${esc(row.id)}">Save</button>
      <button type="button" class="btn" data-action="cancel-history-edit">Cancel</button>
      <button type="button" class="btn danger" data-action="delete-excerpt" data-id="${esc(row.id)}">Delete</button>
    </div>
  </article>`;
}

function dotButton(id: string, filled: boolean): string {
  return `<button type="button" class="excerpt-dot${filled ? ' on' : ''}" data-action="open-excerpt" data-id="${esc(id)}" title="Content" aria-label="Content"></button>`;
}

function typeSelect(current: UserAction): string {
  const options = ENTRY_ACTIONS.map(
    (action) => `<option value="${action}" ${action === current ? 'selected' : ''}>${esc(actionLabel(action))}</option>`,
  ).join('');
  return `<select id="history-type" aria-label="Type">${options}</select>`;
}

function contextSelect(state: SidenoteState, id: string, current: string): string {
  const contexts = state.contexts.filter((context) => !context.deletedAt);
  const options = [
    `<option value="" ${current ? '' : 'selected'}>Uncategorized</option>`,
    ...contexts.map(
      (context) =>
        `<option value="${esc(context.id)}" ${context.id === current ? 'selected' : ''}>${esc(context.name)}</option>`,
    ),
  ].join('');
  return `<select id="${id}" aria-label="Context">${options}</select>`;
}

function tagControls(state: SidenoteState, selected: string[], scope: 'history' | 'edit'): string {
  const tags = state.tags.filter((tag) => !tag.deletedAt);
  const chips = selected
    .map((id) => tags.find((tag) => tag.id === id))
    .filter((tag) => tag)
    .map(
      (tag) =>
        `<span class="chip chip-dark">#${esc(tag!.name)}<button type="button" data-action="remove-history-tag" data-scope="${scope}" data-tag="${esc(tag!.id)}" aria-label="Remove ${esc(tag!.name)}">${icon('close')}</button></span>`,
    )
    .join('');
  const options = tags
    .filter((tag) => !selected.includes(tag.id))
    .map((tag) => `<option value="${esc(tag.id)}">#${esc(tag.name)}</option>`)
    .join('');
  return `<select id="${scope}-tag" aria-label="Add tag"><option value="">Add tag</option>${options}</select>${chips}`;
}

function excerptView(state: SidenoteState, row: PageExcerpt): string {
  const context = state.contexts.find((item) => item.id === row.contextId && !item.deletedAt);
  const tags = row.tagIds
    .map((id) => state.tags.find((tag) => tag.id === id && !tag.deletedAt))
    .filter((tag) => tag)
    .map((tag) => ` #${esc(tag!.name)}`)
    .join('');
  return `<article class="note" data-action="edit-history" data-id="${esc(row.id)}">
    <div class="meta"><span>${esc(formatWhen(row.updatedAt, state.settings.timeZone))}</span></div>
    <div class="band-line">
      <span class="note-text summary-line">${esc(row.text)}</span>
      <span class="trail" title="${esc(actionLabel(row.userAction))}">${icon(actionIcon(row.userAction))}</span>
      ${dotButton(row.id, Boolean(row.excerpt?.trim()))}
    </div>
    <div class="meta faint">${esc(context?.name ?? 'Uncategorized')}${tags}</div>
  </article>`;
}

function excerptLine(state: SidenoteState, row: PageExcerpt): string {
  const page = state.pages.find((item) => item.id === row.scope.pageId);
  const domain = page ? hostOf(page.url) : hostOf(row.scope.url);
  const url = page?.url || row.scope.url;
  return `<div class="line-row">
    <span class="line-ico" title="${esc(actionLabel(row.userAction))}">${icon(actionIcon(row.userAction))}</span>
    <span class="line-title"><span class="clip">${esc(clipText(row.text, 20))}</span>${dotButton(row.id, Boolean(row.excerpt?.trim()))}${rowActs(row.id, 'edit-history', url)}</span>
    <span class="ellipsis">${esc(domain)}</span>
    <span class="muted">${esc(formatDay(row.updatedAt || row.createdAt, state.settings.timeZone))}</span>
  </div>`;
}
