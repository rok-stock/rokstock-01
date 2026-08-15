/**
 * 시세 표시 포맷 유틸.
 *
 * 한국 증시 관례: **상승은 빨강, 하락은 파랑**이다.
 * 미국 시장(상승 초록/하락 빨강)과 반대라 헷갈리기 쉬우니 여기서 한 번에 정한다.
 */

const priceFormatter = new Intl.NumberFormat("ko-KR");

/** 42000 → "42,000" */
export function formatPrice(price: number): string {
  return priceFormatter.format(Math.round(price));
}

/** 1234 → "+1,234" / -560 → "-560" / 0 → "0" */
export function formatChange(change: number): string {
  const rounded = Math.round(change);
  if (rounded === 0) return "0";
  const sign = rounded > 0 ? "+" : "-";
  return `${sign}${priceFormatter.format(Math.abs(rounded))}`;
}

/** -1.234 → "-1.23%" / 0 → "0.00%" */
export function formatChangeRate(rate: number): string {
  if (rate === 0) return "0.00%";
  const sign = rate > 0 ? "+" : "-";
  return `${sign}${Math.abs(rate).toFixed(2)}%`;
}

/** 12345678 → "1,235만" (거래량처럼 큰 수를 짧게) */
export function formatVolume(volume: number): string {
  if (volume >= 100_000_000) return `${(volume / 100_000_000).toFixed(1)}억`;
  if (volume >= 10_000) return `${priceFormatter.format(Math.round(volume / 10_000))}만`;
  return priceFormatter.format(volume);
}

/**
 * 재무제표처럼 아주 큰 금액(원)을 짧게 — 200조 6,535억 대신 "200.7조".
 * 음수(적자)도 처리한다.
 */
export function formatKrwCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_0000_0000_0000) return `${sign}${(abs / 1_0000_0000_0000).toFixed(1)}조`;
  if (abs >= 1_0000_0000) return `${sign}${priceFormatter.format(Math.round(abs / 1_0000_0000))}억`;
  if (abs >= 1_0000) return `${sign}${priceFormatter.format(Math.round(abs / 1_0000))}만`;
  return `${sign}${priceFormatter.format(abs)}`;
}

/** 등락에 따른 텍스트 색상 클래스 (상승 빨강 / 하락 파랑 / 보합 회색) */
export function changeColorClass(change: number): string {
  if (change > 0) return "text-red-600 dark:text-red-400";
  if (change < 0) return "text-blue-600 dark:text-blue-400";
  return "text-zinc-500 dark:text-zinc-400";
}

/**
 * 캔들 차트 색상 (한국 관례: 상승 빨강 / 하락 파랑).
 *
 * 차트는 canvas 로 그려져서 CSS 변수를 못 쓴다. 그래서 라이트/다크 각각의 색을 여기서 정한다.
 * 두 조합 모두 색각 이상(CVD) 구분 가능 여부를 검증해 고른 값이다.
 */
export const CANDLE_COLORS = {
  light: { up: "#e11d48", down: "#2563eb" },
  dark: { up: "#f43f5e", down: "#3b82f6" },
} as const;
