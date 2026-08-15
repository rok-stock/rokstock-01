# ISR과 Next.js 캐시 계층

## 개념

**ISR(Incremental Static Regeneration, 증분 정적 재생성)** 은 "정적 페이지의 속도"와
"동적 데이터의 신선함"을 절충하는 기법이다. 페이지를 한 번 렌더링해 캐시해 두고,
정해진 시간(`revalidate`)이 지나면 **다음 방문자에게는 일단 캐시본을 주면서 뒤에서 새로
만든다**(stale-while-revalidate). 방문자는 늘 빠른 응답을 받고, 서버는 렌더링을 시간당
한 번만 한다.

Next.js에는 캐시가 여러 겹 있다는 게 핵심이다:

| 계층 | 캐시 대상 | 수명 설정 | 이 프로젝트 |
|---|---|---|---|
| 데이터 캐시 | `fetch()` 응답 | `next: { revalidate, tags }` | 시세 스냅샷 1시간, 일봉 6시간 |
| 전체 라우트 캐시 | 페이지 렌더 결과(HTML/RSC) | `export const revalidate` | 홈·종목 상세 1시간 |
| 라우터 캐시 | 브라우저 안의 방문 기록 | (클라이언트) | 기본값 |

데이터 캐시 덕에 같은 시간대의 방문자 100명이 와도 공공데이터포털 API는 **한 번만** 호출된다.
우리 데이터는 하루 한 번(T+1 13시)만 바뀌므로, 시간당 몇 번의 호출로 하루 종일 서비스가 돈다.

## 함정: generateStaticParams가 없으면 ISR이 아니다

`/stocks/[code]` 같은 동적 라우트는 `export const revalidate = 3600`만 선언해서는
ISR이 되지 **않는다**. 이 프로젝트에서 실제로 밟은 함정:

```
Cache-Control: private, no-cache, no-store   ← 매 요청 서버 렌더링 (ISR 아님)
```

`generateStaticParams()`를 **빈 배열이라도** 내보내야 "명단에 없는 경로는 첫 방문 때
만들어 캐시"하는 온디맨드 ISR이 된다:

```ts
export const revalidate = 3600;
export function generateStaticParams() {
  return []; // 940여 종목을 빌드 때 다 만들 필요 없다 — 방문한 종목만 그때 생성
}
```

적용 후:

```
1회차  x-nextjs-cache: MISS   ← 이때 한 번 렌더링
2회차  x-nextjs-cache: HIT    ← 캐시본
Cache-Control: s-maxage=3600, stale-while-revalidate=...
```

## 온디맨드 재검증 (cron)

시간 기반 캐시만 있으면 13시에 새 데이터가 나와도 최대 1시간 늦게 반영된다. 그래서
fetch에 **태그**를 달고, 매일 13:20 KST경 Vercel cron이 태그를 무효화한다:

```ts
// 캐시에 태그 달기
fetch(url, { next: { revalidate: 3600, tags: ["datagokr"] } });

// /api/revalidate (cron 이 호출)
revalidateTag("datagokr", "max"); // "max" = stale-while-revalidate 방식으로 무효화
```

주의: Next 16에서 `revalidateTag(tag)` 1-인자 형태는 deprecated다. 두 번째 인자로
프로파일(보통 `"max"`)을 넘겨야 한다.

## 검증 방법

**개발 모드(`npm run dev`)에서는 캐시가 동작하지 않는다.** 반드시 프로덕션 모드로 확인한다:

```bash
npm run build && npm run start
curl -sI localhost:3000/stocks/005930   # 2회째 요청에서 x-nextjs-cache: HIT 확인
```

## 이 프로젝트에서 어디에 쓰였나

- `src/lib/market/snapshot.ts` — 전 종목 시세 fetch에 `revalidate: 3600` + `datagokr` 태그
- `src/app/stocks/[code]/page.tsx` — `revalidate` + 빈 `generateStaticParams`
- `src/app/api/revalidate/route.ts` + `vercel.json`의 crons — 13시 갱신 직후 반영

## 참고

- `node_modules/next/dist/docs/01-app/02-guides/incremental-static-regeneration.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md`
