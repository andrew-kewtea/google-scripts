import { apiUrl } from './api.js';

export function suggestPath(query: string): string {
  const params = new URLSearchParams({ q: query, recent: '5', search_limit: '20' });
  return `/tags/suggest?${params.toString()}`;
}

export function suggestUrl(query: string): string {
  return apiUrl(suggestPath(query));
}

export type TagChoice = { id: string; name: string };

export function tagChoices(local: TagChoice[], remote: TagChoice[], signedIn: boolean): TagChoice[] {
  if (!signedIn) return local;
  const seen = new Set(local.map((tag) => tag.id));
  return [...local, ...remote.filter((tag) => !seen.has(tag.id))];
}

export function tagSelectOptions(local: TagChoice[], remote: TagChoice[], selected: string[], signedIn: boolean): TagChoice[] {
  return tagChoices(local, remote, signedIn).filter((tag) => !selected.includes(tag.id));
}
