# sidenote — Chrome Extension 개발 가이드

> 디자인 기준 파일: `SidenotePanel.dc.html` (패널 본체), `Sidenote Prototype.dc.html` (페이지 위 동작), `Sidenote States.dc.html` (상태별 화면).
> 이전 버전 참고: `SidenotePanel v1.dc.html` (minimal 이전안), `SidenotePanel v2.dc.html` (애니메이션·subtree 이전안) — 구현 기준 아님
> 최종 수정: 2026-10-02 — 애니메이션, About 다중 URL pattern(modal)·page subtree, History 필터 5종, Collections/Tasks 정렬, Projects 편집 modal 반영 / 이후: 로컬 모드 외부링크 숨김, Collection 본문 1줄 말줄임, Task 번호·상태(Active/Inactive/Draft)·inline 편집, General › Display limits modal, 패널 높이·가로 스크롤 수정

---

## 1. 제품 개요

웹페이지 옆에 붙는 노트 패널. 사용자가 **노트를 쓰고**, 페이지에서 **읽고·조작·복사한 이력(history)을 자동 기록**한다. 데이터는 kewtea **journal**(collections)과 **kchloe**(tasks)로 연결되어 사용자의 관심사를 정리한다.

핵심 원칙
- **로그인 없이 바로 동작** — 처음엔 로컬 저장, 로그인하면 로컬→클라우드 병합 후 클라우드가 main DB.
- **최소 UI** — 섹션 제목만 bold(500), 아이콘 또는 텍스트 중 하나만, 설정은 기본 form 요소만.
- 상세 편집/관리는 journal·kchloe 웹에서. 패널은 최근 10개 + Show more까지만.

---

## 2. 아키텍처 (Manifest V3)

```
manifest.json
background/service-worker.js   ← action 클릭, 인증, 동기화, 알람
content/
  inject.js                    ← 패널 마운트(Shadow DOM), 토글
  tracker.js                   ← history 이벤트 수집
panel/                         ← 패널 UI (Vue/React 등, shadow root 안에 렌더)
shared/
  storage.js                   ← 로컬/클라우드 저장 추상화
  urlmatch.js                  ← URL pattern 매칭
  sync.js                      ← 병합/충돌 처리
_locales/{en,ko,ja}/messages.json
```

### 2.1 패널 표시 방식
- 요구사항: **페이지 위에 겹침(overlay)**, 오른쪽 끝에 붙음. → `chrome.sidePanel` API는 페이지를 밀어내고 너비 제어가 제한되므로 **사용하지 않는다**.
- `chrome.action.onClicked` → service worker → `chrome.scripting.executeScript`로 `inject.js` 주입(이미 있으면 토글 메시지만).
- `inject.js`는 `<div id="sidenote-root">`를 `document.documentElement`에 붙이고 **`attachShadow({mode:'closed'})`** 안에 UI를 렌더한다.
  - 대안: 패널을 확장 페이지(`panel.html`)로 만들고 `<iframe>`으로 삽입 — CSS/JS 격리가 가장 확실하고 페이지 CSP 영향이 없다. **페이지 CSP가 엄격한 사이트가 많으면 iframe 방식 권장.** 이 경우 history 수집(content script)과 패널(iframe)은 `chrome.runtime` 메시지 또는 `postMessage`로 통신.
- 호스트 컨테이너 스타일: `position:fixed; top:0; right:0; bottom:0; z-index:2147483646; height:100vh;`

### 2.2 권한
```json
"permissions": ["storage", "scripting", "activeTab", "identity", "alarms"],
"host_permissions": ["<all_urls>"],          // history 자동기록 시 필요. 스토어 심사 사유 명시
"optional_permissions": [],
"action": { "default_title": "sidenote" }
```
- `unlimitedStorage`는 로컬 용량을 늘려야 할 때만 추가(설정 화면의 "x / 5 MB" 표기를 실제 quota에 맞출 것 — 기본 `chrome.storage.local` 한도는 10MB).

---

## 3. 화면 구조 (UI)

### 3.1 컬럼
| | 너비 | 상단 바 | 섹션 |
|---|---|---|---|
| 1st column | **360px** | → (expand) / ← (collapse), × (패널 닫기) | About, Notes, History |
| 2nd column | **520px** (+ border 1px = 521) | × (2nd column만 닫기 = ← 와 동일) | Collections, Tasks, Settings |

