# GSheet sync (fast2) — TODO

백엔드 리팩터링 후에도 **Pull(list)** 는 `list_envelope.js` 가 `{ items, total, ... }` 를 파싱하므로 동작 전제는 유지된다.
아래는 시트·스크립트 쪽에서 정리하면 좋은 항목이다.

---

## 1. 인증·토큰

- Access 만료 시: settings 탭에서「Refresh access token」(G6 → `POST .../auth/token` → G5 갱신). refresh 만료 시 재 로그인.
- 오류 본문은 `http.formatApiErrorBrief_` 가 `{ detail, code, details.errors }` 를 요약한다(Pull/Push/login 실패 알림·refresh 예외·signup 실패 셀 E8 등). 성공 signup 응답만 `formatHttpResult_` 로 전체 JSON 표시.

---

## 2. Pull(list)

- 응답에 `page`, `size`, `sort`, `order` 가 추가돼도 `parseListEnvelope_` 는 `items`/`total` 중심이라 **변경 필수 아님**.
- 새 엔드포인트·탭 추가 시 `readme.txt` 의 절차 + `listPath`가 trailing slash 등 백엔드 라우트와 일치하는지 확인.

---

## 3. Push / 단건 연동

- 스크립트는 노트·포스트·유저 Push(list Pull과 별개)를 `push.js` + `models/*` 스펙으로 처리한다. 노트는 `PATCH /notes/` + 바디 `id`(경로에 id 없음).

---

## 4. 참고 문서

- 프로젝트 루트 `readme.txt`: clasp, Pull 스펙 등록, 시트 gid 주의사항.
