# sidenote backlog

Status: active  
Code: `apps/chrome/sidenote`  
Spec: `documents/specs/products/sidenote/spec.md`

The overlay UI reads and writes `chrome.storage.local`. Sync and scraping are not started.

## In the overlay

| Item | Note |
| --- | --- |
| Two columns | First column toggles from the toolbar. Second column opens from the header |
| Notes, collections, tasks, settings | Local edit, including save / cancel / delete where the reference UI has them |
| History list | Renders `page_excerpt`. Filter includes Highlights (`copy` and `select`) |
| Account | Local mode. Log in and Google are visible and do not authenticate |
| Demo seed | Five pages, one or two rows per section, inserted when storage is empty |

## Later

| Item | Note |
| --- | --- |
| Background sync | `documents/specs/sprints/261001_sidenote_v1/background_sync.md`. Service worker, outbox push, infrequent pull, Refresh button |
| Page scrap | `webPageActionContentScrap.md`. Read, link, form, copy, select. Not implemented |
| Highlight paint | `page_excerpt.range` is stored so a later build can mark the page. The overlay does not paint it |
| Sign-in | Session for `https://api.kchloe.co`. Token stays in the service worker, never in git |
| Journal create | Notes and collections → Fast2 journal. Contract from the fast2 repo. Client still only exports the origin in `src/lib/api.ts` |
| Tasks | Projects and tasks → kchloe after sign-in |
| `page_excerpt` API | New Fast2 resource. Same fields as the local record |
| API tests | Same Node runner as the data service, with a fake HTTP port. No live calls |
| Listing assets | Icon 128px, screenshots of the overlay, privacy text. See `documents/system/developments/chrome-publish.md` |
| Host permission | Add `https://api.kchloe.co/*` with the first real request. Do not claim sync works before it does |
| `<all_urls>` | Add only when the scraper ships, with a store-review reason |
