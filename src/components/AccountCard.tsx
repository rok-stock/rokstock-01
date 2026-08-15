"use client";

import { useGame } from "@/hooks/useGame";
import { formatPrice } from "@/lib/market/format";

/** startedAt(ISO) → 시작 후 며칠째인지 (시작한 날 = 1일째) */
function dayCount(startedAt: string): number {
  const elapsed = Date.now() - new Date(startedAt).getTime();
  return Math.max(1, Math.floor(elapsed / 86_400_000) + 1);
}

/**
 * 홈 상단 계좌 카드 — 주문 가능 현금과 게임 진행 정보.
 * 총자산·수익률(보유 종목 평가 포함)은 G5 에서 확장한다.
 */
export default function AccountCard() {
  const { state, ready } = useGame();

  if (!ready) {
    return (
      <div className="animate-pulse rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-3 h-8 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
    );
  }

  const startedDate = state.startedAt.slice(0, 10);

  return (
    <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">주문 가능 금액</h2>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {startedDate} 시작 · {dayCount(state.startedAt)}일째
        </span>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums">
        {formatPrice(state.cash)}
        <span className="ml-1 text-base font-normal text-zinc-400">원</span>
      </p>
      {state.lockedCash > 0 && (
        <p className="mt-1 text-sm tabular-nums text-zinc-500">
          주문에 묶인 금액 {formatPrice(state.lockedCash)}원
        </p>
      )}
    </div>
  );
}