- 툴바 버튼 클릭 → **1st column만** 표시.
- → 클릭 → 2nd column이 1st 오른쪽에 붙어 전체 880px. 버튼 아이콘은 ←로 바뀜. 패널은 오른쪽 정렬이므로 왼쪽으로 넓어진다.
- **열고 닫기 애니메이션**
  - 패널(1st column): `transform: translateX(0)` ↔ `translateX(calc(100% + 60px))` + opacity, 340ms. 닫혀도 언마운트하지 않고 `pointer-events:none` (상태 유지, 그림자까지 화면 밖으로).
  - 2nd column: 바깥 래퍼 `width: 0 ↔ 521px; overflow:hidden; transition: width 340ms`, 안쪽은 **고정 521px** — 내용이 리플로우되지 않고 잘려 나오듯 열린다.
  - easing 공통: `cubic-bezier(.2,.8,.2,1)`. `prefers-reduced-motion: reduce`면 transition 0.
- 상단 바: 높이 46px, 배경 `#2b2a27`, 제품명/계정/동기화 표시 **없음**.
- 2nd column의 펼침 상태, 섹션 open 상태는 `chrome.storage.local`에 UI 상태로 저장해 다음에 열 때 복원.

### 3.2 아코디언 & 스크롤 (중요)
- **컬럼 전체 스크롤 없음.** 컬럼 = `display:flex; flex-direction:column; overflow:hidden; height:100%`.
- 패널 루트: `height:100vh; min-height:640px; width:max-content` — 뷰포트 높이를 항상 채우고, 640px 미만 창에서는 섹션을 더 짓누르지 않고 루트가 스크롤된다(섹션이 96px 이하로 찌그러지는 것 방지).
- 섹션 헤더: `flex:none; height:46px`. 클릭 시 토글. **여러 섹션 동시에 열기 가능.**
- 섹션 body는 **닫혀도 언마운트하지 않고** 높이만 애니메이션한다(접기/펴기 모두 부드럽게):
  - About: `flex:0 1 auto; max-height: 0 ↔ 640px; transition: max-height 300ms`
  - 그 외(Notes, History, Collections, Tasks, Settings): `flex: 0 1 0px ↔ 1 1 0px; min-height: 0 ↔ 96px; transition: flex-grow, min-height 300ms` → 열린 섹션들이 남는 높이를 **균등 분배**
  - 닫힘 상태는 `border-bottom-width:0`, 내부 포커스 요소는 `inert` 처리(키보드 탭 이동 차단)
  - 공통: `overflow-y:auto; overflow-x:hidden` → **섹션 안에서만 세로 스크롤**, 가로 스크롤바는 절대 노출하지 않음(긴 URL·제목은 ellipsis)
- 서브섹션(collection, task project 그룹, settings 항목)은 grid 트릭: `display:grid; grid-template-rows: 0fr ↔ 1fr; transition 260ms` + 자식 `min-height:0; overflow:hidden`.
- 드롭다운·modal 등장: fade + 6px 위에서 내려오는 pop(160–220ms).
- 결과: 닫힌 섹션 헤더는 자연스럽게 컬럼 **하단에 붙는다**(예: History를 닫으면 Notes가 늘어나고 History 헤더는 바닥).

### 3.3 섹션 > 서브섹션 들여쓰기
| 레벨 | 좌측 padding |
|---|---|
| 섹션 헤더 / 섹션 내 행 | 16px |
| 서브섹션 헤더 (collection, task project, settings 항목) | 28px |
| 서브섹션 내용 | 40px |

### 3.4 1st column 섹션
**About** (view ↔ edit 스왑)
- View: 페이지 제목, URL(muted) + 오른쪽 **mini tune 아이콘**(16px, `--faint`), 태그 칩. 아이콘 외 영역 클릭 → Edit.
- Edit: 제목 input, 태그(Enter로 추가, × 삭제), Save / Cancel. (URL pattern은 여기서 편집하지 않음)
- **URL patterns modal** (tune 아이콘 클릭, 1st column 위에 overlay)
  - 헤더: `URL patterns {개수}` + ×. 본문: 패턴 input 목록(각 × 삭제), dashed "Add pattern · Enter" input, "Ignore ?query and #hash" 체크박스.
  - 하단: "None = this page only" 안내, Save / Cancel. 배경 클릭·Esc = Cancel. 저장 시 공백 제거·중복 제거.
