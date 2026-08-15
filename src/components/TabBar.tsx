"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 하단 고정 탭 내비게이션 (모바일 앱 스타일).
 *
 * `pb-[env(safe-area-inset-bottom)]` 는 아이폰 홈 인디케이터 영역을 피하기 위한
 * safe-area 대응이다. 레이아웃 body 에 하단 여백(pb-16)을 함께 줘서 콘텐츠가
 * 탭바에 가려지지 않게 한다.
 */

const TABS = [
  {
    href: "/",
    label: "홈",
    // 집 모양
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10.5 12 3l9 7.5M5 9.75V21h5.25v-5.25h3.5V21H19V9.75"
      />
    ),
  },
  {
    href: "/history",
    label: "내역",
    // 목록 모양
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"
      />
    ),
  },
  {
    href: "/settings",
    label: "설정",
    // 슬라이더 모양 (톱니보다 패스가 단순)
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7h9m4 0h3M4 17h3m4 0h9M13 4.5V9.5M7 14.5v5"
      />
    ),
  },
];

export default function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur
                 pb-[env(safe-area-inset-bottom)] dark:border-zinc-800 dark:bg-zinc-950/95"
    >
      <div className="mx-auto flex max-w-3xl">
        {TABS.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
                active
                  ? "text-zinc-900 dark:text-zinc-50"
                  : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={active ? 2 : 1.5}
                className="h-6 w-6"
                aria-hidden
              >
                {tab.icon}
              </svg>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
