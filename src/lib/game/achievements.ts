import type { GameState } from "./types";

/**
 * 업적 시스템 — 조건은 전부 게임 상태에서 파생되는 순수 판정.
 *
 * 달성한 업적 id 만 상태(v2 의 `achievements`)에 기록한다. 한 번 달성하면
 * 조건이 다시 깨져도 유지된다 (분산투자 후 일부 매도해도 업적은 남는다).
 */

export interface AchievementDef {
  id: string;
  emoji: string;
  title: string;
  description: string;
  /** 달성 조건 */
  earned(state: GameState): boolean;
}

/** 게임 시작 후 며칠째인지 */
function gameDays(state: GameState): number {
  return Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 86_400_000) + 1;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_buy",
    emoji: "🌱",
    title: "첫 매수",
    description: "첫 주식이 체결됐어요. 주주가 되신 걸 환영합니다!",
    earned: (s) => s.trades.some((t) => t.side === "buy"),
  },
  {
    id: "first_sell",
    emoji: "🤝",
    title: "첫 매도",
    description: "첫 매도 체결 — 실현손익이라는 걸 처음 만났어요.",
    earned: (s) => s.trades.some((t) => t.side === "sell"),
  },
  {
    id: "first_profit",
    emoji: "📈",
    title: "첫 수익 실현",
    description: "수수료와 세금을 내고도 남는 장사를 했어요.",
    earned: (s) => s.trades.some((t) => (t.realizedPnl ?? 0) > 0),
  },
  {
    id: "diversified_5",
    emoji: "🧺",
    title: "계란은 나눠 담기",
    description: "서로 다른 5개 종목을 동시에 보유했어요 — 분산투자의 시작.",
    earned: (s) => s.positions.length >= 5,
  },
  {
    id: "survivor_30",
    emoji: "🗿",
    title: "한 달 생존",
    description: "게임 시작 후 30일이 지났어요. 시장에 오래 머무는 것도 실력입니다.",
    earned: (s) => gameDays(s) >= 30,
  },
  {
    id: "fee_chicken",
    emoji: "🍗",
    title: "수수료로 치킨 한 마리",
    description: "수수료·세금 누적 2만 원 — 거래가 잦으면 증권사(와 나라)만 배부릅니다.",
    earned: (s) => s.trades.reduce((sum, t) => sum + t.fee + t.tax, 0) >= 20_000,
  },
];

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function achievementById(id: string): AchievementDef | undefined {
  return BY_ID.get(id);
}

/**
 * 새로 달성한 업적을 상태에 반영한다. 없으면 상태를 그대로 돌려준다(참조 유지).
 */
export function applyAchievements(state: GameState): {
  state: GameState;
  earned: AchievementDef[];
} {
  const earned = ACHIEVEMENTS.filter(
    (def) => !state.achievements.includes(def.id) && def.earned(state),
  );
  if (earned.length === 0) return { state, earned };
  return {
    earned,
    state: { ...state, achievements: [...state.achievements, ...earned.map((d) => d.id)] },
  };
}
