import { COMMISSION_RATE, commissionOf, MAX_TRADES_KEPT, sellTaxOf } from "./rules";
import type { DailyCandle } from "../market/types";
import type { GameState, PendingOrder, Position, Trade } from "./types";

/**
 * 주문 엔진 — 순수 함수 모음.
 *
 * React/localStorage 를 모르는 순수한 상태 전이 함수들이다. 입력 상태를 바꾸지 않고
 * 새 상태를 반환한다(불변 갱신). 이렇게 분리해 두면 계산 로직을 화면과 무관하게
 * 검증할 수 있고, G4 의 체결 정산(settleOrders)도 같은 자리에 얹는다.
 *
 * 체결 규칙(왜 "다음 거래일 종가"인지)은 docs/game-design.md 2절 참조.
 */

export type OrderError =
  | "invalid_amount" // 금액이 0 이하이거나 정수가 아님
  | "insufficient_cash" // 주문 가능 현금 부족
  | "invalid_quantity" // 수량이 0 이하이거나 정수가 아님
  | "insufficient_quantity" // 주문 가능 수량(보유 - 잠김) 부족
  | "unknown_order"; // 취소하려는 주문이 없음

export type EngineResult =
  | { ok: true; state: GameState; order: PendingOrder }
  | { ok: false; reason: OrderError };

export interface BuyInput {
  code: string;
  name: string;
  /** 주문 금액(원) — 수수료 포함 예산. 체결 시 이 안에서 최대 수량을 산다 */
  amount: number;
  /** 주문 시점의 최신 종가 (예상 표시용) */
  basePrice: number;
  /** 그 종가의 기준일 */
  baseDate: string;
}

export interface SellInput {
  code: string;
  name: string;
  quantity: number;
  basePrice: number;
  baseDate: string;
}

/** 매수 주문 접수 — 금액을 잠근다. 수량은 체결 시(G4) 확정된다 */
export function placeBuy(state: GameState, input: BuyInput, now: Date): EngineResult {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    return { ok: false, reason: "invalid_amount" };
  }
  if (input.amount > state.cash) {
    return { ok: false, reason: "insufficient_cash" };
  }

  const order: PendingOrder = {
    id: crypto.randomUUID(),
    side: "buy",
    code: input.code,
    name: input.name,
    amount: input.amount,
    orderedAt: now.toISOString(),
    baseDate: input.baseDate,
    basePrice: input.basePrice,
  };

  return {
    ok: true,
    order,
    state: {
      ...state,
      cash: state.cash - input.amount,
      lockedCash: state.lockedCash + input.amount,
      pendingOrders: [order, ...state.pendingOrders],
    },
  };
}

/** 매도 주문 접수 — 보유 수량을 잠근다 */
export function placeSell(state: GameState, input: SellInput, now: Date): EngineResult {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return { ok: false, reason: "invalid_quantity" };
  }
  const position = state.positions.find((p) => p.code === input.code);
  const available = position ? position.quantity - position.lockedQuantity : 0;
  if (!position || input.quantity > available) {
    return { ok: false, reason: "insufficient_quantity" };
  }

  const order: PendingOrder = {
    id: crypto.randomUUID(),
    side: "sell",
    code: input.code,
    name: input.name,
    quantity: input.quantity,
    orderedAt: now.toISOString(),
    baseDate: input.baseDate,
    basePrice: input.basePrice,
  };

  return {
    ok: true,
    order,
    state: {
      ...state,
      positions: state.positions.map((p) =>
        p.code === input.code ? { ...p, lockedQuantity: p.lockedQuantity + input.quantity } : p,
      ),
      pendingOrders: [order, ...state.pendingOrders],
    },
  };
}

