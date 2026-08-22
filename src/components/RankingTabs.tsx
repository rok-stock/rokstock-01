"use client";

import {
  changeColorClass,
  formatChangeRate,
  formatPrice,
  formatVolume,
} from "@/lib/market/format";
import type { Quote } from "@/lib/market/types";
import Link from "next/link";
import { useState } from "react";

/**
 * 랭킹 탭 — 서버가 미리 계산한 세 리스트(상승/하락/거래량)를 받아 전환만 한다.
 * 정렬 재계산도, 추가 fetch 도 없다 (page.tsx 의 ISR 설계 참조).
 */

type RankKind = "gainers" | "losers" | "volume";

const KINDS: { key: RankKind; label: string }[] = [
  { key: "gainers", label: "상승률" },
  { key: "losers", label: "하락률" },
  { key: "volume", label: "거래량" },
];

export default function RankingTabs({
  gainers,
  losers,
  byVolume,
}: {
  gainers: Quote[];
  losers: Quote[];
  byVolume: Quote[];
}) {
  const [kind, setKind] = useState<RankKind>("gainers");
  const list = kind === "gainers" ? gainers : kind === "losers" ? losers : byVolume;

  return (
    <div>
      {/* 정렬 기준 토글 */}
      <div className="flex gap-2" role="tablist" aria-label="랭킹 기준">
        {KINDS.map((k) => {
          const active = kind === k.key;
          return (
            <button
              key={k.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setKind(k.key)}
              className={`rounded-lg border px-3 py-1.5 text-xs ${
                active
                  ? "border-zinc-900 bg-zinc-900 font-medium text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {k.label}
            </button>
          );
        })}
      </div>

      <ol className="mt-3 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
        {list.map((quote, i) => (
          <li key={quote.code}>
            <Link
              href={`/stocks/${quote.code}`}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span
                className={`w-7 shrink-0 text-center text-sm font-semibold tabular-nums ${
                  i < 3 ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400"
                }`}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{quote.name}</p>
                <p className="text-xs tabular-nums text-zinc-500">
                  {formatPrice(quote.price)}원
                  {kind === "volume" && (
                    <span className={`ml-2 ${changeColorClass(quote.change)}`}>
                      {formatChangeRate(quote.changeRate)}
                    </span>
                  )}
                </p>
              </div>
              <span
                className={`shrink-0 text-sm font-semibold tabular-nums ${
                  kind === "volume" ? "" : changeColorClass(quote.change)
                }`}
              >
                {kind === "volume"
                  ? `${formatVolume(quote.volume)}주`
                  : formatChangeRate(quote.changeRate)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
