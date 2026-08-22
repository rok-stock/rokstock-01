import RankingTabs from "@/components/RankingTabs";
import { marketProvider } from "@/lib/market";
import type { Metadata } from "next";

/**
 * 시장 랭킹 — 상승률/하락률/거래량 TOP 30.
 *
 * 서버 컴포넌트가 전 종목 스냅샷(getAllQuotes, 이미 fetch 캐시를 탄다)에서
 * 세 리스트를 미리 계산해 ISR HTML 로 굽는다. 탭 전환은 클라이언트가 받은
 * 배열을 바꿔 보여줄 뿐이라 추가 요청이 없다.
 *
 * ⚠️ 정렬을 searchParams 로 만들면 안 된다 — searchParams 는 Request-time API 라
 * 읽는 순간 페이지가 동적 렌더링으로 떨어져 ISR 캐시를 잃는다.
 */

export const revalidate = 3600;

export const metadata: Metadata = { title: "시장 랭킹 · RokStock" };

const TOP_N = 30;

export default async function MarketRankingPage() {
  const quotes = await marketProvider.getAllQuotes();

  const gainers = [...quotes].sort((a, b) => b.changeRate - a.changeRate).slice(0, TOP_N);
  const losers = [...quotes].sort((a, b) => a.changeRate - b.changeRate).slice(0, TOP_N);
  const byVolume = [...quotes].sort((a, b) => b.volume - a.volume).slice(0, TOP_N);
  const asOf = quotes[0]?.date ?? "";

  return (
    <main className="container-page flex-1 px-6 pt-6 pb-10">
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            KOSPI 랭킹 TOP {TOP_N}
          </h2>
          {asOf && (
            <span className="text-xs tabular-nums text-zinc-400">{asOf} 종가 기준</span>
          )}
        </div>
        <div className="mt-3">
          <RankingTabs gainers={gainers} losers={losers} byVolume={byVolume} />
        </div>
        <p className="mt-3 text-xs leading-5 text-zinc-400">
          오늘 많이 오른 종목이 내일도 오르리란 법은 없어요 — 급등주 추격 매수는 가장 흔한
          초보 실수 중 하나입니다. 랭킹은 &ldquo;시장에 무슨 일이 있었나&rdquo;를 읽는
          용도로 쓰세요.
        </p>
      </section>
    </main>
  );
}
