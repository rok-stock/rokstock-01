import WatchlistPanel from "@/components/WatchlistPanel";
import { marketProvider } from "@/lib/market";
import Link from "next/link";

export default function Home() {
  const isMock = marketProvider.name === "mock";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">시세 조회 대시보드</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        관심 종목의 시세를 모아 보고, 종목을 눌러 일봉 차트를 확인하세요.
      </p>

      {isMock && (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          지금은 <strong>목업(가짜) 시세</strong>로 동작 중입니다. 실제 시세로 바꾸는 방법은{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">docs/market-data.md</code> 를
          참고하세요.
        </p>
      )}

      <div className="mt-8 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
        <WatchlistPanel />
      </div>

      <p className="mt-6 px-3 text-xs text-zinc-400 dark:text-zinc-600">
        예시로{" "}
        <Link href="/stocks/005930" className="underline">
          삼성전자(005930)
        </Link>{" "}
        를 열어볼 수 있습니다.
      </p>
    </main>
  );
}