- **Page subtree** (About 하단, 구분선 아래, 제목/설명 라벨 없음)
  - 같은 사이트의 경로를 parent-children 트리로 표시. **기본은 도메인 노드 1줄만(접힘)**.
  - 행: chevron(자식 있을 때만) / 경로 세그먼트(폴더는 끝에 `/`) / 노트 수(0이면 숨김). 들여쓰기 = 4 + depth×16px.
  - chevron 클릭 = 펼침/접기, 이름 클릭 = **새 탭으로 열기**(`<a target="_blank" rel="noopener">` 또는 `chrome.tabs.create`).
  - 노트 수는 **하위 노드 합계**. 현재 페이지 행은 `--chip` 배경으로 강조.
  - 표시 범위: 사이트 전체가 아니라 **노트가 있거나 최근(예: 30일) 방문한 경로만** 포함해 트리 구성. 중간 경로는 이 경로들의 조상만 생성.

**Notes**
- 툴바(우측): 정렬 아이콘 드롭다운(By time / By page order), + (새 노트).
- 노트 행: `시간 (edited 시간)` + 공개범위 아이콘 드롭다운 / 본문 / `collection #keyword` (muted 텍스트).
- 본문 클릭 → Edit: dashed textarea, collection select, keyword input(Enter → 검은 칩), Save / Cancel / Delete(red).
- 새 노트를 빈 채로 Cancel/Save하면 삭제.
- "Page order" = 노트에 저장된 페이지 앵커 위치(문서 내 offset) 순.

**History**
- 헤더: `History 18 ●` — ●(green `#8fb08a`)는 기록 중 상태. 일시정지 시 회색 등으로 표현(텍스트 없음).
- 툴바: 필터 드롭다운. **닫힌 상태에서는 아이콘만**(선택된 필터의 아이콘, 'All' 아닐 때 배경 강조). 목록에서만 라벨+개수 표시: **All, Read, Links, Inputs, Highlights** (5종).
  - Read = 읽은 블록 + 스크롤 깊이 + 체류 시간(이전 read/scroll/dwell 통합)
  - Links = 링크 클릭 / Inputs = form 입력 / Highlights = 텍스트 복사(copy)
- 행: 유형 아이콘 / 요약 텍스트 / 보조정보 / 시간. (pin·scrap 기능 없음)
- 행 클릭 → 선택 상태에서 edit·delete **아이콘 버튼** 노출. Edit 시 textarea + Save/Cancel.
- 기본 최근 10개, 아래 **Show more(pill 버튼)**로 10개씩 추가.

### 3.5 2nd column 섹션
**Collections** (journal 동기화) — 서브섹션 = 각 collection
- 행: 이름, 개수, ●(현재 노트가 저장될 대상), 수정시각, 공개범위 아이콘, **open_in_new 아이콘(journal에서 열기, 로그인 시만)**, chevron.
- 펼치면 최근 entry(시간·URL·본문). 본문은 **한 줄, 약 20단어까지 + …** (전체는 title tooltip). entry 수는 Display limits 설정값.
- 툴바(우측): **정렬 드롭다운(By recency / By size)** + "+". By size = 항목 수 내림차순.
- + 로 새 collection(이름 입력 후 Enter). 최근 10개 + Show more, 끝까지 보이면 "All collections in journal" 링크(로그인 시만).
- **로컬 모드(Account = Local)**: journal/kchloe로 가는 아이콘·링크는 모두 숨김(Collections, Tasks 공통).

**Tasks** (kchloe 동기화) — 서브섹션 = project 그룹
- 툴바: 왼쪽 끝 **mini tune 아이콘**(Projects 편집, 눈에 덜 띄게 `--faint`) / 오른쪽 정렬 드롭다운(By recency / By size) + "+".
  - By recency = 그룹 내 가장 최근 task 순, By size = 그룹의 task 수 순.
  - **Uncategorized 그룹**(project 없는 task, 회색 dot)은 정렬과 무관하게 항상 마지막.
