"use client";

import { GLOSSARY } from "@/lib/game/glossary";
import { useState } from "react";

/**
 * 용어 도움말 — 점선 밑줄 친 용어를 탭하면 짧은 설명 시트가 뜬다.
 *
 * 사용: <ConceptTip id="avgPrice">평단</ConceptTip>
 * children 을 생략하면 사전의 용어명을 그대로 보여준다.
 */
export default function ConceptTip({
  id,
  children,
}: {
  id: keyof typeof GLOSSARY;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const entry = GLOSSARY[id];
  if (!entry) return <>{children}</>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-help underline decoration-zinc-400 decoration-dotted underline-offset-2"
      >
        {children ?? entry.term}
      </button>

      {open && (
        <span className="fixed inset-0 z-[60] block" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setOpen(false)}
            className="absolute inset-0 block bg-black/40"
          />
          <span className="absolute inset-x-0 bottom-0 mx-auto block max-w-3xl rounded-t-2xl bg-white p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] dark:bg-zinc-900">
            <span className="block text-base font-bold">💡 {entry.term}</span>
            <span className="mt-2 block text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              {entry.description}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-xl border border-zinc-300 py-2.5 text-sm dark:border-zinc-700"
            >
              닫기
            </button>
          </span>
        </span>
      )}
    </>
  );
}
