"use client";

import ConceptTip from "@/components/ConceptTip";
import { useGame } from "@/hooks/useGame";
import { changeColorClass, formatChangeRate, formatPrice } from "@/lib/market/format";

/**
 * 종목 상세의 보유 현황 카드.
 *
 * 페이지 본문은 ISR 로 모든 사용자가 공유하므로, 개인 상태(보유)는
 * 이 클라이언트 컴포넌트가 localStorage 에서 읽어 그린다. 보유가 없으면 아무것도 안 그린다.
 */
export default function PositionCard({ code, price }: { code: string; price: number }) {
  const { state, ready } = useGame();
  if (!ready) return null;

  const position = state.positions.find((p) => p.code === code);
  if (!position) return null;

  const value = price * position.quantity;
  const pnl = value - position.totalCost;
  const pnlRate = position.totalCost === 0 ? 0 : (pnl / position.totalCost) * 100;

  return (
    <div className="mt-6 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">내 보유</h2>
        <span className={`text-sm font-medium tabular-nums ${changeColorClass(pnl)}`}>
          {pnl >= 0 ? "+" : ""}
          {formatPrice(pnl)}원 ({formatChangeRate(pnlRate)})
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-zinc-400">보유 수량</dt>
          <dd className="mt-0.5 tabular-nums">{position.quantity}주</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-400">
            <ConceptTip id="avgPrice">평균 단가</ConceptTip>
          </dt>
          <dd className="mt-0.5 tabular-nums">{formatPrice(Math.round(position.avgPrice))}원</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-400">평가금액</dt>
          <dd className="mt-0.5 tabular-nums">{formatPrice(value)}원</dd>
        </div>
      </dl>
    </div>
  );
}
