export type PageTreeNode = {
  segment: string;
  path: string;
  href: string;
  title: string;
  notes: number;
  children: PageTreeNode[];
};

export type TreeRow = {
  path: string;
  label: string;
  hint: string;
  href: string;
  depth: number;
  count: number;
  hasChildren: boolean;
  open: boolean;
  current: boolean;
};

export function ancestorPaths(url: string): string[] {
  const current = pathOf(url);
  if (!current || current.segments.length === 0) return [];
  const paths = [current.host];
  let path = current.host;
  for (const segment of current.segments.slice(0, -1)) {
    path = `${path}/${segment}`;
    paths.push(path);
  }
  return paths;
}

export function buildPageTree(
  entries: { url: string; notes: number; title?: string }[],
  currentUrl: string,
  currentTitle = '',
): PageTreeNode | null {
  const current = pathOf(currentUrl);
  if (!current) return null;
  const root = makeNode(current.host, current.host);
  const included = new Map<string, { notes: number; title: string }>();
  for (const entry of entries) {
    const parsed = pathOf(entry.url);
    if (!parsed || parsed.host !== current.host || entry.notes <= 0) continue;
    const prior = included.get(parsed.key);
    included.set(parsed.key, {
      notes: (prior?.notes ?? 0) + entry.notes,
      title: entry.title?.trim() || prior?.title || '',
    });
  }
  if (!included.has(current.key)) included.set(current.key, { notes: 0, title: '' });
  for (const [key, item] of included) {
    const parsed = pathOf(`https://${key}`);
    if (!parsed) continue;
    insert(root, parsed.segments, item.notes, item.title);
  }
  const here = nodeAt(root, current.segments);
  if (here?.path === current.key && currentTitle.trim()) here.title = currentTitle.trim();
  sortTree(root);
  return root;
}

export function visibleTreeRows(root: PageTreeNode, openPaths: readonly string[], currentUrl: string): TreeRow[] {
  const current = pathOf(currentUrl);
  const open = new Set(openPaths);
  const rows: TreeRow[] = [];
  const walk = (node: PageTreeNode, depth: number): void => {
    const hasChildren = node.children.length > 0;
    const isOpen = hasChildren && open.has(node.path);
    const count = subtreeNotes(node);
    const raw = depth === 0 || !hasChildren ? node.segment : `${node.segment}/`;
    const clipped = clipPart(raw);
    const title = pageTitle(node.segment, node.title);
    const label = title ? `${clipped} (${title})` : clipped;
    rows.push({
      path: node.path,
      label,
      hint: title ? `${raw} (${title})` : raw,
      href: node.href,
      depth,
      count,
      hasChildren,
      open: isOpen,
      current: current?.key === node.path,
    });
    if (isOpen) {
      for (const child of node.children) walk(child, depth + 1);
    }
  };
  walk(root, 0);
  return rows;
}

function subtreeNotes(node: PageTreeNode): number {
  return node.notes + node.children.reduce((sum, child) => sum + subtreeNotes(child), 0);
}

function insert(root: PageTreeNode, segments: string[], notes: number, title: string): void {
  if (segments.length === 0) {
    root.notes += notes;
    if (title) root.title = title;
    return;
  }
  let parent = root;
  let path = root.path;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index] ?? '';
    path = `${path}/${segment}`;
    let child = parent.children.find((item) => item.segment === segment);
    if (!child) {
      child = makeNode(segment, path);
      parent.children.push(child);
    }
    if (index === segments.length - 1) {
      child.notes += notes;
      if (title) child.title = title;
    }
    parent = child;
  }
}

function nodeAt(root: PageTreeNode, segments: string[]): PageTreeNode | undefined {
  let node = root;
  for (const segment of segments) {
    const child = node.children.find((item) => item.segment === segment);
    if (!child) return undefined;
    node = child;
  }
  return node;
}

function clipPart(segment: string): string {
  const slash = segment.endsWith('/');
  const body = slash ? segment.slice(0, -1) : segment;
  const chars = [...body];
  if (chars.length <= 20) return segment;
  return `${chars.slice(0, 20).join('')}...${slash ? '/' : ''}`;
}

function pageTitle(segment: string, title: string): string {
  const trimmed = title.trim();
  if (!trimmed || trimmed.toLowerCase() === segment.toLowerCase()) return '';
  return trimmed;
}

function sortTree(node: PageTreeNode): void {
  node.children.sort((a, b) => a.segment.localeCompare(b.segment));
  for (const child of node.children) sortTree(child);
}

function makeNode(segment: string, path: string): PageTreeNode {
  return { segment, path, href: `https://${path}`, title: '', notes: 0, children: [] };
}

function pathOf(url: string): { host: string; segments: string[]; key: string } | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (!host) return null;
    const segments = parsed.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part));
    const key = segments.length ? `${host}/${segments.join('/')}` : host;
    return { host, segments, key };
  } catch {
    return null;
  }
}
