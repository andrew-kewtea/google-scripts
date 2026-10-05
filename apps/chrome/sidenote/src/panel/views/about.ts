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
  const tags = session.aboutEditing ? session.aboutTags : (page?.tags ?? []);
  const body = session.aboutEditing ? aboutEdit(session, tags) : aboutView(title, url, tags, page?.id);
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

function aboutView(title: string, url: string, tags: string[], pageId: string | undefined): string {
  const chips = tags.map((tag) => `<span class="chip">#${esc(tag)}</span>`).join('');
  return `<div class="about-view" data-action="edit-about">
    <div class="about-title">${esc(title)}</div>
    <div class="url-row">
      <span class="muted ellipsis">${esc(url || 'Open a page to take a note')}</span>
      <button type="button" class="mini" data-action="open-patterns" title="URL patterns" aria-label="URL patterns" ${pageId ? '' : ''}>${icon('tune')}</button>
    </div>
    ${chips ? `<div class="chips">${chips}</div>` : ''}
  </div>`;
}

function aboutEdit(session: Session, tags: string[]): string {
  const chips = tags
    .map(
      (tag) =>
        `<span class="chip chip-dark">#${esc(tag)}<button type="button" data-action="remove-about-tag" data-tag="${esc(tag)}" aria-label="Remove ${esc(tag)}">${icon('close')}</button></span>`,
    )
    .join('');
  return `<div class="editor">
    <input id="about-title" value="${esc(session.aboutTitle)}" aria-label="Page title">
    <div class="chips">${chips}<input id="about-tag-input" value="${esc(session.tagInput)}" placeholder="Enter to add tag"></div>
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
        <label class="check"><input id="pattern-ignore" type="checkbox" ${session.ignoreQuery ? 'checked' : ''}> Ignore ?query and #hash</label>
        <p class="hint">None = this page only</p>
      </div>
      <div class="btn-row modal-actions">
        <button type="button" class="btn" data-action="save-patterns">Save</button>
        <button type="button" class="btn" data-action="close-patterns">Cancel</button>
      </div>
    </div>
  </div>`;
}
