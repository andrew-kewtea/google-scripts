import type { SidenoteState } from '../../shared/types.js';
import { esc, formatWhen, icon, visIcon, visLabel, words } from '../format.js';
import { liveCollections, notesInCollection } from '../present.js';
import type { Session } from '../session.js';
import { anchor, menuBox, menuItem, menuOpen } from './menu.js';

export function collectionsSection(state: SidenoteState, session: Session): string {
  const open = state.ui.sections.collections;
  const rows = liveCollections(state);
  const shown = rows.slice(0, Math.max(state.settings.display.collections, state.ui.collectionsShown));
  const more = rows.length > shown.length;
  const sort = state.ui.collectionSort;
  const menu = menuOpen(session, 'col-sort', 'collections')
    ? menuBox(
        'col-sort',
        'collections',
        menuItem('set-col-sort', 'data-sort="recency"', 'By recency', sort === 'recency') +
          menuItem('set-col-sort', 'data-sort="size"', 'By size', sort === 'size'),
      )
    : '';
  const list = shown.map((collection) => collectionBlock(state, collection.id)).join('');
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
        ${anchor(
          'col-sort',
          'collections',
          `<button type="button" class="icon-btn" data-action="toggle-menu" data-menu="col-sort" data-id="collections" title="Sort" aria-label="Sort">${icon('sort')}${icon('arrow_drop_down')}</button>`,
          menu,
        )}
        <button type="button" class="icon-btn" data-action="add-collection" title="New collection" aria-label="New collection">${icon('add')}</button>
      </div>
      ${adder}${list}
      ${more ? `<button type="button" class="pill" data-action="show-more-collections">Show more</button>` : ''}
    </div>
  </section>`;
}

function collectionBlock(state: SidenoteState, id: string): string {
  const collection = state.collections.find((item) => item.id === id);
  if (!collection || collection.deletedAt) return '';
  const open = state.ui.openCollections.includes(id);
  const count = state.notes.filter((note) => !note.deletedAt && note.collectionId === id).length;
  const entries = notesInCollection(state, id)
    .map((note) => {
      const page = state.pages.find((item) => item.id === note.pageId);
      const text = words(note.text, 20);
      return `<div class="entry">
        <div class="meta"><span>${esc(formatWhen(note.updatedAt, state.settings.timeZone))}</span>
          <span class="ellipsis">${esc(page?.url ?? '')}</span></div>
        <div class="entry-text" title="${esc(note.text)}">${esc(text)}</div>
      </div>`;
    })
    .join('');
  return `<div class="sub">
    <button type="button" class="sub-head" data-action="toggle-collection" data-id="${esc(id)}" aria-expanded="${open}">
      <span class="dot" style="background:#c9a35a"></span>
      <span class="sub-name">${esc(collection.name)}</span>
      <span class="count">${count}</span>
      <span class="vis" title="${esc(visLabel(collection.visibility, state.groups))}">${icon(visIcon(collection.visibility))}</span>
      <span class="muted">${esc(formatWhen(collection.updatedAt, state.settings.timeZone))}</span>
      ${icon(open ? 'expand_less' : 'expand_more')}
    </button>
    <div class="sub-body${open ? ' open' : ''}"><div>${entries}</div></div>
  </div>`;
}
