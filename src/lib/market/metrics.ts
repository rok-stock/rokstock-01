import type { CompanyReport } from "./financials";

/**
 * 가치평가 지표 계산 — 순수 함수.
 *
 * PER/PBR/배당수익률 계산과 "우선주 제외" 규칙의 단일 소스다.
 * 종목 상세(CompanyReport)와 스크리너(/market/screener)가 같은 종목에 대해
 * 다른 값을 보여주는 사고를 막기 위해 계산을 한 곳에 모았다.
 * (게임 포트폴리오 평가는 src/lib/game/valuation.ts — 별개 도메인이다)
 */

export interface ValuationMetrics {
  /** PER (배) — 시총 미상·재무 없음·우선주면 null */
  per: number | null;
  /** PBR (배) */
  pbr: number | null;
  /** 배당수익률 (%) */
  dividendYield: number | null;
  /** 최근 순이익이 적자인가 — PER null 의 이유가 "적자"임을 구분해 표시하기 위함 */
  lossMaking: boolean;
  /** 지표의 기준 사업연도 (재무 없으면 null) */
  bizYear: string | null;
}

export interface ValuationInput {
  code: string;
  /** 최근 종가 — 배당수익률 계산용 */
  price?: number;
  marketCap?: number;
}

export function computeValuationMetrics(
  input: ValuationInput,
  report: CompanyReport | null,
): ValuationMetrics {
  const latest = report?.years[0];
  // 우선주(코드 끝자리 ≠ 0)는 시총·배당이 보통주와 달라 지표가 왜곡된다 — 보통주에서만 계산.
  const isCommon = input.code.endsWith("0");
  const cap = isCommon ? input.marketCap : undefined;

  const per = cap && latest && latest.crtmNpf > 0 ? cap / latest.crtmNpf : null;
  const pbr = cap && latest && latest.tcpt > 0 ? cap / latest.tcpt : null;
  const dividend = report?.dividend;
  const dividendYield =
    isCommon && dividend && dividend.annualDvdn > 0 && input.price
      ? (dividend.annualDvdn / input.price) * 100
      : null;

  return {
    per,
    pbr,
    dividendYield,
    lossMaking: latest ? latest.crtmNpf <= 0 : false,
    bizYear: latest?.bizYear ?? null,
  };
}
