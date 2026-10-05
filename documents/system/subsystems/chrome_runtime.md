Status: active  
Owner: jungh  
Last reviewed: 2026-10-05  
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
| `storage` | `chrome.storage.local` keys `sidenote.state`, `sidenote.auth`, `sidenote.outbox` |
| `activeTab`, `scripting` | Inject the host on the tab where the user clicked the action, and read that tab's URL |
| `identity` | Google sign-in via `chrome.identity.launchWebAuthFlow`. Redirect is `https://<extension-id>.chromiumapp.org/` |
| `alarms` | Wake the service worker every 10 minutes to flush the outbox and pull |
| `host_permissions` | `http://*/*` and `https://*/*` so the worker can call the API and read the active page |
| `web_accessible_resources` | The page iframe loads `panel/index.html` and the bundled fonts |

`activeTab` lasts for the tab where the user invoked the extension. It is not a permanent read of every site. The manifest `key` keeps the unpacked extension id stable so the Google redirect URI can be registered.

## Data

| Store | Contents |
| --- | --- |
| `sidenote.state` | Pages, notes, history rows, collections, contexts, tasks, projects, tags, groups, settings, UI |
| `sidenote.auth` | Access token, refresh token, email, user id, journal uname. Not posted to the host page |
| `sidenote.outbox` | Signed-in creates, updates, and deletes waiting for the worker |
| Fast2 `https://api.kchloe.co/api/v1` | `urls`, `url_abouts`, `url_match_rules`, `notes`, `note_url_refs`, journal collections, `contexts`, `web_histories`, `tasks`, `projects`, tags, groups, preferences. Design: `documents/specs/sprints/261001_sidenote_v1/api_connect.md` |

The panel's data service takes a storage port. Tests use a memory port. The iframe uses the Chrome port. Do not write the page's `window.localStorage`.

Do not commit tokens, and do not put user page text into the git repo. There is no demo seed. Empty storage stays empty. A local JSON payload at or above 9MB rejects new rows.
