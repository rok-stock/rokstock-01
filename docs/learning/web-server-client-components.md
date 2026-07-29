# 서버 컴포넌트와 클라이언트 컴포넌트

관련 마일스톤: M1

## 개념

Next.js App Router에서 컴포넌트는 기본이 **서버 컴포넌트**다. 서버에서 한 번 실행되어 HTML을
만들고, 그 코드는 브라우저로 내려가지 않는다.

파일 맨 위에 `"use client"`를 적으면 **클라이언트 컴포넌트**가 된다. 이건 "브라우저에서만 돈다"는
뜻이 아니라 **"브라우저에서도 돈다"**는 뜻이다. 서버에서 HTML을 만들고, 브라우저에서 그 HTML에
이벤트 핸들러를 다시 붙인다(= 하이드레이션).

보험 업무에 비유하면, 서버 컴포넌트는 배치로 돌려 만든 정적인 통지서에 가깝고, 클라이언트
컴포넌트는 사용자가 값을 바꾸면 즉시 반응하는 설계 화면에 가깝다.

## 어느 쪽을 쓰나

| 필요한 것 | 어느 쪽 |
|---|---|
| DB/외부 API 조회, API 키 사용 | **서버** |
| `useState`, `useEffect` 같은 상태/생명주기 | 클라이언트 |
| `onClick` 등 사용자 이벤트 | 클라이언트 |
| `window`, `localStorage`, canvas | 클라이언트 |

원칙은 **가능한 한 서버, 필요한 곳만 클라이언트**다. 클라이언트 컴포넌트는 브라우저로 내려보내야
할 자바스크립트가 되므로 화면이 무거워진다.

## 이 프로젝트에서

- `src/app/stocks/[code]/page.tsx` — **서버**. 시세 조회가 서버에서 끝나므로 공공데이터포털
  인증키가 브라우저로 새지 않는다. 조회 코드도 번들에 안 들어간다.
- `src/components/CandleChart.tsx` — **클라이언트**. lightweight-charts가 canvas에 직접 그려서
  브라우저 DOM이 필요하다.
- `src/components/WatchlistPanel.tsx` — **클라이언트**. 관심 종목이 `localStorage`에 있는데,
  이건 브라우저에만 존재해서 서버는 알 수 없다.
- `src/components/StockSearch.tsx` — **클라이언트**. 타이핑에 반응해야 한다.

## 자주 밟는 함정

### 1. 하이드레이션 불일치

서버가 만든 HTML과 브라우저의 첫 렌더 결과가 다르면 React가 경고를 띄우고 화면이 깨진다.
원인은 대개 **렌더 중에 서버/브라우저가 다른 값을 보는 것**이다.

```tsx
// ✗ 서버에는 localStorage가 없다 → 즉시 에러
const [codes] = useState(JSON.parse(localStorage.getItem("watchlist")));

// ✓ useEffect는 브라우저에서만 돈다 → 첫 렌더는 서버와 동일하게 빈 값
useEffect(() => setCodes(readStorage()), []);
```

`src/hooks/useWatchlist.ts`가 이 방식을 쓴다. `ready` 플래그는 "아직 못 읽음"과 "읽었는데
비어있음"을 구분하려고 둔 값이다.

같은 이유로 목업 시세도 `Math.random()`을 쓰지 않는다. 서버와 브라우저가 다른 난수를 뽑으면
값이 어긋나기 때문에, 종목코드로 시드를 만든 의사난수를 쓴다.

### 2. 서버 컴포넌트는 클라이언트 컴포넌트를 품을 수 있다

반대도 되지만(children으로 넘기면) 직접 import는 안 된다. 이 프로젝트에서는 서버 컴포넌트인
상세 페이지가 `<CandleChart candles={...} />`처럼 클라이언트 컴포넌트를 렌더하고 데이터를
props로 내려준다. 이때 props는 직렬화(JSON으로 변환)될 수 있어야 한다.

## Route Handler는 왜 필요했나

서버 컴포넌트가 직접 조회하면 되는데 왜 `src/app/api/quotes/route.ts`를 만들었을까?

관심 종목 목록이 **브라우저에만** 있기 때문이다. 서버는 페이지를 그릴 때 그 목록을 모른다.
그래서 브라우저가 자기 목록을 들고 와서 시세를 물어볼 창구가 필요했다.

M2에서 관심 종목을 DB로 옮기면 서버가 목록을 알게 되므로, 이 API 없이 서버 컴포넌트에서 바로
조회할 수 있게 된다.

## 참고

- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
