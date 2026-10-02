Status: active  
Canonical: yes  
Owner: jungh  
Last reviewed: 2026-10-02

# Product requirements

google-scripts는 여러 제품을 한 GitHub 저장소에서 개발하고, 제품마다 따로 publish 한다.  
One GitHub repo, many publish targets. It is not a hosted multi-tenant service.

## Products

| Product | Path | Runtime | Status |
| --- | --- | --- | --- |
| gsheet_sync | `apps/gas/bound/gsheet_sync` | Spreadsheet-bound Apps Script, plain JavaScript | Active. Fast2 notes / posts / users Pull and Push |
| sidenote | `apps/chrome/sidenote` | Chrome extension, Manifest V3 in-page overlay | Local two-column panel. Fast2 sync later |
| ts_gsheet_sync | removed from the working tree | TypeScript GAS prototype | Retired. See `decisions/ADR-2026-10-01-retire-ts-gsheet-sync.md` |

## Shared needs

- Local edit, then publish: clasp for GAS, unpacked load then Chrome Web Store for extensions.
- Signed-in product data goes through Fast2 at `https://api.kchloe.co`, prefix `/api/v1`. The sheet stores the API base in a cell. The extension will use the fixed origin above.
- Secrets (OAuth token in `.clasprc.json`, sheet access tokens, Chrome user tokens) stay out of git.

## Not in this version

- A shared code library (`shared/`). Revisit when a util is copied twice and the extra package is still easy to own.
- Standalone Apps Script libraries (`apps/gas/standalone/`). Reserved for a library that makes bound scripts easier, not as a product by itself.
- TypeScript as the source of bound sheet CRUD. Chrome extensions still use TypeScript.
