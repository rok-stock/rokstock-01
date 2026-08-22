"use client";

import { useWatchlist } from "@/hooks/useWatchlist";
import { formatChangeRate } from "@/lib/market/format";
import type { DailyCandle } from "@/lib/market/types";
import {
  ColorType,
  LineSeries,
  createChart,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * 관심종목 수익률 비교 차트 — 각 종목을 구간 첫 종가 대비 % 변화로 정규화해
 * 같은 축에 겹쳐 그린다. "가격이 다른 종목들을 어떻게 비교하나?"에 대한 답이
 * 정규화(=수익률 지수화)라는 걸 몸으로 익히는 화면.
 *
 * 차트 관례는 CandleChart 를 따른다(다크모드 재생성, autoSize, cleanup, 표 대체).
 * 시리즈 색은 CVD 검증을 통과한 8색 고정 순서 팔레트 — 색은 관심종목 배열
 * 위치(=종목)에 고정되고, 숨김 토글로 순위가 바뀌어도 다시 칠하지 않는다.
 */

/** 8색 고정 순서 카테고리 팔레트 — validate_palette.js 로 라이트(#fff)/다크(#0a0a0a) 서피스 검증 완료 */
const SERIES_COLORS = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
} as const;

/** 팔레트가 8색이라 비교도 8종목까지 — 9번째부터는 색을 새로 만들지 않고 잘라낸다 */
const MAX_SERIES = SERIES_COLORS.light.length;

const PERIODS = [
  { label: "1개월", days: 22 },
  { label: "3개월", days: 66 },
  { label: "6개월", days: 130 },
  { label: "1년", days: 260 },
] as const;

interface CompareSeries {
  code: string;
  name: string;
  /** 구간 첫 종가 대비 % 변화 (첫 값 = 0) */
  points: { date: string; value: number }[];
  /** 구간 수익률 (마지막 값) */
  totalReturn: number;
}

function normalize(candles: DailyCandle[]): CompareSeries["points"] {
  const base = candles[0]?.close;
  if (!base || base <= 0) return [];
  return candles.map((c) => ({ date: c.date, value: ((c.close - base) / base) * 100 }));
}

