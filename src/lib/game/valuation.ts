import { INITIAL_CASH } from "./rules";
import type { GameState, Position } from "./types";
import type { Quote } from "../market/types";

/**
 * 포트폴리오 평가 — 순수 함수.
 *
 * 게임 상태(보유 내역)와 시세(스냅샷)를 합쳐 화면이 쓸 파생값을 만든다.
 * 저장하지 않고 매번 계산한다 — 시세가 바뀔 때마다 저장값을 고치는 것보다
 * "원본(상태·시세) + 파생(평가)"을 분리하는 쪽이 버그가 적다.
 */

export interface PositionValuation extends Position {
  /** 최근 종가. 시세를 못 구했으면 null (평가액은 평단가로 대체 계산) */
  price: number | null;
  /** 전일 대비 등락률(%) — 시세 없으면 null */
  changeRate: number | null;
  /** 평가금액 */
  value: number;
  /** 평가손익 = 평가금액 − 매입원가 */
  pnl: number;
  /** 평가손익률(%) — 매입원가 대비 */
  pnlRate: number;
}

export interface PortfolioValuation {
  /** 총자산 = 현금 + 주식 평가금액 */
  totalAssets: number;
  cash: number;
  /** 주식 평가금액 합계 */
  stockValue: number;
  /** 보유 종목 평가손익 합계 (미실현) */
  unrealizedPnl: number;
  /** 게임 전체 손익 = 총자산 − 초기 자금 (실현+미실현+비용 전부 반영된 결과) */
  totalPnl: number;
  /** 게임 전체 수익률(%) — 초기 자금 대비 */
  totalPnlRate: number;
  positions: PositionValuation[];
}

export function evaluatePortfolio(
  state: GameState,
  quotes: ReadonlyMap<string, Quote>,
): PortfolioValuation {
  const positions: PositionValuation[] = state.positions.map((position) => {
    const quote = quotes.get(position.code);
    const price = quote?.price ?? null;
    const value = Math.round((price ?? position.avgPrice) * position.quantity);
    const pnl = value - position.totalCost;
    return {
      ...position,
      price,
      changeRate: quote?.changeRate ?? null,
      value,
      pnl,
      pnlRate: position.totalCost === 0 ? 0 : (pnl / position.totalCost) * 100,
    };
  });

  const stockValue = positions.reduce((sum, p) => sum + p.value, 0);
  const totalAssets = state.cash + stockValue;
  const totalPnl = totalAssets - INITIAL_CASH;

  return {
    totalAssets,
    cash: state.cash,
    stockValue,
    unrealizedPnl: positions.reduce((sum, p) => sum + p.pnl, 0),
    totalPnl,
    totalPnlRate: (totalPnl / INITIAL_CASH) * 100,
    positions,
  };
}
