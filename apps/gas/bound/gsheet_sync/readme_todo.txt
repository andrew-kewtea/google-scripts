# GSheet sync (fast2) — TODO

백엔드 리팩터링 후에도 **Pull(list)** 는 `list_envelope.js` 가 `{ items, total, ... }` 를 파싱하므로 동작 전제는 유지된다.
아래는 시트·스크립트 쪽에서 정리하면 좋은 항목이다.

---

## 1. 인증·토큰

- Access 만료 시: settings 탭에서「Refresh access token」(G6 → `POST .../auth/token` → G5 갱신). refresh 만료 시 재 로그인.
- (선택) 401 응답 본문이 `{ detail, code, details }` 로 통일됨 — `formatHttpResult_` / 알림 문구에 `code` 표시 여부 검토.

---

## 2. Pull(list)

- 응답에 `page`, `size`, `sort`, `order` 가 추가돼도 `parseListEnvelope_` 는 `items`/`total` 중심이라 **변경 필수 아님**.
- 새 엔드포인트·탭 추가 시 `readme.txt` 의 절차 + `listPath`가 trailing slash 등 백엔드 라우트와 일치하는지 확인.

---

## 3. Push / 단건 연동 (미구현 영역)

- 노트·포스트 **쓰기** 연동은 별도 설계. 노트는 `PATCH /notes/` + 본문 `id` 규칙을 반드시 따를 것.
- 에러 본문 통일에 맞춰 실패 시 사용자 메시지 파싱 로직이 있으면 `detail`/`code` 기준으로 정리.

---

## 4. 참고 문서

- 프로젝트 루트 `readme.txt`: clasp, Pull 스펙 등록, 시트 gid 주의사항.
