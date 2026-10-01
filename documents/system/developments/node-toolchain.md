Status: active  
Owner: jungh  
Last reviewed: 2026-10-01

# Node toolchain

| Tool | Expected |
| --- | --- |
| Node | `>=20`, `.nvmrc` is `22`. clasp 3.3 requires Node 20+ |
| pnpm | `10.33.0`, declared in the root `package.json` `packageManager` |
| npm | Comes with nvm's Node. Use it only if you must install a global CLI. Do not use it to install this repo |
| clasp | Dev dependency of `gsheet_sync` (`catalog:` → 3.3.0). Invoke through pnpm |

`.npmrc` sets `engine-strict=true`, so install fails on Node 18 instead of half-working.

## pnpm, not a second package manager

One lockfile: `pnpm-lock.yaml` at the root. Commit it.  
Add a dependency from the root:

```bash
pnpm add -D <pkg> --filter gsheet_sync
pnpm add -D <pkg> --filter sidenote
```

Or `cd` into the package and `pnpm add`. Both update the root lockfile.  
Versions that several products share belong in the `catalog:` block of `pnpm-workspace.yaml`. Packages reference them as `"catalog:"`.

`packageManager` is only on the root. Child packages do not repeat it.

The isolated linker is intentional. There is no `shamefully-hoist` and no `node-linker=hoisted`. A package sees the dependencies it declares, plus catalog peers pnpm links. `gsheet_sync` does not get sidenote's TypeScript as something it uploads.

## Global clasp and Windows tsc

This WSL environment has also had:

- `clasp` on PATH from `npm install -g @google/clasp` under nvm
- `tsc` on PATH from Scoop (`/mnt/c/Users/jungh/scoop/.../tsc`), which is Windows Node

Project scripts put the package `node_modules/.bin` first, so `pnpm --filter gsheet_sync push` uses the local clasp. A hand-typed `clasp` or `tsc` may not. Prefer the filter commands. Uninstalling the global clasp is optional; the risk is version drift, not a broken lockfile.

## pnpm major upgrades

`pnpm install` may print that a newer pnpm exists (10.33 → 12.x was reported on 2026-10-01). Do not `pnpm add -g pnpm` as part of normal work. Upgrading the package manager is a separate change: update the root `packageManager` field, reinstall, and commit the lockfile diff after you have read the changelog.

## Auth files

| File | Git |
| --- | --- |
| `.clasp.json` | Tracked. It is the scriptId binding |
| `.clasprc.json` | Ignored. It is the clasp OAuth token |
| `node_modules/`, `dist/` | Ignored |
