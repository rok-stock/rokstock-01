import { INITIAL_CASH } from "./rules";

/**
 * 게임 상태 도메인 타입.
 *
 * 전체 상태를 localStorage 의 `rokstock:game` **단일 키**에 저장한다.
 * 체결 정산은 현금·포지션·주문·내역을 한 번에 바꾸므로, 키를 쪼개면 부분 쓰기 실패 시
 * 정합성이 깨진다. 자세한 설계는 docs/game-design.md 4절.
 */

export const GAME_SCHEMA_VERSION = 1;

export type OrderSide = "buy" | "sell";

/** 보유 종목 하나 */
export interface Position {
  code: string;
  /** 표시용 종목명 스냅샷 — 마스터 재조회 없이 목록을 그리기 위함 */
  name: string;
  quantity: number;
  /** 미체결 매도 주문에 잠긴 수량 (추가 매도 불가분) */
  lockedQuantity: number;
  /** 평균 매입 단가 (수수료 미포함) */
  avgPrice: number;
  /** 총 매입금액 — 평단 재계산 시 반올림 오차가 누적되지 않도록 원본을 보관 */
  totalCost: number;
}

/** 접수됐지만 아직 체결되지 않은 주문 */
export interface PendingOrder {
  id: string;
  side: OrderSide;
  code: string;
  name: string;
  /** 매수 주문: 잠근 금액 (수수료 포함). 체결 시 수량이 확정된다 */
  amount?: number;
  /** 매도 주문: 잠근 수량 */
  quantity?: number;
  /** 주문 시각 (ISO) — 체결일 판정 기준 */
  orderedAt: string;
  /** 주문 시점의 최신 종가 기준일 (표시용) */
  baseDate: string;
  /** 주문 시점의 최신 종가 (예상가 표시용 — 체결가가 아니다!) */
  basePrice: number;
}

/** 체결된 거래 한 건 */
export interface Trade {
  id: string;
  side: OrderSide;
  code: string;
  name: string;
  quantity: number;
  /** 체결가 = 체결 기준일의 종가 */
  price: number;
  /** 위탁수수료 (원 미만 절사) */
  fee: number;
  /** 농어촌특별세 — 매도만, 매수는 0 */
  tax: number;
  /** 체결 기준일 (YYYY-MM-DD) */
  execDate: string;
  /** 정산 처리 시각 (ISO) */
  settledAt: string;
  /** 매도 시 실현손익 (수수료·세금 차감 후) */
  realizedPnl?: number;
}

export interface GameState {
  schemaVersion: number;
  /** 게임 시작 시각 (ISO) — 수익률·벤치마크 비교의 기준일 */
  startedAt: string;
  /** 주문 가능 현금 */
  cash: number;
  /** 미체결 매수 주문에 잠긴 금액 */
  lockedCash: number;
  positions: Position[];
  pendingOrders: PendingOrder[];
  /** 체결 내역 — 최신이 앞. MAX_TRADES_KEPT 초과분은 절삭 */
  trades: Trade[];
  /** 누적 실현손익 — 내역 절삭에도 보존되는 합계 */
  realizedPnlTotal: number;
}

/** 새 게임 상태 */
export function createInitialState(now: Date): GameState {
  return {
    schemaVersion: GAME_SCHEMA_VERSION,
    startedAt: now.toISOString(),
    cash: INITIAL_CASH,
    lockedCash: 0,
    positions: [],
    pendingOrders: [],
    trades: [],
    realizedPnlTotal: 0,
  };
}
