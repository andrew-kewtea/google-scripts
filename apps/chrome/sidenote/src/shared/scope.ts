import type { HistoryFilter, PageExcerpt, PageRecord, SidenoteState, UserAction } from './types.js';

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export function scopeKey(url: string): string {
  return pageKey(url, true);
}

export function pageKey(url: string, ignoreQuery: boolean): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (!host) return '';
    const path = parsed.pathname.replace(/\/+$/, '');
    const base = host + (path ? path : '');
    if (ignoreQuery) return base;
    return base + parsed.search + parsed.hash;
  } catch {
    return '';
  }
}

export function matchPage(state: SidenoteState, url: string): PageRecord | undefined {
  return state.pages.find((page) => {
    const key = pageKey(url, page.ignoreQuery);
    return key !== '' && key === pageKey(page.url, page.ignoreQuery);
  });
}

export function acceptsAction(action: UserAction, filter: HistoryFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'highlights') return action === 'highlight';
  return action === filter;
}

export function filterExcerpts(state: SidenoteState, pageId: string, filter: HistoryFilter): PageExcerpt[] {
  return state.excerpts.filter(
    (row) => !row.deletedAt && row.scope.pageId === pageId && acceptsAction(row.userAction, filter),
  );
}
