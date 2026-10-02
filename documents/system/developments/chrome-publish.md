Status: active  
Owner: jungh  
Last reviewed: 2026-10-02  
Related code: `apps/chrome/sidenote`  
Store docs: [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish)

# Chrome publish

sidenote goes through four stages. Stage 1 and 2 are local. Stage 3 and 4 are the store. Do them in order. A store item does not exist until the first upload.

## Stage 1 — build

```bash
cd ~/webProjects/google-scripts
pnpm --filter sidenote typecheck
pnpm --filter sidenote build
```

`build` writes `apps/chrome/sidenote/dist/`: compiled JS plus `manifest.json`, `panel/index.html`, and CSS. `dist/` is gitignored. The manifest version is `0.2.0` until you bump `public/manifest.json` and `package.json` together.

## Stage 2 — load unpacked

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Load unpacked and choose `apps/chrome/sidenote/dist` (the directory that contains `manifest.json`, not the repo root and not `src/`).
4. Open an https page and click the toolbar action. The first column overlays the right edge. It does not use `chrome.sidePanel`.
5. Add a note. It stays in `chrome.storage.local` for this profile (`sidenote.state`).

After a code change, run `build` again and press Reload on the extension card. Chrome does not watch `dist/`.

The unpacked extension id changes if you delete the load and load again, unless you set a stable `"key"` in the manifest. Leave `key` unset until you need a stable id for OAuth. The store assigns the public id at first upload.

Check the service worker console from the extension card when the panel is blank. The panel console is the iframe's DevTools. A common miss is loading `src/` or the package root instead of `dist/`. `chrome://` pages refuse the inject.

## Stage 3 — package the zip

The zip root must be the contents of `dist/`, so `manifest.json` is at the top of the zip.

```bash
cd apps/chrome/sidenote/dist
zip -r ../sidenote-0.2.0.zip .
```

Do not zip `node_modules`, `src`, or the whole repo. `sidenote-0.2.0.zip` sits next to `dist/` and should not be committed. Bump the manifest version for every upload Chrome has not seen before. The store rejects a reused version.

Before the first public listing, add:

| Asset | Why |
| --- | --- |
| Icons, at least 128×128, referenced from the manifest | The store listing and the toolbar |
| A short description and screenshots of the overlay | Listing. The old marketing image in `documents/specs/products/sidenote/reference-ui.jpg` is a product reference, not the new screenshot |
| Privacy disclosure that matches the permissions | `storage` (local notes), `activeTab` / `scripting` (read the tab after a click), host `https://api.kchloe.co/*` (account sync, even if the call is not implemented yet) |

If a permission is declared and unused, remove it before review rather than explaining a future feature. When Fast2 sync lands, the host permission stays and the privacy text must say that note text and page URL are sent to `api.kchloe.co` for the signed-in user.

## Stage 4 — Chrome Web Store

1. Register a developer account in the [Chrome Web Store developer console](https://chrome.google.com/webstore/devconsole). There is a one-time registration fee. Use the Google account that should own the item.
2. New item → upload `sidenote-0.2.0.zip`.
3. Store listing: name, summary, description, category, language, screenshots, icon.
4. Privacy: a privacy policy URL, permission justifications, and data-use questions. Single purpose should match the spec: jot a note on the page you are visiting, optionally save it to the user's kchloe / journal account.
5. Submit for review. Review is not instant. The dashboard shows the status.
6. After approval, publish to public, unlisted, or trusted testers. Unlisted or a tester group is the right first publish.

Updates: bump the version, rebuild, zip `dist/`, upload a new package on the same store item. The extension id stays. Users on the stable channel receive the update on Chrome's schedule after you publish.

## Local versus store

| | Unpacked | Store |
| --- | --- | --- |
| Who has it | This Chrome profile | Accounts you publish to |
| Id | Changes if you remove and reload, unless `key` is set | Stable after first upload |
| Update | Manual reload | Upload a higher version |
| Review | None | Google review |

Account sync to `api.kchloe.co` is specified and not implemented. Do not describe it as a working store feature until the client sends a real request and the privacy form says so.
