import { marketProvider } from "@/lib/market";
import { NextResponse } from "next/server";

/** 한 번에 조회할 수 있는 종목 수 상한 (실 공급자는 종목당 1회씩 호출하므로 과도한 요청을 막는다) */
const MAX_CODES = 30;

/**
 * GET /api/quotes?codes=005930,000660
 *
 * 관심 종목은 브라우저 localStorage 에 있어서 서버가 미리 알 수 없다.
 * 그래서 클라이언트가 자기 목록을 들고 와 시세를 물어보는 통로가 필요하다.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("codes") ?? "";
  const codes = raw
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean)
    .slice(0, MAX_CODES);

  if (codes.length === 0) {
    return NextResponse.json({ quotes: [] });
  }

  try {
    const quotes = await marketProvider.getQuotes(codes);
    return NextResponse.json({ quotes });
  } catch (error) {
    console.error("[api/quotes] 시세 조회 실패", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "시세 조회에 실패했습니다." },
      { status: 502 },
    );
  }
}
