# documents

Status: active  
Owner: jungh  
Last reviewed: 2026-10-01

이 폴더는 google-scripts의 canonical documentation hub다. fast2 / vuejs의 `documents/`와 같은 역할이다. 코드 옆 `readme.txt`는 짧은 지도만 둔다.

This repo is a multi-product monorepo: Google Apps Script projects and Chrome extensions, published with clasp or the Chrome Web Store, and synced to one GitHub repository.

## Where to read

| 상황 Situation | 문서 Doc |
| --- | --- |
| 레포를 처음 연다 | `system/developments/using-this-repo.md` |
| pnpm, Node, clasp, Chrome 배포 | `system/developments/readmefirst.md` |
| 제품이 무엇을 하는가 | `system/prd.md`, `specs/products/` |
| 폴더를 어디에 두는가 | `system/subsystems/workspace_layout.md` |
| 아직 스프린트에 없는 일 | `specs/backlogs/readme.md` |
| 이번에 하는 일 | `specs/sprints/` |
| 왜 그렇게 정했는가 | `system/decisions/readme.md` |

## Layout

| Path | Role |
| --- | --- |
| `system/` | Long-lived product and platform design |
| `system/subsystems/` | Cross-product rules (GAS runtime, Chrome MV3, folder layout) |
| `system/developments/` | Setup, pnpm, clasp, publish, git. Changes more often than design |
| `system/decisions/` | ADR. The why. Daily source of truth stays in subsystems or product specs |
| `specs/products/` | One spec per product |
| `specs/backlogs/` | Not yet in a sprint |
| `specs/sprints/YYMMDD_slug/` | Selected work |
| `templates/` | Empty forms |
| `archived/` | Retired efforts. Code history stays in git |

새 제품 spec은 `templates/spec.md`를 복사한다. 새 결정은 `templates/adr.md`를 복사해 `system/decisions/`에 둔다.
