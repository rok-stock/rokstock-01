"use client";

import { useWatchlist } from "@/hooks/useWatchlist";

/** 종목 상세에서 관심 종목에 담거나 빼는 버튼 */
export default function WatchlistButton({ code }: { code: string }) {
  const { has, add, remove, ready } = useWatchlist();
  const saved = has(code);

  return (
    <button
      type="button"
      disabled={!ready}
      onClick={() => (saved ? remove(code) : add(code))}
      aria-pressed={saved}
      className={`rounded-full border px-4 py-1.5 text-sm transition-colors disabled:opacity-50 ${
        saved
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-300 hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500"
      }`}
    >
      {saved ? "관심 종목 ✓" : "관심 종목 담기"}
    </button>
  );
}
