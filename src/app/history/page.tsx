"use client";

import { useGame } from "@/hooks/useGame";
import { formatPrice } from "@/lib/market/format";
import Link from "next/link";

/**
 * 거래 내역 — 체결 내역. 매수/매도가 조회 시점 최신가로 즉시 체결되므로
 * 미체결 상태는 없다 (docs/game-design.md 2절).
 */
export default function HistoryPage() {
  const { state, ready } = useGame();

  const empty = state.trades.length === 0;

  return (
    <main className="container-page flex-1 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">거래 내역</h1>

      {!ready ? (
        <p className="mt-8 text-sm text-zinc-400">불러오는 중…</p>
      ) : empty ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500">아직 거래가 없어요.</p>
          <p className="mt-2 text-sm text-zinc-400">
            <Link href="/" className="underline">
              홈
            </Link>
            에서 종목을 찾아 첫 주문을 넣어보세요.
          </p>
        </div>
      ) : (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">체결 내역</h2>
          <ul className="mt-3 space-y-2">
            {state.trades.map((trade) => (
              <li
                key={trade.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                    trade.side === "buy"
                      ? "bg-red-50 text-red-600 dark:bg-red-950"
                      : "bg-blue-50 text-blue-600 dark:bg-blue-950"
                  }`}
                >
                  {trade.side === "buy" ? "매수" : "매도"}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/stocks/${trade.code}`} className="text-sm font-medium hover:underline">
                    {trade.name}
                  </Link>
                  <p className="mt-0.5 text-xs tabular-nums text-zinc-500">
                    {trade.quantity}주 × {formatPrice(trade.price)}원 · {trade.execDate} · 비용{" "}
                    {formatPrice(trade.fee + trade.tax)}원
                  </p>
                </div>
                {trade.realizedPnl !== undefined && (
                  <span
                    className={`text-sm tabular-nums ${
                      trade.realizedPnl >= 0 ? "text-red-600" : "text-blue-600"
                    }`}
                  >
                    {trade.realizedPnl >= 0 ? "+" : ""}
                    {formatPrice(trade.realizedPnl)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
