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
  return `<span class="ms" aria-hidden="true">${esc(name)}</span>`;
}

export function words(text: string, count: number): string {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= count) return text;
  return `${parts.slice(0, count).join(' ')}…`;
}

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  const shown = mb < 0.1 ? mb.toFixed(2) : mb.toFixed(1);
  return `${shown} / 10 MB`;
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
