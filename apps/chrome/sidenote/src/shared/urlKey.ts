/** Code-fixed URL identity. User rules in url_match_rules apply after this. */

export type UrlRule = {
  kind: 'path_glob' | 'host_alias';
  pattern: string;
};

export function canonicalUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  } catch {
    return '';
  }
  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  if (!host) return '';
  let path = parsed.pathname || '/';
  if (path !== '/' && path.endsWith('/')) path = path.replace(/\/+$/, '');
  return `https://${host}${path}`;
}

export function pageKey(url: string): string {
  const canon = canonicalUrl(url);
  if (!canon) return '';
  try {
    const parsed = new URL(canon);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${parsed.hostname}${path}`;
  } catch {
    return '';
  }
}

export function applyMatchRules(url: string, rules: UrlRule[]): string {
  let current = canonicalUrl(url);
  if (!current) return '';
  for (const rule of rules) {
    if (rule.kind !== 'host_alias') continue;
    const [from, to] = rule.pattern.split('->').map((part) => part.trim().replace(/^www\./, '').toLowerCase());
    if (!from || !to) continue;
    try {
      const parsed = new URL(current);
      if (parsed.hostname === from) {
        parsed.hostname = to;
        current = canonicalUrl(parsed.toString());
      }
    } catch {
      // skip a rule that does not parse
    }
  }
  return current;
}

export function patternCovers(pattern: string, url: string): boolean {
  const key = pageKey(applyMatchRules(url, []));
  if (!key || !pattern.trim()) return false;
  const glob = pattern
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
  const expression = `^${glob.split('*').map(escapeRegExp).join('.*')}$`;
  return new RegExp(expression).test(key);
}

export function samePage(url: string, other: string, patterns: string[], rules: UrlRule[]): boolean {
  const left = applyMatchRules(url, rules);
  const right = applyMatchRules(other, rules);
  if (left && left === right) return true;
  const globs = [...patterns, ...rules.filter((rule) => rule.kind === 'path_glob').map((rule) => rule.pattern)];
  return globs.some((pattern) => patternCovers(pattern, left) && patternCovers(pattern, right));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
