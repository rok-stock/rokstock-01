"use client";

import type { Stock } from "@/lib/market/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * 종목 검색창 — ARIA 콤보박스 패턴.
 *
 * 입력할 때마다 서버를 때리면 낭비라서, 타이핑이 250ms 멈춘 뒤에 한 번만 호출한다(디바운스).
 * 키보드: ↑/↓ 로 결과 이동, Enter 로 이동(선택 없으면 첫 결과), Esc 로 닫기.
 * 스크린리더에는 aria-activedescendant 로 "지금 짚고 있는 항목"을 알려준다.
 */
export default function StockSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Stock[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const listOpen = open && query.trim().length > 0;

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    // 이전 요청이 늦게 도착해 새 결과를 덮어쓰지 않도록 취소한다
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "검색에 실패했습니다.");
        setResults(data.stocks ?? []);
        setActiveIndex(-1);
        setError(null);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // 바깥을 클릭하면 결과 목록을 닫는다
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <input
        type="search"
        role="combobox"
        aria-expanded={listOpen}
        aria-controls="stock-search-listbox"
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 && results[activeIndex]
            ? `stock-option-${results[activeIndex].code}`
            : undefined
        }
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          // 새로 입력하면 이전 결과를 즉시 비운다.
          // (이벤트 핸들러에서 하는 setState 는 효과 안에서 하는 것과 달리 추가 렌더를 부르지 않는다)
          setResults([]);
          setActiveIndex(-1);
          setError(null);
          setLoading(event.target.value.trim().length > 0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setActiveIndex(-1);
            return;
          }
          if (!listOpen || results.length === 0) return;

          if (event.key === "ArrowDown") {
            event.preventDefault(); // 커서 이동 방지
            setActiveIndex((prev) => (prev + 1) % results.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
          } else if (event.key === "Enter") {
            event.preventDefault();
            // 선택한 항목, 없으면 첫 결과로 이동
            const target = results[activeIndex] ?? results[0];
            setOpen(false);
            setActiveIndex(-1);
            router.push(`/stocks/${target.code}`);
          }
        }}
        placeholder="종목명 또는 종목코드 검색"
        aria-label="종목 검색"
        className="w-full rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-600"
      />

      {listOpen && (
        <div
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          {loading && <p className="px-4 py-3 text-sm text-zinc-500">검색 중…</p>}

          {!loading && error && (
            <p className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {!loading && !error && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-zinc-500">검색 결과가 없습니다.</p>
          )}

          {!loading && !error && results.length > 0 && (
            <ul id="stock-search-listbox" role="listbox" aria-label="종목 검색 결과">
              {results.map((stock, index) => (
                <li
                  key={stock.code}
                  id={`stock-option-${stock.code}`}
                  role="option"
                  aria-selected={index === activeIndex}
                >
                  <Link
                    href={`/stocks/${stock.code}`}
                    onClick={() => setOpen(false)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm ${
                      index === activeIndex
                        ? "bg-zinc-100 dark:bg-zinc-800"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span className="font-medium">{stock.name}</span>
                    <span className="text-xs tabular-nums text-zinc-500">
                      {stock.code} · {stock.market}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