/** 미체결 주문 취소 — 잠근 금액/수량을 되돌린다 */
export function cancelOrder(state: GameState, orderId: string): EngineResult {
  const order = state.pendingOrders.find((o) => o.id === orderId);
  if (!order) return { ok: false, reason: "unknown_order" };

  const rest = state.pendingOrders.filter((o) => o.id !== orderId);

  if (order.side === "buy") {
    const amount = order.amount ?? 0;
    return {
      ok: true,
      order,
      state: {
        ...state,
        cash: state.cash + amount,
        lockedCash: state.lockedCash - amount,
        pendingOrders: rest,
      },
    };
  }

  const quantity = order.quantity ?? 0;
  return {
    ok: true,
    order,
    state: {
      ...state,
      positions: state.positions.map((p) =>
        p.code === order.code ? { ...p, lockedQuantity: p.lockedQuantity - quantity } : p,
      ),
      pendingOrders: rest,
    },
  };
}

// ---- 체결 정산 ----

export interface SettlementResult {
  state: GameState;
  /** 이번 정산에서 체결된 거래들 (개봉 연출용) */
  fills: Trade[];
  /** 금액이 1주 가격에 못 미쳐 전액 반환된 매수 주문들 */
  refunds: PendingOrder[];
}

/** 일봉 날짜 X의 장 마감 시각 (X 15:30 KST) */
function closeTimeOf(date: string): Date {
  return new Date(`${date}T15:30:00+09:00`);
}

/**
 * 주문을 체결할 일봉 찾기 — 주문 시각 **이후에 마감된** 가장 이른 공개 일봉.
 * 공개된 일봉만 스캔하므로 주말·공휴일은 자동으로 건너뛴다 (달력 불필요).
 */
function findExecCandle(order: PendingOrder, candles: DailyCandle[]): DailyCandle | undefined {
  const orderedAt = new Date(order.orderedAt);
  return candles.find((candle) => closeTimeOf(candle.date) > orderedAt);
}

/** 매수 체결 — 잠근 금액 안에서 최대 수량을 사고 잔돈은 반환한다 */
function fillBuy(
  state: GameState,
  order: PendingOrder,
  candle: DailyCandle,
  now: Date,
): { state: GameState; fill?: Trade; refund?: PendingOrder } {
  const amount = order.amount ?? 0;
  const price = candle.close;
  let quantity = Math.floor(amount / (price * (1 + COMMISSION_RATE)));
  // 부동소수점 경계에서 (매입금 + 수수료)가 예산을 1원 넘을 수 있어 한 번 보정한다
  while (quantity > 0 && quantity * price + commissionOf(quantity * price) > amount) {
    quantity -= 1;
  }

  if (quantity <= 0) {
    // 금액이 1주 가격에도 못 미침 — 전액 반환
    return {
      refund: order,
      state: { ...state, cash: state.cash + amount, lockedCash: state.lockedCash - amount },
    };
  }

  const cost = quantity * price;
  const fee = commissionOf(cost);
  const change = amount - cost - fee; // 잔돈

  const existing = state.positions.find((p) => p.code === order.code);
  const positions: Position[] = existing
    ? state.positions.map((p) =>
        p.code === order.code
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
        {
          code: order.code,
          name: order.name,
          quantity,
          lockedQuantity: 0,
          avgPrice: price,
          totalCost: cost,
        },
      ];

  const fill: Trade = {
    id: order.id,
    side: "buy",
    code: order.code,
    name: order.name,
    quantity,
    price,
    fee,
    tax: 0,
    execDate: candle.date,
    settledAt: now.toISOString(),
  };

  return {
    fill,
    state: {
      ...state,
      cash: state.cash + change,
      lockedCash: state.lockedCash - amount,
      positions,
    },
  };
}

