"use client";

import {
  ensureGameStarted,
  getGameSnapshot,
  getServerGameSnapshot,
  resetGameStore,
  subscribeGame,
} from "@/lib/game/store";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { resetWatchlist } from "./useWatchlist";

/**
 * 게임 상태 훅 — 계좌·포지션·주문·내역 전체를 구독한다.
 *
 * 스토어가 단일 키 하나라 훅도 하나다 (useAccount/usePortfolio 로 쪼개면
 * 원자적 갱신이 어려워지고 복잡도만 는다). 주문/체결 액션은 G3~G4 에서 추가된다.
 *
 * `ready` 가 false 인 동안(서버 렌더·하이드레이션 직후)은 자리 표시자를 그릴 것.
 */
export function useGame() {
  const state = useSyncExternalStore(subscribeGame, getGameSnapshot, getServerGameSnapshot);
  const ready = useSyncExternalStore(
    subscribeGame,
    () => true,
    () => false,
  );

  // 첫 방문이면 게임 개시 — startedAt 을 이 시점에 고정 저장한다
  useEffect(() => {
    ensureGameStarted();
  }, []);

  const resetGame = useCallback((options?: { clearWatchlist?: boolean }) => {
    resetGameStore();
    if (options?.clearWatchlist) resetWatchlist();
  }, []);

  return { state, ready, resetGame };
}
