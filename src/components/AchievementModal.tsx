"use client";

import { useEscapeClose } from "@/hooks/useEscapeClose";
import type { AchievementDef } from "@/lib/game/achievements";
import { useCallback } from "react";
import { createPortal } from "react-dom";

/**
 * "🏅 업적 달성!" 공통 모달.
 *
 * 두 곳에서 쓴다: `TradePanel`(매수/매도 직후 즉석 달성)과 `AchievementChecker`
 * (앱 로드 시 시간 경과형 업적 점검). 포털로 body 에 렌더 — sticky 사이드바 등
 * 스태킹 컨텍스트에 갇히지 않도록 한다(TradePanel 의 주문 시트와 같은 이유).
 */
export default function AchievementModal({
  achievements,
  onClose,
}: {
  achievements: AchievementDef[];
  onClose: () => void;
}) {
  const close = useCallback(() => onClose(), [onClose]);
  useEscapeClose(achievements.length > 0, close);

  if (achievements.length === 0) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 lg:grid lg:place-items-center lg:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="업적 달성"
    >
      <button
        type="button"
        aria-label="닫기"
        onClick={close}
        className="absolute inset-0 bg-black/50"
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl rounded-t-2xl bg-white p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:relative lg:inset-auto lg:w-full lg:max-w-lg lg:rounded-2xl lg:p-6 lg:pb-6 lg:shadow-xl dark:bg-zinc-900">
        <h2 className="text-lg font-bold">🏅 업적 달성!</h2>
        <div className="mt-4 space-y-2">
          {achievements.map((achievement) => (
            <p
              key={achievement.id}
              className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:bg-violet-950 dark:text-violet-200"
            >
              <span className="font-semibold">
                {achievement.emoji} {achievement.title}
              </span>
              <span className="mt-0.5 block text-xs opacity-80">{achievement.description}</span>
            </p>
          ))}
        </div>
        <button
          type="button"
          onClick={close}
          className="mt-4 w-full rounded-xl bg-zinc-900 py-3.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          확인
        </button>
      </div>
    </div>,
    document.body,
  );
}
