import { filterExcerpts, matchPage } from '../../shared/scope.js';
import type { HistoryFilter, PageExcerpt, SidenoteState } from '../../shared/types.js';
import { esc, formatWhen, icon } from '../format.js';
import { actionIcon, filterIcon, liveExcerpts } from '../present.js';
import type { Session } from '../session.js';
import { anchor, menuBox, menuItem, menuOpen } from './menu.js';

const FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'read', label: 'Read' },
  { id: 'link', label: 'Links' },
  { id: 'form', label: 'Inputs' },
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
  const rows = items.map((row) => excerptRow(state, session, row)).join('');
  const empty = items.length === 0 ? `<p class="empty">No history for this page.</p>` : '';
  const moreBtn = more ? `<button type="button" class="pill" data-action="show-more-history">Show more</button>` : '';
  return `<section class="section">
    <button type="button" class="sec-head" data-action="toggle-section" data-section="history" aria-expanded="${open}">
      <span class="sec-title">History</span><span class="count">${filtered.length}</span>
      <span class="rec" title="Recording"></span>
      ${icon(open ? 'expand_less' : 'expand_more')}
    </button>
    <div class="sec-body${open ? ' open' : ''}" ${open ? '' : 'inert'}>
      <div class="toolbar">
        ${anchor(
          'history-filter',
          'history',
          `<button type="button" class="icon-btn${filter === 'all' ? '' : ' on'}" data-action="toggle-menu" data-menu="history-filter" data-id="history" title="Filter" aria-label="Filter">${icon(filterIcon(filter))}${icon('arrow_drop_down')}</button>`,
          menu,
        )}
      </div>
      ${rows}${empty}${moreBtn}
    </div>
  </section>`;
}

function excerptRow(state: SidenoteState, session: Session, row: PageExcerpt): string {
  const selected = session.selectedExcerptId === row.id;
  const editing = selected && session.excerptEditing;
  const body = editing
    ? `<textarea id="excerpt-text">${esc(session.excerptText)}</textarea>
       <div class="btn-row">
         <button type="button" class="btn" data-action="save-excerpt" data-id="${esc(row.id)}">Save</button>
         <button type="button" class="btn" data-action="cancel-excerpt">Cancel</button>
       </div>`
    : `<div class="excerpt-text">${esc(row.text)}</div>
       <div class="meta faint">${esc(row.excerpt ?? '')}</div>`;
  const tools =
    selected && !editing
      ? `<div class="row-tools">
          <button type="button" class="icon-btn" data-action="edit-excerpt" data-id="${esc(row.id)}" title="Edit" aria-label="Edit">${icon('tune')}</button>
          <button type="button" class="icon-btn" data-action="delete-excerpt" data-id="${esc(row.id)}" title="Delete" aria-label="Delete">${icon('close')}</button>
        </div>`
      : '';
  return `<article class="hist${selected ? ' selected' : ''}" data-action="select-excerpt" data-id="${esc(row.id)}">
    <div class="hist-icon">${icon(actionIcon(row.userAction))}</div>
    <div class="hist-main">${body}</div>
    <div class="hist-side">
      <span class="muted">${esc(formatWhen(row.createdAt, state.settings.timeZone))}</span>
      ${tools}
    </div>
  </article>`;
}
