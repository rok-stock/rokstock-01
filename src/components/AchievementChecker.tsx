"use client";

import AchievementModal from "@/components/AchievementModal";
import { useGame } from "@/hooks/useGame";
import type { AchievementDef } from "@/lib/game/achievements";
import { useEffect, useRef, useState } from "react";

/**
 * 시간 경과형 업적("한 달 생존" 등) 점검 — 앱 로드 시 한 번 확인한다.
 *
 * 매수/매도 직후 달성하는 업적(첫 매수, 분산투자 5종목 등)은 그 자리에서 체결되므로
 * `TradePanel` 이 즉시 보여준다. 여기는 "가만히 있다가 시간이 지나 달성하는" 업적만
 * 커버한다 — 매수/매도 없이도 앱을 열면 확인해야 하기 때문.
 */
export default function AchievementChecker() {
  const { ready, refreshAchievements } = useGame();
  const [earned, setEarned] = useState<AchievementDef[]>([]);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!ready || checkedRef.current) return;
    checkedRef.current = true;
    // setTimeout 으로 미뤄 effect 내 동기 setState(연쇄 렌더 유발)를 피한다.
    setTimeout(() => {
      const result = refreshAchievements();
      if (result.length > 0) setEarned(result);
    }, 0);
  }, [ready, refreshAchievements]);

  return <AchievementModal achievements={earned} onClose={() => setEarned([])} />;
}
