import ConceptTip from "@/components/ConceptTip";
import { getCompanyReport } from "@/lib/market/financials";
import { formatKrwCompact, formatPrice } from "@/lib/market/format";

/**
 * 기업 리포트 — "싸 보여서"가 아니라 "알고" 사기 위한 화면.
 *
 * 서버 컴포넌트: 데이터가 시드(연 단위 갱신)라 모든 사용자에게 같고,
 * ISR 페이지에 그대로 캐시되어도 안전하다. 데이터가 없으면 안내만 남긴다.
 */

/** YYYYMMDD → YYYY.MM.DD (이상한 형식은 그대로 노출) */
function formatDate8(raw: string): string {
  return /^\d{8}$/.test(raw) ? `${raw.slice(0, 4)}.${raw.slice(4, 6)}.${raw.slice(6, 8)}` : raw;
}

export default function CompanyReport({
  code,
  marketCap,
  price,
}: {
  code: string;
  marketCap?: number;
  /** 최근 종가 — 배당수익률 계산용 */
  price?: number;
}) {
  const report = getCompanyReport(code);

  if (!report) {
    return (
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">기업 리포트</h2>
        <p className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-400 dark:border-zinc-700">
          이 종목의 기업 정보가 아직 없어요. (시드 데이터 갱신 후 제공됩니다)
        </p>
      </section>
    );
  }

  const latest = report.years[0];
  // 우선주(코드 끝자리 ≠ 0)는 시총·배당이 보통주와 달라 지표가 왜곡된다 — 보통주에서만 계산.
  const isCommon = code.endsWith("0");
  const cap = isCommon ? marketCap : undefined;
  const per = cap && latest && latest.crtmNpf > 0 ? cap / latest.crtmNpf : null;
  const pbr = cap && latest && latest.tcpt > 0 ? cap / latest.tcpt : null;
  const dividend = report.dividend;
  const dividendYield =
    isCommon && dividend && dividend.annualDvdn > 0 && price
      ? (dividend.annualDvdn / price) * 100
      : null;
  const outline = report.outline;

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">기업 리포트</h2>

      {/* 가치평가 지표 */}
      {(per !== null || pbr !== null || dividendYield !== null) && (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-xs text-zinc-400">
              <ConceptTip id="per">PER</ConceptTip>
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {per !== null ? `${per.toFixed(1)}배` : "적자"}
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">{latest?.bizYear}년 순이익 기준</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-xs text-zinc-400">
              <ConceptTip id="pbr">PBR</ConceptTip>
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {pbr !== null ? `${pbr.toFixed(2)}배` : "—"}
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">{latest?.bizYear}년 자본총계 기준</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-xs text-zinc-400">
              <ConceptTip id="dividendYield">배당수익률</ConceptTip>
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {dividendYield !== null ? `${dividendYield.toFixed(2)}%` : "—"}
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">
              {dividendYield !== null && dividend
                ? `주당 ${formatPrice(dividend.annualDvdn)}원 (최근 1년)`
                : "최근 1년 현금배당 없음"}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-xs text-zinc-400">
              <ConceptTip id="parValue">액면가</ConceptTip>
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {dividend && dividend.parValue > 0 ? `${formatPrice(dividend.parValue)}원` : "—"}
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">주가와는 무관한 명목가</p>
          </div>
        </div>
      )}

      {/* 요약 재무 (최근 3개년) */}
      {report.years.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                <th className="px-4 py-2.5 font-medium">연도</th>
                <th className="px-3 py-2.5 text-right font-medium">매출액</th>
                <th className="px-3 py-2.5 text-right font-medium">영업이익</th>
                <th className="px-3 py-2.5 text-right font-medium">순이익</th>
                <th className="px-4 py-2.5 text-right font-medium">자본총계</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {report.years.map((year) => (
                <tr
                  key={year.bizYear}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td className="px-4 py-2">{year.bizYear}</td>
                  <td className="px-3 py-2 text-right">{formatKrwCompact(year.sale)}</td>
                  <td
                    className={`px-3 py-2 text-right ${year.bzopPft < 0 ? "text-blue-600 dark:text-blue-400" : ""}`}
                  >
                    {formatKrwCompact(year.bzopPft)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right ${year.crtmNpf < 0 ? "text-blue-600 dark:text-blue-400" : ""}`}
                  >
                    {formatKrwCompact(year.crtmNpf)}
                  </td>
                  <td className="px-4 py-2 text-right">{formatKrwCompact(year.tcpt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 기업 개요 */}
      {outline && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl border border-zinc-200 p-4 text-sm sm:grid-cols-3 dark:border-zinc-800">
          {outline.ceo && (
            <div>
              <dt className="text-xs text-zinc-400">대표이사</dt>
              <dd className="mt-0.5">{outline.ceo}</dd>
            </div>
          )}
          {outline.estbDt && (
            <div>
              <dt className="text-xs text-zinc-400">설립</dt>
              <dd className="mt-0.5 tabular-nums">{formatDate8(outline.estbDt)}</dd>
            </div>
          )}
          {outline.empeCnt > 0 && (
            <div>
              <dt className="text-xs text-zinc-400">종업원</dt>
              <dd className="mt-0.5 tabular-nums">{formatPrice(outline.empeCnt)}명</dd>
            </div>
          )}
          {outline.avgSlry > 0 && (
            <div>
              <dt className="text-xs text-zinc-400">1인 평균 급여</dt>
              <dd className="mt-0.5 tabular-nums">{formatKrwCompact(outline.avgSlry)}원</dd>
            </div>
          )}
          {outline.auditOpnn && (
            <div>
              <dt className="text-xs text-zinc-400">감사 의견</dt>
              <dd className="mt-0.5">{outline.auditOpnn}</dd>
            </div>
          )}
          {outline.hmpg && (
            <div className="min-w-0">
              <dt className="text-xs text-zinc-400">홈페이지</dt>
              <dd className="mt-0.5 truncate">
                <a
                  href={`https://${outline.hmpg.replace(/^https?:\/\//, "")}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline"
                >
                  {outline.hmpg}
                </a>
              </dd>
            </div>
          )}
        </dl>
      )}

      <p className="mt-2 text-xs leading-5 text-zinc-400">
        출처: 금융위원회 기업재무정보·기업기본정보 (연 단위 갱신). PER/PBR 은 참고 지표일 뿐 —
        숫자가 싸 보이는 데는 이유가 있을 수 있어요.
      </p>
    </section>
  );
}
