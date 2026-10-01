# gsheet_sync

Version: v1  
Date: 2026-10-01  
Owner: jungh  
Status: active  
Code: `apps/gas/bound/gsheet_sync`  
Runtime: spreadsheet-bound Apps Script, JavaScript, clasp `rootDir` `src`

## 1. Summary

Google Sheet UI over Fast2. The settings tab signs up, logs in, and refreshes tokens. Other tabs Pull a list into rows and Push creates, updates, and deletes. Resources today: notes, posts, users.

The script does not compile. Edit `src/*.js` and push. Why this is not the TypeScript prototype: `documents/system/decisions/ADR-2026-10-01-retire-ts-gsheet-sync.md`.

In scope: menu-driven sync for those three models, node tests for pure helpers.  
Out of scope: a shared GAS library, TypeScript source, Chrome.

## 2. Runtime

API base is settings cell E7 (the origin, no path). Paths start with `API_PREFIX` = `/api/v1` in `src/10_constants.js`.

Auth paths: `/auth/signup`, `/auth/login`, `/auth/token` (body `{ refresh_token }` → new access token).

Pull and Push send the access token from G5 as a Bearer token. Refresh reads G6, posts to `/auth/token`, and writes a new access token to G5. When refresh itself is expired, log in again.

Menu items 1–3 run only on the settings sheet, gid `0`. Pull and Push run only when the active tab's gid is registered.

## 3. Sheet cells

Settings tab:

| Cell | Role |
| --- | --- |
| E2–E6 | Signup name, email, password, confirm, dev bypass |
| E7 | API base URL |
| E8 | Signup message |
| G2–G3 | Login email, password |
| G5 | Access token (Bearer) |
| G6 | Refresh token |
| G7 | Refresh expiry |

Do not commit screenshots of G5/G6. `muteHttpExceptions` is on, so a 4xx can still look like a finished script run. Read the sheet message cell or the editor log.

Notes list query cells are C6:I6 (`last_updated_atFrom`, `last_updated_atTo`, `q`, `size`, `page`, `sort`, `order`). The Tag column is sent as `q`, not as a tag filter. Fast2 list `sort` fields are snake_case (`last_updated_at`). Time values are unix seconds on the API. The sheet displays local time.

`NOTES_SHEET_GID` and the other `*_SHEET_GID` constants must match the tab's `#gid=`. Copying the spreadsheet changes gids. `getRange(row, column, numRows, numColumns)` takes counts, not end indexes.

## 4. Source map

| Path | Role |
| --- | --- |
| `main.js` | Menu: signup, login, refresh, Pull, Push |
| `10_constants.js` | `API_PREFIX`, empty registries, `PROP_LOADING` |
| `20_auth.js` | Settings gid and cells |
| `30_registry.js` | `registerPullSpecs_` / `registerPushSpecs_` |
| `http.js` | UrlFetch, error brief |
| `sheet_util.js` | Sheet read/write, list query string |
| `list_envelope.js` | `{ items, total }` and older wrapped lists |
| `pull.js` / `push.js` | Engines |
| `models/*.js` | Per-resource layout, query keys, row mapping |
| `utils/` | `pick_`, dates, sort alias |
| `smoke_test.js` | Optional editor smoke (`smokeTestUtils_`) |
| `tests/node/run.mjs` | Local tests, no network. `pnpm --filter gsheet_sync test` |

clasp may concatenate files in alphabetical order. Registration is done inside the menu functions so a new model does not depend on that order.

## 5. Add a model

1. New sheet tab. Copy `#gid=` into `*_SHEET_GID` in `src/models/<name>.js`.
2. Copy `models/notes.js`. Set `listPath`, query keys, `dataFirstRow`, `numCols`, message cells, `mapItemToRow`.
3. One line in `registerPullSpecs_` and, if the tab pushes, `registerPushSpecs_`.
4. Match Fast2's list filter names and allowed sort fields.
5. `pnpm --filter gsheet_sync test`, then `push`. See `documents/system/developments/clasp.md` if a deployment is pinned to a version.

Push URL shape is not the same for every model:

- notes: `PATCH /api/v1/notes/` with `id` in the JSON body (`patchBodyIdOnly`). Posts and users use `PATCH …/{id}`.
- users list/create path has no trailing slash (`/users`). notes and posts lists use a trailing slash.

## 6. Checks

- Node: `pnpm --filter gsheet_sync test` (pick, sort alias, list envelope, error brief).
- Editor, after push: run `smokeTestUtils_` from the spreadsheet script. It does not call the API.
- Menu Pull on a notes/posts/users tab with a live E7 and a valid G5.
- Menu Push on a registered tab.
- Signup / login / refresh only on gid 0.

## 7. References

- Publish steps: `documents/system/developments/clasp.md`
- Open follow-ups: `documents/specs/backlogs/gsheet_sync.md`
- Package pointer: `apps/gas/bound/gsheet_sync/readme.txt`
