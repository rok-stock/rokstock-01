import { INITIAL_CASH } from "./rules";

/**
 * 게임 상태 도메인 타입.
 *
 * 전체 상태를 localStorage 의 `rokstock:game` **단일 키**에 저장한다.
 * 매수/매도가 현금·포지션·내역을 한 번에 바꾸므로, 키를 쪼개면 부분 쓰기 실패 시
 * 정합성이 깨진다. 자세한 설계는 docs/game-design.md 4절.
 */

/**
 * 스키마 버전 연혁:
 * - v1: 최초 (계좌/포지션/주문/내역) — 주문은 "다음 거래일 종가"로 미체결 상태를 거쳐 체결
 * - v2: `achievements` 필드 추가 (업적 시스템, G7)
 * - v3: **즉시 체결로 전환** — `pendingOrders`/`lockedCash`/`Position.lockedQuantity` 제거.
 *   매수/매도가 조회 시점 최신 종가로 그 자리에서 체결된다 (docs/game-design.md 2절 개정).
 *   store.ts 의 migrate 가 이전 버전을 승격하며, 남아있던 미체결 주문은 취소 처리(잠긴 현금 반환)한다.
 */
export const GAME_SCHEMA_VERSION = 3;

export type OrderSide = "buy" | "sell";

/** 보유 종목 하나 */
export interface Position {
  code: string;
  /** 표시용 종목명 스냅샷 — 마스터 재조회 없이 목록을 그리기 위함 */
  name: string;
  quantity: number;
  /** 평균 매입 단가 (수수료 미포함) */
  avgPrice: number;
  /** 총 매입금액 — 평단 재계산 시 반올림 오차가 누적되지 않도록 원본을 보관 */
  totalCost: number;
}

/** 체결된 거래 한 건 — 매수/매도 즉시 이 레코드가 만들어진다 */
export interface Trade {
  id: string;
  side: OrderSide;
  code: string;
  name: string;
  quantity: number;
  /** 체결가 = 주문 시점에 조회된 최신 종가 */
  price: number;
  /** 위탁수수료 (원 미만 절사) */
  fee: number;
  /** 농어촌특별세 — 매도만, 매수는 0 */
  tax: number;
  /** 체결가의 기준일 (YYYY-MM-DD) — 실제 시장에서 이 종가가 확정된 날 */
  execDate: string;
  /** 체결 처리 시각 (ISO) — 이 게임에서는 주문 시각과 사실상 같다 */
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
  positions: Position[];
  /** 체결 내역 — 최신이 앞. MAX_TRADES_KEPT 초과분은 절삭 */
  trades: Trade[];
  /** 누적 실현손익 — 내역 절삭에도 보존되는 합계 */
  realizedPnlTotal: number;
  /** 달성한 업적 id 목록 (달성 순서) — v2 에서 추가 */
  achievements: string[];
}

/** 새 게임 상태 */
export function createInitialState(now: Date): GameState {
  return {
    schemaVersion: GAME_SCHEMA_VERSION,
    startedAt: now.toISOString(),
    cash: INITIAL_CASH,
    positions: [],
    trades: [],
    realizedPnlTotal: 0,
    achievements: [],
  };
}