export default function WatchlistCompareChart() {
  const { codes, ready } = useWatchlist();
  const [days, setDays] = useState<number>(66);
  const [hiddenCodes, setHiddenCodes] = useState<ReadonlySet<string>>(new Set());
  // 마지막으로 완료된 요청의 (키, 결과)를 한 덩어리로 저장한다 — loading/error 는 여기서 파생.
  // (effect 안에서 동기 setState 를 부르지 않기 위한 구조: react-hooks/set-state-in-effect)
  const [loaded, setLoaded] = useState<{
    key: string;
    map: Map<string, { name: string; candles: DailyCandle[] }>;
    error: string | null;
  } | null>(null);

  const chartCodes = useMemo(() => codes.slice(0, MAX_SERIES), [codes]);
  const requestKey = `${chartCodes.join(",")}|${days}`;

  // 일봉 로드 — 기간을 바꾸면 다시 요청한다 (서버 fetch 캐시가 실제 API 호출을 흡수).
  // 새 결과가 오기 전까지는 이전 차트를 그대로 보여준다 (stale-while-loading).
  useEffect(() => {
    if (!ready || chartCodes.length === 0) return;
    const controller = new AbortController();

    fetch(`/api/candles?codes=${chartCodes.join(",")}&days=${days}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "일봉을 불러오지 못했습니다.");
        const map = new Map<string, { name: string; candles: DailyCandle[] }>();
        for (const entry of data.series ?? []) {
          if (Array.isArray(entry.candles) && entry.candles.length > 0) {
            map.set(entry.code, { name: String(entry.name ?? entry.code), candles: entry.candles });
          }
        }
        setLoaded({ key: requestKey, map, error: null });
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setLoaded({ key: requestKey, map: new Map(), error: err.message });
      });

    return () => controller.abort();
  }, [ready, chartCodes, days, requestKey]);

  const loading = ready && chartCodes.length > 0 && loaded === null;
  const error = loaded?.key === requestKey ? loaded.error : null;
  const seriesByCode = loaded?.map ?? new Map<string, { name: string; candles: DailyCandle[] }>();

  const series: CompareSeries[] = useMemo(
    () =>
      chartCodes.flatMap((code) => {
        const entry = seriesByCode.get(code);
        if (!entry) return [];
        const points = normalize(entry.candles);
        if (points.length === 0) return [];
        return [
          { code, name: entry.name, points, totalReturn: points[points.length - 1].value },
        ];
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seriesByCode 는 loaded 에서 파생
    [chartCodes, loaded],
  );

  const visible = series.filter((s) => !hiddenCodes.has(s.code));

  const toggleCode = (code: string) => {
    setHiddenCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  // ---- 차트 렌더 ----
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || visible.length === 0) return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const build = () => {
      const isDark = media.matches;
      const palette = isDark ? SERIES_COLORS.dark : SERIES_COLORS.light;
      const textColor = isDark ? "#a1a1aa" : "#52525b";
      const gridColor = isDark ? "#27272a" : "#f4f4f5";

      const chart = createChart(container, {
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor,
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: gridColor },
          horzLines: { color: gridColor },
        },
        rightPriceScale: { borderColor: gridColor },
        timeScale: { borderColor: gridColor, timeVisible: false },
        crosshair: { mode: 1 },
        localization: { priceFormatter: (v: number) => `${v.toFixed(1)}%` },
        autoSize: true,
      });

      for (const s of visible) {
        // 색은 관심종목 배열 위치에 고정 — 숨김/해제로 보이는 개수가 바뀌어도 유지된다
        const slot = chartCodes.indexOf(s.code) % palette.length;
        const line = chart.addSeries(LineSeries, {
          color: palette[slot],
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        line.setData(s.points.map((p) => ({ time: p.date as Time, value: p.value })));
      }

      chart.timeScale().fitContent();
      chartRef.current = chart;
    };

    build();

    const rebuild = () => {
      chartRef.current?.remove();
      chartRef.current = null;
      build();
    };
    media.addEventListener("change", rebuild);

    return () => {
      media.removeEventListener("change", rebuild);
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [visible, chartCodes]);

  // ---- 상태별 화면 ----

  if (!ready || loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-4 h-72 rounded bg-zinc-100 dark:bg-zinc-900" />
      </div>
    );
  }

  if (chartCodes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-500">비교할 관심 종목이 없어요.</p>
        <p className="mt-2 text-sm text-zinc-400">상단 검색에서 종목을 찾아 ☆ 로 담아보세요.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-zinc-200 p-10 text-center dark:border-zinc-800">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">수익률 비교</h2>
        {/* 기간 선택 */}
        <div className="flex gap-1.5" role="tablist" aria-label="비교 기간">
          {PERIODS.map((p) => {
            const active = days === p.days;
            return (
              <button
                key={p.days}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setDays(p.days)}
                className={`rounded-lg border px-2.5 py-1 text-xs ${
                  active
                    ? "border-zinc-900 bg-zinc-900 font-medium text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-1 text-xs text-zinc-400">
        구간 시작일 종가를 0%로 놓고 각 종목의 변화를 겹쳐 그려요 — 가격대가 달라도 성과를
        비교할 수 있습니다.
      </p>

      {/* 범례 + 종목 토글 — 색·이름·구간 수익률을 함께 보여준다 (색만으로 구분하지 않기) */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {series.map((s) => {
          const slot = chartCodes.indexOf(s.code) % MAX_SERIES;
          const hidden = hiddenCodes.has(s.code);
          return (
            <li key={s.code}>
              <button
                type="button"
                onClick={() => toggleCode(s.code)}
                aria-pressed={!hidden}
                title={hidden ? "다시 표시" : "잠시 숨기기"}
                className={`flex items-center gap-1.5 text-xs ${hidden ? "opacity-35" : ""}`}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full bg-(--dot) dark:bg-(--dot-dark)"
                  style={
                    {
                      "--dot": SERIES_COLORS.light[slot],
                      "--dot-dark": SERIES_COLORS.dark[slot],
                    } as React.CSSProperties
                  }
                />
                <span className="font-medium">{s.name}</span>
                <span className="tabular-nums text-zinc-500">
                  {formatChangeRate(s.totalReturn)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {visible.length > 0 ? (
        <div ref={containerRef} className="mt-3 h-[320px] w-full lg:h-[400px]" />
      ) : (
        <p className="py-16 text-center text-sm text-zinc-400">
          모든 종목을 숨겼어요 — 위에서 다시 켜 보세요.
        </p>
      )}

      {codes.length > MAX_SERIES && (
        <p className="mt-2 text-xs text-zinc-400">
          비교는 관심 종목 앞에서부터 {MAX_SERIES}종목까지만 그려요.
        </p>
      )}
      {chartCodes.length === 1 && (
        <p className="mt-2 text-xs text-zinc-400">
          종목을 하나 더 담으면 서로 비교하는 재미가 생겨요.
        </p>
      )}

      {/* 차트는 canvas 라 화면 낭독기로 읽을 수 없다 — 같은 데이터를 표로도 제공 */}
      {series.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            수익률 표로 보기
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[320px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-3 font-medium">종목</th>
                  <th className="py-2 pr-3 text-right font-medium">구간 수익률</th>
                  <th className="py-2 text-right font-medium">기간</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {series.map((s) => (
                  <tr key={s.code} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-1.5 pr-3">
                      <Link href={`/stocks/${s.code}`} className="hover:underline">
                        {s.name}
                      </Link>
                    </td>
                    <td className="py-1.5 pr-3 text-right">{formatChangeRate(s.totalReturn)}</td>
                    <td className="py-1.5 text-right text-xs text-zinc-500">
                      {s.points[0]?.date} ~ {s.points[s.points.length - 1]?.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
