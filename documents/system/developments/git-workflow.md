Status: active  
Owner: jungh  
Last reviewed: 2026-10-01

# Git workflow

Remote: `origin` → `https://github.com/andrew-kewtea/google-scripts.git`.  
Current working branch: `dev_jungh`. Merges to the default branch have gone through pull requests (`#1`, `#3`).

## Commit

- `pnpm-lock.yaml` is source. Commit it in the same change as `package.json` or the catalog.
- `.clasp.json` is source. It binds a directory to a scriptId. Do not commit a second developer's script by overwriting it without meaning to.
- Do not commit `.clasprc.json`, `.env`, `node_modules/`, `dist/`, or a Web Store zip.
- Do not commit sheet screenshots that show access tokens (settings cells G5 / G6).

## Docs

A behavior change updates the product spec in the same work as the code. A one-off investigation stays in `specs/sprints/YYMMDD_slug/`. If the outcome should outlive the sprint, move the stable part into `system/subsystems/` or `specs/products/`, and leave the sprint folder as the record of the decision.

Code comments and `readme.txt` point at those docs. They do not become a second spec.
