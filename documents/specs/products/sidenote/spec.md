# sidenote

Version: v0.1  
Date: 2026-10-01  
Owner: jungh  
Status: scaffold  
Code: `apps/chrome/sidenote`  
Runtime: Chrome Manifest V3 side panel

## 1. Summary

sidenote는 보고 있는 페이지 옆에 노트를 적는 Chrome extension이다.  
The previous product was a wide in-page panel: page URL and a comment on the left, collections and saved notes on the right. Reference: `reference-ui.jpg` in this folder (the "Jot down on the side" listing image).

The new host is `chrome.sidePanel`, which is a narrow column. The scaffold stacks the page, one note field, a collection name, and the local note list. It does not recreate the two-pane layout pixel for pixel.

In scope now: build, unpacked load, capture the active tab, save a draft in `chrome.storage.local`.  
Out of scope until a later sprint: login, journal create, task/tag reconciliation, Web Store listing assets.

## 2. Behavior we are rebuilding

| Old surface | New meaning |
| --- | --- |
| About page, current URL | Active tab title and URL |
| Comment, Save / Cancel / Delete | A note body. Save local works. Cancel/delete and server save do not |
| My Collections | A collection name stored on the local note. Not a server collection yet |
| Note list with URL and time | Local list only |

Two later writes, both through Fast2 at `https://api.kchloe.co` (`/api/v1`), for a logged-in user:

1. Journal — create a note for the visited page.
2. kchloe — reconcile the captured page (URL, title, selection) with existing tasks or tags. One capture may apply to journal and kchloe together.

The HTTP shapes live in the fast2 repo. This spec does not invent paths. `src/lib/api.ts` only exports `API_ORIGIN` and `API_PREFIX` so the next sprint has one place to add calls. Unsigned use keeps the local draft.

Some data stays in `chrome.storage.local` even after sync exists (drafts, last collection name). Account data is not stored as the only copy.

## 3. Scaffold map

| Path | Role |
| --- | --- |
| `public/manifest.json` | MV3, side panel, permissions |
| `public/sidepanel/` | HTML and CSS, copied to `dist/` |
| `src/background.ts` | Open the side panel when the action is clicked |
| `src/sidepanel/main.ts` | Panel UI |
| `src/lib/capture.ts` | `activeTab` + `scripting.executeScript` for title, URL, selection |
| `src/lib/storage.ts` | Key `sidenote.notes` |
| `src/lib/api.ts` | Origin constant, no request yet |
| `src/lib/types.ts` | `LocalNote.sync` is `'local'` or `'pending'` (pending is unused) |

Permissions and the no-bundler build: `documents/system/subsystems/chrome_runtime.md`.  
Load unpacked through store upload: `documents/system/developments/chrome-publish.md`.

## 4. Checks for this scaffold

- `pnpm --filter sidenote build` produces `dist/manifest.json` and `dist/sidepanel/index.html`.
- Load `dist/` unpacked. The action opens the side panel.
- Capture on an http(s) page fills the selection when one exists.
- Save local lists the note after the panel is reopened.
- `chrome://` and the Web Store itself may refuse scripting. That is a browser limit, not a failed save of an already captured note.

## 5. Next

`documents/specs/backlogs/sidenote.md` and `documents/specs/sprints/261001_sidenote_scaffold/plan.md`.

## Revision

| Date | Change |
| --- | --- |
| 2026-10-01 | Scaffold and product intent. No Fast2 calls yet |
