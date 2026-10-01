Status: active  
Owner: jungh  
Last reviewed: 2026-10-01

# Workspace layout

## Current tree

```text
apps/gas/bound/gsheet_sync/     # JavaScript, clasp rootDir = src
apps/chrome/sidenote/           # TypeScript src → dist, plus public/ static files
apps/chrome/tsconfig.json-crx_sample   # old sample, not a package
apps/gas/tsconfig.json_gas      # old sample for a GAS TypeScript compile
```

`pnpm-workspace.yaml` includes only:

```yaml
packages:
  - "apps/gas/bound/*"
  - "apps/chrome/*"
```

`apps/chrome/*` matches `sidenote` because that directory has `package.json`. The sample tsconfig file does not become a package.

## Adding a product

1. Create `apps/gas/bound/<name>/` or `apps/chrome/<name>/` with `package.json` `"private": true`.
2. Put the name in `package.json` so `pnpm --filter <name>` works.
3. Depend on tools with the `catalog:` protocol (`typescript`, `@google/clasp`, `@types/chrome`). Versions live in `pnpm-workspace.yaml`.
4. From the repo root, `pnpm install`.
5. Add `documents/specs/products/<name>/spec.md`.
6. Leave a one-line `readme.txt` in the package that points at the spec.

Bound GAS today does not need a `build` script. Chrome products need `build` that fills `dist/`. Root `pnpm build` runs a package script only when that script exists (`--if-present`).

## Later globs

Add these to `pnpm-workspace.yaml` only when a real `package.json` exists:

| Glob | When |
| --- | --- |
| `apps/gas/standalone/*` | An unbound script or an Apps Script library |
| `shared/*` | A util package both products can consume |

Do not add `apps/*`. That pattern also matches the category directories `apps/gas` and `apps/chrome`. A stray `package.json` there would become a workspace member.
