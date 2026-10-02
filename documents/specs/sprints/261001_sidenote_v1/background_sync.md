# sidenote background sync

Status: design only  
Date: 2026-10-02  
Code later: `apps/chrome/sidenote/src/background/`

이번 스프린트는 화면이 `chrome.storage.local`만 읽고 쓴다. Fast2 호출은 없다. 아래는 그 다음 구현의 계획이다.

## 원칙

로컬 기록이 먼저다. 노트, 발췌, 컬렉션, 태스크를 저장하면 dataService가 `chrome.storage.local`에 쓰고, 패널은 그 결과만 다시 그린다. 네트워크가 실패해도 화면의 저장은 끝나 있다.

서버에서 먼저 바뀐 자료는 자주 오지 않는다. 이 브라우저에서 방금 만든 변경만 바로 올리고, 서버 변경은 가끔 내려받는다.

## 어디에 둘지

Manifest V3의 background는 service worker다. 상주 페이지는 없다. 워커는 꺼져 있다가 아래 이벤트로 깨어난다.

- 패널이 로컬 저장 직후 보내는 메시지 (push)
- `chrome.alarms` (드물게 pull)
- 패널을 열 때 (pull 한 번)
- 나중에 패널에 넣을 Refresh (강제 pull)

토큰은 워커만 가진다. `chrome.identity.launchWebAuthFlow`로 kewtea 로그인(Google 포함)을 하고, access/refresh는 `chrome.storage.session` 또는 워커만 읽는 저장소에 둔다. 패널과 content script에 토큰을 보내지 않는다.

인증이 없으면 outbox를 만들지 않는다. Account는 Local이고 데이터는 이 프로필 안에만 있다.

## 데이터 흐름

```
panel dataService → chrome.storage.local → (signed in) outbox
                                              ↓
                                    service worker push
                                              ↓
                         Fast2  https://api.kchloe.co/api/v1
                                              ↓
                         pull → chrome.storage.local
                                              ↓
                         chrome.storage.onChanged → panel render
```

Push 대상:

| 로컬 레코드 | 서버 |
| --- | --- |
| Note, Collection | journal |
| Task, Project | kchloe |
| PageExcerpt | `page_excerpt` (fast2에 추가될 리소스) |

`page_excerpt` 한 리소스 안에 행동과 범위를 필드로 구분한다. 별도 `web_history`, `url_content` 리소스는 두지 않는다.

- `userAction`: `read` \| `link` \| `form` \| `copy` \| `select`
- `scope`: 정규화 URL, `pageId`, URL pattern 키
- `text`: History에 보이는 짧은 요약
- `excerpt`: 읽거나 선택한 본문 조각
- `range`: 나중에 페이지에 하이라이트를 칠할 selector / offset / textQuote

노트는 사용자가 쓴 글이라 `page_excerpt`에 넣지 않는다. journal 노트다.

## 병합

1. 첫 로그인에서 로컬 레코드를 id 그대로 올린다. 서버는 id로 upsert한다.
2. 같은 id면 `updatedAt`이 최신인 쪽을 남긴다. `deletedAt`이 있으면 삭제가 이긴다.
3. 같은 URL scope가 서버에 있으면 태그는 합치고, 노트와 excerpt의 `pageId`를 맞춘다.
4. 끝난 뒤 로컬은 캐시와 outbox다. 클라우드가 본 저장소다.

이후 push는 저장 직후 outbox를 비운다. pull은 패널을 열 때와 Refresh 때 한다. 알람은 15–30분에 한 번이면 충분하다. 가이드 초안의 1분 주기는 쓰지 않는다. pull은 `since` 커서로 증분한다.

Sign out은 클라우드 데이터를 지우지 않는다. 로컬 캐시를 지울지는 사용자에게 묻는다.

## API 테스트

클라이언트가 생기면 dataService와 같은 Node 러너에 둔다. `pnpm --filter sidenote test`. HTTP는 가짜 포트로 바꾸고, outbox push, `since` pull, `updatedAt` 충돌, `deletedAt` 우선만 검증한다. 테스트가 `api.kchloe.co`를 호출하지 않는다.

## 패널에 나중에 넣을 것

- Refresh 버튼. 누르면 워커가 pull을 한 번 한다.
- Account의 Sync 점과 마지막 시각. 로그인 전에는 숨긴다.
- 로그인 버튼은 지금 자리만 있다. 워커 인증이 생기기 전에는 세션을 만들지 않는다.
