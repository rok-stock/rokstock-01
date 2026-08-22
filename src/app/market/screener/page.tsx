import ScreenerTable, { type ScreenerRow } from "@/components/ScreenerTable";
import ConceptTip from "@/components/ConceptTip";
import { marketProvider } from "@/lib/market";
import { getCompanyReport } from "@/lib/market/financials";
import { computeValuationMetrics } from "@/lib/market/metrics";
import type { Metadata } from "next";

/**
 * 밸류에이션 스크리너 — 전 종목을 PER/PBR/배당수익률로 정렬해 비교한다.
 *
 * 서버 컴포넌트가 시세 스냅샷과 재무 시드를 조인해(둘 다 캐시/인메모리라 저렴)
 * 완성된 행 배열을 ISR HTML 로 굽고, 정렬은 클라이언트가 받은 배열을
 * 재정렬할 뿐이다 — searchParams 를 쓰면 ISR 이 깨진다 (랭킹 페이지 주석 참조).
 *
 * 우선주는 시총·배당 왜곡 때문에 지표 계산에서 빠지므로(metrics.ts)
 * 여기서도 보통주만 노출한다.
 */

export const revalidate = 3600;

export const metadata: Metadata = { title: "밸류에이션 스크리너 · RokStock" };

export default async function ScreenerPage() {
  const quotes = await marketProvider.getAllQuotes();

  const rows: ScreenerRow[] = [];
  let bizYear: string | null = null;
  for (const quote of quotes) {
    if (!quote.code.endsWith("0")) continue; // 보통주만
    const report = getCompanyReport(quote.code);
    if (!report || report.years.length === 0) continue; // 재무 없는 종목 제외
    const m = computeValuationMetrics(
      { code: quote.code, price: quote.price, marketCap: quote.marketCap },
      report,
    );
    bizYear ??= m.bizYear;
    rows.push({
      code: quote.code,
      name: quote.name,
      price: quote.price,
      changeRate: quote.changeRate,
      marketCap: quote.marketCap ?? null,
      per: m.per,
      pbr: m.pbr,
      dividendYield: m.dividendYield,
      lossMaking: m.lossMaking,
    });
  }

  return (
    <main className="container-page flex-1 px-6 pt-6 pb-10">
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            <ConceptTip id="per">PER</ConceptTip> · <ConceptTip id="pbr">PBR</ConceptTip> ·{" "}
            <ConceptTip id="dividendYield">배당수익률</ConceptTip>로 훑어보기
          </h2>
          <span className="text-xs text-zinc-400">
            보통주 {rows.length}종목 · 재무는 최근 사업연도{bizYear ? `(${bizYear})` : ""} 기준
          </span>
        </div>
        <div className="mt-3">
          <ScreenerTable rows={rows} />
        </div>
        <p className="mt-3 text-xs leading-5 text-zinc-400">
          PER·PBR 이 낮다고 곧 &ldquo;싸다&rdquo;는 뜻은 아니에요 — 이익이 줄고 있거나 업종
          특성일 수 있습니다. 숫자가 눈에 띄면 종목을 눌러 재무 흐름과 기업 개요까지
          확인해 보세요.
        </p>
      </section>
    </main>
  );
}
