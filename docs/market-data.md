# 시세 데이터

> API 별 정확한 엔드포인트·파라미터·응답 필드·함정은 **[api-reference.md](./api-reference.md)**
> (실호출 검증본, 다른 프로젝트에서 재사용 가능) 참조. 이 문서는 이 앱의 아키텍처를 다룬다.

## 왜 한 겹을 뒀나

화면은 "시세를 어디서 가져오는지" 몰라야 한다. 데이터 출처를 바꾸더라도 화면 코드를 다시
쓰고 싶지 않기 때문이다. 그래서 `src/lib/market/`에 **공급자(provider) 인터페이스**를 두고,
화면은 그 인터페이스만 바라본다.

```
src/lib/market/
  types.ts              도메인 타입 + MarketDataProvider 인터페이스
  seed.ts               시드 데이터 로더 (src/data/*.json)
  snapshot.ts           전 종목 시세 스냅샷 — 시세의 단일 진실 공급원
  stock-master.ts       종목 마스터 (시드 기반, KOSPI 전 종목)
  mock-provider.ts      가짜 시세 — API 키 불필요
  datagokr-provider.ts  공공데이터포털 실제 시세
  index.ts              환경변수로 공급자 선택
  format.ts             가격·등락률 표시 포맷과 색상

scripts/
  build-seed.ts         시드 데이터 생성 (npm run seed)
  lib/                  스크립트 전용 API/직렬화 헬퍼

src/data/               시드 산출물 (커밋함)
  stock-master.json     KOSPI 종목 마스터 (+법인등록번호)
  market-snapshot.json  최근 5영업일 전 종목 시세
  index-kospi.json      KOSPI 지수 1년치
  financials.json       기업 재무(3개년)·개요 — 연 단위 갱신, --only=financials 로 생성
```

화면에서는 이렇게만 쓴다:

```ts
import { marketProvider } from "@/lib/market";

const quote = await marketProvider.getQuote("005930");
```

## 데이터 흐름 (비용 최적화의 핵심)

공공데이터포털 시세는 **T+1 영업일 13시경** 갱신되는 하루 한 번짜리 데이터다. 이 특성에 맞춰
세 겹으로 쌓았다:

1. **시드 데이터** (`src/data/*.json`, 커밋됨) — `npm run seed`로 로컬에서 생성한다.
   빌드·프리뷰가 API 키나 API 장애와 무관하게 뜨게 하는 안전망이자, 검색·목업의 재료.
2. **전 종목 스냅샷** (`snapshot.ts`) — KOSPI는 1,000종목 미만이라
   `basDt=최근영업일&mrktCls=KOSPI&numOfRows=1000` **한 번의 호출**로 전 종목 시세가 나온다.
   개별 시세/관심 종목/랭킹이 전부 이 스냅샷에서 나오므로 **API 호출량이 종목 수와 무관**하다.
   응답은 Next.js 데이터 캐시(1시간, `datagokr` 태그)에 저장된다.
   "13시 이전엔 오늘 데이터가 없다" 문제는 오늘부터 거꾸로 데이터가 있는 첫 영업일을 찾는
   것으로 해결 — 화면은 항상 "가장 최근 영업일 종가"를 본다.
3. **ISR 페이지 캐시** — 페이지(`revalidate = 3600`)가 렌더 결과째로 캐시된다. 종목 상세는
   `generateStaticParams()`가 빈 배열을 반환해 "방문한 종목만 그때 생성해 캐시"한다.

갱신 반영은 두 경로: fetch 캐시 만료(1시간) 또는 **Vercel cron**(매일 13:20 KST경,
`vercel.json`)이 `/api/revalidate`를 호출해 `datagokr` 태그를 즉시 무효화.

일일 API 호출량 추정: **200회 미만** (개발계정 한도 10,000건/일의 2%).

## 공급자 전환

`.env.local` (없으면 `.env.example`을 복사해서 만든다):

```bash
cp .env.example .env.local
```

| 환경변수 | 값 | 설명 |
|---|---|---|
| `MARKET_DATA_PROVIDER` | `mock` (기본) | API 키 없이 도는 가짜 시세 |
| | `datagokr` | 공공데이터포털 실제 시세 |
| `DATA_GO_KR_SERVICE_KEY` | 인증키 | `datagokr`일 때, 그리고 `npm run seed`에 필요 |
| `CRON_SECRET` | 시크릿 | `/api/revalidate` 인증 (배포 환경에만) |

`datagokr`로 지정했는데 키가 없으면 경고를 남기고 목업으로 되돌아간다 — 개발이 멈추지 않도록.

## 시드 데이터 생성 (`npm run seed`)

