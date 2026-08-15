/**
 * 시세 도메인 타입.
 *
 * 어떤 데이터 소스(목업/공공데이터포털/증권사 API)를 쓰더라도 화면은 이 타입만 알면 되도록
 * 중간에 한 겹을 둔다. 나중에 KIS API로 갈아끼울 때 화면 코드를 건드리지 않기 위한 장치다.
 */

/** 시장 구분 */
export type Market = "KOSPI" | "KOSDAQ";

/** 종목 기본 정보 */
export interface Stock {
  /** 단축 종목코드 6자리 (예: "005930") */
  code: string;
  /** 종목명 (예: "삼성전자") */
  name: string;
  market: Market;
}

/** 특정 시점의 시세 */
export interface Quote extends Stock {
  /** 현재가(또는 종가). 원 단위 */
  price: number;
  /** 전일 대비 등락액. 원 단위 (음수면 하락) */
  change: number;
  /** 전일 대비 등락률. 퍼센트 값 (예: -1.23 은 -1.23%) */
  changeRate: number;
  /** 거래량 (주) */
  volume: number;
  /** 이 시세의 기준일자 (YYYY-MM-DD) */
  date: string;
}

/**
 * 일봉 하나. 캔들 차트의 막대 하나에 해당한다.
 * 시가로 시작해 장중 고가/저가를 찍고 종가로 끝난다.
 */
export interface DailyCandle {
  /** 기준일자 (YYYY-MM-DD) */
  date: string;
  /** 시가 */
  open: number;
  /** 고가 */
  high: number;
  /** 저가 */
  low: number;
  /** 종가 */
  close: number;
  /** 거래량 */
  volume: number;
}

/** 지수(코스피 등) 일별 시세 한 점 */
export interface IndexPoint {
  /** 기준일자 (YYYY-MM-DD) */
  date: string;
  /** 종가 (지수 포인트) */
  close: number;
  /** 전일 대비 */
  change: number;
  /** 전일 대비 등락률(%) */
  changeRate: number;
}

/**
 * 특정 영업일의 전 종목 시세 묶음.
 * 하루 한 번 갱신되는 데이터라, 이 스냅샷 하나가 시세의 단일 진실 공급원이다.
 */
export interface MarketSnapshot {
  /** 기준 영업일 (YYYY-MM-DD) */
  date: string;
  /** api: 공공데이터포털 실시간 조회 / seed: 커밋된 시드 데이터 (API 실패 시 안전망) */
  source: "api" | "seed";
  /** 종목코드 → 시세 */
  quotes: ReadonlyMap<string, Quote>;
}

/**
 * 시세 공급자 인터페이스.
 * 목업이든 실제 API든 이것만 제공하면 화면이 동작한다.
 */
export interface MarketDataProvider {
  /** 공급자 식별자 (화면/로그에 표시) */
  readonly name: string;
  /** 종목명 또는 종목코드로 검색 */
  searchStocks(query: string): Promise<Stock[]>;
  /** 단일 종목 시세. 없는 종목이면 null */
  getQuote(code: string): Promise<Quote | null>;
  /** 여러 종목 시세 (관심 종목 목록용) */
  getQuotes(codes: string[]): Promise<Quote[]>;
  /** 전 종목 최근 영업일 시세 (등락 랭킹/포트폴리오 평가용) */
  getAllQuotes(): Promise<Quote[]>;
  /** 최근 N일치 일봉 (오래된 날짜부터 오름차순) */
  getDailyCandles(code: string, days: number): Promise<DailyCandle[]>;
}
