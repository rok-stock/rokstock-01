"use client";

import { useGame } from "@/hooks/useGame";
import Link from "next/link";

/**
 * 거래 내역 — 미체결 주문과 체결 내역.
 *
 * G2 시점에는 주문 기능이 없어 빈 상태만 보인다. 미체결 목록·취소는 G3,
 * 체결 내역 상세는 G4 에서 채워진다.
 */
export default function HistoryPage() {
  const { state, ready } = useGame();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">거래 내역</h1>

      {!ready ? (
        <p className="mt-8 text-sm text-zinc-400">불러오는 중…</p>
      ) : state.pendingOrders.length === 0 && state.trades.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500">아직 거래가 없어요.</p>
          <p className="mt-2 text-sm text-zinc-400">
            <Link href="/" className="underline">
              홈
            </Link>
            에서 종목을 찾아 첫 주문을 넣어보세요. (주문 기능은 다음 업데이트에서 열립니다)
          </p>
        </div>
      ) : (
        <p className="mt-8 text-sm text-zinc-500">
          미체결 {state.pendingOrders.length}건 · 체결 {state.trades.length}건 — 목록 화면은
          준비 중입니다.
        </p>
      )}
    </main>
  );
}
