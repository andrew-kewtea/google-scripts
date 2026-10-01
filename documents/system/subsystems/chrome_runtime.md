Status: active  
Owner: jungh  
Last reviewed: 2026-10-01  
Related code: `apps/chrome/sidenote`

# Chrome extension runtime

Extensions in this repo use Manifest V3. sidenote's UI is a side panel (`chrome.sidePanel`), not a page injected over the whole window.

The old product UI was a wide two-pane surface (page comment on the left, collections on the right). A Chrome side panel is a narrow column, so the scaffold stacks Page and the note list. The reference image is `documents/specs/products/sidenote/reference-ui.jpg`.

## Build

`src/**/*.ts` is typechecked and emitted to `dist/` by `tsc`. `public/` (manifest, html, css) is copied onto `dist/` afterwards. There is no bundler yet.

That is enough while the extension imports only its own modules and Chrome APIs. When it needs an npm library at runtime, switch to a bundler and keep `tsc` for typecheck (`noEmit`), closer to `apps/chrome/tsconfig.json-crx_sample`.

Browser ESM imports in TypeScript source must end in `.js`, because that is the path Chrome loads after emit.

## Permissions in the scaffold

| Permission | Why |
| --- | --- |
| `sidePanel` | The product UI |
| `storage` | `chrome.storage.local` drafts |
| `activeTab`, `scripting` | Read the active tab title, URL, and selection after a user click |
| host `https://api.kchloe.co/*` | Reserved for Fast2. The scaffold does not send notes yet |

`activeTab` is granted for the tab where the user invoked the extension. It is not a permanent read of every site. A content script on `<all_urls>` is a later decision, and it is a heavier Web Store review.

## Data

| Store | Contents |
| --- | --- |
| `chrome.storage.local` | Draft notes on this browser profile. Key `sidenote.notes` |
| Fast2 `https://api.kchloe.co/api/v1` | Later: journal note create, and reconciliation onto kchloe tasks or tags. Same API family as `gsheet_sync`, fixed origin instead of a sheet cell |

Do not commit tokens, and do not put user page text into the git repo.
