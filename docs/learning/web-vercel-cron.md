# Vercel Cron — 매일 13:20에 시세 캐시를 갱신하는 기술

## 개념: 크론(cron)이란

**정해진 시각에 작업을 자동 실행하는 스케줄러**다. 유닉스의 `crond` 데몬에서 온 이름이고,
실행 시각은 **크론 표현식** 5칸으로 적는다:

```
분 시 일 월 요일
20  4  *  *  *     ← 매일 04:20 (에 실행)
```

`*` 는 "매번"이라는 뜻. `0 */6 * * *` 라면 "6시간마다 정각"이 된다.

## Vercel Cron Jobs 는 어떤 기술인가

서버가 늘 떠 있는 전통적 환경이라면 `crond` 가 백그라운드에서 돌지만, 서버리스에는
"늘 떠 있는 내 프로세스"가 없다. Vercel Cron 은 이를 뒤집어서 해결한다:

> **Vercel 쪽 스케줄러가 지정 시각에 내 배포의 URL 로 HTTP GET 요청을 보낸다.**

즉 크론 작업의 실체는 데몬이 아니라 **평범한 Route Handler(서버리스 함수)** 이고,
"누가 그 URL 을 때리느냐"만 Vercel 스케줄러로 바뀐 것이다. 그래서:

- 크론 전용 코드가 따로 없다 — 우리가 이미 아는 `route.ts` 하나면 된다
- 로컬에서도 `curl` 로 같은 URL 을 때리면 똑같이 동작한다 (테스트가 쉽다)
- 함수 실행 시간·과금도 일반 함수 호출과 동일한 규칙을 따른다

## 이 프로젝트의 구성 (3조각)

### 1. 스케줄 선언 — `vercel.json`

```json
{
  "regions": ["icn1"],
  "crons": [{ "path": "/api/revalidate", "schedule": "20 4 * * *" }]
}
```

- ⚠️ **스케줄은 UTC 기준**이다. `20 4 * * *` = UTC 04:20 = **KST 13:20** (KST = UTC+9).
  공공데이터포털이 "다음 영업일 13시경" 시세를 공개하므로 그 직후를 노린 것.
- `regions: ["icn1"]` 은 함수가 서울 리전에서 실행된다는 뜻 — data.go.kr 과 물리적으로
  가까워 API 왕복이 빠르다.

### 2. 크론이 때리는 함수 — `src/app/api/revalidate/route.ts`

```ts
export async function GET(request: Request) {
  // ① 인증: Vercel 은 CRON_SECRET 환경변수가 있으면 크론 요청에
  //    Authorization: Bearer <CRON_SECRET> 헤더를 자동으로 붙여 준다
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }

  // ② 캐시 무효화: "datagokr" 태그가 붙은 모든 fetch 캐시를 stale 처리
  revalidateTag("datagokr", "max");

  // ③ 예열 + 진단: 바로 한 번 조회해 새 캐시를 만들고, 기준일을 응답에 담는다
  const snapshot = await getMarketSnapshot();
  return NextResponse.json({ revalidated: true, asOf: snapshot.date, source: snapshot.source });
}
```

인증이 필요한 이유: 이 URL 은 공개돼 있어서, 인증이 없으면 아무나 반복 호출해
캐시를 계속 무효화(=공공데이터 API 를 소진)할 수 있다.

### 3. 무효화 대상 — `datagokr` 태그가 붙은 fetch 들

| fetch | 파일 | 시간 캐시 | 태그 |
|---|---|---|---|
| 전 종목 스냅샷 | `src/lib/market/snapshot.ts` | 1시간 | `["datagokr", "snapshot"]` |
| 종목별 일봉 | `src/lib/market/datagokr-provider.ts` | 6시간 | `["datagokr", "candles"]` |
| KOSPI 지수 | `src/lib/market/index-series.ts` | 1시간 | `["datagokr", "index"]` |

셋 다 `datagokr` 를 공통 태그로 갖고 있어 **크론 한 번에 전부** stale 이 된다.
데이터 캐시가 무효화되면 그 데이터를 쓰던 ISR 페이지(홈·종목 상세·시장 뷰들)도
다음 방문 때 재생성된다.

