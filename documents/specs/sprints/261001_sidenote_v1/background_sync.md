# sidenote background sync

Status: superseded  
Date: 2026-10-02, replaced 2026-10-05

2026-10-02 설계는 화면이 `chrome.storage.local`만 읽고 쓰는 동안의 다음 단계 초안이었다. API 연결은 구현되었고, 기준 문서는 `api_connect.md`다.

바뀐 결정:

- History 서버 리소스는 `page_excerpt` 하나가 아니다. 로컬 레코드 이름은 PageExcerpt로 두고, API는 `web_histories`다. 사용자별 페이지 설명은 `url_abouts`, URL이 있는 노트는 `note_url_refs`, 추가 동일 URL 규칙은 `url_match_rules`다.
- 토큰은 `chrome.storage.session`이 아니다. `chrome.storage.local` 키 `sidenote.auth`에 둔다. 브라우저를 닫아도 로그인이 유지되어야 한다. 호스트 페이지로는 보내지 않는다.
- pull 주기는 10분이다. 증분 파라미터는 `last_updated_atFrom`이다. 별도 `since` 이름은 만들지 않는다.
- 로그아웃은 캐시를 지우지 않고 토큰만 지운다. 그 사이 수정은 outbox에 남는다.

로컬 저장을 먼저 하고 화면은 그 결과만 그린다는 원칙, service worker와 `chrome.alarms`가 네트워크를 맡는다는 원칙은 그대로다.
