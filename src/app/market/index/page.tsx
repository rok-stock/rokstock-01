import ConceptTip from "@/components/ConceptTip";
import IndexChart from "@/components/IndexChart";
import { changeColorClass, formatChangeRate } from "@/lib/market/format";
import { getIndexSeries } from "@/lib/market/index-series";
import type { Metadata } from "next";

/**
 * KOSPI 지수 전용 페이지 — 홈의 벤치마크 카드가 요약만 보여준다면,
 * 여기서는 1년치 흐름을 차트로 본다. "내 수익률이 좋은 건가?"의 기준선을
 * 눈으로 익히는 것이 목적.
 */

export const revalidate = 3600;

export const metadata: Metadata = { title: "KOSPI 지수 · RokStock" };

function formatIndex(value: number): string {
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function IndexPage() {
  const points = await getIndexSeries();
  const latest = points[points.length - 1];
  const first = points[0];

  const yearHigh = points.reduce((max, p) => Math.max(max, p.close), 0);
  const yearLow = points.reduce((min, p) => Math.min(min, p.close), Infinity);
  const yearReturn =
    first && first.close > 0 ? ((latest.close - first.close) / first.close) * 100 : 0;

  return (
    <main className="container-page flex-1 px-6 pt-6 pb-10">
      {/* 요약 카드 */}
      <section className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          <ConceptTip id="kospiIndex">코스피지수</ConceptTip>
        </h2>
        <p className="mt-2 text-3xl font-semibold tabular-nums">
          {formatIndex(latest.close)}
          <span className={`ml-3 text-lg ${changeColorClass(latest.change)}`}>
            {latest.change >= 0 ? "+" : ""}
            {formatIndex(latest.change)} ({formatChangeRate(latest.changeRate)})
          </span>
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-900">
          <div>
            <dt className="text-xs text-zinc-400">1년 수익률</dt>
            <dd className={`mt-0.5 tabular-nums ${changeColorClass(yearReturn)}`}>
              {formatChangeRate(yearReturn)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400">1년 최고</dt>
            <dd className="mt-0.5 tabular-nums">{formatIndex(yearHigh)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400">1년 최저</dt>
            <dd className="mt-0.5 tabular-nums">{formatIndex(yearLow)}</dd>
          </div>
        </dl>
      </section>

      {/* 1년 차트 */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          최근 1년 ({first?.date} ~ {latest.date})
        </h2>
        <IndexChart points={points} />
      </section>

      <p className="mt-4 text-xs leading-5 text-zinc-400">
        지수는 시장 전체의 평균 체온계예요. 내 수익률이 지수보다 낮다면 &ldquo;그냥 지수를
        사는 것&rdquo;(인덱스 투자)이 더 나았다는 뜻 — 홈의 벤치마크 비교가 바로 이 질문에
        답합니다.
      </p>
    </main>
  );
}