- 그룹 헤더: 색 dot, 프로젝트명, 개수. 행: 번호, 제목, 상태 dot+라벨, due, open_in_new(kchloe, 로그인 시만).
- **번호**: 로컬 모드 = 로컬 자체 순번(`localNo`), 로그인·동기화 후 = kchloe가 부여한 번호(`remoteNo`, 동기화 전이면 `—`).
- **상태는 3개만**: Active(녹색) / Inactive(회색) / Draft(황색). 새 task 기본값 Draft. 날짜는 due만.
- **행 클릭 → inline 편집**: 제목, project, status select, due(date input), Save / Cancel / Delete. Enter 저장, Esc 취소.
- + → 새 task(제목, project select(+Uncategorized), Create/Cancel). 생성 시 현재 페이지 URL을 reference로 첨부.
- **Projects modal** (2nd column 위 overlay): 행 = 색 dot(클릭 시 팔레트 순환) / 이름 inline input / task 수 / 삭제. 하단에 "New project · Enter", "Tasks of a deleted project move to Uncategorized." 안내, Done. 배경 클릭·Esc로 닫기, 빈 이름은 "Untitled".
- 목록 / 새 task / task 편집(제목·project·status·due) / project 편집 / kchloe에서 열기 지원. 그 외 상세는 kchloe에서.

**Settings** — 서브섹션 4개, 아이콘·설명 없이 `라벨 — form control` 행만
- General: Language, Time zone, Theme (select). 헤더 라벨 옆 **mini tune 아이콘 → Display limits modal**:
  - Collections shown(기본 10) / Notes per collection max(기본 3) / Tasks shown(기본 10), number input 1–50, Save/Cancel.
  - Show more는 같은 개수만큼 추가 로드. API page size도 이 값 사용.
- Account
  - 로컬 모드: "This device" 사용량 바 + `1.2 / 5 MB`, Email/Password(폼 영역 max-width 300px), 버튼 행 = **Log in, Google 왼쪽 정렬 / "Create account" 텍스트 링크 오른쪽**, 한 줄 안내.
  - 로그인: Email, Sync(● + 마지막 동기화 시각), Offline cache, Sign out.
- Tags: 헤더에 태그 개수, 정렬 select + "+", 행 = 이름·개수·공개범위 드롭다운(Private / @group… / Public)
- User groups: 헤더에 `2 / 3` 슬롯, "+"(슬롯 꽉 차면 비활성), 행 = 이름·개수·@handle·read-access 체크박스·status select(active/inactive/archived)

---

## 4. 스타일 (CSS)

### 4.1 원칙
- 폰트: **Jost** (400 / 500만 사용). **bold(500)는 섹션 제목에만.** 그 외 모두 400.
- 아이콘: Material Symbols Outlined (weight 300–400). **아이콘과 설명 텍스트를 함께 두지 않는다** — 아이콘 버튼은 `title`/`aria-label`로 의미 제공.
- 페이지 CSS 격리를 위해 Shadow DOM(또는 iframe) 내부에서 **reset 후 토큰 사용**. `:host { all: initial; }` 권장.
- 폰트는 확장 패키지에 포함(`web_accessible_resources`)하고 `@font-face`로 로드 — 외부 CDN은 페이지 CSP에 막힐 수 있다.

### 4.2 토큰
```css
:host{
  --ink:#1f1e1c;      --ink-2:#5c5850;   --muted:#8b877e;  --faint:#b3ada1;
  --bg:#fbf9f4;       --head:#f3efe6;    --hover:#f6f2ea;  --chip:#ece6d8;
  --line:#e6e1d6;     --line-2:#efebe2;  --field:#e0dacd;  --dash:#a9a293;
  --bar:#2b2a27;      --bar-ink:#f4f1ea;
  --accent:#c9a35a;   /* 저장 대상 dot, 사용량 바 */
  --selected:#f4efe3; --overlay:rgba(31,30,28,.28);
  --link:#5d7fa8;     --danger:#b5523f;
  --ok:#8fb08a; --info:#7fa3d6; --warn:#d2a85a; --err:#cf7d6e;  /* 상태 dot */
  --font: 'Jost', system-ui, sans-serif;
  --shadow-panel: -14px 0 40px rgba(30,28,24,.20);
  --shadow-menu: 0 12px 32px rgba(30,28,24,.16);
  --shadow-modal: 0 20px 50px rgba(30,28,24,.28);
  --ease: cubic-bezier(.2,.8,.2,1);
}
```

