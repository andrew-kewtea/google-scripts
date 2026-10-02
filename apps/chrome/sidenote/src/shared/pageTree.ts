export type PageTreeNode = {
  segment: string;
  path: string;
  href: string;
  notes: number;
  children: PageTreeNode[];
};

export type TreeRow = {
  path: string;
  label: string;
  href: string;
  depth: number;
  count: number;
  hasChildren: boolean;
  open: boolean;
  current: boolean;
};

export function buildPageTree(
  entries: { url: string; notes: number }[],
  currentUrl: string,
): PageTreeNode | null {
  const current = pathOf(currentUrl);
  if (!current) return null;
  const root = makeNode(current.host, current.host);
  const included = new Map<string, number>();
  for (const entry of entries) {
    const parsed = pathOf(entry.url);
    if (!parsed || parsed.host !== current.host || entry.notes <= 0) continue;
    included.set(parsed.key, (included.get(parsed.key) ?? 0) + entry.notes);
  }
  included.set(current.key, included.get(current.key) ?? 0);
  for (const [key, notes] of included) {
    const parsed = pathOf(`https://${key}`);
    if (!parsed) continue;
    insert(root, parsed.segments, notes);
  }
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
    rows.push({
      path: node.path,
      label: depth === 0 || !hasChildren ? node.segment : `${node.segment}/`,
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

function insert(root: PageTreeNode, segments: string[], notes: number): void {
  if (segments.length === 0) {
    root.notes += notes;
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
    if (index === segments.length - 1) child.notes += notes;
    parent = child;
  }
}

function sortTree(node: PageTreeNode): void {
  node.children.sort((a, b) => a.segment.localeCompare(b.segment));
  for (const child of node.children) sortTree(child);
}

function makeNode(segment: string, path: string): PageTreeNode {
  return { segment, path, href: `https://${path}`, notes: 0, children: [] };
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
