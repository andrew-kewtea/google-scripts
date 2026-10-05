import type { HistoryFilter, PageExcerpt, PageRecord, SidenoteState, UserAction } from './types.js';
import { pageKey as canonicalPageKey, samePage } from './urlKey.js';

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export function scopeKey(url: string): string {
  return canonicalPageKey(url);
}

export function pageKey(url: string, _ignoreQuery = true): string {
  return canonicalPageKey(url);
}

export function matchPage(state: SidenoteState, url: string): PageRecord | undefined {
  const rules = state.urlRules ?? [];
  if (!pageKey(url)) return undefined;
  return state.pages.find((page) => samePage(url, page.url, page.patterns, rules));
}

export function acceptsAction(action: UserAction, filter: HistoryFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'highlights') return action === 'highlight';
  return action === filter;
}

export function filterExcerpts(state: SidenoteState, pageId: string | undefined, filter: HistoryFilter): PageExcerpt[] {
  return state.excerpts.filter(
    (row) => !row.deletedAt && row.scope.pageId === pageId && acceptsAction(row.userAction, filter),
  );
}
