# sidenote API 연결

Status: implemented  
Date: 2026-10-05  
Code: `apps/chrome/sidenote`, Fast2 `url_about` / `url_match_rule` / `note_url_ref` / `web_history` / `context` / `context_task`

이 문서가 동기화 기준이다. 2026-10-02의 `background_sync.md`에서 `page_excerpt` 단일 리소스, `chrome.storage.session` 토큰, 15–30분 pull, `since` 커서를 정했던 부분은 여기로 바뀐다.

페이지 스크랩은 이 범위가 아니다. 설계는 `webPageActionContentScrap.md`에 그대로 둔다.

## 화면과 네트워크

패널은 `chrome.storage.local`의 `sidenote.state`만 그린다. dataService가 로컬 저장을 먼저 끝내고, 로그인 중이면 차이를 `sidenote.outbox`에 넣은 뒤 service worker에 `sidenote:sync`를 보낸다. 워커가 꺼져 있으면 다음 기동, 10분 `chrome.alarms`, 패널을 열 때, Refresh에서 outbox를 다시 보낸다.

받는 순서: tags, journal access groups, preferences, urls와 url abouts, notes (`has_url=1`)와 note url refs, journal collections, contexts와 context tasks, web histories, tasks, projects. 목록은 `size=20`이다. 10분 알람은 `last_updated_atFrom`으로 그 사이 변경만 합친다. Show more는 로그인 중 해당 섹션의 `page`를 1 올린다. 섹션 로컬 상한은 60이고, outbox에 있는 id는 지우지 않는다.

기본 origin은 `https://api.kchloe.co`, prefix는 `/api/v1`이다. 로컬 Fast2는 `src/lib/api.ts`의 origin 상수만 `http://localhost:5000`으로 바꾼다.

## 리소스

공통 URL은 기존 `urls`다. 코드 정규화(host 소문자, `www` 제거, hash 제거, 끝 슬래시 제거, 쿼리 제거)가 `urls.normalized_url`이다. 사용자별 제목·패턴은 `url_abouts`다. 그 외 동일 URL 규칙은 `url_match_rules`(`path_glob`, `host_alias`)다. About의 쿼리 무시 체크는 없다.

노트에 URL 컬럼은 없다. URL이 있는 노트만 `note_url_refs`로 고르고, 컬렉션 소속은 그 행의 `collection_id`다. URL 없는 노트 응답은 캐시에 넣지 않는다. 컬렉션 API는 `/journal/{uname}/collections`다.

History의 로컬 이름은 PageExcerpt다. 서버 리소스는 `web_histories`다. `contexts`와 `web_histories`의 기본 `access_level`은 `private`다. 화면의 Uncategorized는 행이 아니다. Task members는 응답을 `memberIds`로만 저장한다. 멤버 UI는 없다.

## 병합

로컬 임시 id는 `tmp_`로 시작한다. POST 응답의 서버 id로 바꾸고, 그 id를 가리키는 연결도 고친다. 이미 서버 id가 있는 행은 다시 POST하지 않고 PATCH한다. 같은 id는 `last_updated_at`이 최신인 쪽을 남긴다. 삭제가 있으면 삭제가 이긴다.

로그아웃은 토큰만 지운다. 캐시와 outbox는 남고, 다음 로그인 때 비교해서 올린다. access token이 거절되면 `POST /auth/token`으로 한 번 갱신한다. refresh도 거절되면 토큰을 지우고 패널 notice에서 Settings > Account를 연다.

토큰 키는 `sidenote.auth`다. `sidenote.state`와 분리하고, 호스트 페이지로 `postMessage`하지 않는다. Google은 `chrome.identity.launchWebAuthFlow`이고 redirect는 `https://<extension-id>.chromiumapp.org/`다. manifest `key`로 unpacked id를 고정한다. `GOOGLE_CLIENT_ID`가 비어 있으면 Google 버튼은 설정 안내만 한다. redirect URI는 Google Cloud와 Fast2 `GOOGLE_OAUTH_REDIRECT_URIS`에 넣어야 한다.

## 용량

빈 저장소는 시드하지 않는다. 저장소 JSON이 9MB 이상이면 만들기를 거절한다. 로그인 중에는 사용량 막대를 숨기고, 섹션당 약 20개 캐시로 용량을 유지한다. 9MB는 로그인 중에도 마지막 차단이다.

## 테스트

확장: `pnpm --filter sidenote test`. 가짜 저장소와 가짜 HTTP만 쓴다. `auth.test.mjs`, `sync.test.mjs`, `urlKey.test.mjs`, `tags.test.mjs`, `dataService.test.mjs`.

Fast2: `test_url_about.py`, `test_web_history.py`, `test_note_url_filter.py`. 다른 사용자는 `url_about`를 읽지 못한다. `has_url=1`은 연결 없는 노트를 빼고 `size=20`을 지킨다.