### 4.3 크기
| 요소 | 값 |
|---|---|
| 본문 | 14px / 노트 본문 14.5px, line-height 1.55 |
| 섹션 제목 | 15px, weight 500 |
| 서브섹션 제목 | 14px |
| 메타/보조 | 12–12.5px, `--muted` |
| 소제목 라벨 (URL PATTERNS) | 11px, uppercase, letter-spacing .14em |
| 섹션 헤더 높이 | 46px / 서브섹션 헤더 40–42px |
| 아이콘 버튼 | 30×30 (상단바 34×34), radius 8 |
| 텍스트 버튼 (Save 등) | height 30, padding 0 14px, 1px solid `--ink`, radius 6 |
| Show more | pill: height 32, 1px `--field`, radius 99 |
| mini 아이콘 (tune) | 24×24 버튼, 아이콘 16px, `--faint` → hover `--ink-2` |
| Modal | 폭 328px(1st) / 380px(2nd, Display limits 340px), radius 12, 상단 110px, max-height 70%, 헤더 46px |
| Task 행 | grid `38px 1fr 72px 48px 20px`, 높이 38, 클릭 시 inline 편집(배경 `#f6f2ea`) |
| 상태 dot | Active `#8fb08a` / Inactive `#b3ada1` / Draft `#d2a85a` |
| 드롭다운 메뉴 | 흰 배경, radius 12, padding 6, 항목 높이 34, `--shadow-menu` |

---

## 5. 데이터 모델

```ts
type Visibility = 'private' | 'public' | `group:${string}`;

interface PageScope {            // About
  id: string;
  title: string;
  url: string;                   // 최초 생성 URL (정규화)
  patterns: string[];            // 예: ['docs.tablekit.dev/script/reference/*', '…/guides/*']  (빈 배열이면 해당 URL만)
  ignoreQuery: boolean;
  tags: string[];
  updatedAt: number;
}

interface Note {
  id: string; scopeId: string;
  text: string; visibility: Visibility;
  collectionId: string; keywords: string[];
  anchor?: { selector: string; offset: number; textQuote?: string }; // page order 정렬용
  createdAt: number; updatedAt: number; deletedAt?: number;
}

interface HistoryItem {
  id: string; scopeId: string; url: string;
  kind: 'read' | 'link' | 'form' | 'copy';   // 필터: All / Read / Links / Inputs / Highlights
  text: string;                  // 사용자 편집 가능
  meta?: { durationMs?: number; section?: string; href?: string; depth?: number; paragraphs?: number };
  editedByUser?: boolean;
  createdAt: number; deletedAt?: number;
}

interface Project {              // Tasks 그룹 (kchloe)
  id: string; name: string; color: string; order: number; updatedAt: number;
}
// Task.projectId 가 null/삭제된 project → Uncategorized

interface Task {
  id: string; localNo: number;   // 로컬 자체 순번
  remoteNo?: number;             // kchloe 동기화 후 부여
  title: string; projectId: string | null;
  status: 'active' | 'inactive' | 'draft';
  due?: string;                  // YYYY-MM-DD
  refUrl?: string; updatedAt: number;
}

interface DisplayLimits { collections: number; notesPerCollection: number; tasks: number; } // settings.general

interface PageNode {             // About subtree (계산값, 저장 안 함)
  path: string; segment: string; children: PageNode[];
  noteCount: number;             // 하위 합계
  lastVisitedAt?: number;
}
```
- 모든 레코드에 `updatedAt`, soft delete용 `deletedAt` — 동기화 병합에 필요.
- ID는 클라이언트 생성(UUID v7 권장, 시간순 정렬 가능).

---

## 6. 주요 구현

### 6.1 URL pattern 매칭 (`urlmatch.js`)
1. URL 정규화: 프로토콜·`www.` 제거, 소문자 host, 끝 `/` 제거, `ignoreQuery`면 `?…`/`#…` 제거.
2. 패턴은 `*` 와일드카드만 허용 → 정규식으로 변환(나머지 문자는 escape).
3. scope는 **패턴 여러 개**를 가질 수 있고 하나라도 맞으면 매칭(OR). 서로 다른 scope가 동시에 매칭되면 **가장 구체적인 패턴(고정 문자 길이 최대)** 우선.
4. 매칭 scope의 notes/history를 공유한다. History 행에는 실제 `url`을 보존(어느 페이지에서 발생했는지).
5. 패턴 변경 시 기존 데이터는 이동하지 않고 scope만 바뀜 — 영향 페이지 수를 미리 보여주는 것은 후속 과제.
6. **Page subtree 생성**: 같은 host의 note가 있는 URL + 최근 방문 URL을 모아 경로를 `/`로 분할 → trie 구성 → 노트 수 bottom-up 합산. 노드 수 상한(예: 60) 초과 시 오래된 leaf부터 제외. 펼침 상태는 UI 상태로 저장(기본 모두 접힘).

