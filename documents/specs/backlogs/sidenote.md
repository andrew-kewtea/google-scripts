# sidenote backlog

Status: active  
Code: `apps/chrome/sidenote`  
Spec: `documents/specs/products/sidenote/spec.md`

The overlay UI reads and writes `chrome.storage.local`. Signed-in sync is in `documents/specs/sprints/261001_sidenote_v1/api_connect.md`. Scraping is not started.

## In the overlay

| Item | Note |
| --- | --- |
| Two columns | First column toggles from the toolbar. Second column opens from the header |
| Notes, collections, tasks, settings | Local edit, then outbox push when signed in. Notes need a URL ref |
| History list | Local PageExcerpt, API `web_histories`. Highlights are `highlight` (`copy` and `select` fold into that) |
| Account | Email, signup, reset, Google. Email beside Account when signed in. Logout keeps the cache |
| Cache window | About 20 rows per section, cap 60. Refresh and a 10 minute alarm pull. Show more asks for the next page |

## Later

| Item | Note |
| --- | --- |
| Page scrap | `webPageActionContentScrap.md`. Read, link, form, highlight. Not implemented. Existing history rows sync; nothing is captured automatically |
| Highlight paint | `range` is stored so a later build can mark the page. The overlay does not paint it |
| Task members | `memberIds` are stored from the task payload. No member UI |
| Listing assets | Icon 128px, screenshots of the overlay, privacy text. See `documents/system/developments/chrome-publish.md` |
| `<all_urls>` content script | Add only when the scraper ships, with a store-review reason |
