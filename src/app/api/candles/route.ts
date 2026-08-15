import { marketProvider } from "@/lib/market";
import { NextResponse } from "next/server";

/**
 * GET /api/candles?code=005930&days=10
 *
 * 일봉 조회 — 클라이언트 주도 정산(GameSettlement)이 체결가를 알아내는 데 쓴다.
 * 서버(공급자)의 fetch 데이터 캐시를 타므로 반복 호출 비용은 크지 않다.
 */
const MAX_DAYS = 90;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = params.get("code")?.trim() ?? "";
  const days = Math.min(MAX_DAYS, Math.max(1, Number(params.get("days") ?? 10) || 10));

  if (!/^\d{5}[0-9A-Z]$/.test(code)) {
    return NextResponse.json({ error: "올바른 종목코드가 아닙니다." }, { status: 400 });
  }

  try {
    const candles = await marketProvider.getDailyCandles(code, days);
    return NextResponse.json({ code, candles });
  } catch (error) {
    console.error("[api/candles] 일봉 조회 실패", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "일봉 조회에 실패했습니다." },
      { status: 502 },
    );
  }
}
