"use client";

import { useGame } from "@/hooks/useGame";
import { expectedExecDate } from "@/lib/game/engine";
import { formatPrice } from "@/lib/market/format";
import Link from "next/link";

/**
 * 거래 내역 — 미체결 주문(취소 가능)과 체결 내역.
 * 체결은 G4 의 정산 엔진이 만들어낸다. 그전까지 체결 내역은 비어 있다.
 */
export default function HistoryPage() {
  const { state, ready, cancelPendingOrder } = useGame();

  const empty = state.pendingOrders.length === 0 && state.trades.length === 0;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
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
        <>
          {state.pendingOrders.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                미체결 주문 {state.pendingOrders.length}건
              </h2>
              <ul className="mt-3 space-y-2">
                {state.pendingOrders.map((order) => (
                  <li
                    key={order.id}
                    className="flex items-center gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                  >
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                        order.side === "buy"
                          ? "bg-red-50 text-red-600 dark:bg-red-950"
                          : "bg-blue-50 text-blue-600 dark:bg-blue-950"
                      }`}
                    >
                      {order.side === "buy" ? "매수" : "매도"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/stocks/${order.code}`} className="text-sm font-medium">
                        {order.name}
                      </Link>
                      <p className="mt-0.5 text-xs tabular-nums text-zinc-500">
                        {order.side === "buy"
                          ? `${formatPrice(order.amount ?? 0)}원어치`
                          : `${order.quantity}주`}{" "}
                        · {expectedExecDate(new Date(order.orderedAt))} 종가 체결 예정
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => cancelPendingOrder(order.id)}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      취소
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-zinc-400">
                체결 전까지 취소할 수 있어요. 체결 확인은 데이터가 갱신되는 다음 영업일 오후에!
              </p>
            </section>
          )}

          {state.trades.length > 0 && (
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
                      <Link href={`/stocks/${trade.code}`} className="text-sm font-medium">
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
        </>
      )}
    </main>
  );
}
