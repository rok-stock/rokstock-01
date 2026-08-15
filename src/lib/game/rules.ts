/**
 * 게임 규칙 상수 — 수수료·세금·초기 자금.
 *
 * 규칙의 근거와 배경은 docs/game-design.md 3절 참조. 세율이 바뀌면 여기 한 곳만 고친다.
 */

/** 초기 자금 1억 원 */
export const INITIAL_CASH = 100_000_000;

/**
 * 위탁수수료율 0.015% — 매수/매도 각각 부과, 원 미만 절사.
 * 실제 증권사 온라인 수수료의 일반적인 수준을 따랐다.
 */
export const COMMISSION_RATE = 0.00015;

/**
 * 매도 세율 0.15% — 농어촌특별세.
 * 2025년부터 KOSPI 는 증권거래세 0% + 농특세 0.15%다
 * (인하 연혁: 2023년 0.20% → 2024년 0.18% → 2025년 0.15%).
 */
export const SELL_TAX_RATE = 0.0015;

/**
 * 체결 내역 보관 상한. localStorage 용량을 지키기 위한 안전장치로,
 * 오래된 내역을 잘라내도 누적 실현손익(realizedPnlTotal)은 보존된다.
 */
export const MAX_TRADES_KEPT = 500;

/**
 * 수수료/세금 계산 — 정수 연산으로 부동소수점 오차를 피한다.
 * `2_680_000 * 0.00015` 는 401.9999…가 되어 floor 하면 1원이 어긋난다.
 * 금액 × 15 는 정수라 정확하고(2^53 안), 그다음 나눠서 절사한다.
 */
export function commissionOf(amount: number): number {
  return Math.floor((amount * 15) / 100_000); // 0.015%
}

export function sellTaxOf(amount: number): number {
  return Math.floor((amount * 15) / 10_000); // 0.15%
}
