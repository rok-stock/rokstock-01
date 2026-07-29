# 시세 데이터

## 왜 한 겹을 뒀나

화면은 "시세를 어디서 가져오는지" 몰라야 한다. 나중에 KIS API(M5)로 갈아끼울 때 화면 코드를 다시
쓰고 싶지 않기 때문이다. 그래서 `src/lib/market/`에 **공급자(provider) 인터페이스**를 두고,
화면은 그 인터페이스만 바라본다.

```
src/lib/market/
  types.ts              도메인 타입 + MarketDataProvider 인터페이스
  stock-master.ts       종목 마스터 (코드/종목명/시장)
  mock-provider.ts      가짜 시세 — API 키 불필요
  datagokr-provider.ts  공공데이터포털 실제 시세
  index.ts              환경변수로 공급자 선택
  format.ts             가격·등락률 표시 포맷과 색상
```

화면에서는 이렇게만 쓴다:

```ts
import { marketProvider } from "@/lib/market";

const quote = await marketProvider.getQuote("005930");
```

## 공급자 전환

`.env.local` (없으면 `.env.example`을 복사해서 만든다):

```bash
cp .env.example .env.local
```

| 환경변수 | 값 | 설명 |
|---|---|---|
| `MARKET_DATA_PROVIDER` | `mock` (기본) | API 키 없이 도는 가짜 시세 |
| | `datagokr` | 공공데이터포털 실제 시세 |
| `DATA_GO_KR_SERVICE_KEY` | 인증키 | `datagokr`일 때 필요 |

`datagokr`로 지정했는데 키가 없으면 경고를 남기고 목업으로 되돌아간다 — 개발이 멈추지 않도록.

## 목업 공급자

- 값은 가짜지만 **결정적**이다. 종목코드에서 시드를 뽑아 쓰기 때문에 같은 종목은 항상 같은 시세가
  나온다. `Math.random()`을 쓰면 서버가 그린 HTML과 브라우저가 그린 화면이 어긋나
  하이드레이션이 깨지고, 새로고침할 때마다 차트가 춤춘다.
- 약 1년치(260영업일) 이력을 통째로 만든 뒤 필요한 만큼 뒤에서 잘라 쓴다. 요청한 일수만큼만
  만들면 2일치로 본 현재가와 60일 차트의 마지막 값이 어긋난다.
- 공휴일은 반영하지 않는다(주말만 제외).

## 공공데이터포털 공급자

**금융위원회 「주식시세정보」** — https://www.data.go.kr/data/15094808/openapi.do

1. 공공데이터포털 회원가입 후 위 API에 **활용신청** (자동 승인)
2. 마이페이지에서 **일반 인증키(Decoding)** 복사
3. `.env.local`에 `DATA_GO_KR_SERVICE_KEY=...`, `MARKET_DATA_PROVIDER=datagokr`
4. `npm run dev`

### 알아둘 점

- **실시간이 아니다.** 기준일자 기준 **다음 영업일 오후**에 갱신되는 일별 시세(T+1)다.
  그래서 화면의 "현재가"는 엄밀히는 가장 최근 영업일의 **종가**다. 실시간 시세는 M5(KIS API)에서
  다룬다.
- 종목 여러 개를 한 번에 조회하는 파라미터가 없어 관심 종목은 종목당 한 번씩 호출한다.
  응답은 1시간 캐시(`next: { revalidate: 3600 }`)를 타므로 반복 조회 비용은 크지 않다.
- 인증키가 틀리면 JSON 대신 XML 에러 문서가 돌아온다. `parseItems`에서 이를 감지해
  읽을 수 있는 에러 메시지로 바꾼다.

### 이 저장소의 개발 환경 제약

Claude Code 웹 개발 컨테이너는 네트워크 정책상 `apis.data.go.kr`을 포함한 국내 금융 API가
차단되어 있다. 따라서 **실제 시세 연동은 로컬에서 확인해야 한다.** 컨테이너 안에서는 목업으로만
개발·검증한다.
