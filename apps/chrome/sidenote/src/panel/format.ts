import type { UserGroup, Visibility } from '../shared/types.js';

export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

export function icon(name: string): string {
  if (name === 'play_arrow') return '<span class="play-mark" aria-hidden="true"></span>';
  if (name === 'refresh') return mark(REFRESH);
  return `<span class="ms" aria-hidden="true">${esc(name)}</span>`;
}

const REFRESH =
  'M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08a5.99 5.99 0 0 1-5.65 4c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z';
const PENCIL =
  'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z';
const OPEN_PAGE =
  'M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7zM19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7z';

function mark(path: string): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"></path></svg>`;
}

export function rowActs(id: string, editAction: string, url: string): string {
  const edit = `<button type="button" class="row-act" data-action="${esc(editAction)}" data-id="${esc(id)}" title="Edit" aria-label="Edit">${mark(PENCIL)}</button>`;
  const go = /^https?:/i.test(url)
    ? `<button type="button" class="row-act" data-action="goto-page" data-url="${esc(url)}" title="Open page" aria-label="Open page">${mark(OPEN_PAGE)}</button>`
    : '';
  return `<span class="row-acts">${edit}${go}</span>`;
}

export function clipText(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const chars = [...flat];
  if (chars.length <= max) return flat;
  return `${chars.slice(0, max).join('')}...`;
}

export function words(text: string, count: number): string {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= count) return text;
  return `${parts.slice(0, count).join(' ')}…`;
}

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  const shown = mb < 0.1 ? mb.toFixed(2) : mb.toFixed(1);
  return shown;
}

export function formatWhen(ms: number, timeZone: string, now = Date.now()): string {
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const clock = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const hm = clock.format(ms);
  if (day.format(ms) === day.format(now)) return `Today at ${hm}`;
  if (day.format(ms) === day.format(now - 86_400_000)) return `Yesterday at ${hm}`;
  return new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(ms);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDay(ms: number, timeZone: string, now = Date.now()): string {
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  if (day.format(ms) === day.format(now)) return 'Today';
  if (day.format(ms) === day.format(now - 86_400_000)) return 'Yesterday';
  return new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(ms);
}

export function formatDue(due?: string): string {
  if (!due) return '—';
  const parts = due.split('-');
  const month = MONTHS[Number(parts[1]) - 1];
  if (!month || !parts[2]) return '—';
  return `${month} ${parts[2]}`;
}

export function visIcon(visibility: Visibility): string {
  if (visibility === 'public') return 'public';
  if (visibility === 'private') return 'lock';
  return 'group';
}

export function visLabel(visibility: Visibility, groups: UserGroup[]): string {
  if (visibility === 'public') return 'Public';
  if (visibility === 'private') return 'Private';
  const id = visibility.slice('group:'.length);
  const group = groups.find((item) => item.id === id);
  return group ? `@${group.handle}` : 'Group';
}

export function safeHref(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return esc(parsed.href);
  } catch {
    return '#';
  }
  return '#';
}
