Status: active  
Owner: jungh  
Last reviewed: 2026-10-02

# Using this repo

Repo root: `~/webProjects/google-scripts`.  
GitHub: `https://github.com/andrew-kewtea/google-scripts`. Working branch at the time of writing: `dev_jungh`.

## 1. First time, and after pull

```bash
cd ~/webProjects/google-scripts
nvm use          # .nvmrc is 22. Node must be >= 20
pnpm install     # only at the root. Refreshes every workspace package
```

`pnpm` is pinned by the root `packageManager` field to `10.33.0`. A newer major exists. Stay on 10.33 until you change that field on purpose. See `node-toolchain.md`.

Check:

```bash
pnpm test        # gsheet_sync node tests. Packages without a test script are skipped
pnpm --filter sidenote build
```

## 2. Products

| Filter name | Directory | What you run |
| --- | --- | --- |
| `gsheet_sync` | `apps/gas/bound/gsheet_sync` | `pnpm --filter gsheet_sync test` then `push` when you mean to upload |
| `sidenote` | `apps/chrome/sidenote` | `pnpm --filter sidenote test`, then `build`, then load `dist/` unpacked |

Root scripts:

| Script | Effect |
| --- | --- |
| `pnpm test` | Runs `test` in every package that has one |
| `pnpm build` | Runs `build` only where it exists. `gsheet_sync` has no build |
| `pnpm typecheck` | sidenote `tsc --noEmit` |

`--filter` runs the script with that package as the current directory. clasp needs that, because it reads `./.clasp.json`.

## 3. Docs while you work

| Question | Open |
| --- | --- |
| Sheet columns, gid, Fast2 paths | `documents/specs/products/gsheet_sync/spec.md` |
| Overlay panel behavior | `documents/specs/products/sidenote/spec.md` |
| Why the TypeScript sheet app is gone | `documents/system/decisions/ADR-2026-10-01-retire-ts-gsheet-sync.md` |

Code-adjacent `readme.txt` files only point here.

## 4. What not to run

- `npm install` anywhere in this repo. It writes `package-lock.json` beside `pnpm-lock.yaml`.
- `clasp push` from the repo root. There is no root `.clasp.json`.
- `tsc` from a bare shell on this WSL machine. `tsc` on PATH may be the Windows Scoop binary. Use `pnpm --filter sidenote exec tsc` or `pnpm --filter sidenote build`.
