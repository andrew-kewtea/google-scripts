import { hostOf } from '../../shared/scope.js';
import type { SidenoteState } from '../../shared/types.js';
import { clipText, esc, formatDay, icon, rowActs, visIcon } from '../format.js';
import { listWindow, liveCollections, notesInCollection } from '../present.js';
import type { Session } from '../session.js';
import { anchor, menuBox, menuItem, menuOpen } from './menu.js';
import { noteArticle } from './notes.js';

export function collectionsSection(state: SidenoteState, session: Session): string {
  const open = state.ui.sections.collections;
  const rows = liveCollections(state);
  const window = listWindow(rows.length, state.ui.collectionsShown, state.settings.display.collections);
  const shown = rows.slice(0, window.count);
  const sort = state.ui.collectionSort;
  const menu = menuOpen(session, 'col-sort', 'collections')
    ? menuBox(
        'col-sort',
        'collections',
        menuItem('set-col-sort', 'data-sort="recency"', 'By recency', sort === 'recency') +
          menuItem('set-col-sort', 'data-sort="size"', 'By size', sort === 'size'),
      )
    : '';
  const list = shown.map((collection) => collectionBlock(state, session, collection.id)).join('');
  const adder = session.newCollection
    ? `<input id="collection-name" value="${esc(session.collectionName)}" placeholder="Collection name · Enter">`
    : '';
  return `<section class="section">
    <button type="button" class="sec-head" data-action="toggle-section" data-section="collections" aria-expanded="${open}">
      <span class="sec-title">Collections</span><span class="count">${rows.length}</span>
      ${icon(open ? 'expand_less' : 'expand_more')}
    </button>
    <div class="sec-body${open ? ' open' : ''}" ${open ? '' : 'inert'}>
      <div class="toolbar">
        <button type="button" class="icon-btn" data-action="add-collection" title="New collection" aria-label="New collection">${icon('add')}</button>
        ${anchor(
          'col-sort',
          'collections',
          `<button type="button" class="icon-btn" data-action="toggle-menu" data-menu="col-sort" data-id="collections" title="Sort" aria-label="Sort">${icon('sort')}${icon('arrow_drop_down')}</button>`,
          menu,
        )}
      </div>
      ${adder}${list}
      ${window.more ? `<button type="button" class="pill" data-action="show-more-collections">Show more</button>` : ''}
    </div>
  </section>`;
}

function collectionBlock(state: SidenoteState, session: Session, id: string): string {
  const collection = state.collections.find((item) => item.id === id);
  if (!collection || collection.deletedAt) return '';
  const open = state.ui.openCollections.includes(id);
  const notes = notesInCollection(state, id);
  const window = listWindow(notes.length, state.ui.collectionItemsShown[id], state.settings.display.notesPerCollection);
  const entries = notes
    .slice(0, window.count)
    .map((note) => {
      if (session.noteKey === note.id) return noteArticle(state, session, note);
      const page = state.pages.find((item) => item.id === note.pageId);
      return `<div class="line-row">
        <span class="line-ico">${icon(visIcon(note.visibility))}</span>
        <span class="line-title"><span class="clip" title="${esc(note.text)}">${esc(clipText(note.text, 30))}</span>${rowActs(note.id, 'edit-note', page?.url ?? '')}</span>
        <span class="ellipsis">${esc(page ? hostOf(page.url) : '')}</span>
        <span class="muted">${esc(formatDay(note.updatedAt || note.createdAt, state.settings.timeZone))}</span>
      </div>`;
    })
    .join('');
  const more =
    open && window.more
      ? `<button type="button" class="pill" data-action="show-more-collection-items" data-id="${esc(id)}">Show more</button>`
      : '';
  return `<div class="sub">
    <button type="button" class="sub-head" data-action="toggle-collection" data-id="${esc(id)}" aria-expanded="${open}">
      <span class="dot" style="background:#c9a35a"></span>
      <span class="sub-name">${esc(collection.name)}</span>
      <span class="count">${notes.length}</span>
      ${icon(open ? 'expand_less' : 'expand_more')}
    </button>
    <div class="sub-body${open ? ' open' : ''}"><div>${open ? entries : ''}${more}</div></div>
  </div>`;
}