/** 매도 체결 — 잠근 수량을 종가에 팔고 수수료·세금을 뗀다 */
function fillSell(
  state: GameState,
  order: PendingOrder,
  candle: DailyCandle,
  now: Date,
): { state: GameState; fill?: Trade } {
  const quantity = order.quantity ?? 0;
  const position = state.positions.find((p) => p.code === order.code);
  if (!position) return { state }; // 방어적 — 정상 흐름에선 발생하지 않음

  const price = candle.close;
  const gross = quantity * price;
  const fee = commissionOf(gross);
  const tax = sellTaxOf(gross);
  const net = gross - fee - tax;
  // 실현손익 = 정산액 - 평단 기준 매입원가 (원 단위 반올림)
  const costBasis = Math.round(quantity * position.avgPrice);
  const realizedPnl = net - costBasis;

  const remaining = position.quantity - quantity;
  const positions =
    remaining === 0
      ? state.positions.filter((p) => p.code !== order.code)
      : state.positions.map((p) =>
          p.code === order.code
            ? {
                ...p,
                quantity: remaining,
                lockedQuantity: p.lockedQuantity - quantity,
                totalCost: p.totalCost - costBasis,
              }
            : p,
        );

  const fill: Trade = {
    id: order.id,
    side: "sell",
    code: order.code,
    name: order.name,
    quantity,
    price,
    fee,
    tax,
    execDate: candle.date,
    settledAt: now.toISOString(),
    realizedPnl,
  };

  return {
    fill,
    state: {
      ...state,
      cash: state.cash + net,
      positions,
      realizedPnlTotal: state.realizedPnlTotal + realizedPnl,
    },
  };
}

/**
 * 미체결 주문 정산 — 게임의 심장.
 *
 * 각 주문을 "주문 시각 이후 처음 마감된 공개 일봉"의 종가로 체결한다.
 * 아직 그런 일봉이 없는 주문(어제 저녁 주문 등)과 일봉 조회에 실패한 종목의 주문은
 * 그대로 미체결로 남긴다. 여러 번 불려도 안전하다(체결된 주문은 목록에서 빠지므로 멱등).
 */
export function settleOrders(
  state: GameState,
  candlesByCode: ReadonlyMap<string, DailyCandle[]>,
  now: Date,
): SettlementResult {
  const fills: Trade[] = [];
  const refunds: PendingOrder[] = [];
  const stillPending: PendingOrder[] = [];
  // 오래된 주문부터 처리해야 같은 종목의 매수→매도 순서가 자연스럽다
  const ordered = [...state.pendingOrders].reverse();

  let next: GameState = state;
  for (const order of ordered) {
    const candles = candlesByCode.get(order.code);
    const candle = candles ? findExecCandle(order, candles) : undefined;
    if (!candle) {
      stillPending.unshift(order); // 원래 순서(최신 앞) 복원
      continue;
    }

    if (order.side === "buy") {
      const result = fillBuy(next, order, candle, now);
      next = result.state;
      if (result.fill) fills.push(result.fill);
      if (result.refund) refunds.push(result.refund);
    } else {
      const result = fillSell(next, order, candle, now);
      next = result.state;
      if (result.fill) fills.push(result.fill);
    }
  }

  if (fills.length === 0 && refunds.length === 0) {
    return { state, fills, refunds };
  }

  return {
    fills,
    refunds,
    state: {
      ...next,
      pendingOrders: stillPending,
      trades: [...fills].reverse().concat(next.trades).slice(0, MAX_TRADES_KEPT),
    },
  };
}

/**
 * 예상 체결일 (YYYY-MM-DD) — 주문 시각 이후 처음 맞는 "평일 15:30 마감".
 *
 * 공휴일은 알 수 없으므로 주말만 건너뛴다. 실제 체결(G4)은 공개된 일봉을 스캔하므로
 * 공휴일이 껴 있으면 자동으로 그다음 거래일 종가가 된다 — 화면에는
 * "휴장일이면 다음 거래일" 단서를 함께 표시할 것.
 */
export function expectedExecDate(orderedAt: Date): string {
  // KST 로 변환해 UTC 필드로 다룬다 (서버/브라우저 타임존과 무관하게 동작)
  const kst = new Date(orderedAt.getTime() + 9 * 3600_000);
  const isWeekday = kst.getUTCDay() >= 1 && kst.getUTCDay() <= 5;
  const beforeClose =
    kst.getUTCHours() < 15 || (kst.getUTCHours() === 15 && kst.getUTCMinutes() < 30);

  if (!(isWeekday && beforeClose)) {
    // 다음 평일 0시로 이동
    do {
      kst.setUTCDate(kst.getUTCDate() + 1);
    } while (kst.getUTCDay() === 0 || kst.getUTCDay() === 6);
  }
  return kst.toISOString().slice(0, 10);
}
