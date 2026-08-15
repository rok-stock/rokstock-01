"use client";

import { useGame } from "@/hooks/useGame";
import type { AchievementDef } from "@/lib/game/achievements";
import type { PendingOrder, Trade } from "@/lib/game/types";
import { getGameSnapshot } from "@/lib/game/store";
import { formatPrice } from "@/lib/market/format";
import type { DailyCandle } from "@/lib/market/types";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 체결 정산 트리거 + "체결 결과 개봉" 연출.
 *
 * 서버가 없는 게임이라 정산은 클라이언트가 주도한다: 앱을 열거나 탭에 돌아올 때
 * 미체결 주문이 있으면 일봉을 조회해 정산하고, 체결이 있으면 개봉 시트를 띄운다.
 * 이 "다음 날 개봉" 순간이 게임의 핵심 리듬이다 (docs/game-design.md 2절).
 *
 * 멀티탭 동시 정산 레이스는 취미 규모에서 무시한다 — 체결된 주문은 목록에서 빠지므로
 * 중복 실행은 사실상 no-op 이다.
 */

interface Outcome {
  fills: Trade[];
  refunds: PendingOrder[];
  earned: AchievementDef[];
}

/** 연속 focus 이벤트로 API 를 두드리지 않기 위한 최소 재시도 간격 */
const MIN_RUN_INTERVAL_MS = 60_000;

export default function GameSettlement() {
  const { ready, settlePendingOrders, refreshAchievements } = useGame();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const runningRef = useRef(false);
  const lastRunRef = useRef(0);
  const checkedTimeRef = useRef(false);

  const attempt = useCallback(async () => {
    if (runningRef.current) return;
    const pending = getGameSnapshot().pendingOrders;
    if (pending.length === 0) return;
    if (Date.now() - lastRunRef.current < MIN_RUN_INTERVAL_MS) return;

    runningRef.current = true;
    lastRunRef.current = Date.now();
    try {
      // 가장 오래된 주문까지 덮는 일봉 구간을 요청한다 (오래 접속 안 한 경우 대비)
      const oldest = Math.min(...pending.map((o) => new Date(o.orderedAt).getTime()));
      const days = Math.min(90, Math.ceil((Date.now() - oldest) / 86_400_000) + 7);

      const codes = [...new Set(pending.map((o) => o.code))];
      const entries = await Promise.all(
        codes.map(async (code): Promise<[string, DailyCandle[]] | null> => {
          try {
            const res = await fetch(`/api/candles?code=${code}&days=${days}`);
            if (!res.ok) return null;
            const json = (await res.json()) as { candles?: DailyCandle[] };
            return Array.isArray(json.candles) ? [code, json.candles] : null;
          } catch {
            return null; // 이 종목만 다음 기회에
          }
        }),
      );

      const candlesByCode = new Map(entries.filter((e): e is [string, DailyCandle[]] => e !== null));
      if (candlesByCode.size === 0) return;

      const result = settlePendingOrders(candlesByCode);
      if (result.fills.length > 0 || result.refunds.length > 0 || result.earned.length > 0) {
        setOutcome(result);
      }
    } finally {
      runningRef.current = false;
    }
  }, [settlePendingOrders]);

  useEffect(() => {
    if (!ready) return;
    // 시간 경과형 업적(한 달 생존 등)은 정산과 무관하게 로드 시 한 번 점검.
    // setTimeout 으로 미뤄 effect 내 동기 setState(연쇄 렌더 유발)를 피한다.
    if (!checkedTimeRef.current) {
      checkedTimeRef.current = true;
      setTimeout(() => {
        const earned = refreshAchievements();
        if (earned.length > 0) {
          setOutcome((prev) => prev ?? { fills: [], refunds: [], earned });
        }
      }, 0);
    }
    void attempt();
    const onVisible = () => {
      if (document.visibilityState === "visible") void attempt();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready, attempt, refreshAchievements]);

  if (!outcome) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="체결 결과">
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl rounded-t-2xl bg-white p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] dark:bg-zinc-900">
        {outcome.fills.length > 0 || outcome.refunds.length > 0 ? (
          <>
            <h2 className="text-lg font-bold">📬 체결 결과가 도착했어요</h2>
            <p className="mt-1 text-sm text-zinc-500">주문하신 내역이 종가로 체결됐습니다.</p>
          </>
        ) : (
          <h2 className="text-lg font-bold">🏅 업적 달성!</h2>
        )}

        <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
          {outcome.fills.map((fill) => (
            <li
              key={fill.id}
              className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">
                  <span className={fill.side === "buy" ? "text-red-600" : "text-blue-600"}>
                    {fill.side === "buy" ? "매수" : "매도"}
                  </span>{" "}
                  {fill.name}
                </span>
                <span className="text-sm tabular-nums">
                  {fill.quantity}주 × {formatPrice(fill.price)}원
                </span>
              </div>
              <p className="mt-1 flex justify-between text-xs tabular-nums text-zinc-500">
                <span>
                  {fill.execDate} 종가 체결 · 비용 {formatPrice(fill.fee + fill.tax)}원
                </span>
                {fill.realizedPnl !== undefined && (
                  <span
                    className={`font-semibold ${
                      fill.realizedPnl >= 0 ? "text-red-600" : "text-blue-600"
                    }`}
                  >
                    실현손익 {fill.realizedPnl >= 0 ? "+" : ""}
                    {formatPrice(fill.realizedPnl)}원
                  </span>
                )}
              </p>
            </li>
          ))}
          {outcome.refunds.map((order) => (
            <li
              key={order.id}
              className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
            >
              {order.name} 매수 주문 {formatPrice(order.amount ?? 0)}원이 1주 가격에 못 미쳐
              반환됐어요.
            </li>
          ))}
        </ul>

        {outcome.earned.length > 0 && (
          <div className="mt-3 space-y-2">
            {outcome.earned.map((achievement) => (
              <p
                key={achievement.id}
                className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:bg-violet-950 dark:text-violet-200"
              >
                <span className="font-semibold">
                  🏅 업적 달성 — {achievement.emoji} {achievement.title}
                </span>
                <span className="mt-0.5 block text-xs opacity-80">{achievement.description}</span>
              </p>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setOutcome(null)}
          className="mt-4 w-full rounded-xl bg-zinc-900 py-3.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          확인
        </button>
      </div>
    </div>
  );
}
