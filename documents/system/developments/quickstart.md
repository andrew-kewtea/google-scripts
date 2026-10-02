Status: active  
Owner: jungh  
Last reviewed: 2026-10-02

# Quickstart

명령만. 설명은 링크한 문서에 있다.  
Commands only. Detail lives in the linked docs.

공통 1–3은 레포 루트에서 한다. `pnpm install`은 서브프로젝트로 들어간 뒤 하지 않는다.  
Steps 1–3 are at the repo root. Do not `pnpm install` after `cd` into a product.

## 1. Git sync

```bash
cd ~/webProjects/google-scripts
git status
git pull
```

## 2. pnpm install

```bash
nvm use
pnpm install
```

`package.json`이나 `pnpm-lock.yaml`이 바뀐 pull 다음에 다시 한다.  
Repeat after a pull that changes `package.json` or `pnpm-lock.yaml`.

## Bound Apps Script — `gsheet_sync`

### 3. 패키지로 이동

```bash
cd ~/webProjects/google-scripts/apps/gas/bound/gsheet_sync
```

루트에 그대로 있어도 된다. 그때는 아래 `pnpm …` 대신 `pnpm --filter gsheet_sync …` 를 쓴다.  
From the root, prefix with `pnpm --filter gsheet_sync` instead of `cd`.

### 4. clasp

한 머신에서 한 번. 그 전에 Apps Script API를 켠다: https://script.google.com/home/usersettings

```bash
pnpm exec clasp login
```

개발 중:

```bash
pnpm test
pnpm status
pnpm push
```

원격 파일을 `src/`에 덮어쓰지 않고 보려면:

```bash
pnpm run pull:snapshot
```

배포가 버전 번호에 고정되어 있을 때만:

```bash
pnpm exec clasp version
pnpm exec clasp deployments
pnpm exec clasp update-deployment <deploymentId> -V <n>
```

시트 메뉴는 push한 head를 쓴다. 웹앱 URL이나 라이브러리 버전만 위 배포 갱신이 필요하다.  
The spreadsheet menu runs head after push. Versioned web app or library deployments need the update above.

더 긴 설명: `clasp.md`

## Chrome extension — `sidenote`

clasp 없음. 개발 중 확인은 로컬 Chrome에 `dist/`를 로드한다. Web Store 업로드는 그 다음이다.  
No clasp. Day-to-day check is an unpacked load of `dist/`. Store upload comes later (`chrome-publish.md`).

### 3. 패키지로 이동

```bash
cd ~/webProjects/google-scripts/apps/chrome/sidenote
```

루트에서면 `pnpm --filter sidenote …`.

### 4. 빌드 후 로컬 로드

```bash
pnpm test
pnpm typecheck
pnpm build
```

1. `chrome://extensions`
2. Developer mode
3. Load unpacked → `apps/chrome/sidenote/dist` (`manifest.json`이 있는 폴더)
4. 코드를 고치면 `pnpm build` 하고, 확장 카드에서 Reload

Web Store에 올릴 때만 zip과 스토어 콘솔. 절차는 `chrome-publish.md`.

## 5. 주의

- 이 레포에서 `npm install` 하지 않는다.
- 레포 루트에서 `clasp push` 하지 않는다. 루트에는 `.clasp.json`이 없다.
- `clasp pull`로 `src/`를 갱신하지 않는다. `pull:snapshot`만 쓰고, 반영은 `src/`에 손으로 옮긴 뒤 push.
- 셸에서 `tsc` / `clasp`를 직접 치지 않는다. WSL PATH의 Windows `tsc`, 전역 npm clasp와 버전이 다를 수 있다. `pnpm exec` 또는 `pnpm build` / `pnpm push`.
- `.clasprc.json`, 시트 토큰, `dist/`, `node_modules/`는 커밋하지 않는다.
- 패키지 버전을 올리는 매일 명령은 `pnpm up`이 아니다. 의존성을 맞출 때는 루트에서 `pnpm install`.
