import { findStockByCode, searchStockMaster, STOCK_MASTER } from "./stock-master";
import type { DailyCandle, MarketDataProvider, Quote } from "./types";

/**
 * 목업 시세 공급자 — API 키 없이 개발/데모용으로 쓴다.
 *
 * 값은 전부 가짜지만 **결정적(deterministic)** 이다. 같은 종목코드는 항상 같은 시세를 만든다.
 * `Math.random()`을 쓰면 서버 렌더 결과와 클라이언트 렌더 결과가 달라져 하이드레이션이 깨지고,
 * 새로고침할 때마다 차트가 춤춘다. 그래서 종목코드에서 시드를 뽑아 쓰는 의사난수를 쓴다.
 */

/** 종목별 기준 가격 (대략적인 실제 주가대를 흉내낸 값) */
const BASE_PRICE: Record<string, number> = {
  "005930": 74000,
  "000660": 178000,
  "373220": 402000,
  "207940": 782000,
  "005380": 235000,
  "000270": 108000,
  "068270": 189000,
  "005490": 385000,
  "035420": 187000,
  "035720": 45000,
  "105560": 72000,
  "055550": 48000,
  "012330": 232000,
  "051910": 385000,
  "006400": 372000,
  "028260": 142000,
  "015760": 21000,
  "032830": 78000,
  "003670": 285000,
  "247540": 195000,
  "086520": 78000,
  "091990": 68000,
  "196170": 312000,
  "066970": 152000,
  "058470": 168000,
};

const DEFAULT_BASE_PRICE = 50000;

/** 문자열 → 32비트 정수 시드 */
function seedFrom(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32 — 작고 빠른 시드 기반 의사난수 생성기 */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * 오늘부터 거슬러 올라가며 영업일(주말 제외) 날짜를 오래된 순으로 만든다.
 * 공휴일은 반영하지 않는다 — 목업이므로 감안하고 본다.
 */
function recentBusinessDays(count: number): string[] {
  const days: string[] = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);

  while (days.length < count) {
    const dayOfWeek = cursor.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days.push(toDateString(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return days.reverse();
}

/** 호가 단위에 맞춰 반올림 (실제 KRX 호가단위를 단순화한 근사치) */
function roundToTick(price: number): number {
  const tick =
    price >= 500000 ? 1000 : price >= 100000 ? 500 : price >= 50000 ? 100 : price >= 10000 ? 50 : 10;
  return Math.max(tick, Math.round(price / tick) * tick);
}

/**
 * 목업이 보유한 전체 이력 길이(영업일 기준 약 1년).
 *
 * 항상 이 길이로 만든 뒤 뒤에서 잘라 쓴다. 요청한 일수만큼만 만들면
 * 랜덤워크의 시작 구간이 잘려나가, 2일치로 본 현재가와 60일치 차트의 마지막 값이
 * 서로 어긋나 버린다.
 */
const HISTORY_DAYS = 260;

/**
 * 랜덤워크로 일봉을 만든다.
 * 하루하루 종가가 조금씩 오르내리고, 그 안에서 시가/고가/저가를 만들어낸다.
 */
function generateHistory(code: string): DailyCandle[] {
  const random = createRandom(seedFrom(code));
  const dates = recentBusinessDays(HISTORY_DAYS);
  const base = BASE_PRICE[code] ?? DEFAULT_BASE_PRICE;

  // 시작가는 기준가에서 ±15% 안쪽으로 흩어뜨린다
  let close = base * (0.85 + random() * 0.3);
  const candles: DailyCandle[] = [];

  for (const date of dates) {
    const open = close;
    // 일간 변동률 -3% ~ +3%.
    // 순수 랜덤워크만 두면 1년 뒤 주가가 기준가의 3배나 1/3로 튀어버린다.
    // 기준가에서 멀어질수록 되돌아오는 힘을 살짝 섞어 그럴듯한 범위에 머물게 한다.
    const pull = ((base - open) / base) * 0.02;
    const drift = (random() - 0.5) * 0.06 + pull;
    close = open * (1 + drift);

    const spread = Math.abs(drift) + random() * 0.015;
    const high = Math.max(open, close) * (1 + spread * 0.5);
    const low = Math.min(open, close) * (1 - spread * 0.5);

    candles.push({
      date,
      open: roundToTick(open),
      high: roundToTick(high),
      low: roundToTick(low),
      close: roundToTick(close),
      volume: Math.round((0.5 + random()) * 1_000_000),
    });
  }

  return candles;
}

/** 최근 `days` 영업일치 일봉 (오래된 날짜부터 오름차순) */
function generateCandles(code: string, days: number): DailyCandle[] {
  return generateHistory(code).slice(-days);
}

function quoteFromCandles(code: string, candles: DailyCandle[]): Quote | null {
  const stock = findStockByCode(code);
  if (!stock || candles.length === 0) return null;

  const latest = candles[candles.length - 1];
  const previous = candles[candles.length - 2] ?? latest;
  const change = latest.close - previous.close;

  return {
    ...stock,
    price: latest.close,
    change,
    changeRate: previous.close === 0 ? 0 : (change / previous.close) * 100,
    volume: latest.volume,
    date: latest.date,
  };
}

export const mockProvider: MarketDataProvider = {
  name: "mock",

  async searchStocks(query) {
    return searchStockMaster(query);
  },

  async getQuote(code) {
    return quoteFromCandles(code, generateCandles(code, 2));
  },

  async getQuotes(codes) {
    return codes
      .map((code) => quoteFromCandles(code, generateCandles(code, 2)))
      .filter((quote): quote is Quote => quote !== null);
  },

  async getDailyCandles(code, days) {
    if (!findStockByCode(code)) return [];
    return generateCandles(code, days);
  },
};

/** 목업이 알고 있는 전체 종목 (대시보드 기본 관심 종목 등에 사용) */
export const MOCK_STOCKS = STOCK_MASTER;
