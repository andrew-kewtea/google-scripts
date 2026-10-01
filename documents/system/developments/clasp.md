Status: active  
Owner: jungh  
Last reviewed: 2026-10-01  
Related code: `apps/gas/bound/gsheet_sync/.clasp.json`

# clasp

Official setting that must be on before login: [Apps Script user settings](https://script.google.com/home/usersettings) → Google Apps Script API.

This repo uses the clasp binary installed in `gsheet_sync`, not a global `npm install -g`.

## Login

Once per machine (the token is `~/.clasprc.json`, gitignored when it appears inside the repo):

```bash
cd ~/webProjects/google-scripts
pnpm --filter gsheet_sync exec clasp login
```

## Daily push for gsheet_sync

```bash
pnpm --filter gsheet_sync test
pnpm --filter gsheet_sync status
pnpm --filter gsheet_sync push
```

`status` and `push` use `-P ./.clasp.json` and `rootDir` `src`.  
`.claspignore` keeps `node_modules`, tests, and the local readme out of the upload.

Pull a remote copy without touching `src/`:

```bash
pnpm --filter gsheet_sync run pull:snapshot
```

That uses `snapshot/.clasp.json`. Treat `snapshot/` as a reference diff. Copy changes back into `src/` by hand. The next push from `src/` overwrites the remote project files.

## Create a bound project

Creating the spreadsheet (or Doc) and the script in the browser, then cloning, is the easier direction.

```bash
cd apps/gas/bound/<product>
pnpm exec clasp clone <SCRIPT_ID>
```

For a new package, `cd` works after `pnpm install` has linked clasp. If clasp is only declared on `gsheet_sync`, either add `@google/clasp` to the new package via the catalog, or run `pnpm --filter gsheet_sync exec clasp` with `--project` flags. Prefer a catalog devDependency on the package that owns the scriptId.

## Head, version, deployment

Push updates **head**. Users of a deployed web app or a pinned library version stay on the old version until:

```bash
pnpm --filter gsheet_sync exec clasp version
pnpm --filter gsheet_sync exec clasp deployments
pnpm --filter gsheet_sync exec clasp update-deployment <deploymentId> -V <n>
```

`clasp open` opens the Apps Script editor for the current `.clasp.json`.  
`gsheet_sync` is container-bound. Opening the spreadsheet → Extensions → Apps Script is the same project.

A container-bound script's "deployment" matters when something outside the editor calls a versioned deployment (web app URL, library version). Menu items in the spreadsheet run the saved head after push. If a menu still shows old behavior, confirm you pushed the right scriptId and reloaded the spreadsheet.

## Standalone and libraries

Not in the tree yet. A library is its own scriptId, developed under `apps/gas/standalone/<name>/` when we add that glob, and referenced from a bound script's `appsscript.json` `dependencies.libraries`. Pushing the library still needs `clasp version` if consumers pin a version number.

## Do not

- Push from the repository root.
- Let `clasp pull` write into a TypeScript `src/` and call that the source of truth. That mismatch is why `ts_gsheet_sync` was retired.
- Commit `.clasprc.json` or paste sheet tokens into docs or chat.
