import type { SidenoteState, Visibility } from '../../shared/types.js';
import { esc, formatBytes, icon, visIcon, visLabel } from '../format.js';
import { stateBytes, tagUsage } from '../dataService.js';
import type { Session } from '../session.js';
import { anchor, menuBox, menuItem, menuOpen } from './menu.js';

export function settingsSection(state: SidenoteState, session: Session): string {
  const open = state.ui.sections.settings;
  return `<section class="section">
    <button type="button" class="sec-head" data-action="toggle-section" data-section="settings" aria-expanded="${open}">
      <span class="sec-title">Settings</span>
      ${icon(open ? 'expand_less' : 'expand_more')}
    </button>
    <div class="sec-body${open ? ' open' : ''}" ${open ? '' : 'inert'}>
      ${generalBlock(state, session)}
      ${accountBlock(state, session)}
      ${tagsBlock(state, session)}
      ${groupsBlock(state, session)}
    </div>
    ${session.limitsOpen ? limitsModal(session) : ''}
  </section>`;
}

function sub(id: string, label: string, meta: string, toolbar: string, body: string, open: boolean): string {
  const tools = toolbar ? `<div class="toolbar">${toolbar}</div>` : '';
  return `<div class="sub">
    <div class="sub-head">
      <button type="button" class="sub-toggle" data-action="toggle-settings" data-id="${esc(id)}" aria-expanded="${open}">
        <span class="sub-name">${esc(label)}</span>
        ${meta}
        ${icon(open ? 'expand_less' : 'expand_more')}
      </button>
    </div>
    <div class="sub-body${open ? ' open' : ''}" ${open ? '' : 'inert'}><div>${tools}<div class="sub-pad">${body}</div></div></div>
  </div>`;
}

function generalBlock(state: SidenoteState, session: Session): string {
  const settings = state.settings;
  const open = state.ui.openSettings.includes('general');
  const body = `<label class="field">Language
      <select id="set-language" data-setting="language">
        ${opt('en', 'English', settings.language)}
        ${opt('ko', '한국어', settings.language)}
      </select>
    </label>
    <label class="field">Time zone
      <select id="set-tz" data-setting="timeZone">
        ${opt('Asia/Seoul', 'Asia/Seoul', settings.timeZone)}
        ${opt('UTC', 'UTC', settings.timeZone)}
        ${opt('America/New_York', 'America/New_York', settings.timeZone)}
        ${opt('Europe/London', 'Europe/London', settings.timeZone)}
      </select>
    </label>
    <label class="field">Theme
      <select id="set-theme" data-setting="theme">
        ${opt('system', 'System', settings.theme)}
        ${opt('light', 'Light', settings.theme)}
        ${opt('dark', 'Dark', settings.theme)}
      </select>
    </label>`;
  const tune = `<button type="button" class="mini" data-action="open-limits" title="Display limits" aria-label="Display limits">${icon('tune')}</button>`;
  return sub('general', 'General', '', tune, body, open);
}

function accountBlock(state: SidenoteState, session: Session): string {
  const open = state.ui.openSettings.includes('account');
  const meta = session.signedIn
    ? `<span class="count">${esc(session.authEmail || 'Signed in')}</span>`
    : '<span class="count">Local</span>';
  const body = session.signedIn ? accountSignedIn() : accountSignedOut(state, session);
  const sync = session.signedIn
    ? `<button type="button" class="icon-btn" data-action="refresh-cloud" title="Sync" aria-label="Sync">${icon('sync')}</button>`
    : '';
  return sub('account', 'Account', meta, sync, body, open);
}

function accountSignedIn(): string {
  return `<div class="account-form">
      <p class="hint">Changes on this device sync to your account. The cloud copy stays when you log out.</p>
      <button type="button" class="btn" data-action="logout">Log out</button>
    </div>`;
}

