import { COMMISSION_RATE, commissionOf, MAX_TRADES_KEPT, sellTaxOf } from "./rules";
import type { GameState, Position, Trade } from "./types";

/**
 * 주문 엔진 — 순수 함수 모음.
 *
 * React/localStorage 를 모르는 순수한 상태 전이 함수들이다. 입력 상태를 바꾸지 않고
 * 새 상태를 반환한다(불변 갱신). 이렇게 분리해 두면 계산 로직을 화면과 무관하게
 * 검증할 수 있다.
 *
 * 매수/매도는 **조회 시점에 화면에 뜬 최신 종가**로 그 자리에서 체결된다 — 시세 자체는
 * 공공데이터 특성상 하루 늦지만(T+1), 그 하루 늦은 가격을 안 다음엔 곧바로 사고판다.
 * 이 게임은 "미래 정보로 과거 가격에 사는" 룩어헤드 편향을 이론적으로는 허용하지만,
 * 캐주얼한 모의투자 게임에 걸맞게 정산 대기 없는 즉시 체결을 택했다 — 트레이드오프는
 * docs/game-design.md 2절과 docs/learning/stock-order-execution.md 참조.
 */

export type OrderError =
  | "invalid_amount" // 금액이 0 이하이거나 정수가 아님
  | "insufficient_cash" // 주문 가능 현금 부족
  | "amount_too_small" // 금액이 1주 가격(+수수료)에도 못 미침
  | "invalid_quantity" // 수량이 0 이하이거나 정수가 아님
  | "insufficient_quantity"; // 보유 수량 부족

export type TradeResult =
  | { ok: true; state: GameState; trade: Trade }
  | { ok: false; reason: OrderError };

export interface BuyInput {
  code: string;
  name: string;
  /** 주문 금액(원) — 수수료 포함 예산. 이 안에서 최대 수량을 산다 */
  amount: number;
  /** 체결가 = 조회 시점의 최신 종가 */
  price: number;
  /** 그 종가의 기준일 (Trade.execDate 로 기록) */
  date: string;
}

export interface SellInput {
  code: string;
  name: string;
  quantity: number;
  price: number;
  date: string;
}

/** 매수 체결 — 금액 예산 안에서 최대 수량을 사고 남은 잔돈은 현금에 그대로 둔다 */
export function buyNow(state: GameState, input: BuyInput, now: Date): TradeResult {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    return { ok: false, reason: "invalid_amount" };
  }
  if (input.amount > state.cash) {
    return { ok: false, reason: "insufficient_cash" };
  }

  const price = input.price;
  let quantity = Math.floor(input.amount / (price * (1 + COMMISSION_RATE)));
  // 부동소수점 경계에서 (매입금 + 수수료)가 예산을 1원 넘을 수 있어 한 번 보정한다
  while (quantity > 0 && quantity * price + commissionOf(quantity * price) > input.amount) {
    quantity -= 1;
  }
  if (quantity <= 0) {
    return { ok: false, reason: "amount_too_small" };
  }

  const cost = quantity * price;
  const fee = commissionOf(cost);
  const spent = cost + fee;

  const existing = state.positions.find((p) => p.code === input.code);
  const positions: Position[] = existing
    ? state.positions.map((p) =>
        p.code === input.code
          ? {
              ...p,
              quantity: p.quantity + quantity,
              totalCost: p.totalCost + cost,
              avgPrice: (p.totalCost + cost) / (p.quantity + quantity),
            }
          : p,
      )
    : [
        ...state.positions,
        { code: input.code, name: input.name, quantity, avgPrice: price, totalCost: cost },
      ];

  const trade: Trade = {
    id: crypto.randomUUID(),
    side: "buy",
    code: input.code,
    name: input.name,
    quantity,
    price,
    fee,
    tax: 0,
    execDate: input.date,
    settledAt: now.toISOString(),
  };

  return {
    ok: true,
    trade,
    state: {
      ...state,
      cash: state.cash - spent,
      positions,
      trades: [trade, ...state.trades].slice(0, MAX_TRADES_KEPT),
    },
  };
}

/** 매도 체결 — 보유 수량을 조회가에 팔고 수수료·세금을 뗀다 */
export function sellNow(state: GameState, input: SellInput, now: Date): TradeResult {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return { ok: false, reason: "invalid_quantity" };
  }
  const position = state.positions.find((p) => p.code === input.code);
  if (!position || input.quantity > position.quantity) {
    return { ok: false, reason: "insufficient_quantity" };
  }

  const price = input.price;
  const gross = input.quantity * price;
  const fee = commissionOf(gross);
  const tax = sellTaxOf(gross);
  const net = gross - fee - tax;
  // 실현손익 = 정산액 - 평단 기준 매입원가 (원 단위 반올림)
  const costBasis = Math.round(input.quantity * position.avgPrice);
  const realizedPnl = net - costBasis;

  const remaining = position.quantity - input.quantity;
  const positions =
    remaining === 0
      ? state.positions.filter((p) => p.code !== input.code)
      : state.positions.map((p) =>
          p.code === input.code
            ? { ...p, quantity: remaining, totalCost: p.totalCost - costBasis }
            : p,
        );

  const trade: Trade = {
    id: crypto.randomUUID(),
    side: "sell",
    code: input.code,
    name: input.name,
    quantity: input.quantity,
    price,
    fee,
    tax,
    execDate: input.date,
    settledAt: now.toISOString(),
    realizedPnl,
  };

  return {
    ok: true,
    trade,
    state: {
      ...state,
      cash: state.cash + net,
      positions,
      realizedPnlTotal: state.realizedPnlTotal + realizedPnl,
      trades: [trade, ...state.trades].slice(0, MAX_TRADES_KEPT),
    },
  };
}
