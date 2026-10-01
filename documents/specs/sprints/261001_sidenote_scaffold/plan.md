# 261001 sidenote scaffold

Status: done for the scaffold only  
Date: 2026-10-01

## Plan

- Document the repo (`documents/`) and fix the pnpm workspace.
- Retire `ts_gsheet_sync` (ADR 2026-10-01).
- Add `apps/chrome/sidenote`: MV3 side panel, local capture and save, no Fast2 call yet.

## Done in tree

- `pnpm --filter sidenote build` emits `dist/` for unpacked load.
- Spec: `documents/specs/products/sidenote/spec.md`.
- Remaining product work: `documents/specs/backlogs/sidenote.md`.

## Not this sprint

Login, journal create, task/tag reconciliation, store listing, icons.