```bash
npm run seed                      # 전체 생성
npm run seed -- --only=snapshot   # 일부만 (master | snapshot | index)
npm run seed -- --days=5          # 시세 스냅샷 영업일 수
npm run seed -- --placeholder     # 인증키 없이 가짜 시드 (초기 개발용)
```

- 종목 수가 정상 범위(800~1,200)를 벗어나면 커밋 사고를 막기 위해 실패 처리한다.
- **KRX상장종목정보에는 우선주가 없다** (831법인 vs 시세 943종목). 시세 스냅샷과 병합하고,
  우선주의 법인등록번호는 보통주(앞 5자리 + "0")에서 유도한다.
- KRX상장종목정보가 미승인이면 시세 응답에서 마스터를 유도하고(법인등록번호 없음),
  지수시세정보가 미승인이면 빈 지수 파일을 만든다 — 승인 후 재실행하면 채워진다.
- 산출물은 "필드 헤더 + 튜플 행" JSON — 키 반복을 없애 용량을 절반 이하로 줄였다.

## 목업 공급자

- 값은 가짜지만 **결정적**이다. 종목코드에서 시드를 뽑아 쓰기 때문에 같은 종목은 항상 같은 시세가
  나온다. `Math.random()`을 쓰면 서버가 그린 HTML과 브라우저가 그린 화면이 어긋나
  하이드레이션이 깨지고, 새로고침할 때마다 차트가 춤춘다.
- 기준 가격은 시드 스냅샷의 **실제 종가**를 쓴다 — 가짜여도 가격대는 그럴듯하게.
- 약 1년치(260영업일) 이력을 통째로 만든 뒤 필요한 만큼 뒤에서 잘라 쓴다.
- 공휴일은 반영하지 않는다(주말만 제외).

## 공공데이터포털

**금융위원회 「주식시세정보」** — https://www.data.go.kr/data/15094808/openapi.do

1. 공공데이터포털 회원가입 후 API에 **활용신청** (자동 승인, 반영까지 최대 1시간)
2. 마이페이지에서 인증키 복사
3. `.env.local`에 `DATA_GO_KR_SERVICE_KEY=...`, `MARKET_DATA_PROVIDER=datagokr`
4. `npm run seed` 후 `npm run dev`

사용하는 API (인증키는 하나, API마다 활용신청 필요):

| API | 용도 | 상태 (2026-08-15) |
|---|---|---|
| 주식시세정보 | 시세 스냅샷·일봉 | ✅ 사용 중 |
| KRX상장종목정보 | 종목 마스터(법인등록번호) | ✅ 사용 중 — 우선주는 없어서 시세와 병합 |
| 지수시세정보 | KOSPI 지수 (벤치마크, `/api/index`) | ✅ 사용 중 |
| 기업재무정보·기업기본정보 | 기업 리포트 — `GetFinaStatInfoService_V2`·`GetCorpBasicInfoService_V2` | ✅ 시드 수집 (연 단위) |
| 주식배당정보 | 배당수익률·액면가 — `1160100/GetStocDiviInfoService_V2/getDiviInfo_V2` ⚠️ 이 서비스만 `service/` 경로 없이 루트 바로 아래 | ✅ 시드 수집 (연 단위) |
| ~~주식발행정보~~ | ~~액면가·발행주식수~~ → **불필요해짐** — 액면가는 배당 API에, 상장일은 기업개요에, 발행주식수는 시세(시총)에 이미 있음 | 사용 안 함 |

> 배당·발행정보는 공공누리 제2유형(상업적 이용금지)이다. 이 프로젝트는 **비상업(개인 학습용)**
> 이라 사용하되, 수익화를 검토하게 되면 한국예탁결제원과의 정보이용계약을 먼저 확인해야 한다.

### 알아둘 점

- **실시간이 아니다.** 기준일자 기준 **다음 영업일 13시경** 갱신되는 일별 시세(T+1)다.
  그래서 화면의 "현재가"는 엄밀히는 가장 최근 영업일의 **종가**다. 이 제약이 게임 규칙이 됐다 —
  [game-design.md](./game-design.md) 참조.
- 인증키가 틀리면 JSON 대신 XML/에러 문서가 돌아온다. 파싱 단계에서 이를 감지해 읽을 수 있는
  에러 메시지로 바꾼다. 특정 API만 403이면 그 API 활용신청이 안 된 것.
- API가 죽거나 쿼터가 소진되면 시드 스냅샷으로 폴백한다 — 화면이 죽는 대신 며칠 묵은
  데이터가 나온다.

### 이 저장소의 개발 환경 제약

Claude Code 웹 개발 컨테이너는 네트워크 정책상 `apis.data.go.kr`을 포함한 국내 금융 API가
차단되어 있을 수 있다. 그 경우 `npm run seed`와 실제 시세 연동 확인은 로컬에서 한다.
(로컬 CLI 세션에서는 정상 동작 확인됨)
