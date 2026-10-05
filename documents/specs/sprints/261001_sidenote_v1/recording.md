# sidenote history recording

Status: plan only. Do not implement from this file until the review says so.  
Date: 2026-10-06  
Replaces the capture rules in `webPageActionContentScrap.md`.  
Code later: `apps/chrome/sidenote/src/content/tracker.ts`  
Storage later: `web_histories` already has `text`, `excerpt`, `range`, `meta`. No new Fast2 table.

자동 기록은 노트보다 아래다. 수집이 실패하거나 용량에 닿아도 패널, 노트, 수동 History 입력은 그대로 동작한다.

## 닫힌 패널

패널이 닫혀 있을 때도 녹화할 수 있다. 관찰은 패널 iframe이 아니라 페이지에 주입된 콘텐츠 스크립트가 한다. 워커는 DOM을 보지 못한다. 워커가 잠들어도 페이지 안의 리스너는 남는다.

복잡도는 여기에 있지 않다. 같은 스크립트를 두 조건에서 주입하면 된다.

- 그 탭에서 패널이 열려 있으면 녹화한다. 기본값이다.
- Settings → General의 "Record while sidenote is hidden"이 켜져 있으면, 패널을 연 적 없는 `http`/`https` 탭에도 같은 스크립트를 넣는다. 기본값은 꺼짐이다.

불안정해지는 길은 넣지 않는다.

- `all_frames: true`로 광고·결제 iframe까지 넣지 않는다. 최상위 프레임만 본다.
- YouTube나 DRM을 위해 페이지 월드(`MAIN`)에 스크립트를 더 넣지 않는다. 이미 있는 `location.js`의 `pushState` 훅만 SPA 주소용으로 유지한다.
- `document` 전체에 제한 없는 `MutationObserver`를 걸지 않는다.
- closed shadow, canvas, PDF 뷰어, DRM을 따라가지 않는다. 못 읽으면 그 행을 건너뛴다.
- 주입 실패를 반복 재시도하지 않는다. 한 번 실패하면 그 탭은 주황이고, 다음 탐색에서만 다시 시도한다.

트래커는 `mount.js`와 다른 파일이고, 예외가 나도 패널을 내리지 않는다. 두 파일 모두 이미 주입됐으면 다시 실행되지 않는다.

## 상태 색

History 제목 옆 점은 지금 장식이다. 구현 때는 섹션 접기로 클릭이 넘어가지 않는 버튼이 된다. 툴바 아이콘의 점은 `chrome.action` 배지로 만들지 않는다. 배지 위치는 브라우저가 정한다. 탭마다 오른쪽 위에 점이 있는 아이콘을 그려 `chrome.action.setIcon({ tabId })`로 올린다.

| 색 | 의미 |
| --- | --- |
| 녹색 | 이 탭을 녹화 중 |
| 회색 | 사용자가 일시정지. 패널을 닫아도 유지 |
| 주황 | 녹화 중단. 이 페이지에 붙지 못했거나, 스크립트가 죽었거나, 아래 20MB에 닿음 |

툴팁으로 이유를 구분한다. 패널이 닫혀 있으면 아이콘만 보인다. 일시정지와 용량 중단은 `chrome.storage.local`에 둔다. 아이콘과 패널 점은 같은 값을 본다.

패널이 닫혀 있고 General 체크도 꺼져 있으면 스크립트를 넣지 않고 점도 없다. 수동으로 History에 추가하는 동작은 일시정지나 용량 중단과 별개다.

## 용량

Chrome의 `chrome.storage.local` 기본 한도는 10MB다. manifest에 `unlimitedStorage`를 넣어 그 한도를 푼다. 디스크가 차면 그때는 브라우저가 거절한다.

화면의 내부 예산은 20MB다. `chrome.storage.local.getBytesInUse()`로 재고, 상태 JSON만 재지 않는다. auth와 outbox가 포함된다. 사용량 막대는 로그인 중에도 20MB를 눈금으로 보여 준다. 로그인 중 막대를 숨기던 현재 동작은 이 계획에서 바뀐다.

20MB에 닿으면 자동 녹화만 멈추고 점을 주황으로 둔다. 노트, 태스크, 수동 History는 계속 저장할 수 있다. 녹화가 용량을 먼저 쓰고 노트를 막지 않는다. 사용자가 행을 지워 20MB 아래로 내려가기 전에는 녹화를 다시 켜지 않는다. 경계에서 켰다 끄기를 반복하지 않는다.

지금 코드의 9MB 생성 거절은 구현 때 이 규칙으로 바꾼다. 그 전에는 코드를 바꾸지 않는다.

