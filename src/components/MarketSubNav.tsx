"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * /market 하위 뷰 공용 서브내비 (pill) — 랭킹 / 스크리너 / 지수.
 *
 * TabBar·HeaderNav 가 TABS 배열을 공유하듯 MARKET_TABS 가 단일 소스다.
 * `/market` 자체가 랭킹 페이지라 활성 판정은 정확 일치로 한다
 * (startsWith 를 쓰면 스크리너에서 랭킹까지 같이 켜진다).
 */

const MARKET_TABS = [
  { href: "/market", label: "랭킹" },
  { href: "/market/screener", label: "스크리너" },
  { href: "/market/index", label: "KOSPI 지수" },
];

export default function MarketSubNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="시장 메뉴" className="flex gap-2">
      {MARKET_TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${
              active
                ? "border-zinc-900 bg-zinc-900 font-medium text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
