import indexJson from "@/data/index-kospi.json";
import snapshotJson from "@/data/market-snapshot.json";
import masterJson from "@/data/stock-master.json";
import type { DailyCandle, IndexPoint, MarketSnapshot, Quote, Stock } from "./types";

/**
 * 시드 데이터 로더.
 *
 * `scripts/build-seed.ts` 가 만들어 커밋한 `src/data/*.json` 을 읽는다.
 * 시드 파일은 용량을 줄이려고 "필드 헤더 + 튜플 행" 형식이라, 여기서 필드 이름으로
 * 인덱스를 찾아 도메인 타입으로 되살린다. (컬럼 순서가 바뀌어도 코드는 안 깨진다)
 *
 * 서버 전용 — 클라이언트 번들에 수백 KB 를 실어 보내지 않도록 서버 컴포넌트/Route Handler
 * 에서만 import 한다.
 */

type Row = (string | number)[];

/** fields 배열에서 각 필드의 튜플 인덱스를 뽑는다 */
function columnIndex(fields: string[]): Record<string, number> {
  return Object.fromEntries(fields.map((field, i) => [field, i]));
}

// ---- 종목 마스터 ----

const masterCol = columnIndex(masterJson.fields);

/** KOSPI 전 종목 (시드 기준) */
export const SEED_STOCKS: Stock[] = (masterJson.rows as Row[]).map((row) => ({
  code: String(row[masterCol.code]),
  name: String(row[masterCol.name]),
  market: "KOSPI",
}));

/** 종목코드 → 법인등록번호(crno). 기업 재무/개황 API(G6)의 조인 키다 */
export const SEED_CRNO_BY_CODE: ReadonlyMap<string, string> = new Map(
  (masterJson.rows as Row[])
    .filter((row) => row[masterCol.crno])
    .map((row) => [String(row[masterCol.code]), String(row[masterCol.crno])]),
);

// ---- 시세 스냅샷 ----

interface SeedDay {
  date: string;
  fields: string[];
  rows: Row[];
}

const seedDays = snapshotJson.days as SeedDay[];

const stockByCode = new Map(SEED_STOCKS.map((stock) => [stock.code, stock]));

function toQuote(day: SeedDay, col: Record<string, number>, row: Row): Quote | null {
  const code = String(row[col.code]);
  const stock = stockByCode.get(code);
  if (!stock) return null;
  return {
    ...stock,
    price: Number(row[col.clpr]),
    change: Number(row[col.vs]),
    changeRate: Number(row[col.fltRt]),
    volume: Number(row[col.trqu]),
    marketCap: Number(row[col.mrktTotAmt]),
    date: day.date,
  };
}

let cachedSeedSnapshot: MarketSnapshot | undefined;

/** 시드의 가장 최근 영업일 시세 스냅샷 (API 실패 시 안전망) */
export function loadSeedSnapshot(): MarketSnapshot {
  if (!cachedSeedSnapshot) {
    const latest = seedDays[seedDays.length - 1];
    const col = columnIndex(latest.fields);
    const quotes = new Map<string, Quote>();
    for (const row of latest.rows) {
      const quote = toQuote(latest, col, row);
      if (quote) quotes.set(quote.code, quote);
    }
    cachedSeedSnapshot = { date: latest.date, source: "seed", quotes };
  }
  return cachedSeedSnapshot;
}

/** 시드에 담긴 며칠치 일봉 (API 실패 시 최소한의 차트용) */
export function seedCandles(code: string): DailyCandle[] {
  const candles: DailyCandle[] = [];
  for (const day of seedDays) {
    const col = columnIndex(day.fields);
    const row = day.rows.find((r) => String(r[col.code]) === code);
    if (!row) continue;
    candles.push({
      date: day.date,
      open: Number(row[col.mkp]),
      high: Number(row[col.hipr]),
      low: Number(row[col.lopr]),
      close: Number(row[col.clpr]),
      volume: Number(row[col.trqu]),
    });
  }
  return candles;
}

/** 시드 최신 종가 (목업 공급자의 기준 가격으로도 쓴다) */
export function seedBasePrice(code: string): number | undefined {
  return loadSeedSnapshot().quotes.get(code)?.price;
}

// ---- KOSPI 지수 ----

const indexCol = columnIndex(indexJson.fields);

let cachedSeedIndex: IndexPoint[] | undefined;

/** KOSPI 지수 일별 시세 (오래된 날짜부터). 벤치마크 비교(G7)용 */
export function loadSeedIndex(): IndexPoint[] {
  if (!cachedSeedIndex) {
    cachedSeedIndex = (indexJson.rows as Row[]).map((row) => ({
      date: String(row[indexCol.date]),
      close: Number(row[indexCol.clpr]),
      change: Number(row[indexCol.vs]),
      changeRate: Number(row[indexCol.fltRt]),
    }));
  }
  return cachedSeedIndex;
}
