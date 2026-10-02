Status: active  
Canonical: yes  
Owner: jungh  
Last reviewed: 2026-10-02  
Related code: `apps/`, `pnpm-workspace.yaml`

# System design

Each product is a pnpm workspace package with its own publish identity. The repo root does not deploy anything.

## Runtime shape

| Path | What it is |
| --- | --- |
| `apps/gas/bound/<product>/` | Script bound to a spreadsheet. `.clasp.json` `scriptId` is that Apps Script project. `gsheet_sync` pushes `src/` as-is |
| `apps/gas/standalone/<product>/` | Not created yet. Unbound script or a library other scripts depend on |
| `apps/chrome/<product>/` | Manifest V3 extension. Build output is `dist/`, loaded unpacked, later zipped for the Web Store |
| `shared/<lib>/` | Not created yet. See below |

Category folders (`apps/gas`, `apps/chrome`) are not packages. Do not put a `package.json` there.

## Publish identities

| Product | Identity | Tool |
| --- | --- | --- |
| gsheet_sync | `.clasp.json` scriptId | `pnpm --filter gsheet_sync push`, then a version and deployment update when the live deployment is pinned |
| sidenote | Chrome extension id after the first store upload, or the local unpacked id before that | `pnpm --filter sidenote build`, then load `dist/` |

Two GAS products never share one scriptId. The retired TypeScript prototype had a different scriptId from `gsheet_sync`.

## Fast2

`gsheet_sync` calls Fast2 with the base URL in the settings sheet (cell E7) plus `/api/v1`.  
sidenote will call `https://api.kchloe.co/api/v1` for journal notes and for kchloe task/tag reconciliation. The HTTP contract stays in the fast2 repo. This repo records which resources a product uses.

## Shared library, later

A util package is worth adding only when two products need the same function and both can actually import it.

- Chrome can depend on a workspace package if the extension build bundles it.
- Apps Script does not run `node_modules`. A GAS library is a separate script referenced from `appsscript.json` `dependencies.libraries`, or a file copied into `src/`. That is a different mechanism from a pnpm package.

Until then, keep helpers inside the product (`gsheet_sync/src/utils/`, `sidenote/src/shared/`).

## Canonical detail

- Folders: `subsystems/workspace_layout.md`
- GAS file order, manifest, versions: `subsystems/gas_runtime.md`
- Extension shape: `subsystems/chrome_runtime.md`
- Commands: `developments/using-this-repo.md`
