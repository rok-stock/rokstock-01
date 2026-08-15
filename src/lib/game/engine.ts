import type { GameState, PendingOrder } from "./types";

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