### 6.2 History 수집 (`tracker.js`)
| kind | 방법 | 기록 조건 |
|---|---|---|
| read | `IntersectionObserver`로 p/li/h*/pre 블록 관찰, 화면 중앙 영역에 머문 시간 누적 | 누적 ≥ 8초(조정값) → 블록 앞부분 120자 + 섹션 heading |
| read (scroll) | `scroll` throttle(500ms), 최대 도달 깊이 | 깊이 10% 단위 증가 시 "Read to N%", 30초 이내 직전 행과 **병합** |
| read (dwell) | `visibilitychange` + 활동 감지 | 섹션별 체류 ≥ 60초 → "Nm Ns on {section}" |
| link | `click` capture, `a[href]` | 외부/내부 링크 텍스트 + href |
| form | `input`/`change` debounce(1.5s) | **password, hidden, cc, autocomplete="off"·`one-time-code` 필드 제외.** 검색 input은 값 기록, 일반 입력은 "Typed in {label}" + 앞 40자 |
| copy | `copy` 이벤트 + `getSelection()` | 선택 텍스트 앞 200자 + 섹션 heading. 입력 필드 내부 복사는 제외 |

- 탭이 hidden이거나 사용자 비활성(마우스/키 입력 30초 없음)이면 시간 누적 중지.
- SPA 대응: `history.pushState/replaceState` 래핑 + `popstate` → URL 변경 시 scope 재계산.
- 기록 일시정지/사이트 제외 목록은 설정 확장 시 추가(헤더 ● 색으로만 상태 표시).
- 성능: 관찰 대상 블록 수 상한(예: 500), `requestIdleCallback`으로 저장 배치(2초).

### 6.3 저장소 (`storage.js`)
- 공통 인터페이스: `get/put/list/remove(collection, query)` → 로컬/클라우드 어댑터 교체.
- **로컬 모드**: `chrome.storage.local` (content script의 `window.localStorage`는 **페이지 origin에 저장되므로 사용 금지**). 키 전략: `scope:{id}`, `notes:{scopeId}`, `history:{scopeId}`(배열 청크, 최근 200행 유지).
- 사용량: `chrome.storage.local.getBytesInUse()` → Account의 사용량 바. 80% 초과 시 오래된 history(copy 제외)부터 정리 + 로그인 권유.
- 로그인 모드: 클라우드가 source of truth, 로컬은 offline cache + outbox(미전송 변경 큐).

### 6.4 로그인 & 동기화 (`sync.js`)
- 인증: `chrome.identity.launchWebAuthFlow`로 kewtea OAuth(Google 포함) → access/refresh token은 **service worker에서만** 보관(`chrome.storage.session` 또는 local 암호화). content script/패널에 토큰 노출 금지.
- 최초 로그인 병합:
  1. 로컬 전체 레코드 업로드(id 유지) → 서버는 id 기준 upsert.
  2. 같은 id 충돌 시 `updatedAt` 최신 우선(LWW), `deletedAt` 있으면 삭제 우선.
  3. 같은 URL scope가 서버에도 있으면 scope 병합(태그 합집합, notes/history는 scopeId 재매핑).
  4. 완료 후 로컬을 cache로 전환. 진행 중 UI: 로그인 버튼 "Syncing…", 안내 문구에 항목 수.
- 이후: 변경은 outbox → 백그라운드 `alarms`(1분) + 패널 열릴 때 즉시 push/pull. `since` 커서 기반 증분 pull.
- Collections → journal API, Tasks → kchloe API. 패널은 **Display limits 값만큼 요청**(기본 10, cursor로 Show more).
- Sign out: 클라우드 데이터는 유지, 로컬 cache 삭제 여부를 확인받는다.

### 6.5 드롭다운 (공통 컴포넌트)
- 대상: notes 정렬, history 필터, collections/tasks 정렬, 노트/태그 공개범위.
- **한 번에 하나만 열림** — 전역 `openMenu` 상태 `{kind, id}`.
- **바깥 클릭 시 닫힘(기본 동작)**: shadow root(또는 document)에 `pointerdown` 리스너 → `event.composedPath()`에 메뉴/트리거가 없으면 닫기. Shadow DOM에서는 `event.target`이 host로 retarget되므로 **반드시 `composedPath()` 사용**.
- Esc로 닫기, 항목 선택 시 닫기, 섹션 스크롤 시 닫기.
- 메뉴는 섹션 스크롤 영역에 잘리지 않도록 **패널 최상위 레이어(portal)** 에 `position:fixed`로 렌더하고 트리거 `getBoundingClientRect()`로 위치 계산(하단 공간 부족 시 위로 뒤집기).

