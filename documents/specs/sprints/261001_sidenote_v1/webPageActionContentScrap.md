# sidenote page action and content scrap

Status: superseded by `recording.md` (2026-10-06). Do not implement from this file.  
Date: 2026-10-02  
Code later: `apps/chrome/sidenote/src/content/tracker.ts`

닫힌 패널 녹화, 20MB 내부 예산, `play`, `highlight` 한 행동, 최상위 프레임만 쓰는 결정은 `recording.md`가 기준이다. 아래는 2026-10-02 초안이다.

v1 패널의 History는 시드된 `page_excerpt`만 보여 준다. 페이지에서 읽기·클릭·선택을 수집하는 코드는 없다.

## 무엇을 남기나

콘텐츠 스크립트가 최상위 프레임만 본다 (`all_frames: false`). 관찰 결과는 `page_excerpt` 한 건으로 `chrome.storage.local`에 들어간다. 패널은 저장소 변경을 보고 다시 그린다.

한 레코드의 필드:

| 필드 | 내용 |
| --- | --- |
| `userAction` | `read` \| `link` \| `form` \| `copy` \| `select` |
| `scope` | 그 순간 URL의 정규화 값, `pageId`. URL pattern이 있으면 그 키 |
| `text` | History 행 요약. 사용자가 고칠 수 있다 |
| `excerpt` | 읽거나 선택한 본문 조각. 페이지 HTML 전체가 아니다 |
| `range` | 하이라이트를 나중에 페이지에 칠하기 위한 위치 |
| `meta` | 체류, 스크롤 깊이, 링크 href, 섹션 제목 |

Highlights 필터는 `copy`와 `select`다. 드래그로 선택만 해도 `select`다. 복사 이벤트는 `copy`다. Inputs는 `form`이다.

`range` 모양:

```ts
{
  selector?: string;      // 시작 노드로 가는 CSS 경로
  startOffset?: number;
  endOffset?: number;
  textQuote?: string;     // selector가 어긋났을 때 다시 찾을 문장
}
```

v1은 이 필드를 타입과 시드에만 둔다. 페이지에 색을 칠하지 않는다. 다음 구현에서 같은 `range`로 호스트 페이지에 마크를 올린다. 패널을 닫아도 마크 데이터는 `page_excerpt`에 남고, 페이지를 다시 열 때 저장소에서 칠한다.

## 수집 조건

탭이 숨겨져 있거나, 마우스·키보드 입력이 30초 없으면 시간 누적을 멈춘다. 저장은 `requestIdleCallback`으로 약 2초 모아서 한다. 스크롤·입력 리스너는 `passive: true`와 throttle/debounce를 쓴다. 패널이 닫혀 있어도 트래커는 DOM을 고치지 않는다.

| userAction | 방법 | 남기는 조건 |
| --- | --- | --- |
| read | `IntersectionObserver`로 p, li, h*, pre. 화면 중앙에 머문 시간 | 누적 8초 이상. 앞 120자와 섹션 heading |
| read | scroll 500ms throttle, 최대 깊이 | 10% 단위로 깊어질 때 "Read to N%". 30초 안의 이전 read 행과 병합 |
| read | `visibilitychange`와 활동 | 섹션 체류 60초 이상이면 "Nm Ns on {section}" |
| link | click capture, `a[href]` | 링크 텍스트와 href |
| form | input/change, 1.5초 debounce | 검색 칸은 값, 그 외는 "Typed in {label}"과 앞 40자 |
| select | mouseup 후 `getSelection()` | 선택 텍스트 앞 200자, heading, range. 입력 칸 안은 제외 |
| copy | `copy` 이벤트와 선택 텍스트 | 앞 200자와 range. 입력 칸 안은 제외 |

비밀번호, hidden, 카드 번호, `autocomplete="off"`, `autocomplete="one-time-code"` 필드는 수집하지 않는다. 은행·메일처럼 민감한 호스트는 기본 제외 목록을 둔다. 메일 호스트를 시드 페이지에 넣어 둔 것과, 그 호스트의 본문을 수집하는 것은 별개다. 제외 목록이 생기기 전에는 메일 본문을 긁지 않는다.

SPA는 `history.pushState` / `replaceState`와 `popstate`로 URL이 바뀌면 scope를 다시 계산한다.

기록 일시정지와 사이트 제외는 설정이 확장될 때 넣는다. 그때 History 헤더의 초록 점은 일시정지에서 회색이 된다. v1의 점은 시드 화면용으로 항상 초록이다.

## 성능과 권한

블록 관찰은 약 500개에서 멈춘다. 이 수집이 생기기 전에는 `<all_urls>` content script를 매니페스트에 넣지 않는다. 수집을 켤 때 host 권한과 스토어 심사 문구를 같이 검토한다.

## 저장

트래커는 패널과 같은 dataService 포트로 `page_excerpt`를 추가한다. content script의 `window.localStorage`는 페이지 origin이라 쓰지 않는다. 최근 200행을 넘기면 사용자가 고치지 않은 오래된 read부터 지운다. `copy`와 `select`는 그보다 나중에 줄인다.
