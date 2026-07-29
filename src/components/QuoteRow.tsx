import {
  changeColorClass,
  formatChange,
  formatChangeRate,
  formatPrice,
} from "@/lib/market/format";
import type { Quote } from "@/lib/market/types";
import Link from "next/link";

/** 관심 종목 목록의 한 줄. 종목명 / 현재가 / 등락 */
export default function QuoteRow({ quote }: { quote: Quote }) {
  const color = changeColorClass(quote.change);

  return (
    <Link
      href={`/stocks/${quote.code}`}
      className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{quote.name}</p>
        <p className="text-xs tabular-nums text-zinc-500">
          {quote.code} · {quote.market}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-medium tabular-nums">{formatPrice(quote.price)}</p>
        <p className={`text-xs tabular-nums ${color}`}>
          {formatChange(quote.change)} ({formatChangeRate(quote.changeRate)})
        </p>
      </div>
    </Link>
  );
}