### 6.6 Modal (공통)
- 대상: URL patterns(1st column 위), Projects(2nd column 위). 해당 column 영역에만 overlay(`position:absolute; inset:0`, `--overlay`).
- 배경 클릭·Esc로 닫기. URL patterns는 draft 편집 → Save 시에만 반영(Cancel = 폐기). Projects는 즉시 반영 + Done.
- 열릴 때 첫 input에 포커스, 포커스 트랩, 닫힐 때 트리거로 포커스 복귀.

### 6.7 상태 저장
- UI 상태(`expanded`, 섹션 open 맵, 노트 정렬, history 필터, collections/tasks 정렬, subtree 펼침)는 `chrome.storage.local['ui']`.
- 편집 중인 노트 draft는 입력마다 debounce(500ms) 저장 → 탭 닫힘에도 유지.

---

## 7. 주의사항

1. **CSS 격리** — 페이지 스타일이 새어 들어오거나(`* {}` , `button {}`), 우리 스타일이 페이지에 새면 안 된다. Shadow DOM + `:host{all:initial}` 또는 iframe. `rem` 대신 `px` 사용(페이지의 html font-size 영향 차단).
2. **z-index / stacking** — 일부 사이트의 고정 헤더·모달보다 위에 있어야 함: host에 최대값 근처 z-index. 전체화면 비디오에서는 자동 숨김.
3. **CSP** — 외부 폰트/스크립트 로드 금지, 인라인 스크립트 금지. 리소스는 패키지에 포함.
4. **localStorage 금지** — content script의 `localStorage`는 방문 사이트 소유. 반드시 `chrome.storage.*`.
5. **개인정보** — history는 민감 정보. password·결제·OTP 필드 절대 수집 금지, 은행/메일 등 민감 도메인 기본 제외 목록 제공, 로컬 모드 데이터는 기기 밖으로 나가지 않음을 명시. 스토어 Privacy 정책에 수집 항목 기재.
6. **성능** — scroll/input 리스너는 `passive:true` + throttle/debounce. 패널이 닫혀 있어도 tracker는 가볍게 동작해야 함(DOM 수정 없음).
7. **SPA / iframe 페이지** — URL 변경 감지, `all_frames:false` 기본(최상위 프레임만).
8. **용량** — `chrome.storage.local` quota 초과 시 write 실패 → 사용량 체크 후 정리 로직 필수. 디자인의 "5 MB"는 실제 정책값으로 교체.
9. **동기화 충돌** — LWW는 단순하지만 노트 본문 동시 편집 시 손실 가능. 서버에 이전 버전 보관(최소 1개) 권장. 충돌 UI는 현재 디자인에 없음(후속 과제).
10. **Timezone** — 저장은 UTC epoch ms, 표시만 Settings › Time zone 기준. "Today at", "Yesterday" 계산도 설정 TZ 기준.
11. **i18n** — UI 문구는 `_locales` 키로. 영어 기준 디자인이므로 한국어/일본어 길이에 맞게 말줄임(`text-overflow:ellipsis`) 유지.
12. **접근성** — 아이콘 전용 버튼에 `aria-label`, 아코디언 헤더에 `aria-expanded`, 메뉴에 `role="menu"`/키보드 이동(↑↓ Enter Esc), 포커스 링 유지.
13. **미니멀 규칙 유지** — 새 기능 추가 시에도: 섹션 제목 외 bold 금지, 아이콘+설명 병기 금지, 설명 문구 최소화, 상세 관리는 journal/kchloe로 링크.

---

## 8. 디자인에 없는 / 후속 결정 필요
- 로그인 시 로컬↔클라우드 **충돌 해결 화면**
- History 기록 **일시정지 / 사이트 제외** 설정 위치
- Collection 공개범위 변경(현재 표시만)
- 다크 테마 토큰(Theme: Dark 선택 시)
- 노트 앵커를 페이지에 하이라이트로 표시할지 여부
- Page subtree의 "최근" 기준(기간·노드 상한) 확정, 전체 사이트 트리를 journal에서 보여줄지
- Projects 순서 변경(drag) — 현재 modal은 추가/이름/색/삭제만
