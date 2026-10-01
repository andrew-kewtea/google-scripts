# gsheet_sync backlog

Status: active  
Code: `apps/gas/bound/gsheet_sync`

Moved from `readme_todo.txt` on 2026-10-01. Push itself is implemented. These items are still open or easy to forget.

| Item | Note |
| --- | --- |
| Tag filter | Notes column Tag is sent as list query `q`. A real tag filter needs a Fast2 field and a mapping change in `src/models/notes.js` |
| Pinned deployment | `clasp push` updates head. A version-pinned deployment needs `clasp version` and `update-deployment`. Commands: `documents/system/developments/clasp.md` |
| Local API base | E7 often points at ngrok. When the tunnel URL changes, the sheet cell must change. Header `ngrok-skip-browser-warning` stays |
| Token handling | Access and refresh live in G5/G6. Rotate if they leak. Do not paste them into docs |
| notes PATCH shape | `PATCH /api/v1/notes/` with `id` in the body. If Fast2 moves to `PATCH /notes/{id}`, remove `patchBodyIdOnly` and the branch in `push.js` |

New models still follow `documents/specs/products/gsheet_sync/spec.md` section 5.
