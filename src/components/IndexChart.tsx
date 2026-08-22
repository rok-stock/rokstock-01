"use client";

import { formatChangeRate } from "@/lib/market/format";
import type { IndexPoint } from "@/lib/market/types";
import {
  AreaSeries,
  ColorType,
  createChart,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";

/**
 * KOSPI 지수 1년 영역 차트 — CandleChart 의 패턴(다크모드 재생성, autoSize,
 * cleanup, 십자선 값 표시, 표 대체)을 그대로 따른다.
 *
 * 지수는 등락 방향이 매일 바뀌는 단일 시계열이라 상승빨강/하락파랑 대신
 * 중립 파랑 한 색으로 그린다 (선 색이 방향을 주장하지 않게).
 */

const LINE_COLORS = {
  light: { line: "#2a78d6", top: "rgba(42, 120, 214, 0.25)", bottom: "rgba(42, 120, 214, 0)" },
  dark: { line: "#3987e5", top: "rgba(57, 135, 229, 0.25)", bottom: "rgba(57, 135, 229, 0)" },
} as const;

function formatIndex(value: number): string {
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function IndexChart({ points }: { points: IndexPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [hovered, setHovered] = useState<IndexPoint | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || points.length === 0) return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const build = () => {
      const isDark = media.matches;
      const palette = isDark ? LINE_COLORS.dark : LINE_COLORS.light;
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
        autoSize: true,
      });

      const series = chart.addSeries(AreaSeries, {
        lineColor: palette.line,
        lineWidth: 2,
        topColor: palette.top,
        bottomColor: palette.bottom,
        priceLineVisible: false,
      });
      series.setData(points.map((p) => ({ time: p.date as Time, value: p.close })));

      const byDate = new Map(points.map((p) => [p.date, p]));
      chart.subscribeCrosshairMove((param) => {
        const date = param.time as string | undefined;
        setHovered(date ? (byDate.get(date) ?? null) : null);
      });

      chart.timeScale().fitContent();
      chartRef.current = chart;
    };

    build();

    // OS 테마 변경 시 차트 재생성 (canvas 라 CSS 로는 못 바꾼다)
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
  }, [points]);

  if (points.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        표시할 지수 데이터가 없습니다.
      </p>
    );
  }

  const shown = hovered ?? points[points.length - 1];

  return (
    <div>
      {/* 십자선 위치의 값 — 차트를 못 읽는 환경을 위한 텍스트 병행 */}
      <dl className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="flex gap-1">
          <dt className="text-zinc-400 dark:text-zinc-500">일자</dt>
          <dd className="tabular-nums">{shown.date}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-zinc-400 dark:text-zinc-500">지수</dt>
          <dd className="tabular-nums">{formatIndex(shown.close)}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-zinc-400 dark:text-zinc-500">등락률</dt>
          <dd className="tabular-nums">{formatChangeRate(shown.changeRate)}</dd>
        </div>
      </dl>

      <div ref={containerRef} className="h-[320px] w-full lg:h-[420px]" />

      {/* 차트는 canvas 라 화면 낭독기로 읽을 수 없다 — 같은 데이터를 표로도 제공 */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          지수 표로 보기
        </summary>
        <div className="mt-3 max-h-80 overflow-y-auto overflow-x-auto">
          <table className="w-full min-w-[360px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-3 font-medium">일자</th>
                <th className="py-2 pr-3 text-right font-medium">지수</th>
                <th className="py-2 text-right font-medium">등락률</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...points].reverse().map((p) => (
                <tr key={p.date} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-1.5 pr-3">{p.date}</td>
                  <td className="py-1.5 pr-3 text-right">{formatIndex(p.close)}</td>
                  <td className="py-1.5 text-right">{formatChangeRate(p.changeRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