## 전체 흐름 한눈에

```
13:00  공공데이터포털이 전일 시세 공개 (T+1)
  ↓
13:20  Vercel 스케줄러 → GET /api/revalidate (Bearer CRON_SECRET)
  ↓
       revalidateTag("datagokr", "max")
         → snapshot·candles·index 캐시가 stale 로 표시됨
  ↓
       getMarketSnapshot() 즉시 호출 → 새 스냅샷으로 예열
  ↓
이후   사용자가 페이지 방문 → stale 캐시 대신 새 데이터로 재생성
```

`"max"` 는 **stale-while-revalidate** 방식이다: 캐시를 지우는 게 아니라 "낡음"으로만
표시하고, 다음 요청은 일단 낡은 값을 보여주면서 백그라운드에서 새 값을 받아온다 —
사용자가 빈 화면이나 느린 응답을 보는 일이 없다. (Next 16 에서 1-인자
`revalidateTag(tag)` 는 deprecated — 두 번째 인자가 필수라고 봐야 한다.)

## 크론이 실패하면? — 이중 안전망

크론은 "빨리 반영하는 최적화"일 뿐, 유일한 갱신 경로가 아니다:

1. **시간 기반 캐시**: 크론이 안 돌아도 fetch 캐시가 1시간(일봉은 6시간) 뒤 알아서
   만료된다. 최악의 경우에도 새 시세가 최대 1시간 늦게 반영될 뿐.
2. **시드 폴백**: API 자체가 죽으면 커밋된 시드(`src/data/*.json`)로 동작한다.

그래서 크론 모니터링에 공을 들일 필요가 없는 구조다 — 취미 프로젝트에 맞는 설계.

## 확인·테스트 방법

- **프로덕션 로그**: Vercel 대시보드 → 프로젝트 → Logs 에서 13:20 KST 무렵
  `/api/revalidate` 항목 확인. 응답의 `asOf` 가 **전일(최신 영업일) 날짜**면 정상,
  이틀 전이면 포털 갱신이 늦었거나 크론이 그보다 먼저 돈 것.
- **수동 실행** (크론과 완전히 동일한 요청):
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" https://rokstock-01.vercel.app/api/revalidate
  ```
- 대시보드의 프로젝트 → Settings → Cron Jobs 에서 등록된 스케줄과 최근 실행 이력을
  볼 수 있다.

## 함정·주의사항

- **스케줄은 UTC**: "13:20에 돌게 했는데 새벽에 돈다"의 원인 1순위. KST 는 9시간을 빼서 적는다.
- **Hobby 플랜의 정밀도**: 무료 플랜에서는 예약 시각 정각이 아니라 **그 시각 이후 다소
  늦게**(수십 분 단위) 실행될 수 있다. 이 프로젝트는 시간 기반 캐시가 안전망이라 문제없지만,
  "정각 실행"이 중요한 작업이라면 유료 플랜이나 외부 스케줄러를 검토해야 한다.
- **프로덕션 배포에서만 돈다**: 프리뷰 배포에는 크론이 붙지 않는다. 프리뷰에서 시세가
  하루 늦게 보이는 건 정상.
- **`CRON_SECRET` 은 Vercel 환경변수로만**: 코드나 저장소에 절대 넣지 않는다. 값이 없으면
  라우트가 503 을 반환하도록 방어해 뒀다(인증 없이 열리는 사고 방지).
- **크론 요청은 GET**: Vercel 스케줄러는 GET 으로 호출하므로 핸들러도 `GET` 이어야 한다.

## 이 프로젝트에서 어디에 쓰였나

- `vercel.json` — 스케줄 선언 (`20 4 * * *` = 13:20 KST, 서울 리전)
- `src/app/api/revalidate/route.ts` — 크론이 때리는 함수 (인증 → 태그 무효화 → 예열)
- `src/lib/market/{snapshot,datagokr-provider,index-series}.ts` — `datagokr` 태그가 붙은 fetch 들
- 캐시 계층 전반은 [web-isr-caching.md](./web-isr-caching.md) 참조

## 참고

- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md`
