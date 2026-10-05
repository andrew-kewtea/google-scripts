import type { SidenoteState } from '../shared/types.js';
import { icon, esc } from './format.js';
import type { Session } from './session.js';
import { aboutSection } from './views/about.js';
import { collectionsSection } from './views/collections.js';
import { contextsSection, contextTaskModal } from './views/contexts.js';
import { excerptModal, historySection } from './views/history.js';
import { notesSection } from './views/notes.js';
import { settingsSection } from './views/settings.js';
import { tasksSection } from './views/tasks.js';

export function renderPanel(state: SidenoteState, session: Session): string {
  const expanded = state.ui.expanded;
  const expandIcon = expanded ? 'chevron_left' : 'chevron_right';
  const expandLabel = expanded ? 'Collapse' : 'Expand';
  const second = expanded
    ? `<div class="col col-2">
        <div class="bar">
          <button type="button" data-action="close-second" title="Close this column" aria-label="Close this column">${icon('close')}</button>
        </div>
        ${collectionsSection(state, session)}
        ${contextsSection(state, session)}
        ${tasksSection(state, session)}
        ${settingsSection(state, session)}
      </div>`
    : '';
  return `<div class="panel">
    <div class="col">
      <div class="bar">
        <button type="button" data-action="toggle-expand" title="${expandLabel}" aria-label="${expandLabel}">${icon(expandIcon)}</button>
        <button type="button" data-action="close-panel" title="Close" aria-label="Close">${icon('close')}</button>
      </div>
      ${aboutSection(state, session)}
      ${notesSection(state, session)}
      ${historySection(state, session)}
    </div>
    <div class="col2-wrap${expanded ? ' open' : ''}">${second}</div>
    ${session.notice ? noticeBanner(session.notice) : ''}
    ${excerptModal(session)}
    ${contextTaskModal(state, session)}
  </div>`;
}

function noticeBanner(message: string): string {
  return `<div class="save-banner" role="status">
    <p>${esc(message)}</p>
    <button type="button" data-action="dismiss-notice" title="Dismiss" aria-label="Dismiss">${icon('close')}</button>
  </div>`;
}

export const SIDE_SHADE = 28;

export function panelWidth(expanded: boolean): number {
  return (expanded ? 881 : 360) + SIDE_SHADE;
}
