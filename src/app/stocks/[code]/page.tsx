import CandleChart from "@/components/CandleChart";
import TradePanel from "@/components/TradePanel";
import WatchlistButton from "@/components/WatchlistButton";
import { marketProvider } from "@/lib/market";
import {
  changeColorClass,
  formatChange,
  formatChangeRate,
  formatPrice,
  formatVolume,
} from "@/lib/market/format";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/** 차트에 그릴 일봉 개수 (영업일 기준 약 3개월) */
const CHART_DAYS = 60;

/**
 * ISR — 렌더 결과를 1시간 캐시하고 백그라운드에서 재생성한다.
 * 시세가 하루 한 번(T+1 13시) 갱신되는 데이터라 이 정도면 충분하고,
 * 13시 직후엔 cron 이 `/api/revalidate` 로 즉시 무효화한다.
 */
export const revalidate = 3600;

/**
 * 940여 종목을 빌드 때 전부 미리 만들 필요는 없다. 빈 배열을 반환하면
 * "방문한 종목만 그때 생성해 ISR 캐시"가 된다 — 이 함수가 아예 없으면
 * 매 요청 동적 렌더링으로 떨어진다는 게 함정. (docs/generate-static-params 참고)
 */
export function generateStaticParams(): Array<{ code: string }> {
  return [];
}

/**
 * 종목 상세.
 *
 * 서버 컴포넌트다. 시세 조회가 서버에서 끝나므로 API 키가 브라우저로 가지 않고,
 * 조회 코드도 클라이언트 번들에 포함되지 않는다.
 *
 * Next.js 16 에서 동적 라우트의 `params` 는 Promise 라 `await` 해야 한다.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const quote = await marketProvider.getQuote(code);
  return { title: quote ? `${quote.name} (${quote.code}) · RokStock` : "종목을 찾을 수 없습니다" };
}

export default async function StockDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const [quote, candles] = await Promise.all([
    marketProvider.getQuote(code),
    marketProvider.getDailyCandles(code, CHART_DAYS),
  ]);

  if (!quote) notFound();

  const color = changeColorClass(quote.change);

  return (
    // pb-28: 하단 고정 매수/매도 바(TradePanel)에 콘텐츠가 가려지지 않도록
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 pt-10 pb-28">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{quote.name}</h1>
          <p className="mt-1 text-sm tabular-nums text-zinc-500">
            {quote.code} · {quote.market} · 기준일 {quote.date}
          </p>
        </div>
        <WatchlistButton code={quote.code} />
      </div>

      <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-4xl font-semibold tabular-nums">{formatPrice(quote.price)}</span>
        <span className="text-sm text-zinc-400">원</span>
        <span className={`text-lg tabular-nums ${color}`}>
          {formatChange(quote.change)} ({formatChangeRate(quote.changeRate)})
        </span>
      </div>

      <p className="mt-1 text-sm text-zinc-500">거래량 {formatVolume(quote.volume)}주</p>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          일봉 차트 (최근 {CHART_DAYS}영업일)
        </h2>
        <CandleChart candles={candles} />
      </section>

      {/* 차트는 canvas 라서 화면 낭독기로 읽을 수 없다. 같은 데이터를 표로도 제공한다. */}
      <details className="mt-8">
        <summary className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          일별 시세 표로 보기
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-3 font-medium">일자</th>
                <th className="py-2 pr-3 text-right font-medium">시가</th>
                <th className="py-2 pr-3 text-right font-medium">고가</th>
                <th className="py-2 pr-3 text-right font-medium">저가</th>
                <th className="py-2 pr-3 text-right font-medium">종가</th>
                <th className="py-2 text-right font-medium">거래량</th>
              </tr>
            </thead>
            <tbody>
              {[...candles].reverse().map((candle) => (
                <tr
                  key={candle.date}
                  className="border-b border-zinc-100 tabular-nums dark:border-zinc-900"
                >
                  <td className="py-1.5 pr-3">{candle.date}</td>
                  <td className="py-1.5 pr-3 text-right">{formatPrice(candle.open)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatPrice(candle.high)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatPrice(candle.low)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatPrice(candle.close)}</td>
                  <td className="py-1.5 text-right">{formatVolume(candle.volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <TradePanel code={quote.code} name={quote.name} price={quote.price} date={quote.date} />
    </main>
  );
}
