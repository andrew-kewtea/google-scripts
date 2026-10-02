# sidenote

Version: v0.2  
Date: 2026-10-02  
Owner: jungh  
Status: local overlay  
Code: `apps/chrome/sidenote`  
Runtime: Chrome Manifest V3, in-page overlay

## 1. Summary

sidenote는 보고 있는 페이지 오른쪽에 붙는 노트 패널이다.  
sidenote is a note panel pinned to the right edge of the page you are on.

The 2026-10-01 scaffold used `chrome.sidePanel`. That host pushes the page and cannot match the two-column overlay. The panel is now an extension iframe injected on toolbar click. Reference UI: `documents/specs/sprints/261001_sidenote_v1/references/`.

In scope: show and hide the first column, expand the second column, edit notes, history rows, collections, tasks, and settings, all stored in `chrome.storage.local`.  
Out of scope: Fast2 login, journal and kchloe writes, scraping the page, painting highlights, Web Store listing. Those are `documents/specs/sprints/261001_sidenote_v1/background_sync.md` and `webPageActionContentScrap.md`.

## 2. Behavior

| Action | Result |
| --- | --- |
| Toolbar icon | Toggle the first column (360px). The page is not pushed |
| Header `→` / `←` | Open or close the second column (521px) to the right of the first. The panel grows left |
| First column `×` | Hide the whole panel. The iframe stays mounted |
| Second column `×` | Close the second column only |
| Notes, About, history text, collections, tasks, settings | Read and write `chrome.storage.local`. The screen renders that state |
| Account Log in / Google | Buttons only. No session and no request |

Empty storage is seeded once: five pages, and one or two rows in each section. Pages:

- `https://www.google.com/`
- `https://drive.google.com/`
- `https://mail.google.com/`
- `https://chatgpt.com/`
- `https://www.bbc.com/future/article/20260930-metas-new-ai-is-about-to-break-the-internet`

About shows the tab that was active when the panel opened. Notes and history belong to that path: `www`, a trailing slash, and the query string do not make a different page. Another path on the same host, such as `chatgpt.com/c/…`, has its own notes. Those other paths show up in the About tree, and the name opens that URL in a new tab.

Account stays Local. Links out to journal and kchloe are hidden.

Motion: panel 340ms, accordion 300ms, easing `cubic-bezier(.2,.8,.2,1)`. `prefers-reduced-motion: reduce` sets the duration to 0. Type is Jost 400, with 500 only on section titles. Fonts ship in the extension package.

## 3. Records

| Record | Role |
| --- | --- |
| Page | About: title, URL, tags, URL patterns |
| Note | Text the user wrote. Later this is a journal entry, not a scrape |
| PageExcerpt | History and the cached fragment. One shape for the future Fast2 `page_excerpt` resource |
| Collection, Task, Project, Tag, UserGroup, Settings | Second column and settings. Local only for now |
| Ui | Second column open, section open map, sorts, history filter |

`page_excerpt` fields that matter: `userAction` (`read`, `link`, `form`, `copy`, `select`), `scope` (normalized URL and page id), `text`, `excerpt`, `range`. Highlights in the filter are `copy` and `select`. `range` is stored so a later build can mark the page. This version does not mark the page.

Soft delete uses `deletedAt`. Ids are created on the client.

Storage key: `sidenote.state` in `chrome.storage.local`. The panel does not use the page's `window.localStorage`.

## 4. Code map

| Path | Role |
| --- | --- |
| `public/manifest.json` | MV3. `storage`, `scripting`, `activeTab`. No `sidePanel`. No `<all_urls>` content script |
| `src/background/serviceWorker.ts` | Toolbar click injects or toggles. No network |
| `src/content/mount.ts` | Fixed host and iframe. No imports, so it can be injected as a classic script |
| `src/panel/` | Controller, data service, views. The iframe document |
| `src/panel/dataService.ts` | Storage port in, state out. No DOM |
| `src/shared/types.ts`, `demoData.ts` | Records and the seed |
| `src/lib/api.ts` | `API_ORIGIN` only. No request |

Permissions and the build: `documents/system/subsystems/chrome_runtime.md`.  
Unpacked load: `documents/system/developments/chrome-publish.md`.

## 5. Checks

- `pnpm --filter sidenote test` — seed, note create/update/delete, excerpt filter, host match, soft delete.
- `pnpm --filter sidenote typecheck`
- `pnpm --filter sidenote build` writes `dist/manifest.json` and `dist/panel/index.html`.
- Load `dist/` unpacked. On an http(s) page, the toolbar action toggles the first column.
- `chrome://` and the Web Store may refuse scripting. That is a browser limit.

## 6. Later

Background sync and page scraping stay in the sprint design docs. The backlog is `documents/specs/backlogs/sidenote.md`.

## Revision

| Date | Change |
| --- | --- |
| 2026-10-01 | Scaffold. Side panel, local draft, no Fast2 calls |
| 2026-10-02 | In-page two-column overlay. Render from `chrome.storage.local`. `page_excerpt` for history |
