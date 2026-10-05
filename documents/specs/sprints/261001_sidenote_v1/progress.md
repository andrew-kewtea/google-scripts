# 261001 sidenote v1 progress

Status: done  
Date: 2026-10-02

## Done

- The overlay replaces the side panel. Toolbar click toggles the first column. The header opens the second column. The panel is an extension iframe.
- Notes, history, collections, tasks, and settings read and write `chrome.storage.local` (`sidenote.state`). Empty storage is seeded once: five pages, two notes, two `page_excerpt` rows, two collections, two tasks.
- Highlights are `copy` and `select`. `range` is on the model and on the select seed. The page is not painted.
- Account Log in / Google do not start a session.
- `pnpm --filter sidenote test` covers seed, note edit, excerpt filters, the five hosts, and soft delete. API tests stay in `background_sync.md`.
- Page scraping is not implemented. The design is `webPageActionContentScrap.md`.

## API connect (2026-10-05)

Design: `api_connect.md`. This replaces the `page_excerpt` single-resource decision in `background_sync.md`.

- Empty storage stays empty. The demo seed is gone. Creates stop at 9MB.
- Account signs in with email, signup, password reset, and Google. Tokens live in `sidenote.auth`. Logout clears tokens only.
- Signed-in edits go to `sidenote.outbox`. The service worker pushes them and pulls about 20 rows per section on login, panel open, a 10 minute alarm, and Refresh. Show more asks for the next page. The local cap is 60.
- Notes sync only when they have a `note_url_ref`. History maps to `web_histories`. Task `members` are stored as `memberIds` and are not shown.
- Page scraping is still not implemented.

## Recording plan (2026-10-06)

Design only: `recording.md`. Not in the build.

- Recording while the panel is closed is the same content script, off unless Settings → General asks for it.
- Manifest `unlimitedStorage` is planned. The on-screen budget becomes 20MB. At that line, automatic recording stops and the dot turns orange. Notes are not blocked.
- `webPageActionContentScrap.md` is no longer the capture spec.

## Check

```bash
pnpm --filter sidenote test
pnpm --filter sidenote typecheck
pnpm --filter sidenote build
```

Verified here: typecheck, five data-service tests, and `dist/manifest.json` plus `dist/panel/index.html`.

Unpacked load is a manual Chrome step. Cursor's browser cannot open `chrome://extensions`.

1. `chrome://extensions` → Developer mode → Load unpacked → `apps/chrome/sidenote/dist`
2. Open an https page and click the toolbar icon. The first column slides in from the right.
3. Header control opens Collections, Tasks, and Settings.
4. Save a note, hide the panel, and open it again. The note is still there.
5. `chrome://` pages will not mount the panel.
