"use client";

import { applyAchievements, type AchievementDef } from "@/lib/game/achievements";
import { buyNow, sellNow, type BuyInput, type OrderError, type SellInput } from "@/lib/game/engine";
import type { Trade } from "@/lib/game/types";
import {
  ensureGameStarted,
  getGameSnapshot,
  getServerGameSnapshot,
  resetGameStore,
  subscribeGame,
  updateGame,
} from "@/lib/game/store";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { resetWatchlist } from "./useWatchlist";

export type OrderResult =
  | { ok: true; trade: Trade; earned: AchievementDef[] }
  | { ok: false; reason: OrderError };

/**
 * 게임 상태 훅 — 계좌·포지션·내역 전체를 구독한다.
 *
 * 스토어가 단일 키 하나라 훅도 하나다 (useAccount/usePortfolio 로 쪼개면
 * 원자적 갱신이 어려워지고 복잡도만 는다). 매수/매도는 조회 시점 최신가로 즉시 체결되므로
 * (docs/game-design.md 2절), 접수와 정산이 분리돼 있던 예전과 달리 액션 한 번에 끝난다.
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

  const placeBuyOrder = useCallback((input: BuyInput): OrderResult => {
    let result: OrderResult = { ok: false, reason: "invalid_amount" };
    updateGame((current) => {
      const r = buyNow(current, input, new Date());
      if (!r.ok) {
        result = r;
        return current;
      }
      const a = applyAchievements(r.state);
      result = { ok: true, trade: r.trade, earned: a.earned };
      return a.state;
    });
    return result;
  }, []);

  const placeSellOrder = useCallback((input: SellInput): OrderResult => {
    let result: OrderResult = { ok: false, reason: "invalid_quantity" };
    updateGame((current) => {
      const r = sellNow(current, input, new Date());
      if (!r.ok) {
        result = r;
        return current;
      }
      const a = applyAchievements(r.state);
      result = { ok: true, trade: r.trade, earned: a.earned };
      return a.state;
    });
    return result;
  }, []);

  /** 시간 경과형 업적(한 달 생존 등) 점검 — 앱 로드 시 한 번 부른다 */
  const refreshAchievements = useCallback((): AchievementDef[] => {
    // 새 업적이 없으면 쓰기 자체를 생략한다 (매 로드마다 불필요한 저장 방지)
    if (applyAchievements(getGameSnapshot()).earned.length === 0) return [];
    let earned: AchievementDef[] = [];
    updateGame((current) => {
      const a = applyAchievements(current);
      earned = a.earned;
      return a.state;
    });
    return earned;
  }, []);

  return {
    state,
    ready,
    resetGame,
    placeBuyOrder,
    placeSellOrder,
    refreshAchievements,
  };
}
