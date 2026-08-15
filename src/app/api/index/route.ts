import { getIndexSeries } from "@/lib/market/index-series";
import { NextResponse } from "next/server";

/**
 * GET /api/index — KOSPI 지수 일별 시계열.
 * 홈의 벤치마크 카드("지수에 묻어뒀다면")가 쓴다. 파라미터 없음 — 캐시 한 건으로 전원 커버.
 */
export async function GET() {
  try {
    const points = await getIndexSeries();
    return NextResponse.json({ points });
  } catch (error) {
    console.error("[api/index] 지수 조회 실패", error);
    return NextResponse.json({ error: "지수 조회에 실패했습니다." }, { status: 502 });
  }
}
