# sidenote

Version: v0.2  
Date: 2026-10-05  
Owner: jungh  
Status: local cache, signed-in sync  
Code: `apps/chrome/sidenote`  
Runtime: Chrome Manifest V3, in-page overlay

## 1. Summary

sidenote는 보고 있는 페이지 오른쪽에 붙는 노트 패널이다.  
sidenote is a note panel pinned to the right edge of the page you are on.

The 2026-10-01 scaffold used `chrome.sidePanel`. That host pushes the page and cannot match the two-column overlay. The panel is now an extension iframe injected on toolbar click. Reference UI: `documents/specs/sprints/261001_sidenote_v1/references/`.

In scope: show and hide the first column, expand the second column, edit notes, history rows, collections, tasks, and settings in `chrome.storage.local`, and sync that cache to Fast2 after sign-in.  
Out of scope: scraping the page, painting highlights, Web Store listing. Scraping stays in `documents/specs/sprints/261001_sidenote_v1/webPageActionContentScrap.md`. Sync is `api_connect.md`.

## 2. Behavior

| Action | Result |
| --- | --- |
| Toolbar icon | Toggle the first column (360px). The page is not pushed |
| Header `→` / `←` | Open or close the second column (521px) to the right of the first. The panel grows left |
| First column `×` | Hide the whole panel. The iframe stays mounted |
| Second column `×` | Close the second column only |
| Notes, About, history text, collections, tasks, settings | Read and write `chrome.storage.local`. The screen renders that state. Signed-in changes also enter the outbox |
| Account | Email and password, signup, password reset, and Google. Signed in, the email replaces Local, the usage bar hides, and Logout clears tokens only |
| Refresh | About page title and Account. Signed in only. Same full pull |

Empty storage stays empty. A create is refused when the stored JSON is 9MB or larger. Signed in, each section keeps about 20 recent rows, with a local cap of 60.

About shows the tab that was active when the panel opened. Notes and history belong to that path: `www`, a trailing slash, a hash, and the query string do not make a different page. Extra matches come from `url_match_rules` and the page's patterns. Another path on the same host, such as `chatgpt.com/c/…`, has its own notes. Those other paths show up in the About tree, and the name opens that URL in a new tab.

Motion: panel 340ms, accordion 300ms, easing `cubic-bezier(.2,.8,.2,1)`. `prefers-reduced-motion: reduce` sets the duration to 0. Type is Jost 400, with 500 only on section titles. Fonts ship in the extension package.

## 3. Records

| Record | Role |
| --- | --- |
| Page | About: title, URL, tags, URL patterns |
| Note | Text the user wrote. Later this is a journal entry, not a scrape |
| PageExcerpt | History and the cached fragment. The API name is `web_histories` |
| Collection, Task, Project, Tag, UserGroup, Settings | Second column and settings. Synced after sign-in. Task members are stored only |
| Ui | Second column open, section open map, sorts, history filter |

History fields that matter: `userAction` (`read`, `play`, `link`, `form`, `highlight`), `scope` (normalized URL and page id), `text`, `excerpt`, `range`. Older `copy` and `select` rows become `highlight`. `range` is stored so a later build can mark the page. This version does not mark the page. Notes sync only when a `note_url_ref` ties them to a URL.

Soft delete uses `deletedAt`. New ids start with `tmp_` and become server ids after POST.

Storage keys in `chrome.storage.local`: `sidenote.state`, `sidenote.auth`, `sidenote.outbox`. The panel does not use the page's `window.localStorage`.

## 4. Code map

| Path | Role |
| --- | --- |
| `public/manifest.json` | MV3. `storage`, `scripting`, `activeTab`, `identity`, `alarms`. Stable unpacked id via `key` |
| `src/background/serviceWorker.ts` | Toolbar click injects or toggles |
| `src/background/syncWorker.ts` | Outbox push, 10 minute alarm, section pull |
| `src/content/mount.ts` | Fixed host and iframe. No imports, so it can be injected as a classic script |
| `src/panel/` | Controller, data service, views. The iframe document |
| `src/panel/dataService.ts` | Storage port in, state out. No DOM |
| `src/shared/types.ts`, `urlKey.ts` | Records and URL identity |
| `src/lib/api.ts`, `http.ts`, `auth.ts`, `sync.ts` | Origin, bearer refresh, account calls, outbox and cache merge |

Permissions and the build: `documents/system/subsystems/chrome_runtime.md`.  
Unpacked load: `documents/system/developments/chrome-publish.md`.

## 5. Checks

- `pnpm --filter sidenote test` — empty storage, quota, note edit, URL identity, auth, outbox merge, tag suggest. Fake HTTP only.
- `pnpm --filter sidenote typecheck`
- `pnpm --filter sidenote build` writes `dist/manifest.json` and `dist/panel/index.html`.
- Load `dist/` unpacked. On an http(s) page, the toolbar action toggles the first column.
- `chrome://` and the Web Store may refuse scripting. That is a browser limit.

## 6. Later

Page scraping stays in the sprint design docs. The backlog is `documents/specs/backlogs/sidenote.md`.

## Revision

| Date | Change |
| --- | --- |
| 2026-10-01 | Scaffold. Side panel, local draft, no Fast2 calls |
| 2026-10-02 | In-page two-column overlay. Render from `chrome.storage.local`. `page_excerpt` for history |
| 2026-10-05 | Seed removed. Sign-in and a 20-row cache. History API is `web_histories` |
