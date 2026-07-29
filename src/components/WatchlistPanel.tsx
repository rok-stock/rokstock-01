"use client";

import QuoteRow from "@/components/QuoteRow";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { Quote } from "@/lib/market/types";
import { useEffect, useState } from "react";

/**
 * 관심 종목 시세 목록.
 *
 * 관심 종목은 브라우저(localStorage)에만 있어서 서버가 미리 알 수 없다.
 * 그래서 브라우저에서 목록을 읽은 뒤 `/api/quotes` 로 시세를 물어본다.
 */
export default function WatchlistPanel() {
  const { codes, ready } = useWatchlist();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 관심 종목이 없으면 부를 것도 없다. 화면에서 바로 안내 문구를 띄운다.
    if (!ready || codes.length === 0) return;

    const controller = new AbortController();

    fetch(`/api/quotes?codes=${codes.join(",")}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "시세를 불러오지 못했습니다.");
        setQuotes(data.quotes ?? []);
        setError(null);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [codes, ready]);

  return (
    <section className="w-full">
      <h2 className="mb-2 px-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
        관심 종목
      </h2>

      {!ready ? (
        <p className="px-3 py-6 text-sm text-zinc-500">불러오는 중…</p>
      ) : codes.length === 0 ? (
        <p className="px-3 py-6 text-sm text-zinc-500">
          관심 종목이 없습니다. 위에서 종목을 검색해 담아보세요.
        </p>
      ) : error ? (
        <p className="px-3 py-6 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : loading && quotes.length === 0 ? (
        <p className="px-3 py-6 text-sm text-zinc-500">불러오는 중…</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {quotes.map((quote) => (
            <li key={quote.code}>
              <QuoteRow quote={quote} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
