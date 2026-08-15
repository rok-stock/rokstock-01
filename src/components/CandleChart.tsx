"use client";

import { CANDLE_COLORS, formatPrice, formatVolume } from "@/lib/market/format";
import type { DailyCandle } from "@/lib/market/types";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";

/**
 * 일봉 캔들 차트.
 *
 * lightweight-charts 는 canvas 에 직접 그리기 때문에 브라우저에서만 동작한다.
 * 그래서 이 파일은 "use client" 로 클라이언트 컴포넌트가 되어야 한다.
 *
 * 거래량은 **같은 그래프에 두 번째 축으로 겹치지 않고** 아래 별도 영역(pane)에 그린다.
 * 축이 두 개인 차트는 눈금을 어떻게 잡느냐에 따라 없는 상관관계가 보이게 만들 수 있다.
 */
export default function CandleChart({ candles }: { candles: DailyCandle[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // 십자선을 올린 날짜의 시세 — 마우스를 떼면 마지막 봉을 보여준다
  const [hovered, setHovered] = useState<DailyCandle | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || candles.length === 0) return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const build = () => {
      const isDark = media.matches;
      const palette = isDark ? CANDLE_COLORS.dark : CANDLE_COLORS.light;
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
        // 크기는 autoSize 가 컨테이너(h-[450px] lg:h-[560px])를 추종한다
        autoSize: true,
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: palette.up,
        downColor: palette.down,
        borderUpColor: palette.up,
        borderDownColor: palette.down,
        wickUpColor: palette.up,
        wickDownColor: palette.down,
      });
      candleSeries.setData(
        candles.map((candle) => ({
          time: candle.date as Time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        })),
      );

      // 거래량은 아래쪽 별도 pane(paneIndex 1)에 — 가격과 축을 공유하지 않는다
      const volumeSeries = chart.addSeries(
        HistogramSeries,
        { priceFormat: { type: "volume" }, priceLineVisible: false },
        1,
      );
      volumeSeries.setData(
        candles.map((candle) => ({
          time: candle.date as Time,
          value: candle.volume,
          color: candle.close >= candle.open ? palette.up : palette.down,
        })),
      );

      const panes = chart.panes();
      if (panes[1]) panes[1].setHeight(90);

      const byDate = new Map(candles.map((candle) => [candle.date, candle]));
      chart.subscribeCrosshairMove((param) => {
        const date = param.time as string | undefined;
        setHovered(date ? (byDate.get(date) ?? null) : null);
      });

      chart.timeScale().fitContent();
      chartRef.current = chart;
    };

    build();

    // 사용자가 OS 테마를 바꾸면 차트를 다시 만든다 (canvas 라 CSS 로는 못 바꾼다)
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
  }, [candles]);

  if (candles.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        표시할 일봉 데이터가 없습니다.
      </p>
    );
  }

  const shown = hovered ?? candles[candles.length - 1];

  return (
    <div>
      {/* 십자선 위치의 시가/고가/저가/종가 — 값을 직접 읽을 수 있게 한다 */}
      <dl className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="flex gap-1">
          <dt className="text-zinc-400 dark:text-zinc-500">일자</dt>
          <dd className="tabular-nums">{shown.date}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-zinc-400 dark:text-zinc-500">시가</dt>
          <dd className="tabular-nums">{formatPrice(shown.open)}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-zinc-400 dark:text-zinc-500">고가</dt>
          <dd className="tabular-nums">{formatPrice(shown.high)}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-zinc-400 dark:text-zinc-500">저가</dt>
          <dd className="tabular-nums">{formatPrice(shown.low)}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-zinc-400 dark:text-zinc-500">종가</dt>
          <dd className="tabular-nums">{formatPrice(shown.close)}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-zinc-400 dark:text-zinc-500">거래량</dt>
          <dd className="tabular-nums">{formatVolume(shown.volume)}</dd>
        </div>
      </dl>

      <div ref={containerRef} className="h-[450px] w-full lg:h-[560px]" />
    </div>
  );
}
