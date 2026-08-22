import WatchlistCompareChart from "@/components/WatchlistCompareChart";
import WatchlistPanel from "@/components/WatchlistPanel";
import type { Metadata } from "next";

/**
 * 관심종목 비교 — 홈처럼 클라이언트 컴포넌트 두 개를 조합만 하는 서버 셸.
 * 관심 종목이 localStorage 에만 있어 데이터는 전부 클라이언트가 가져온다.
 */

export const metadata: Metadata = { title: "관심종목 비교 · RokStock" };

export default function WatchlistPage() {
  return (
    <main className="container-page flex-1 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">관심종목 비교</h1>

      {/* 데스크톱(lg): 좌 비교 차트 / 우 관심 종목 리스트 (홈과 같은 2컬럼 패턴) */}
      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
        <WatchlistCompareChart />

        <div className="mt-6 rounded-2xl border border-zinc-200 p-3 lg:mt-0 dark:border-zinc-800">
          <WatchlistPanel />
        </div>
      </div>
    </main>
  );
}