function accountSignedOut(state: SidenoteState, session: Session): string {
  const used = stateBytes(state);
  const ratio = Math.min(100, (used / (10 * 1024 * 1024)) * 100);
  if (session.accountView === 'reset') {
    return `<div class="account-form">
      <p class="hint">${esc(`If an account exists for ${session.accountEmail}, a password-reset link is on its way.`)}</p>
      <button type="button" class="btn" data-action="account-back">Got it</button>
    </div>`;
  }
  if (session.accountView === 'verify') {
    return `<div class="account-form">
      <p class="hint">Check your inbox for ${esc(session.accountEmail)} and open the verification link.</p>
      <button type="button" class="btn" data-action="account-back">Got it</button>
    </div>`;
  }
  const loginTab = session.accountTab === 'login';
  const form = loginTab ? loginFields(session) : signupFields(session);
  const error = session.accountError ? `<p class="account-error">${esc(session.accountError)}</p>` : '';
  return `<div class="usage"><div style="width:${ratio}%"></div></div>
    <div class="meta">This device <span>${esc(formatBytes(used))}</span></div>
    <div class="account-tabs">
      <button type="button" class="btn${loginTab ? '' : ' ghost'}" data-action="account-tab" data-tab="login">Log in</button>
      <button type="button" class="btn${loginTab ? ' ghost' : ''}" data-action="account-tab" data-tab="signup">Sign up</button>
    </div>
    <div class="account-form">
      ${form}
      ${error}
      <button type="button" class="btn google" data-action="login-google">${icon('login')} Continue with Google</button>
    </div>`;
}

function loginFields(session: Session): string {
  const type = session.showPassword ? 'text' : 'password';
  return `<input id="account-email" type="email" value="${esc(session.accountEmail)}" placeholder="Email" aria-label="Email" autocomplete="username">
    <input id="account-password" type="${type}" value="${esc(session.accountPassword)}" placeholder="Password" aria-label="Password" autocomplete="current-password">
    <div class="account-actions">
      <button type="button" class="btn" data-action="login">Log in</button>
      <button type="button" class="text-link" data-action="toggle-password">${session.showPassword ? 'Hide' : 'Show'}</button>
      <button type="button" class="text-link" data-action="forgot-password">Forgot password?</button>
    </div>`;
}

function signupFields(session: Session): string {
  const type = session.showPassword ? 'text' : 'password';
  return `<input id="account-name" value="${esc(session.accountName)}" placeholder="Name" aria-label="Name" autocomplete="name">
    <input id="account-email" type="email" value="${esc(session.accountEmail)}" placeholder="Email" aria-label="Email" autocomplete="username">
    <input id="account-password" type="${type}" value="${esc(session.accountPassword)}" placeholder="At least 8 characters" aria-label="Password" autocomplete="new-password">
    <input id="account-password2" type="${type}" value="${esc(session.accountPassword2)}" placeholder="Re-enter your password" aria-label="Confirm password" autocomplete="new-password">
    <label class="check"><input id="account-eula" type="checkbox" ${session.agreeEula ? 'checked' : ''}> I agree to the End User License Agreement and Privacy Policy.</label>
    <div class="account-actions">
      <button type="button" class="btn" data-action="signup">Create account</button>
      <button type="button" class="text-link" data-action="toggle-password">${session.showPassword ? 'Hide' : 'Show'}</button>
    </div>`;
}

function tagsBlock(state: SidenoteState, session: Session): string {
  const tags = state.tags.filter((tag) => !tag.deletedAt);
  const open = state.ui.openSettings.includes('tags');
  const rows = tags
    .map((tag) => {
      const count = tagUsage(state, tag.id);
      const locked = count > 0;
      return `<div class="set-row">
        <span>#${esc(tag.name)}</span>
        <span class="muted">${count}</span>
        ${tagVisibility(state, session, tag.id, tag.visibility)}
        <button type="button" class="icon-btn row-x" data-action="delete-tag" data-id="${esc(tag.id)}" title="${locked ? 'Tag is in use' : 'Delete'}" aria-label="Delete" ${locked ? 'disabled' : ''}>${icon('close')}</button>
      </div>`;
    })
    .join('');
  const adder = session.newTag
    ? `<div class="set-add">
        <input id="tag-name" value="${esc(session.tagName)}" placeholder="Tag name">
        <button type="button" class="btn" data-action="save-tag">Save</button>
        <button type="button" class="btn" data-action="cancel-tag">Cancel</button>
      </div>`
    : '';
  const plus = `<button type="button" class="icon-btn" data-action="add-tag" title="New tag" aria-label="New tag">${icon('add')}</button>`;
  return sub('tags', 'Tags', `<span class="count">${tags.length}</span>`, plus, `${adder}${rows}`, open);
}

