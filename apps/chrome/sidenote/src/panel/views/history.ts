import { filterExcerpts, matchPage } from '../../shared/scope.js';
import type { HistoryFilter, PageExcerpt, SidenoteState } from '../../shared/types.js';
import { esc, formatWhen, icon } from '../format.js';
import { actionIcon, filterIcon, liveExcerpts, recentExcerpts } from '../present.js';
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
  const rows = items.map((row) => excerptRow(state, session, row, 'page')).join('');
  const draft = session.historyDraft ? historyDraft(session) : '';
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

export function globalHistorySection(state: SidenoteState, session: Session): string {
  const open = Boolean(state.ui.sections.globalHistory);
  const items = recentExcerpts(state);
  const rows = items.map((row) => excerptRow(state, session, row, 'global')).join('');
  const empty = items.length === 0 ? `<p class="empty">No history yet.</p>` : '';
  return `<section class="section">
    <button type="button" class="sec-head" data-action="toggle-section" data-section="globalHistory" aria-expanded="${open}">
      <span class="sec-title">History</span><span class="count">${items.length}</span>
      ${icon(open ? 'expand_less' : 'expand_more')}
    </button>
    <div class="sec-body${open ? ' open' : ''}" ${open ? '' : 'inert'}>
      ${rows}${empty}
    </div>
  </section>`;
}

function historyDraft(session: Session): string {
  return `<article class="hist hist-draft">
    <div class="hist-icon">${icon('edit_note')}</div>
    <div class="hist-main">
      <textarea id="history-text" placeholder="Add to this page’s history…">${esc(session.historyText)}</textarea>
      <div class="btn-row">
        <button type="button" class="btn" data-action="save-history">Save</button>
        <button type="button" class="btn" data-action="cancel-history">Cancel</button>
      </div>
    </div>
  </article>`;
}

function excerptRow(state: SidenoteState, session: Session, row: PageExcerpt, scope: 'page' | 'global'): string {
  const selected = scope === 'page' && session.selectedExcerptId === row.id;
  const editing = selected && session.excerptEditing;
  const page = state.pages.find((item) => item.id === row.scope.pageId);
  const where = scope === 'global' ? `<div class="meta faint ellipsis">${esc(page?.title || row.scope.url)}</div>` : '';
  const quote = scope === 'page' && row.excerpt ? `<div class="meta faint">${esc(row.excerpt)}</div>` : '';
  const body = editing
    ? `<textarea id="excerpt-text">${esc(session.excerptText)}</textarea>
       <div class="btn-row">
         <button type="button" class="btn" data-action="save-excerpt" data-id="${esc(row.id)}">Save</button>
         <button type="button" class="btn" data-action="cancel-excerpt">Cancel</button>
       </div>`
    : `<div class="excerpt-text">${esc(row.text)}</div>${where}${quote}`;
  const edit =
    selected && !editing
      ? `<button type="button" class="icon-btn" data-action="edit-excerpt" data-id="${esc(row.id)}" title="Edit" aria-label="Edit">${icon('tune')}</button>`
      : '';
  const select = scope === 'page' ? ` data-action="select-excerpt" data-id="${esc(row.id)}"` : '';
  return `<article class="hist${selected ? ' selected' : ''}${scope === 'global' ? ' hist-plain' : ''}"${select}>
    <div class="hist-icon">${icon(actionIcon(row.userAction))}</div>
    <div class="hist-main">${body}</div>
    <div class="hist-side">
      <span class="muted">${esc(formatWhen(row.createdAt, state.settings.timeZone))}</span>
      <div class="row-tools">
        ${edit}
        <button type="button" class="icon-btn" data-action="delete-excerpt" data-id="${esc(row.id)}" title="Delete" aria-label="Delete">${icon('close')}</button>
      </div>
    </div>
  </article>`;
}