클라우드 캐시 상한 60과 섹션당 20개는 그대로다. 자동 행이 그 창을 노트로 착각해 지우게 두지 않는다. 손대지 않은 오래된 `read`만 로컬에서 줄인다. 사용자가 고친 행, 하이라이트, 수동 입력, outbox에 있는 행은 남긴다. 로그인 중 자동 행의 push는 모아 보내고, 폼에 적은 값은 걸러진 뒤에만 outbox에 들어간다.

## 남기는 것

한 행은 로컬 PageExcerpt이고 서버에서는 `web_histories`다. `text`는 발췌 요약이다. 모델을 호출해 문장을 줄이지 않는다. `excerpt`는 본문 조각이고 페이지 HTML 전체가 아니다. 이미지 주소, 재생 길이, 링크는 `meta` JSON이다. CSS 값은 저장하지 않는다.

요약은 보고 있던 블록의 제목과 앞부분이다. 스크롤이 빠르면 읽은 것으로 치지 않는다. 같은 페이지의 `read`는 한 행으로 합친다.

| 행동 | 방법 | 한계 |
| --- | --- | --- |
| `read` | 최상위 문서에서 `p`, 제목, 목록이 화면 중앙에 머문 시간. 스크롤은 passive와 throttle | canvas, PDF, closed shadow, 교차 출처 iframe 본문은 없다. 패널이 덮은 오른쪽 360px은 보이는 영역에서 뺀다. 이미지는 `img`/`picture`/`source`의 `currentSrc`와 `video poster` URL만. CSS background는 제외 |
| `play` | 같은 문서의 `<video>`, `<audio>` `play`. `duration`, `currentSrc`, `currentTime`을 `meta`에 | 파일 바이트는 받지 않는다. `blob:`이나 DRM이면 파일 링크 없음으로 남기거나 건너뛴다. iframe 안 플레이어는 최상위만 보므로 놓친다 |
| `link` | capture 단계의 `a[href]`. 이동 전에 storage에 쓴다. SPA는 기존 `location.js` | `<a>`가 아닌 버튼, `javascript:`는 놓칠 수 있다. 놓쳐도 재시도하지 않는다 |
| `form` | `input`, `change`, `select`, `contenteditable`. 디바운스 | 아래 민감정보 필터를 통과한 값만 저장한다 |
| `highlight` | `mouseup`의 `getSelection()`과 `copy`. `range`에 selector, offset, `textQuote` | 이번엔 페이지에 칠하지 않는다. 입력칸 안은 제외. 이전의 `copy`와 `select`는 이 행동으로 접는다 |

블록 관찰은 약 500개에서 멈춘다. 저장은 약 2초 모아서 한다. 탭이 숨겨지거나 입력이 30초 없으면 시간 누적을 멈춘다.

`chrome://`, 웹스토어, PDF 뷰어, 확장 페이지는 주입이 거절된다. 주황으로 두고 끝낸다. sidenote 패널 iframe은 확장 출처라 수집 대상이 아니다.

## 민감정보

저장과 outbox보다 먼저 버린다.

- `type=password`, `type=hidden`
- `autocomplete`이 `current-password`, `new-password`, `one-time-code`, `cc-number`, `cc-csc`, `cc-exp`
- 이름이나 id에 password가 있는 칸
- 카드번호 형태

검색칸은 값을 남길 수 있다. 그 외 입력은 라벨과 앞 40자까지로 줄인다. 결제 iframe에는 스크립트를 넣지 않는다. 일반 텍스트 칸에 적은 비밀번호는 구별하지 못한다. 은행·메일 호스트를 기본 제외할지는 구현 전에 목록을 확정한다. 제외 목록이 생기기 전에는 그 호스트 본문을 긁지 않는다.

로그인 중이면 남은 행도 서버로 갈 수 있다. 걸러진 값은 로컬에도 없다. 스토어에 올릴 때 Privacy 문구에 자동 History가 페이지 글, 링크, 재생 정보, 걸러진 입력만 남긴다고 적는다. 그 문구는 이 구현의 범위가 아니다.

## 구현 때 지킬 순서

1. manifest `unlimitedStorage`. 사용량 눈금 20MB. 20MB에서 자동 녹화만 중단.
2. 트래커를 패널 주입과 분리. 최상위 프레임, isolated world, 중복 주입 방지.
3. `read`, `link`, `form`, `highlight`. `play`는 같은 문서의 media 요소만.
4. History 점과 탭 아이콘. General 체크는 그 다음에 넣는다. 체크가 꺼져 있으면 주입 경로는 패널을 연 탭뿐이다.
5. 민감정보 필터와 용량 중단 테스트. 실서버는 호출하지 않는다.

하이라이트를 페이지에 칠하는 일은 이 계획에 없다.
