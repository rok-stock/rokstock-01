import HeaderNav from "@/components/HeaderNav";
import StockSearch from "@/components/StockSearch";
import Link from "next/link";

/**
 * 모든 화면 위에 붙는 헤더 — 홈 링크, 데스크톱 내비, 종목 검색.
 * 데스크톱(lg)은 하단 탭바가 사라지므로 헤더가 내비를 맡고 sticky 로 고정된다.
 * z-30: 탭바/주문바(z-40)와 시트(z-50) 아래.
 */
export default function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 lg:sticky lg:top-0 lg:z-30 lg:bg-white/95 lg:backdrop-blur dark:border-zinc-800 dark:lg:bg-zinc-950/95">
      <div className="container-page flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold tracking-tight hover:opacity-70">
            RokStock
          </Link>
          <HeaderNav />
        </div>
        <StockSearch />
      </div>
    </header>
  );
}