function groupsBlock(state: SidenoteState, session: Session): string {
  const groups = state.groups.filter((group) => !group.deletedAt);
  const open = state.ui.openSettings.includes('groups');
  const full = groups.length >= 3;
  const rows = groups
    .map((group) => {
      const count = state.notes.filter((note) => !note.deletedAt && note.visibility === `group:${group.id}`).length;
      return `<div class="set-row">
        <span>${esc(group.name)}</span>
        <span class="muted">${count}</span>
        <span class="muted">@${esc(group.handle)}</span>
        <label class="check"><input type="checkbox" data-group-read="${esc(group.id)}" ${group.readAccess ? 'checked' : ''}> read</label>
        <select data-group-status="${esc(group.id)}" aria-label="Status">
          ${opt('active', 'active', group.status)}
          ${opt('inactive', 'inactive', group.status)}
          ${opt('archived', 'archived', group.status)}
        </select>
        <button type="button" class="icon-btn row-x" title="Delete is not available yet" aria-label="Delete" disabled>${icon('close')}</button>
      </div>`;
    })
    .join('');
  const adder = session.newGroup
    ? `<div class="set-add">
        <input id="group-name" value="${esc(session.groupName)}" placeholder="Group name">
        <button type="button" class="btn" data-action="save-group">Save</button>
        <button type="button" class="btn" data-action="cancel-group">Cancel</button>
      </div>`
    : '';
  const plus = `<button type="button" class="icon-btn" data-action="add-group" title="New group" aria-label="New group" ${full ? 'disabled' : ''}>${icon('add')}</button>`;
  return sub('groups', 'User groups', `<span class="count">${groups.length} / 3</span>`, plus, `${adder}${rows}`, open);
}

function tagVisibility(state: SidenoteState, session: Session, id: string, current: Visibility): string {
  const groups = state.groups.filter((group) => !group.deletedAt);
  const choices: Visibility[] = ['private', ...groups.map((group) => `group:${group.id}` as Visibility), 'public'];
  const open = menuOpen(session, 'tag-vis', id);
  const items = choices
    .map((choice) =>
      menuItem('set-tag-vis', `data-id="${esc(id)}" data-vis="${esc(choice)}"`, visLabel(choice, groups), choice === current),
    )
    .join('');
  return anchor(
    'tag-vis',
    id,
    `<button type="button" class="vis-btn" data-action="toggle-menu" data-menu="tag-vis" data-id="${esc(id)}" title="${esc(visLabel(current, groups))}" aria-label="Visibility">${icon(visIcon(current))}${icon('arrow_drop_down')}</button>`,
    open ? menuBox('tag-vis', id, items) : '',
  );
}

function limitsModal(session: Session): string {
  return `<div class="modal-back" data-action="close-limits">
    <div class="modal modal-limits" data-action="stop" role="dialog" aria-label="Display limits">
      <div class="modal-head"><span>Display limits</span>
        <button type="button" data-action="close-limits" aria-label="Close">${icon('close')}</button>
      </div>
      <div class="modal-body">
        ${limitField('limits-collections', 'Collections shown max', session.limitsCollections)}
        ${limitField('limits-notes', 'Notes per collection max', session.limitsNotes)}
        ${limitField('limits-contexts', 'Contexts shown max', session.limitsContexts)}
        ${limitField('limits-history', 'History per context max', session.limitsHistory)}
        ${limitField('limits-projects', 'Projects shown max', session.limitsProjects)}
        ${limitField('limits-tasks', 'Tasks per project max', session.limitsTasks)}
      </div>
      <div class="btn-row modal-actions">
        <button type="button" class="btn" data-action="save-limits">Save</button>
        <button type="button" class="btn" data-action="close-limits">Cancel</button>
      </div>
    </div>
  </div>`;
}

function limitField(id: string, label: string, value: number): string {
  return `<label class="field">${esc(label)}
    <input id="${id}" type="number" min="1" max="50" value="${value}">
  </label>`;
}

function opt(value: string, label: string, current: string): string {
  return `<option value="${esc(value)}" ${value === current ? 'selected' : ''}>${esc(label)}</option>`;
}
