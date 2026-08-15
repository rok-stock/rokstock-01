"use client";

import { TABS } from "@/components/TabBar";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 데스크톱 헤더 내비게이션 — 모바일 하단 탭바(TabBar)와 같은 TABS 를 텍스트로 보여준다.
 * lg 미만에서는 숨겨지고 TabBar 가 대신 뜬다 (전환점은 lg 하나로 통일).
 */
export default function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="주요 메뉴 (데스크톱)" className="hidden items-center gap-1 lg:flex">
      {TABS.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              active
                ? "font-semibold text-zinc-900 dark:text-zinc-50"
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
