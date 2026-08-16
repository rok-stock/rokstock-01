/**
 * notes/lib/chart.ts — 노트북에서 재사용하는 미니 SVG 차트 헬퍼.
 *
 * 외부 상태가 없는 순수 함수 3개(line/bar/scatter)만 내보낸다. 좌표 계산(스케일)은
 * `npm:d3`의 scale/shape 서브모듈에 맡기지만, DOM 이 필요한 부분(d3-selection 등)은
 * 전혀 쓰지 않는다 — Deno 커널에는 브라우저 DOM 이 없어서, 대신 SVG를 문자열 템플릿으로
 * 직접 조립한다. d3.line() 같은 shape generator는 DOM 없이도 path 문자열을 돌려주므로
 * 이 방식이 잘 맞는다.
 *
 * Python 비교: matplotlib 이 "그려서 반환"까지 한 번에 해주는 것과 달리, 여기서는
 * "좌표 계산(d3)"과 "그리기(SVG 문자열 조립)"이 분리돼 있다 — d3는 numpy에 가깝고,
 * SVG 조립은 우리가 직접 하는 렌더링 레이어다.
 *
 * 색상은 이 저장소의 기존 관례를 그대로 따른다 — 국내 증시는 상승 빨강 / 하락 파랑
 * (미국 증시와 반대). 출처: src/lib/market/format.ts 의 CANDLE_COLORS.light
 * (Deno 노트북에서 Next.js 서버 전용 모듈을 직접 import 할 수는 없어 값만 옮겨 왔다).
 */
import * as d3 from "npm:d3@7";

export const COLORS = {
  up: "#e11d48", // 상승 — CANDLE_COLORS.light.up
  down: "#2563eb", // 하락 — CANDLE_COLORS.light.down
  neutral: "#71717a", // 보합/중립 (zinc-500)
  axis: "#d4d4d8", // 축선 (zinc-300)
  tick: "#71717a", // 눈금 텍스트 (zinc-500)
  text: "#27272a", // 제목/라벨 (zinc-800)
} as const;

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface BaseOpts {
  width?: number;
  height?: number;
  margin?: Partial<Margin>;
  title?: string;
  xLabel?: string;
  yLabel?: string;
}

const DEFAULT_MARGIN: Margin = { top: 28, right: 20, bottom: 40, left: 64 };

