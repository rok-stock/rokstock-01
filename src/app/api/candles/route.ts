import { marketProvider } from "@/lib/market";
import { findStockByCode } from "@/lib/market/stock-master";
import type { DailyCandle } from "@/lib/market/types";
import { NextResponse } from "next/server";

/**
 * GET /api/candles?codes=005930,000660&days=60
 *
 * 관심종목 수익률 비교 차트(/watchlist)용 배치 일봉 조회.
 * 관심 종목이 localStorage 에만 있어 클라이언트가 목록을 들고 와야 한다
 * (/api/quotes 와 같은 이유).
 *
 * ⚠️ G10 이전에 있던 /api/candles 는 체결 정산 전용이었고 즉시 체결 전환 때
 * 삭제됐다 — 이 라우트는 경로만 같은 별개 용도다.
 */

/** 실 공급자는 종목당 1회씩 호출하고 일봉은 payload 가 커서 quotes(30)보다 낮게 잡는다 */
const MAX_CODES = 10;
const MAX_DAYS = 270; // 약 1년(영업일)

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const codes = (params.get("codes") ?? "")
    .split(",")
    .map((code) => code.trim())
    .filter((code) => /^\d{5}[0-9A-Z]$/.test(code))
    .slice(0, MAX_CODES);
  const days = Math.min(MAX_DAYS, Math.max(1, Number(params.get("days") ?? 60) || 60));

  if (codes.length === 0) {
    return NextResponse.json({ series: [] });
  }

  try {
    const series = await Promise.all(
      codes.map(async (code): Promise<{ code: string; name: string; candles: DailyCandle[] }> => {
        // 종목명도 함께 내려준다 — 클라이언트가 종목 마스터(수십 KB)를 번들에 실을 필요가 없게
        const name = findStockByCode(code)?.name ?? code;
        try {
          return { code, name, candles: await marketProvider.getDailyCandles(code, days) };
        } catch {
          return { code, name, candles: [] }; // 한 종목 실패가 전체를 막지 않게
        }
      }),
    );
    return NextResponse.json({ series });
  } catch (error) {
    console.error("[api/candles] 일봉 조회 실패", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "일봉 조회에 실패했습니다." },
      { status: 502 },
    );
  }
}
