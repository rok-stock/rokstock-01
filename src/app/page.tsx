import OnboardingCard from "@/components/OnboardingCard";
import PortfolioPanel from "@/components/PortfolioPanel";
import WatchlistPanel from "@/components/WatchlistPanel";
import { marketProvider } from "@/lib/market";
import Link from "next/link";

/** ISR — 시세가 하루 한 번 갱신되므로 1시간 캐시로 충분하다 (자세한 건 docs/market-data.md) */
export const revalidate = 3600;

export default function Home() {
  const isMock = marketProvider.name === "mock";

  return (
    <main className="container-page flex-1 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">하루 늦은 모의주식</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        어제 종가로 고르고, 내일 종가에 체결됩니다. 1억 원으로 시작하세요.
      </p>

      {isMock && (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          지금은 <strong>목업(가짜) 시세</strong>로 동작 중입니다. 실제 시세로 바꾸는 방법은{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">docs/market-data.md</code> 를
          참고하세요.
        </p>
      )}

      <OnboardingCard />

      {/* 데스크톱(lg): 좌 포트폴리오 / 우 관심 종목 2컬럼. minmax(0,1fr)는 그리드 오버플로 방지 */}
      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
        <PortfolioPanel />

        {/* WatchlistPanel 이 자체 "관심 종목" 제목을 갖고 있다 */}
        <div className="mt-6 rounded-2xl border border-zinc-200 p-3 lg:mt-0 dark:border-zinc-800">
          <WatchlistPanel />
        </div>
      </div>

      <p className="mt-6 px-3 text-xs text-zinc-400 dark:text-zinc-600">
        예시로{" "}
        <Link href="/stocks/005930" className="underline hover:text-zinc-600 dark:hover:text-zinc-300">
          삼성전자(005930)
        </Link>{" "}
        를 열어볼 수 있습니다.
      </p>
    </main>
  );
}
