@AGENTS.md

## 현재 상태 (2026-08-22, v1.4.0)

**게임 v1 완성(G0~G9) + 이날 하루에 G10~G12 세 마일스톤 완료** ([docs/ROADMAP.md](docs/ROADMAP.md)):

- **G10 즉시 체결 전환** — "다음 거래일 종가 익일 체결"을 버리고 조회 시점 최신 종가로
  그 자리에서 체결. 룩어헤드 편향을 이론적으로 감수하는 의도적 트레이드오프
  ([game-design.md](docs/game-design.md) 2절). 상태 스키마 v3
  (`pendingOrders`/`lockedCash`/`lockedQuantity` 제거, 마이그레이션이 잠긴 현금 반환)
- **G11 시장 학습 뷰 4종** — `/market`(랭킹 TOP30), `/market/screener`(PER/PBR/배당
  정렬, 지표 계산은 `lib/market/metrics.ts` 단일 소스), `/market/index`(KOSPI 1년),
  `/watchlist`(수익률 정규화 비교). 전부 ISR 유지 — **searchParams 를 쓰면 동적 렌더링으로
  떨어져 ISR 이 깨진다**(서버 1회 계산 + 클라이언트 재정렬 패턴 사용)
- **G12 GA4+GTM 사용자 행동 분석** — 페이지뷰 + 커스텀 이벤트(trade/achievement/share).
  프로덕션에서 GA4 실시간 수신까지 검증 완료 (2026-08-22)

- 프로덕션: https://rokstock-01.vercel.app — main 머지 = 자동 배포, Vercel cron 이 매일
  13:20 KST 경 `/api/revalidate` 로 시세 캐시 갱신 ([web-vercel-cron.md](docs/learning/web-vercel-cron.md))
- 게임 상태는 브라우저 localStorage(`rokstock:game`, 스키마 v3), 서버 DB 없음
- API 명세·함정은 [docs/api-reference.md](docs/api-reference.md) (실호출 검증본),
  게임 규칙은 [docs/game-design.md](docs/game-design.md)
- **열려 있는 PR**: #28 (notes/02 PER·PBR 노트북, 사용자 작성 8/16~) — 머지 여부는 사용자 판단

## 다음 이어갈 작업 (우선순위 순)

1. **게임 엔진 단위 테스트 도입** — vitest 등으로 `src/lib/game/{engine,valuation,achievements}`
   + `src/lib/market/metrics.ts` 순수 함수 테스트. 돈 계산은 반드시 `rules.ts` 의 정수
   연산(`commissionOf`/`sellTaxOf`) 유지 (float×세율은 1원 오차 — E2E 로 잡았던 버그).
   `store.ts` 의 v1/v2→v3 마이그레이션(잠긴 현금 반환)도 회귀 테스트로 고정해 둘 것
2. **GA4 후속 (데이터 며칠 쌓인 뒤)** — ① GA4 관리 > 맞춤 정의에 이벤트 파라미터
   (trade_side/stock_code/trade_value 등) 등록해 보고서 차원으로 활성화 ② 이벤트 확장
   후보: 스크리너 정렬 클릭·랭킹 탭 전환·비교차트 기간 변경 — 코드는 `lib/analytics.ts`
   에 헬퍼 추가 + GTM 트리거 정규식(`trade|achievement|share`)에 이벤트 이름 추가·게시
3. **일일 자산 스냅샷 → 내 수익률 곡선 차트** — GameState **v4** 마이그레이션(`assetHistory`,
   v3 는 즉시 체결 전환에 이미 씀), 홈에서 KOSPI 벤치마크와 겹쳐 그리기
4. **지정가 주문** — 호가단위·가격제한폭 도입 (game-design.md 의 v2+ 항목). 즉시 체결 전환으로
   사라진 "체결가 미확정" 상태가 지정가 주문에선 다시 필요해진다는 점 참고
5. **ETF 지원** — 증권상품시세정보(데이터 번호 15094806) 활용신청 필요 (자동승인)
6. (장기) 자동매매 엔진·백테스팅·KIS 연동 — ROADMAP 하단 "장기 아이디어"

## 운영 메모

- **시드 갱신은 평소 불필요** (런타임이 API 로 최신 유지, 커밋된 시드는 폴백/검색용).
  분기·연 결산 후 `npm run seed -- --only=financials` (약 15분, 재무·배당 갱신),
  이따금 `npm run seed` 로 시세 스냅샷·마스터 신선화 후 커밋
- PR 작업 흐름: 작업 단위 브랜치 → 조기 PR(Vercel preview 로 함께 리뷰) → 머지 → GitHub 릴리즈.
  스택 PR 은 **자식을 먼저 main 으로 재타겟한 뒤** 부모를 머지할 것 (base 삭제 시 자식이 닫힘)
- 프로덕션 브랜치는 main (2026-08-15 에 교정함 — Vercel 설정 임의 변경 금지)
- **분석(GA4+GTM)**: GA 계정 `rokstock` > 속성 `rokstock-01`(`G-72NP373Q8J`), GTM 컨테이너
  `GTM-5D6J39X9`. 스니펫은 `NEXT_PUBLIC_GTM_ID`(Vercel Production 전용)로 켜짐 —
  로컬/프리뷰는 미설정이 정상(통계 오염 방지). 이벤트 이름·파라미터는 `src/lib/analytics.ts`
  와 GTM 컨테이너의 계약 — 한쪽만 바꾸면 조용히 유실됨
  (docs/learning/web-analytics-ga4-gtm.md)
