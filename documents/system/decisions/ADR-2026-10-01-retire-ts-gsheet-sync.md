# ADR-2026-10-01: Retire ts_gsheet_sync

Status: accepted  
Date: 2026-10-01  
Related code: removed `apps/gas/bound/ts_gsheet_sync`  
Related docs: `documents/system/subsystems/gas_runtime.md`, `documents/specs/products/gsheet_sync/spec.md`

## Context

Git does not contain a sentence that says TypeScript was dropped because it was too hard. The history still explains the choice.

On 2026-05-04, commit `524c2b5` ("updated bound gsheet sync login part") added both apps:

| App | What landed |
| --- | --- |
| `gsheet_sync` | JavaScript. Its readme said clasp development, "not typescript". About 220 lines of sheet login/sync in `src/main.js`, `rootDir: src` |
| `ts_gsheet_sync` | TypeScript, 110 lines in `src/main.ts`. The readme still called the old path `sheet_naim_connect`. Behavior: take rows whose column A is `1`, call `sendUpdateToServer` (it returned `true` and did not call `UrlFetchApp`), set column A to `0`. Build path was `tsc` → `dist/` → copy `appsscript.json` → clasp `rootDir: dist` |

The same evening, `62d479f` removed `sheet_naim_connect` from the docs and pointed them at `ts_gsheet_sync`. After that commit, `src/main.ts` never changed.

From `b9baece` the same day through `62571fe` (2026-05-11), every product change went to `gsheet_sync`: multi-model list, push create/update/delete, posts, users, auth. The TypeScript file stayed the column-A prototype.

The friction is written in that day's README and in `ts_gsheet_sync/readme.txt`, not in a commit subject:

- clasp pull does not turn remote `.js` back into `.ts`. The remote editor and the TypeScript source diverge.
- Pull into `snapshot/` followed the parent `.clasp.json` because the snapshot folder had no clasp project of its own, so files landed in `dist/` (`rootDir`) instead of the snapshot.
- Push needs a compiled `dist/` plus a copied manifest. `gsheet_sync` pushes `src/*.js` directly.
- Apps Script concatenates several `.js` files. The TypeScript sample was one `main.ts` with `module: none`, which does not match the multi-file registry the JS app grew the same week.

The two apps were never the same Apps Script project.

| | scriptId |
| --- | --- |
| `gsheet_sync` (keep) | `1Zm8QlftCAyKnkRvNo5QGuc_t7L3Z0MWDc4FuE_eymvsbAjVFw25Edgk8` |
| `ts_gsheet_sync` (retired) | `1hSOCHFTgJwGHhXSqbJ3S5PriogI-a-8TdVXjfiXASRPjCjzxk3SVW8Hr` |

## Decision

Remove `apps/gas/bound/ts_gsheet_sync` from the working tree on 2026-10-01. Git history still has the files (`git log -- apps/gas/bound/ts_gsheet_sync`, or show `524c2b5`).

Bound sheet CRUD stays plain JavaScript under `apps/gas/bound/gsheet_sync`, pushed from `src/`.

TypeScript stays in use for Chrome extensions. sidenote compiles `src/` to `dist/` because the browser needs that output, and nothing pulls remote JS back over the TypeScript.

A later `apps/gas/standalone/` library may use TypeScript only with its own build, and must not treat clasp pull as a TypeScript round-trip. That would be a new ADR.

## Consequences

- Root `pnpm test` no longer runs a placeholder script that exited 1.
- The retired scriptId is not referenced by this tree. If that Apps Script project still exists in the Google account, archive or delete it in the Apps Script dashboard. Do not clone it back over `gsheet_sync`.
- `apps/gas/tsconfig.json_gas` remains only as a sample file. It is not a workspace package.

Canonical write-up: `documents/system/subsystems/gas_runtime.md`
