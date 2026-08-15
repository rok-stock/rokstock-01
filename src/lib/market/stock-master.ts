import { SEED_STOCKS } from "./seed";
import type { Stock } from "./types";

/**
 * 종목 마스터 — KOSPI 전 종목.
 *
 * 예전에는 25종목을 하드코딩했지만, 지금은 `scripts/build-seed.ts` 가 KRX상장종목정보 API
 * 에서 받아 커밋한 시드(`src/data/stock-master.json`)를 쓴다. 검색이 로컬에서 끝나므로
 * **검색에는 API 호출이 한 번도 없다.**
 */

export const STOCK_MASTER: Stock[] = SEED_STOCKS;

const BY_CODE = new Map(STOCK_MASTER.map((s) => [s.code, s]));

export function findStockByCode(code: string): Stock | undefined {
  return BY_CODE.get(code);
}

/** 종목명 부분일치 또는 종목코드 앞자리 일치로 검색 */
export function searchStockMaster(query: string, limit = 10): Stock[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return STOCK_MASTER.filter(
    (s) => s.name.toLowerCase().includes(q) || s.code.startsWith(q),
  ).slice(0, limit);
}
