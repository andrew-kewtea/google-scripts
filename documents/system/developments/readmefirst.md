Status: active  
Owner: jungh  
Last reviewed: 2026-10-01

# Development notes

`developments/`는 설치와 배포처럼 자주 바뀌는 운영 문서다. 제품 동작의 기준은 `specs/products/`와 `system/subsystems/`에 둔다.  
Architecture decisions go to `documents/system/decisions/`.

## Quickstart

오늘 명령만: [`quickstart.md`](quickstart.md).  
git pull → 루트 `pnpm install` → bound script는 clasp push, Chrome extension은 `dist/`를 로컬에 로드.

## Index

| Doc | Contents |
| --- | --- |
| `quickstart.md` | git, pnpm install, clasp push, Chrome unpacked load |
| `using-this-repo.md` | Daily commands for this monorepo |
| `node-toolchain.md` | nvm, WSL PATH, npm vs pnpm, global clasp |
| `pnpm-workspace.md` | Workspace globs, catalog, what was fixed |
| `clasp.md` | Login, push, version, deployment |
| `chrome-publish.md` | Unpacked load through Chrome Web Store |
| `git-workflow.md` | Branch, secrets, lockfile |

## Reading order

| Situation | Read |
| --- | --- |
| Today's commands | `quickstart.md` |
| New machine or after git pull | `quickstart.md`, then `node-toolchain.md` |
| `pnpm` error, wrong package, extra lockfile | `pnpm-workspace.md` |
| Sheet script upload | `clasp.md` |
| Extension upload | `chrome-publish.md` |
