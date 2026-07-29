import { marketProvider } from "@/lib/market";
import { NextResponse } from "next/server";

/**
 * GET /api/stocks/search?q=삼성
 *
 * 검색창(클라이언트 컴포넌트)이 호출하는 종목 검색 API.
 * Route Handler 는 서버에서 돌기 때문에 API 키가 브라우저로 새어나가지 않는다.
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return NextResponse.json({ stocks: [] });
  }

  try {
    const stocks = await marketProvider.searchStocks(query);
    return NextResponse.json({ stocks });
  } catch (error) {
    console.error("[api/stocks/search] 검색 실패", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "종목 검색에 실패했습니다." },
      { status: 502 },
    );
  }
}
