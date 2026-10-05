import { matchPage } from '../../shared/scope.js';
import type { Note, SidenoteState, Visibility } from '../../shared/types.js';
import { esc, formatWhen, icon, visIcon, visLabel } from '../format.js';
import { liveNotes } from '../present.js';
import type { Session } from '../session.js';
import { anchor, menuBox, menuItem, menuOpen } from './menu.js';

export function notesSection(state: SidenoteState, session: Session): string {
  const open = state.ui.sections.notes;
  const page = session.url ? matchPage(state, session.url) : undefined;
  const notes = liveNotes(state, page?.id);
  const sortMenu = menuOpen(session, 'note-sort', 'notes')
    ? menuBox(
        'note-sort',
        'notes',
        menuItem('set-note-sort', 'data-sort="time"', 'By time', state.ui.noteSort === 'time') +
          menuItem('set-note-sort', 'data-sort="page"', 'By page order', state.ui.noteSort === 'page'),
      )
    : '';
  const toolbar = `<div class="toolbar">
    <button type="button" class="icon-btn" data-action="add-note" title="New note" aria-label="New note">${icon('add')}</button>
    ${anchor(
      'note-sort',
      'notes',
      `<button type="button" class="icon-btn" data-action="toggle-menu" data-menu="note-sort" data-id="notes" title="Sort" aria-label="Sort">${icon('sort')}${icon('arrow_drop_down')}</button>`,
      sortMenu,
    )}
  </div>`;
  const rows = notes.map((note) => noteArticle(state, session, note)).join('');
  const editingNew = session.noteKey === 'new' ? noteEditor(state, session) : '';
  const empty = notes.length === 0 && session.noteKey !== 'new' ? `<p class="empty">No notes yet.</p>` : '';
  return `<section class="section">
    <button type="button" class="sec-head" data-action="toggle-section" data-section="notes" aria-expanded="${open}">
      <span class="sec-title">Notes</span><span class="count">${notes.length}</span>
      ${icon(open ? 'expand_less' : 'expand_more')}
    </button>
    <div class="sec-body${open ? ' open' : ''}" ${open ? '' : 'inert'}>
      ${toolbar}${editingNew}${rows}${empty}
    </div>
  </section>`;
}

export function noteArticle(state: SidenoteState, session: Session, note: Note): string {
  if (session.noteKey === note.id) return noteEditor(state, session, note);
  const collection = state.collections.find((item) => item.id === note.collectionId && !item.deletedAt);
  const keywords = tagNames(state, note.tagIds);
  const menu = visibilityMenu(state, session, note.id, note.visibility);
  return `<article class="note" data-action="edit-note" data-id="${esc(note.id)}">
    <div class="meta">
      <span>${esc(formatWhen(note.updatedAt, state.settings.timeZone))}</span>
      ${menu}
    </div>
    <div class="note-text">${esc(note.text)}</div>
    <div class="meta faint">${esc(collection?.name ?? 'Uncategorized')}${keywords}</div>
  </article>`;
}

function noteEditor(state: SidenoteState, session: Session, note?: Note): string {
  const collections = state.collections.filter((item) => !item.deletedAt);
  const options = [
    `<option value="" ${session.noteCollectionId ? '' : 'selected'}>Uncategorized</option>`,
    ...collections.map(
      (item) =>
        `<option value="${esc(item.id)}" ${item.id === session.noteCollectionId ? 'selected' : ''}>${esc(item.name)}</option>`,
    ),
  ].join('');
  const tags = state.tags.filter((tag) => !tag.deletedAt);
  const chips = session.noteTagIds
    .map((id) => tags.find((tag) => tag.id === id))
    .filter((tag) => tag)
    .map(
      (tag) =>
        `<span class="chip chip-dark">#${esc(tag!.name)}<button type="button" data-action="remove-note-tag" data-tag="${esc(tag!.id)}" aria-label="Remove ${esc(tag!.name)}">${icon('close')}</button></span>`,
    )
    .join('');
  const tagOptions = tags
    .filter((tag) => !session.noteTagIds.includes(tag.id))
    .map((tag) => `<option value="${esc(tag.id)}">#${esc(tag.name)}</option>`)
    .join('');
  const menu = visibilityMenu(state, session, note?.id ?? 'new', session.noteVisibility);
  const when = note ? formatWhen(note.updatedAt, state.settings.timeZone) : 'New';
  return `<article class="note">
    <div class="meta"><span>${esc(when)}</span>${menu}</div>
    <textarea id="note-text" placeholder="Jot down on the side…">${esc(session.noteText)}</textarea>
    <div class="edit-line">
      <select id="note-collection" aria-label="Collection">${options}</select>
      <select id="note-tag" aria-label="Add tag"><option value="">Add tag</option>${tagOptions}</select>
      ${chips}
    </div>
    <div class="btn-row">
      <button type="button" class="btn" data-action="save-note">Save</button>
      <button type="button" class="btn" data-action="cancel-note">Cancel</button>
      ${note ? `<button type="button" class="btn danger" data-action="delete-note" data-id="${esc(note.id)}">Delete</button>` : ''}
    </div>
  </article>`;
}

function tagNames(state: SidenoteState, ids: string[]): string {
  return ids
    .map((id) => state.tags.find((tag) => tag.id === id && !tag.deletedAt))
    .filter((tag) => tag)
    .map((tag) => ` #${esc(tag!.name)}`)
    .join('');
}

function visibilityMenu(state: SidenoteState, session: Session, id: string, current: Visibility): string {
  const groups = state.groups.filter((group) => !group.deletedAt);
  const choices: Visibility[] = ['private', ...groups.map((group) => `group:${group.id}` as Visibility), 'public'];
  const open = menuOpen(session, 'note-vis', id);
  const items = choices
    .map((choice) =>
      menuItem(
        'set-note-vis',
        `data-id="${esc(id)}" data-vis="${esc(choice)}"`,
        visLabel(choice, groups),
        choice === current,
      ),
    )
    .join('');
  return anchor(
    'note-vis',
    id,
    `<button type="button" class="vis-btn" data-action="toggle-menu" data-menu="note-vis" data-id="${esc(id)}" title="${esc(visLabel(current, groups))}" aria-label="Visibility">${icon(visIcon(current))}${icon('arrow_drop_down')}</button>`,
    open ? menuBox('note-vis', id, items) : '',
  );
}
