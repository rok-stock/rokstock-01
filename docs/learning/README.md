# 학습 노트

프로젝트를 진행하며 배운 **웹개발 개념**과 **주식 개념**을 기록하는 공간.

> 여기 문서로 개념을 읽었다면, [`notes/`](../../notes/README.md)에서 Jupyter(Deno) 노트북으로
> 직접 실행하며 데이터로 확인해볼 수 있다.

## 작성 규칙

- 새로운 개념이 코드에 등장하면 여기에 노트를 추가한다.
- 파일명: `web-` 접두사(웹개발) 또는 `stock-` 접두사(주식) + 주제. 예:
  - `web-server-components.md` — 서버 컴포넌트란?
  - `stock-candle-chart.md` — 캔들 차트 읽는 법
- 노트에는 (1) 개념 설명, (2) 이 프로젝트에서 어디에 쓰였는지, (3) 참고 자료를 담는다.

## 목차

### 웹개발

| 문서 | 주제 | 관련 마일스톤 |
|---|---|---|
| [web-server-client-components.md](./web-server-client-components.md) | 서버/클라이언트 컴포넌트, 하이드레이션, Route Handler | M1 |
| [web-isr-caching.md](./web-isr-caching.md) | ISR, 데이터 캐시와 태그, 온디맨드 재검증, generateStaticParams 함정 | G1 |
| [web-localstorage-state.md](./web-localstorage-state.md) | localStorage 단일 키 원자성, 스키마 버전, useSyncExternalStore 패턴 | G2 |
| [web-mobile-bottom-sheet.md](./web-mobile-bottom-sheet.md) | 바텀시트, safe-area, 모바일 숫자 입력 | G3 |
| [web-responsive-desktop.md](./web-responsive-desktop.md) | 모바일 퍼스트 반응형, v4 @utility, fixed 의 DOM 독립성, :focus-visible | G8 |
| [web-aria-combobox.md](./web-aria-combobox.md) | ARIA 콤보박스 패턴, aria-activedescendant 가상 포커스 | G8 |
| [web-share-og-pwa.md](./web-share-og-pwa.md) | Web Share API·클립보드 폴백, OG 이미지(한글 서브셋), PWA maskable 아이콘 | G9 |
| [web-analytics-ga4-gtm.md](./web-analytics-ga4-gtm.md) | GA4 vs GTM, dataLayer 커스텀 이벤트, "GTM은 자동으로 GA4에 안 보낸다" 함정 | G12 |

### 주식

| 문서 | 주제 | 관련 마일스톤 |
|---|---|---|
| [stock-price-basics.md](./stock-price-basics.md) | 현재가·등락률·거래량, 캔들(OHLC) 읽는 법 | M1 |
| [stock-order-execution.md](./stock-order-execution.md) | 주문 vs 체결, 시장가/지정가, 룩어헤드 편향 | G3 |
| [stock-fees-and-taxes.md](./stock-fees-and-taxes.md) | 위탁수수료, 증권거래세·농특세 인하 연혁, 거래 비용 체감 | G3 |
| [stock-avg-price-pnl.md](./stock-avg-price-pnl.md) | 평단가 계산, 평가손익 vs 실현손익 | G4 |
| [stock-portfolio-valuation.md](./stock-portfolio-valuation.md) | 총자산 계산, 수익률의 기준(분모), 원본·파생 분리 | G5 |
| [stock-benchmark-index.md](./stock-benchmark-index.md) | 지수·벤치마크, 인덱스 투자, "시장 이기기"의 어려움 | G7 |
| [stock-financials-per-pbr.md](./stock-financials-per-pbr.md) | 요약 재무제표 읽기, PER/PBR, 가치평가의 한계 | G6 |
| [stock-dividends.md](./stock-dividends.md) | 배당·배당수익률·배당락, 고배당 함정, 우선주 | G6 |
