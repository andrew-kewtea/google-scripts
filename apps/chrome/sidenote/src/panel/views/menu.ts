import { esc, icon } from '../format.js';
import type { Session } from '../session.js';

export function menuOpen(session: Session, kind: string, id: string): boolean {
  return session.menu?.kind === kind && session.menu.id === id;
}

export function menuBox(kind: string, id: string, items: string): string {
  return `<div class="menu" data-menu-root="${esc(kind)}:${esc(id)}" role="menu">${items}</div>`;
}

export function menuItem(action: string, attrs: string, label: string, checked: boolean): string {
  return `<button type="button" class="menu-item" data-action="${esc(action)}" ${attrs} role="menuitem">
    <span>${esc(label)}</span>${checked ? icon('check') : ''}
  </button>`;
}

export function anchor(kind: string, id: string, trigger: string, menu: string): string {
  return `<div class="menu-anchor" data-menu-root="${esc(kind)}:${esc(id)}">${trigger}${menu}</div>`;
}
