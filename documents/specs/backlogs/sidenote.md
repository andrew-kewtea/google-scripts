# sidenote backlog

Status: active  
Code: `apps/chrome/sidenote`  
Spec: `documents/specs/products/sidenote/spec.md`

Not started. The scaffold only stores local drafts.

| Item | Note |
| --- | --- |
| Sign-in | Session for `https://api.kchloe.co`. Token in `chrome.storage.local`, never in git |
| Journal create | Visited page → Fast2 journal note. Contract from the fast2 repo, client in `src/lib/api.ts` |
| Reconcile | Same capture may attach to an existing kchloe task or tag, and to journal at the same time |
| Collections | Old UI had server-backed collections. Scaffold has a local name string only |
| Edit / delete | Old UI had Save, Cancel, Delete |
| Listing assets | Icon 128px, screenshots of this side panel, privacy text. See `documents/system/developments/chrome-publish.md` |
| Permission trim | Drop `https://api.kchloe.co/*` from the manifest until the first real request, or keep it and justify it at review. Do not claim sync works before it does |
