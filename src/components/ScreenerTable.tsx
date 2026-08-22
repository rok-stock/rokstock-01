"use client";

import {
  changeColorClass,
  formatChangeRate,
  formatKrwCompact,
  formatPrice,
} from "@/lib/market/format";
import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * 스크리너 표 — 서버가 조인해 준 행 배열을 받아 클라이언트에서만 정렬한다.
 * (추가 fetch 없음 — /market/screener/page.tsx 의 ISR 설계 참조)
 *
 * 정렬 규칙: null(지표 없음)은 방향과 무관하게 항상 맨 아래.
 * PER 오름차순 = "저PER 먼저"가 기본 기대라 첫 클릭은 오름차순, 재클릭 시 반전.
 * 시가총액만 첫 클릭이 내림차순(큰 기업 먼저 보는 게 자연스럽다).
 */

export interface ScreenerRow {
  code: string;
  name: string;
  price: number;
  changeRate: number;
  marketCap: number | null;
  per: number | null;
  pbr: number | null;
  dividendYield: number | null;
  /** 최근 순이익 적자 — PER "—" 대신 "적자"로 표시하기 위함 */
  lossMaking: boolean;
}

type SortKey = "marketCap" | "per" | "pbr" | "dividendYield";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; firstDir: SortDir }[] = [
  { key: "marketCap", label: "시가총액", firstDir: "desc" },
  { key: "per", label: "PER", firstDir: "asc" },
  { key: "pbr", label: "PBR", firstDir: "asc" },
  { key: "dividendYield", label: "배당수익률", firstDir: "desc" },
];

const PAGE_SIZE = 50;

export default function ScreenerTable({ rows }: { rows: ScreenerRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("marketCap");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const sorted = useMemo(() => {
    const sign = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va === null && vb === null) return 0;
      if (va === null) return 1; // null 은 항상 맨 아래
      if (vb === null) return -1;
      return (va - vb) * sign;
    });
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(COLUMNS.find((c) => c.key === key)!.firstDir);
    }
    setVisible(PAGE_SIZE); // 정렬을 바꾸면 처음부터 다시 본다
  };

  const shown = sorted.slice(0, visible);
  const arrow = sortDir === "asc" ? "↑" : "↓";

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
              <th className="px-4 py-2.5 font-medium">종목</th>
              <th className="px-3 py-2.5 text-right font-medium">현재가</th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  aria-sort={
                    sortKey === col.key
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  className="px-3 py-2.5 text-right font-medium last:px-4"
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={`whitespace-nowrap hover:text-zinc-800 dark:hover:text-zinc-200 ${
                      sortKey === col.key ? "font-semibold text-zinc-900 dark:text-zinc-50" : ""
                    }`}
                  >
                    {col.label}
                    {sortKey === col.key && <span className="ml-0.5">{arrow}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {shown.map((row) => (
              <tr
                key={row.code}
                className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900"
              >
                <td className="max-w-[10rem] px-4 py-2">
                  <Link href={`/stocks/${row.code}`} className="block truncate hover:underline">
                    {row.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right">
                  {formatPrice(row.price)}
                  <span className={`ml-1.5 text-xs ${changeColorClass(row.changeRate)}`}>
                    {formatChangeRate(row.changeRate)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  {row.marketCap !== null ? formatKrwCompact(row.marketCap) : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {row.per !== null ? row.per.toFixed(1) : row.lossMaking ? "적자" : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {row.pbr !== null ? row.pbr.toFixed(2) : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  {row.dividendYield !== null ? `${row.dividendYield.toFixed(2)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visible < sorted.length && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="mt-3 w-full rounded-xl border border-zinc-300 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          더 보기 ({Math.min(visible + PAGE_SIZE, sorted.length)}/{sorted.length})
        </button>
      )}
    </div>
  );
}
