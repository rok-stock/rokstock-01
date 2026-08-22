"use client";

import ConceptTip from "@/components/ConceptTip";
import { useGame } from "@/hooks/useGame";
import { INITIAL_CASH } from "@/lib/game/rules";
import { evaluatePortfolio } from "@/lib/game/valuation";
import { changeColorClass, formatChangeRate, formatPrice } from "@/lib/market/format";
import type { IndexPoint, Quote } from "@/lib/market/types";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * 홈 포트폴리오 패널 — 총자산 카드 + 보유 종목 리스트.
 *
 * 보유 종목 시세는 `/api/quotes` 로 가져온다 (서버의 스냅샷 캐시를 타므로 저렴).
 * 평가 계산은 `evaluatePortfolio` 순수 함수에 위임하고 여기는 표시만 한다.
 */

/** 연속 focus 이벤트로 시세를 다시 두드리지 않기 위한 최소 간격 */
const REFRESH_INTERVAL_MS = 60_000;

/** startedAt(ISO) → 시작 후 며칠째인지 (시작한 날 = 1일째) */
function dayCount(startedAt: string): number {
  const elapsed = Date.now() - new Date(startedAt).getTime();
  return Math.max(1, Math.floor(elapsed / 86_400_000) + 1);
}

export default function PortfolioPanel() {
  const { state, ready } = useGame();
  const [quotes, setQuotes] = useState<ReadonlyMap<string, Quote>>(new Map());
  const [indexPoints, setIndexPoints] = useState<IndexPoint[]>([]);
  const lastFetchRef = useRef(0);

  // KOSPI 지수 (벤치마크 비교용) — 세션당 한 번이면 충분
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetch("/api/index")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { points?: IndexPoint[] } | null) => {
        if (!cancelled && Array.isArray(json?.points)) setIndexPoints(json.points);
      })
      .catch(() => {
        // 벤치마크 카드만 숨겨진다 — 조용히 넘어감
      });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const codesKey = state.positions
    .map((p) => p.code)
    .sort()
    .join(",");

  useEffect(() => {
    if (!ready || codesKey === "") return;

    const load = async () => {
      if (Date.now() - lastFetchRef.current < REFRESH_INTERVAL_MS) return;
      lastFetchRef.current = Date.now();
      try {
        const res = await fetch(`/api/quotes?codes=${codesKey}`);
        if (!res.ok) return;
        const json = (await res.json()) as { quotes?: Quote[] };
        if (Array.isArray(json.quotes)) {
          setQuotes(new Map(json.quotes.map((q) => [q.code, q])));
        }
      } catch {
        // 시세 실패 시 평단가 기준 평가로 동작한다 — 조용히 넘어감
      }
    };

    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [ready, codesKey]);

  if (!ready) {
    return (
      <div className="animate-pulse rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-3 h-9 w-44 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-3 h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
    );
  }

  const valuation = evaluatePortfolio(state, quotes);
  const pnlColor = changeColorClass(valuation.totalPnl);

  // 벤치마크: 게임 시작일(또는 그 직전 거래일)의 지수 대비 최근 지수 배율로
  // "같은 날 KOSPI 에 1억을 넣었다면"을 계산한다
  const startDate = state.startedAt.slice(0, 10);
  const baseline =
    [...indexPoints].reverse().find((p) => p.date <= startDate) ?? indexPoints[0];
  const latest = indexPoints[indexPoints.length - 1];
  const benchmark =
    baseline && latest && baseline.close > 0
      ? {
          assets: Math.round((INITIAL_CASH * latest.close) / baseline.close),
          baseline,
          latest,
        }
      : null;
  const benchmarkGap = benchmark ? valuation.totalAssets - benchmark.assets : 0;

  return (
    <div className="space-y-4">
      {/* 총자산 카드 */}
      <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">총자산</h2>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {state.startedAt.slice(0, 10)} 시작 · {dayCount(state.startedAt)}일째
          </span>
        </div>
        <p className="mt-2 text-3xl font-semibold tabular-nums">
          {formatPrice(valuation.totalAssets)}
          <span className="ml-1 text-base font-normal text-zinc-400">원</span>
        </p>
        <p className={`mt-1 text-sm tabular-nums ${pnlColor}`}>
          {valuation.totalPnl >= 0 ? "+" : ""}
          {formatPrice(valuation.totalPnl)}원 ({formatChangeRate(valuation.totalPnlRate)})
          <span className="ml-1 text-zinc-400">· 시작 자금 1억 대비</span>
        </p>

        <dl className="mt-4 space-y-1.5 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-900">
          <div className="flex justify-between">
            <dt className="text-zinc-500">주문 가능 현금</dt>
            <dd className="tabular-nums">{formatPrice(valuation.cash)}원</dd>
          </div>
          {valuation.stockValue > 0 && (
            <div className="flex justify-between">
              <dt className="text-zinc-500">주식 평가금액</dt>
              <dd className="tabular-nums">{formatPrice(valuation.stockValue)}원</dd>
            </div>
          )}
        </dl>
      </div>

      {/* 벤치마크 비교 */}
      {benchmark && (
        <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            🏁 <ConceptTip id="benchmark">벤치마크</ConceptTip> 비교
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            시작일에 1억을 전부 <strong>KOSPI 지수</strong>에 넣었다면 지금{" "}
            <span className="font-semibold tabular-nums">{formatPrice(benchmark.assets)}원</span>
          </p>
          <p className={`mt-1 text-sm tabular-nums ${changeColorClass(benchmarkGap)}`}>
            {benchmarkGap >= 0 ? (
              <>내가 {formatPrice(benchmarkGap)}원 앞서고 있어요 🎉</>
            ) : (
              <>지수가 {formatPrice(-benchmarkGap)}원 앞서 있어요 — 시장을 이기긴 어렵죠 💪</>
            )}
          </p>
          <p className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs tabular-nums text-zinc-400">
            <span>
              {benchmark.baseline.date} 지수 {benchmark.baseline.close.toLocaleString("ko-KR")} →{" "}
              {benchmark.latest.date} {benchmark.latest.close.toLocaleString("ko-KR")}
            </span>
            <Link
              href="/market/index"
              className="hover:text-zinc-700 hover:underline dark:hover:text-zinc-300"
            >
              지수 자세히 보기 →
            </Link>
          </p>
        </div>
      )}

      {/* 보유 종목 */}
      {valuation.positions.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            보유 종목
          </h2>
          <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
            {valuation.positions.map((position) => (
              <li key={position.code}>
                <Link
                  href={`/stocks/${position.code}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{position.name}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-zinc-500">
                      {position.quantity}주 · 평단 {formatPrice(Math.round(position.avgPrice))}원
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">
                      {formatPrice(position.value)}원
                    </p>
                    <p className={`mt-0.5 text-xs tabular-nums ${changeColorClass(position.pnl)}`}>
                      {position.pnl >= 0 ? "+" : ""}
                      {formatPrice(position.pnl)} ({formatChangeRate(position.pnlRate)})
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
