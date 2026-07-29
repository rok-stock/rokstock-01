import type { Market, Stock } from "./types";

/**
 * 종목 마스터 (시가총액 상위 위주로 추린 목록).
 *
 * 공공데이터포털 API는 종목명 부분검색을 지원하지만, 목업 공급자에는 검색 대상이 필요하고
 * 실제 공급자에서도 시장 구분(KOSPI/KOSDAQ)을 보완하는 용도로 쓴다.
 */
const RAW: Array<[code: string, name: string, market: Market]> = [
  ["005930", "삼성전자", "KOSPI"],
  ["000660", "SK하이닉스", "KOSPI"],
  ["373220", "LG에너지솔루션", "KOSPI"],
  ["207940", "삼성바이오로직스", "KOSPI"],
  ["005380", "현대차", "KOSPI"],
  ["000270", "기아", "KOSPI"],
  ["068270", "셀트리온", "KOSPI"],
  ["005490", "POSCO홀딩스", "KOSPI"],
  ["035420", "NAVER", "KOSPI"],
  ["035720", "카카오", "KOSPI"],
  ["105560", "KB금융", "KOSPI"],
  ["055550", "신한지주", "KOSPI"],
  ["012330", "현대모비스", "KOSPI"],
  ["051910", "LG화학", "KOSPI"],
  ["006400", "삼성SDI", "KOSPI"],
  ["028260", "삼성물산", "KOSPI"],
  ["015760", "한국전력", "KOSPI"],
  ["032830", "삼성생명", "KOSPI"],
  ["003670", "포스코퓨처엠", "KOSPI"],
  ["247540", "에코프로비엠", "KOSDAQ"],
  ["086520", "에코프로", "KOSDAQ"],
  ["091990", "셀트리온헬스케어", "KOSDAQ"],
  ["196170", "알테오젠", "KOSDAQ"],
  ["066970", "엘앤에프", "KOSDAQ"],
  ["058470", "리노공업", "KOSDAQ"],
];

export const STOCK_MASTER: Stock[] = RAW.map(([code, name, market]) => ({
  code,
  name,
  market,
}));

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
