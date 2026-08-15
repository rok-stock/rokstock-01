import { getMarketSnapshot } from "@/lib/market/snapshot";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * 시세 캐시 온디맨드 재검증.
 *
 * 공공데이터포털 데이터는 T+1 영업일 13시경 갱신된다. Vercel cron(vercel.json)이
 * 13:20 KST 무렵 이 라우트를 호출해 `datagokr` 태그가 붙은 데이터 캐시를 무효화한다.
 * cron 이 실패해도 fetch 캐시의 revalidate(1시간)가 안전망이 된다.
 *
 * 인증: Vercel 은 `CRON_SECRET` 환경변수가 있으면 cron 요청에
 * `Authorization: Bearer <CRON_SECRET>` 헤더를 자동으로 붙여 준다.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET 환경변수가 설정되지 않았습니다." },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }

  // "max" = stale-while-revalidate — 캐시를 stale 로 표시하고, 다음 방문 때 백그라운드로
  // 새 데이터를 받아온다. (1-인자 형태는 Next 16 에서 deprecated)
  revalidateTag("datagokr", "max");

  // 바로 한 번 조회해 재생성을 예열하고, cron 로그에서 기준일을 확인할 수 있게 응답에 담는다.
  const snapshot = await getMarketSnapshot();
  return NextResponse.json({
    revalidated: true,
    asOf: snapshot.date,
    source: snapshot.source,
  });
}
