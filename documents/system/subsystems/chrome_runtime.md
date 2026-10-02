Status: active  
Owner: jungh  
Last reviewed: 2026-10-02  
Related code: `apps/chrome/sidenote`

# Chrome extension runtime

Extensions in this repo use Manifest V3. sidenote's UI is an in-page overlay, not `chrome.sidePanel`. A side panel pushes the page and cannot host the two-column width. The product spec is `documents/specs/products/sidenote/spec.md`.

The toolbar action injects a content script once (`scripting.executeScript` on the active tab). That script mounts a fixed host and an iframe whose document is `panel/index.html`. Later clicks send a toggle message. The iframe stays mounted while it is hidden. There is no `<all_urls>` content script until page scraping is implemented.

## Build

`src/**/*.ts` is typechecked and emitted to `dist/` by `tsc`. `public/` (manifest, html, css, fonts) is copied onto `dist/` afterwards. There is no bundler yet.

That is enough while the extension imports only its own modules and Chrome APIs. When it needs an npm library at runtime, switch to a bundler and keep `tsc` for typecheck (`noEmit`), closer to `apps/chrome/tsconfig.json-crx_sample`.

Browser ESM imports in TypeScript source must end in `.js`, because that is the path Chrome loads after emit.

`src/content/mount.ts` has no import and no export. `tsc` emits it as a classic script so `executeScript` can inject the file. The service worker is an ES module (`"type": "module"` in the manifest).

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | `chrome.storage.local` key `sidenote.state` |
| `activeTab`, `scripting` | Inject the host on the tab where the user clicked the action, and read that tab's URL |
| `web_accessible_resources` | The page iframe loads `panel/index.html` and the bundled fonts |

`activeTab` lasts for the tab where the user invoked the extension. It is not a permanent read of every site. `https://api.kchloe.co/*` is not in the manifest until the first real request.

## Data

| Store | Contents |
| --- | --- |
| `chrome.storage.local` | Pages, notes, `page_excerpt` rows, collections, tasks, settings, UI state. Key `sidenote.state` |
| Fast2 `https://api.kchloe.co/api/v1` | Later. Design: `documents/specs/sprints/261001_sidenote_v1/background_sync.md` |

The panel's data service takes a storage port. Tests use a memory port. The iframe uses the Chrome port. Do not write the page's `window.localStorage`.

Do not commit tokens, and do not put user page text into the git repo. The seed in `src/shared/demoData.ts` is fixture copy, not a capture.