function resolveMargin(m?: Partial<Margin>): Margin {
  return { ...DEFAULT_MARGIN, ...m };
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * scaleLinear/scaleLog 공통 인터페이스 — 눈금 계산에 필요한 부분만 뽑았다.
 * (scaleBand 는 이산값이라 여기 해당 안 됨 — 막대 차트의 x 축은 따로 다룬다)
 */
interface NumericScale {
  (x: number): number;
  ticks(count?: number): number[];
  tickFormat(count?: number, specifier?: string): (n: number) => string;
}

/**
 * 눈금 위치+라벨을 계산한다. `~s` 포맷(SI 접두어: k/M/G)을 기본으로 쓰면
 * d3 가 요청한 개수(count)에 맞춰 정밀도를 알아서 조절해 준다 — 예를 들어 값 범위가
 * 좁으면(3100~3260) "3.1k"/"3.15k"/"3.2k"처럼 소수점까지 살려 겹치는 라벨이 안 나오게,
 * 로그축처럼 눈금이 너무 촘촘하면 일부 라벨을 빈 문자열로 돌려줘 그 눈금 자체를 건너뛰게
 * 한다. "이 눈금을 보여줄 가치가 있는가"(d3 의 `~s` 방식)와 "보여준다면 뭐라고 쓸까"(커스텀
 * 포맷)를 분리했다 — customFormat 을 넘겨도 로그축 눈금 솎아내기는 그대로 살아있다.
 */
function numericTicks(
  scale: NumericScale,
  count: number,
  customFormat?: (n: number) => string,
): { pos: number; label: string }[] {
  const worthLabeling = scale.tickFormat(count, "~s");
  const format = customFormat ?? worthLabeling;
  return scale
    .ticks(count)
    .filter((v) => worthLabeling(v) !== "")
    .map((v) => ({ pos: scale(v), label: format(v) }));
}

/** 프레임(축·제목·라벨)과 플롯 영역 크기를 만든 뒤, 안쪽에 넣을 SVG 마크업을 조립한다. */
function assembleSvg(params: {
  width: number;
  height: number;
  margin: Margin;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  xTicks: { pos: number; label: string }[];
  yTicks: { pos: number; label: string }[];
  plotWidth: number;
  plotHeight: number;
  marks: string;
}): string {
  const { width, height, margin, title, xLabel, yLabel, xTicks, yTicks, plotWidth, plotHeight, marks } = params;

  const xAxis = `
    <line x1="0" y1="${plotHeight}" x2="${plotWidth}" y2="${plotHeight}" stroke="${COLORS.axis}" />
    ${xTicks
      .map(
        (t) => `
      <line x1="${t.pos}" y1="${plotHeight}" x2="${t.pos}" y2="${plotHeight + 5}" stroke="${COLORS.axis}" />
      <text x="${t.pos}" y="${plotHeight + 18}" font-size="10" fill="${COLORS.tick}" text-anchor="middle">${escapeXml(t.label)}</text>`,
      )
      .join("")}
  `;

  const yAxis = `
    <line x1="0" y1="0" x2="0" y2="${plotHeight}" stroke="${COLORS.axis}" />
    ${yTicks
      .map(
        (t) => `
      <line x1="-5" y1="${t.pos}" x2="0" y2="${t.pos}" stroke="${COLORS.axis}" />
      <text x="-9" y="${t.pos + 3}" font-size="10" fill="${COLORS.tick}" text-anchor="end">${escapeXml(t.label)}</text>`,
      )
      .join("")}
  `;

  const titleMark = title
    ? `<text x="${width / 2}" y="16" font-size="13" font-weight="600" fill="${COLORS.text}" text-anchor="middle">${escapeXml(title)}</text>`
    : "";
  const xLabelMark = xLabel
    ? `<text x="${plotWidth / 2}" y="${plotHeight + 34}" font-size="11" fill="${COLORS.tick}" text-anchor="middle">${escapeXml(xLabel)}</text>`
    : "";
  const yLabelMark = yLabel
    ? `<text x="${-plotHeight / 2}" y="${-margin.left + 14}" font-size="11" fill="${COLORS.tick}" text-anchor="middle" transform="rotate(-90)">${escapeXml(yLabel)}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="system-ui, -apple-system, sans-serif">
  ${titleMark}
  <g transform="translate(${margin.left},${margin.top})">
    ${yAxis}
    ${xAxis}
    ${xLabelMark}
    ${yLabelMark}
    ${marks}
  </g>
</svg>`;
}

// ── 라인 차트 ──────────────────────────────────────────────────────────────

export interface LineChartOpts extends BaseOpts {
  color?: string;
  /** x 값을 눈금 라벨로 바꾸는 함수 (예: 일련번호 → 날짜 문자열) */
  xTickFormat?: (x: number) => string;
  yTickFormat?: (y: number) => string;
  xTickCount?: number;
  yTickCount?: number;
}

/** 시계열/추세 라인 차트. points 는 x 오름차순이어야 한다. */
export function renderLineChart(points: { x: number; y: number }[], opts: LineChartOpts = {}): string {
  const width = opts.width ?? 640;
  const height = opts.height ?? 320;
  const margin = resolveMargin(opts.margin);
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const color = opts.color ?? COLORS.down;

  const xExtent = d3.extent(points, (d: { x: number; y: number }) => d.x) as [number, number];
  const yExtent = d3.extent(points, (d: { x: number; y: number }) => d.y) as [number, number];
  const x = d3.scaleLinear().domain(xExtent).range([0, plotWidth]);
  const y = d3.scaleLinear().domain(yExtent).nice().range([plotHeight, 0]);

  const lineGen = d3
    .line<{ x: number; y: number }>()
    .x((d: { x: number; y: number }) => x(d.x))
    .y((d: { x: number; y: number }) => y(d.y));
  const path = lineGen(points) ?? "";

  const xTicks = numericTicks(x, opts.xTickCount ?? 6, opts.xTickFormat);
  const yTicks = numericTicks(y, opts.yTickCount ?? 5, opts.yTickFormat);

  const marks = `<path d="${path}" fill="none" stroke="${color}" stroke-width="2" />`;

  return assembleSvg({
    width,
    height,
    margin,
    title: opts.title,
    xLabel: opts.xLabel,
    yLabel: opts.yLabel,
    xTicks,
    yTicks,
    plotWidth,
    plotHeight,
    marks,
  });
}

// ── 막대 차트 ──────────────────────────────────────────────────────────────

export interface BarChartOpts extends BaseOpts {
  /** 막대별 색을 값에 따라 다르게 주고 싶을 때 (예: 등락 히스토그램의 상승/하락 구간) */
  color?: (bar: { label: string; value: number }, index: number) => string;
  yTickFormat?: (y: number) => string;
  yTickCount?: number;
}

/** 카테고리별 막대 차트 (히스토그램·순위표 등). */
export function renderBarChart(bars: { label: string; value: number }[], opts: BarChartOpts = {}): string {
  const width = opts.width ?? 640;
  const height = opts.height ?? 320;
  const margin = resolveMargin(opts.margin);
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const colorFn = opts.color ?? (() => COLORS.down);

  const x = d3
    .scaleBand()
    .domain(bars.map((b: { label: string; value: number }) => b.label))
    .range([0, plotWidth])
    .padding(0.2);
  const yExtent = d3.extent(bars, (b: { label: string; value: number }) => b.value) as [number, number];
  const y = d3
    .scaleLinear()
    .domain([Math.min(0, yExtent[0]), Math.max(0, yExtent[1])])
    .nice()
    .range([plotHeight, 0]);

  const zeroY = y(0);
  const marks = bars
    .map((b: { label: string; value: number }) => {
      const barX = x(b.label) ?? 0;
      const barY = Math.min(y(b.value), zeroY);
      const barHeight = Math.abs(y(b.value) - zeroY);
      return `<rect x="${barX}" y="${barY}" width="${x.bandwidth()}" height="${barHeight}" fill="${colorFn(b, 0)}" />`;
    })
    .join("");

  const yTicks = numericTicks(y, opts.yTickCount ?? 5, opts.yTickFormat);
  // 막대가 많으면 x축 라벨이 겹치므로 일정 간격으로만 표시한다.
  const xLabelStep = Math.max(1, Math.ceil(bars.length / 12));
  const xTicks = bars
    .filter((_, i) => i % xLabelStep === 0)
    .map((b: { label: string; value: number }) => ({ pos: (x(b.label) ?? 0) + x.bandwidth() / 2, label: b.label }));

  return assembleSvg({
    width,
    height,
    margin,
    title: opts.title,
    xLabel: opts.xLabel,
    yLabel: opts.yLabel,
    xTicks,
    yTicks,
    plotWidth,
    plotHeight,
    marks,
  });
}

// ── 산점도 ────────────────────────────────────────────────────────────────

export interface ScatterChartOpts extends BaseOpts {
  color?: (point: { x: number; y: number; label?: string }, index: number) => string;
  radius?: number;
  /** x 축을 로그 스케일로 (예: 시가총액처럼 값의 폭이 매우 클 때) */
  xLog?: boolean;
  xTickFormat?: (x: number) => string;
  yTickFormat?: (y: number) => string;
  xTickCount?: number;
  yTickCount?: number;
}

/** 두 수치 변수의 관계를 보는 산점도. */
export function renderScatterChart(
  points: { x: number; y: number; label?: string }[],
  opts: ScatterChartOpts = {},
): string {
  const width = opts.width ?? 640;
  const height = opts.height ?? 360;
  const margin = resolveMargin(opts.margin);
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const radius = opts.radius ?? 3;
  const colorFn = opts.color ?? (() => COLORS.down);

  const xExtent = d3.extent(points, (d: { x: number; y: number; label?: string }) => d.x) as [number, number];
  const yExtent = d3.extent(points, (d: { x: number; y: number; label?: string }) => d.y) as [number, number];
  const x = opts.xLog
    ? d3.scaleLog().domain(xExtent).range([0, plotWidth])
    : d3.scaleLinear().domain(xExtent).nice().range([0, plotWidth]);
  const y = d3.scaleLinear().domain(yExtent).nice().range([plotHeight, 0]);

  const marks = points
    .map((p, i) => {
      const tooltip = p.label ? `<title>${escapeXml(p.label)}</title>` : "";
      return `<circle cx="${x(p.x)}" cy="${y(p.y)}" r="${radius}" fill="${colorFn(p, i)}" fill-opacity="0.6">${tooltip}</circle>`;
    })
    .join("");

  // 로그축은 "예쁜" 눈금(1,2,5×10ⁿ)이 십수 개까지 나올 수 있어, count 를 넘긴 tickFormat 이
  // 안 쓸 라벨을 빈 문자열로 돌려주는 걸 numericTicks 가 걸러낸다(로그축 특유의 함정).
  const xTicks = numericTicks(x, opts.xTickCount ?? 6, opts.xTickFormat);
  const yTicks = numericTicks(y, opts.yTickCount ?? 5, opts.yTickFormat);

  return assembleSvg({
    width,
    height,
    margin,
    title: opts.title,
    xLabel: opts.xLabel,
    yLabel: opts.yLabel,
    xTicks,
    yTicks,
    plotWidth,
    plotHeight,
    marks,
  });
}
