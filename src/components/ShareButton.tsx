"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 기본 공유하기 — 특정 SNS 버튼 대신 **Web Share API**(OS 공유 시트)를 쓴다.
 * 지원하지 않는 브라우저(주로 데스크톱)에서는 문구+링크를 클립보드에 복사한다.
 */

const SHARE_TITLE = "하루 늦은 모의주식";
const SHARE_TEXT = "어제 종가로 사고, 내일 종가에 체결! 1억으로 시작하는 모의투자 게임 🐢";

export default function ShareButton() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const share = async () => {
    const url = window.location.origin;

    if (navigator.share) {
      try {
        await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url });
      } catch {
        // 사용자가 공유 시트를 닫은 경우(AbortError) — 조용히 무시
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(`${SHARE_TEXT}\n${url}`);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      // 클립보드도 막힌 환경 — 버튼이 조용히 실패하는 것보다는 주소를 보여준다
      window.prompt("아래 링크를 복사해 공유하세요", url);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={share}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        📤 친구에게 공유하기
      </button>
      {copied && (
        <span role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
          링크를 복사했어요 ✓
        </span>
      )}
    </div>
  );
}
