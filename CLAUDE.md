@AGENTS.md

## 현재 상태 (2026-08-15, v1.0.0)

**"하루 늦은 모의주식" 게임 v1 완성** — 마일스톤 G0~G9 전부 완료 ([docs/ROADMAP.md](docs/ROADMAP.md)).

- 프로덕션: https://rokstock-01.vercel.app — main 머지 = 자동 배포, Vercel cron 이 매일
  13:20 KST 경 `/api/revalidate` 로 시세 캐시 갱신
- 게임 상태는 브라우저 localStorage(`rokstock:game`, 스키마 v2), 서버 DB 없음
- API 명세·함정은 [docs/api-reference.md](docs/api-reference.md) (실호출 검증본),
  게임 규칙은 [docs/game-design.md](docs/game-design.md)

## 다음 이어갈 작업 (우선순위 순)

1. **실전 체결 검증** — 2026-08-18(월) 13시 이후 프로덕션에서 미체결 주문의 첫 📬 개봉 확인.
   문제 시 Vercel cron 로그의 `/api/revalidate` 응답 `asOf` 부터 볼 것
2. **게임 엔진 단위 테스트 도입** — vitest 등으로 `src/lib/game/{engine,valuation,achievements}`
   순수 함수 테스트. 돈 계산은 반드시 `rules.ts` 의 정수 연산(`commissionOf`/`sellTaxOf`) 유지
   (float×세율은 1원 오차 — E2E 로 잡았던 버그)
3. **일일 자산 스냅샷 → 내 수익률 곡선 차트** — GameState v3 마이그레이션(`assetHistory`),
   홈에서 KOSPI 벤치마크와 겹쳐 그리기
4. **지정가 주문** — 호가단위·가격제한폭 도입 (game-design.md 의 v2+ 항목)
5. **ETF 지원** — 증권상품시세정보(데이터 번호 15094806) 활용신청 필요 (자동승인)
6. (장기) 자동매매 엔진·백테스팅·KIS 연동 — ROADMAP 하단 "장기 아이디어"

## 운영 메모

- **시드 갱신은 평소 불필요** (런타임이 API 로 최신 유지, 커밋된 시드는 폴백/검색용).
  분기·연 결산 후 `npm run seed -- --only=financials` (약 15분, 재무·배당 갱신),
  이따금 `npm run seed` 로 시세 스냅샷·마스터 신선화 후 커밋
- PR 작업 흐름: 작업 단위 브랜치 → 조기 PR(Vercel preview 로 함께 리뷰) → 머지 → GitHub 릴리즈.
  스택 PR 은 **자식을 먼저 main 으로 재타겟한 뒤** 부모를 머지할 것 (base 삭제 시 자식이 닫힘)
- 프로덕션 브랜치는 main (2026-08-15 에 교정함 — Vercel 설정 임의 변경 금지)
