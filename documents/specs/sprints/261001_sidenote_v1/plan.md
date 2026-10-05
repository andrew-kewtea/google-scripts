# 261001 sidenote v1 overlay

Status: done  
Date: 2026-10-02

The 2026-10-01 scaffold (`chrome.sidePanel`, one note field) is replaced by the page overlay in `references/sidenote_dev_guide.md`.

## Plan

- Toolbar click toggles the first column only. The header control opens the second column.
- Panel is an extension iframe on the page. No Vue. TypeScript modules. No Fast2 calls.
- Render only from `chrome.storage.local`. Seed five pages and one or two rows per section when storage is empty.
- History rows are `page_excerpt` records (`userAction`, scope, text, excerpt, optional range).
- Tests cover the data service with a memory port. Page scraping and background sync are design-only.

## Docs

- Product: `documents/specs/products/sidenote/spec.md`
- Later sync: `background_sync.md` (done as `api_connect.md`)
- Later capture: `recording.md`. The 2026-10-02 scrape note is `webPageActionContentScrap.md`.
- Progress: `progress.md`

## Next plan

History auto-recording is specified in `recording.md` and is not implemented. Closed-panel recording uses the same top-frame content script. `unlimitedStorage` lifts Chrome's 10MB cap. The UI budget is 20MB, and only automatic recording stops at that line.

## Not this sprint

Login that reaches Fast2, journal or kchloe writes, content-script scraping, painting highlight ranges on the page, `<all_urls>` injection, Web Store listing.
