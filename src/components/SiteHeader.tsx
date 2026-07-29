import StockSearch from "@/components/StockSearch";
import Link from "next/link";

/** 모든 화면 위에 붙는 헤더 — 홈 링크와 종목 검색 */
export default function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          RokStock
        </Link>
        <StockSearch />
      </div>
    </header>
  );
}
