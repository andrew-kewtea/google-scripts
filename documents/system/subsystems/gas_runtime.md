Status: active  
Owner: jungh  
Last reviewed: 2026-10-01  
Related code: `apps/gas/bound/gsheet_sync`

# GAS runtime

Apps Script runs on Google's servers. clasp uploads source files. It does not upload `node_modules`.

## Bound script, current pattern

`gsheet_sync` is container-bound. The spreadsheet owns the script.

| Local | Remote |
| --- | --- |
| `.clasp.json` `rootDir: src` | Project files come from `src/` |
| `src/*.js`, `src/**/*.js` | Server scripts. The editor often shows them as `.gs` |
| `src/appsscript.json` | Manifest |

Several `.js` files are concatenated into one script. Load order is not a reliable import graph. `gsheet_sync` therefore registers models at menu time (`registerPullSpecs_` / `registerPushSpecs_` in `30_registry.js`) instead of depending on file order.

clasp push replaces the remote file set with the local rootDir set. Files that exist only on the server and are absent locally are removed.

## Manifest dependencies

`appsscript.json` `dependencies` is needed in two cases:

- Advanced services (Drive, Sheets, Gmail, …) under `enabledAdvancedServices`
- Another Apps Script project used as a library, under `libraries` (`libraryId`, `userSymbol`, `version`)

`gsheet_sync` does not use those today. UrlFetch to Fast2 is a normal `UrlFetchApp` call.

## Version and deployment

`clasp push` updates the project head. A deployment pinned to a version number does not move until you create a version and point the deployment at it.

```bash
pnpm --filter gsheet_sync push
pnpm --filter gsheet_sync exec clasp version
pnpm --filter gsheet_sync exec clasp deployments
pnpm --filter gsheet_sync exec clasp update-deployment <deploymentId> -V <version>
```

Run these from the package via `--filter`, so clasp reads that package's `.clasp.json`. Do not run `clasp push` in the repo root.

`gsheet_sync` also keeps `snapshot/` as a pull target (`pull:snapshot`) so a remote download does not overwrite `src/`.

## TypeScript

Bound sheet CRUD stays JavaScript. The retired compile-to-`dist` experiment is `decisions/ADR-2026-10-01-retire-ts-gsheet-sync.md`.

A future standalone library may use TypeScript if its own build produces the files clasp pushes, and if pull is not treated as a way to recover `.ts`. Chrome extensions are a separate choice: they compile because the browser needs the `dist/` bundle, and there is no clasp pull that overwrites TypeScript.
