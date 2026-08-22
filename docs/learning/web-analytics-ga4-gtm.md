# GA4 + Google Tag Manager — 사용자 행동 분석 붙이기

## 개념: GA4 와 GTM 은 다른 물건이다

- **GA4 (Google Analytics 4)**: 데이터가 **쌓이는 곳**. 방문·페이지뷰·이벤트를 수집해
  보고서로 보여준다. 사이트는 "측정 ID"(`G-…`)로 데이터를 보낸다.
- **GTM (Google Tag Manager)**: 태그(추적 스크립트)를 **관리하는 곳**. 사이트에는 GTM
  스니펫 하나만 심고, 그 안에서 어떤 태그(GA4, 광고 픽셀 등)를 언제 실행할지
  웹 UI 로 구성한다. 컨테이너 ID 는 `GTM-…`.

왜 GTM 을 거치나? **태그 추가/수정에 코드 배포가 필요 없어진다.** 예를 들어 나중에
"스크리너 정렬 클릭도 추적하자"가 되면 GTM 에서 트리거만 추가하면 된다.

## 이 프로젝트의 구성

```
사이트 (rokstock-01.vercel.app)
  └─ GTM 스니펫 (GTM-5D6J39X9) ← 코드에 심는 유일한 것
       ├─ [태그] GA4 - rokstock-01 (Google 태그, G-72NP373Q8J)
       │     트리거: Initialization - All Pages → 페이지뷰 자동 수집
       └─ [태그] GA4 Event - App Events (GA4 이벤트)
             트리거: CE - App Events (맞춤 이벤트, 정규식 trade|achievement|share)
             파라미터: trade_side/stock_code/stock_name/trade_quantity/
                        trade_value/achievement_id/share_method (dataLayer 변수)
```

- GA4 속성: 계정 `rokstock` > 속성 `rokstock-01` (측정 ID `G-72NP373Q8J`)
- "향상된 측정"이 켜져 있어 SPA 라우팅(브라우저 히스토리 변경)에 따른 page_view 도
  자동으로 잡힌다 — App Router 클라이언트 내비게이션 대응.

## 코드 쪽 (심는 부분)

1. **스니펫**: `@next/third-parties` 의 `<GoogleTagManager gtmId={...} />` 를 루트
   레이아웃에 추가 (`src/app/layout.tsx`). **`NEXT_PUBLIC_GTM_ID` 환경변수가 있을 때만**
   렌더한다 — Vercel 프로덕션에만 설정해 로컬/프리뷰 트래픽이 통계를 오염시키지 않게.
2. **커스텀 이벤트**: `src/lib/analytics.ts` 의 `trackTrade`/`trackAchievement`/`trackShare`
   가 `sendGTMEvent()` 로 dataLayer 에 push 한다. 호출 지점:
   - `TradePanel` — 매수/매도 체결 시 `trade` (종목·수량·금액)
   - `AchievementModal` — 업적 달성 시 `achievement` (두 진입 경로 모두 커버)
   - `ShareButton` — 공유 시 `share` (web_share/clipboard 구분)

## 함정·배운 것

- **GTM 은 커스텀 이벤트를 GA4 로 자동 전달하지 않는다.** `dataLayer.push({event:"trade"})`
  는 GTM 트리거를 깨울 뿐, GA4 로 보내려면 **GA4 이벤트 태그 + 맞춤 이벤트 트리거 +
  dataLayer 변수 매핑**을 컨테이너에 직접 구성해야 한다. "GTM 붙였는데 이벤트가 안 보여요"의
  1순위 원인.
- **dataLayer 는 이전 push 값이 유지된다(persist).** trade 다음에 share 를 보내면 직전
  종목코드가 딸려 갈 수 있다 — `analytics.ts` 가 각 이벤트에서 미사용 파라미터를 `null` 로
  리셋하는 이유.
- **이벤트·파라미터 이름은 코드와 GTM 의 계약이다.** 한쪽만 바꾸면 조용히 유실된다.
  (GA4 커스텀 파라미터를 보고서 차원으로 쓰려면 GA4 관리 > 맞춤 정의에서 등록 필요 —
  데이터가 쌓이기 시작한 뒤에 하면 된다.)
- **약관·쿠키**: GA/GTM 각각 서비스 약관 동의가 필요했고(1회), 이 게임은 로그인이 없어
  개인 식별 정보를 보내지 않는다. 종목코드·수량 같은 게임 상태만 이벤트 파라미터로 보낸다.
- **검증 방법**: 브라우저 콘솔에서 `window.dataLayer` 를 찍어 이벤트 push 확인
  (`gtm.uniqueEventId` 가 붙어 있으면 GTM 이 처리한 것) → GA4 실시간 보고서에서 수신 확인.
  GTM 미리보기(Tag Assistant)로 태그 발화를 단계별로 볼 수도 있다.

## 이 프로젝트에서 어디에 쓰였나

- `src/app/layout.tsx` — `<GoogleTagManager>` (env 조건부)
- `src/lib/analytics.ts` — 이벤트 헬퍼 (이름 계약의 코드 쪽 단일 소스)
- `src/components/{TradePanel,AchievementModal,ShareButton}.tsx` — 계측 지점
- Vercel 환경변수 `NEXT_PUBLIC_GTM_ID` (Production 전용)

## 참고

- GTM 컨테이너: https://tagmanager.google.com (계정 rokstock)
- GA4 보고서: https://analytics.google.com (계정 rokstock > 속성 rokstock-01)
- Next.js third-parties: `node_modules/next/dist/docs/` 및
  https://nextjs.org/docs/app/guides/third-party-libraries
