import { tagSelectOptions } from '../../lib/tags.js';
import { buildPageTree, visibleTreeRows } from '../../shared/pageTree.js';
import { matchPage } from '../../shared/scope.js';
import type { SidenoteState } from '../../shared/types.js';
import { esc, icon, safeHref } from '../format.js';
import { noteCount } from '../present.js';
import type { Session } from '../session.js';

export function aboutSection(state: SidenoteState, session: Session): string {
  const open = state.ui.sections.about;
  const page = session.url ? matchPage(state, session.url) : undefined;
  const title = page?.title || session.title || 'This page';
  const url = page?.url || session.url;
  const names = session.aboutEditing
    ? []
    : (page?.tagIds ?? []).map((id) => state.tags.find((tag) => tag.id === id)?.name).filter((name): name is string => Boolean(name));
  const body = session.aboutEditing ? aboutEdit(state, session) : aboutView(title, url, names, session.signedIn);
  return `<section class="section">
    <button type="button" class="sec-head" data-action="toggle-section" data-section="about" aria-expanded="${open}">
      <span class="sec-title">About</span>
      ${icon(open ? 'expand_less' : 'expand_more')}
    </button>
    <div class="about-body${open ? ' open' : ''}" ${open ? '' : 'inert'}>
      ${body}
      ${pageTree(state, session)}
    </div>
  </section>
  ${session.patternsOpen ? patternModal(session) : ''}`;
}

function aboutView(title: string, url: string, tags: string[], signedIn: boolean): string {
  const chips = tags.map((tag) => `<span class="chip">#${esc(tag)}</span>`).join('');
  const refresh = signedIn
    ? `<button type="button" class="mini" data-action="refresh-cloud" title="Refresh" aria-label="Refresh">${icon('refresh')}</button>`
    : '';
  return `<div class="about-view" data-action="edit-about">
    <div class="about-title-row">
      <div class="about-title">${esc(title)}</div>
      ${refresh}
    </div>
    <div class="url-row">
      <span class="muted ellipsis">${esc(url || 'Open a page to take a note')}</span>
      <button type="button" class="mini" data-action="open-patterns" title="URL patterns" aria-label="URL patterns">${icon('tune')}</button>
    </div>
    ${chips ? `<div class="chips">${chips}</div>` : ''}
  </div>`;
}

function aboutEdit(state: SidenoteState, session: Session): string {
  const tags = state.tags.filter((tag) => !tag.deletedAt);
  const chips = session.aboutTags
    .map((id) => tags.find((tag) => tag.id === id) ?? session.tagSuggestions.find((tag) => tag.id === id))
    .filter((tag) => tag)
    .map(
      (tag) =>
        `<span class="chip chip-dark">#${esc(tag!.name)}<button type="button" data-action="remove-about-tag" data-tag="${esc(tag!.id)}" aria-label="Remove ${esc(tag!.name)}">${icon('close')}</button></span>`,
    )
    .join('');
  const options = tagSelectOptions(tags, session.tagSuggestions, session.aboutTags, session.signedIn)
    .map((tag) => `<option value="${esc(tag.id)}">#${esc(tag.name)}</option>`)
    .join('');
  const fresh = session.signedIn ? '<input id="about-new-tag" data-new-tag="about" placeholder="New tag" aria-label="New tag">' : '';
  return `<div class="editor">
    <input id="about-title" value="${esc(session.aboutTitle)}" aria-label="Page title">
    <div class="edit-line">
      <select id="about-tag" aria-label="Add tag"><option value="">Add tag</option>${options}</select>
      ${fresh}
      ${chips}
    </div>
    <div class="btn-row">
      <button type="button" class="btn" data-action="save-about">Save</button>
      <button type="button" class="btn" data-action="cancel-about">Cancel</button>
    </div>
  </div>`;
}

function pageTree(state: SidenoteState, session: Session): string {
  if (!session.url) return '';
  const root = buildPageTree(
    state.pages.map((page) => ({ url: page.url, notes: noteCount(state, page.id), title: page.title })),
    session.url,
    session.title,
  );
  if (!root) return '';
  const rows = visibleTreeRows(root, state.ui.treeOpen ?? [], session.url)
    .map((row) => {
      const chevron = row.hasChildren
        ? `<button type="button" class="tree-chev" data-action="toggle-tree" data-path="${esc(row.path)}" aria-label="${row.open ? 'Collapse' : 'Expand'}">${icon(row.open ? 'expand_more' : 'chevron_right')}</button>`
        : '<span class="tree-chev"></span>';
      return `<div class="tree-row${row.current ? ' here' : ''}" style="padding-left:${4 + row.depth * 16}px">
        ${chevron}
        <a href="${safeHref(row.href)}" target="_blank" rel="noopener" title="${esc(row.hint)}">${esc(row.label)}</a>
        ${row.count ? `<span class="muted">${row.count}</span>` : ''}
      </div>`;
    })
    .join('');
  return `<div class="tree">${rows}</div>`;
}

function patternModal(session: Session): string {
  const rows = session.patterns
    .map(
      (pattern, index) => `<div class="pattern-row">
        <input data-pattern-index="${index}" value="${esc(pattern)}" aria-label="URL pattern">
        <button type="button" data-action="remove-pattern" data-index="${index}" aria-label="Remove pattern">${icon('close')}</button>
      </div>`,
    )
    .join('');
  return `<div class="modal-back" data-action="close-patterns">
    <div class="modal" data-action="stop" role="dialog" aria-label="URL patterns">
      <div class="modal-head"><span>URL patterns ${session.patterns.length}</span>
        <button type="button" data-action="close-patterns" aria-label="Close">${icon('close')}</button>
      </div>
      <div class="modal-body">
        ${rows}
        <input id="pattern-input" class="dashed-add" value="${esc(session.patternInput)}" placeholder="Add pattern · Enter">
        <p class="hint">www, a trailing slash, ?query, and #hash already count as the same page. None = this page only.</p>
      </div>
      <div class="btn-row modal-actions">
        <button type="button" class="btn" data-action="save-patterns">Save</button>
        <button type="button" class="btn" data-action="close-patterns">Cancel</button>
      </div>
    </div>
  </div>`;
}
