Status: active  
Owner: jungh  
Last reviewed: 2026-10-01  
Related code: `pnpm-workspace.yaml`, `package.json`, `pnpm-lock.yaml`

# pnpm workspace

Checked and corrected on 2026-10-01. Use this file when a install or a recursive script looks wrong.

## What was wrong

| Symptom | Cause |
| --- | --- |
| `gsheet_sync` declared `@google/clasp`, but `gsheet_sync/node_modules` did not exist | `pnpm-lock.yaml` was updated on 2026-05-06 and `pnpm install` was not run again. The virtual store still had an old `typescript@6.0.2` and `@types/google-apps-script` only |
| Root `pnpm test` failed even when sheet tests passed | `ts_gsheet_sync` had a placeholder `test` script that exited 1. That package is removed. See the retire ADR |
| `apps/chrome/sidenote` would not have been a workspace member | Globs were `apps/*`, `apps/gas/*/*`, and `shared/*`. `apps/*` matches category folders, not `apps/chrome/<product>`. `shared/` does not exist |
| TypeScript was documented as a root `-Dw` dependency and was not in any `package.json` | The store copy was TypeScript 6, while clasp's optional peer asks for `typescript@^5.6.0` |
| `ts_gsheet_sync` was not `"private": true` | Accidental publish would have been possible. Active packages are private |
| Root `build` / `test` called `pnpm -r` with no `--if-present` | A package that lacks the script is skipped by recursive run in current pnpm, but a script that exists and fails (the old placeholder test) fails the whole command. Root scripts now pass `--if-present` |

`node_modules` on 2026-04-01 was already a real pnpm install (isolated linker, empty public hoist). The mistake was drift after later `package.json` edits, not "npm was used to create the store". There was no `package-lock.json`.

## What is true now

```yaml
packages:
  - "apps/gas/bound/*"
  - "apps/chrome/*"

catalog:
  typescript: ~5.9.0          # resolved 5.9.3
  "@google/clasp": 3.3.0
  "@types/chrome": ^0.1.0     # resolved 0.1.43
```

| Package | Dependencies |
| --- | --- |
| root | none. Scripts only |
| `gsheet_sync` | `@google/clasp` from the catalog |
| `sidenote` | `typescript`, `@types/chrome` from the catalog |

clasp's optional peer `typescript` resolves to the catalog 5.9.3 because sidenote installs TypeScript in the same workspace. That peer is for clasp's own tooling. It is not pushed to Apps Script.

After any `package.json` or catalog edit:

```bash
cd ~/webProjects/google-scripts
pnpm install
```

Confirm the tree matches the lockfile when something looks stale:

```bash
pnpm list -r --depth 0
ls apps/gas/bound/gsheet_sync/node_modules/.bin/clasp
ls apps/chrome/sidenote/node_modules/.bin/tsc
```

## Rules while developing

- Add shared tool versions to `catalog`, then `"catalog:"` in the package.
- Do not set `shamefully-hoist` or `node-linker=hoisted` to "make imports work". Fix the dependency declaration instead.
- Do not put `package.json` in `apps/gas` or `apps/chrome`.
- Add `apps/gas/standalone/*` or `shared/*` to the globs only when that package exists. `workspace_layout.md` explains why `shared/` waits.
- Root recursive scripts skip packages that do not define the script. Do not add a `test` script that only `exit 1`.
- `pnpm up -r` across the whole workspace is a deliberate upgrade, not a daily command. If it goes badly, restore `package.json` and `pnpm-lock.yaml` from git and run `pnpm install`.
