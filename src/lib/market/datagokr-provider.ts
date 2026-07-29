import type { DailyCandle, Market, MarketDataProvider, Quote, Stock } from "./types";

/**
 * 공공데이터포털 — 금융위원회 「주식시세정보」 공급자.
 *
 * https://www.data.go.kr/data/15094808/openapi.do
 *
 * 알아둘 점:
 * - **실시간이 아니다.** 기준일자 기준 다음 영업일 오후에 갱신되는 일별 시세다(T+1).
 *   그래서 "현재가"라고 부르지만 실제로는 가장 최근 영업일의 **종가**다.
 * - 응답이 XML/JSON 두 형태이고, 오류일 때는 껍데기가 통째로 달라진다.
 *   그래서 파싱을 한곳(`parseItems`)에 모아두고 실패하면 명확한 에러를 던진다.
 */

const ENDPOINT =
  "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo";

/** 캐시 수명(초). 데이터가 하루 한 번 갱신되므로 1시간이면 충분하다. */
const REVALIDATE_SECONDS = 60 * 60;

/** API 응답의 항목 하나 (필요한 필드만 추림) */
interface RawItem {
  /** 기준일자 YYYYMMDD */
  basDt: string;
  /** 단축 종목코드 */
  srtnCd: string;
  /** 종목명 */
  itmsNm: string;
  /** 시장구분 (KOSPI/KOSDAQ/KONEX) */
  mrktCtg: string;
  /** 종가 */
  clpr: string;
  /** 전일 대비 */
  vs: string;
  /** 등락률(%) */
  fltRt: string;
  /** 시가 */
  mkp: string;
  /** 고가 */
  hipr: string;
  /** 저가 */
  lopr: string;
  /** 거래량 */
  trqu: string;
}

function requireServiceKey(): string {
  const key = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!key) {
    throw new Error(
      "DATA_GO_KR_SERVICE_KEY 환경변수가 없습니다. .env.local 에 공공데이터포털 인증키를 넣어주세요.",
    );
  }
  return key;
}

async function callApi(params: Record<string, string>): Promise<RawItem[]> {
  const url = new URL(ENDPOINT);
  // serviceKey 는 이미 URL 인코딩된 형태로 발급되는 경우가 많아 직접 이어붙인다.
  url.searchParams.set("resultType", "json");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const requestUrl = `${url.toString()}&serviceKey=${requireServiceKey()}`;

  const response = await fetch(requestUrl, {
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`공공데이터포털 응답 오류: HTTP ${response.status}`);
  }

  return parseItems(await response.text());
}

/**
 * 응답 본문에서 항목 배열을 꺼낸다.
 * 정상: `{ response: { header: { resultCode: "00" }, body: { items: { item: [...] } } } }`
 */
function parseItems(body: string): RawItem[] {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    // 인증키 오류 등에서는 JSON 대신 XML 에러 문서가 돌아온다.
    throw new Error(
      `공공데이터포털이 JSON이 아닌 응답을 보냈습니다(인증키 오류일 가능성이 큽니다): ${body.slice(0, 200)}`,
    );
  }

  const response = (payload as { response?: Record<string, unknown> }).response;
  if (!response) {
    throw new Error("공공데이터포털 응답에 response 필드가 없습니다.");
  }

  const header = response.header as { resultCode?: string; resultMsg?: string } | undefined;
  if (header?.resultCode && header.resultCode !== "00") {
    throw new Error(`공공데이터포털 오류(${header.resultCode}): ${header.resultMsg ?? "알 수 없음"}`);
  }

  const items = (response.body as { items?: { item?: unknown } } | undefined)?.items?.item;
  if (!items) return [];
  return (Array.isArray(items) ? items : [items]) as RawItem[];
}

function toNumber(value: string | undefined): number {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** YYYYMMDD → YYYY-MM-DD */
function toIsoDate(basDt: string): string {
  return `${basDt.slice(0, 4)}-${basDt.slice(4, 6)}-${basDt.slice(6, 8)}`;
}

function toMarket(mrktCtg: string): Market {
  return mrktCtg?.toUpperCase() === "KOSDAQ" ? "KOSDAQ" : "KOSPI";
}

function toStock(item: RawItem): Stock {
  return {
    code: item.srtnCd,
    name: item.itmsNm,
    market: toMarket(item.mrktCtg),
  };
}

function toQuote(item: RawItem): Quote {
  return {
    ...toStock(item),
    price: toNumber(item.clpr),
    change: toNumber(item.vs),
    changeRate: toNumber(item.fltRt),
    volume: toNumber(item.trqu),
    date: toIsoDate(item.basDt),
  };
}

function toCandle(item: RawItem): DailyCandle {
  return {
    date: toIsoDate(item.basDt),
    open: toNumber(item.mkp),
    high: toNumber(item.hipr),
    low: toNumber(item.lopr),
    close: toNumber(item.clpr),
    volume: toNumber(item.trqu),
  };
}

function yyyymmdd(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * 최근 며칠을 훑을지 계산한다.
 * 주말·공휴일에는 데이터가 없으므로 넉넉히 뒤로 잡고 최신 것만 취한다.
 */
function lookbackRange(businessDays: number): { beginBasDt: string; endBasDt: string } {
  const end = new Date();
  const begin = new Date();
  begin.setUTCDate(begin.getUTCDate() - Math.ceil(businessDays * 1.6) - 10);
  return { beginBasDt: yyyymmdd(begin), endBasDt: yyyymmdd(end) };
}

export const dataGoKrProvider: MarketDataProvider = {
  name: "datagokr",

  async searchStocks(query) {
    const trimmed = query.trim();
    if (!trimmed) return [];

    // 숫자로만 이뤄졌으면 종목코드, 아니면 종목명으로 본다.
    const isCode = /^\d+$/.test(trimmed);
    const { beginBasDt, endBasDt } = lookbackRange(1);

    const items = await callApi({
      numOfRows: "50",
      pageNo: "1",
      beginBasDt,
      endBasDt,
      ...(isCode ? { likeSrtnCd: trimmed } : { likeItmsNm: trimmed }),
    });

    // 같은 종목이 날짜별로 여러 건 오므로 종목코드 기준으로 중복 제거
    const unique = new Map<string, Stock>();
    for (const item of items) {
      if (!unique.has(item.srtnCd)) unique.set(item.srtnCd, toStock(item));
    }
    return [...unique.values()].slice(0, 10);
  },

  async getQuote(code) {
    const { beginBasDt, endBasDt } = lookbackRange(2);
    const items = await callApi({
      numOfRows: "10",
      pageNo: "1",
      likeSrtnCd: code,
      beginBasDt,
      endBasDt,
    });

    const sorted = items
      .filter((item) => item.srtnCd === code)
      .sort((a, b) => a.basDt.localeCompare(b.basDt));

    const latest = sorted[sorted.length - 1];
    return latest ? toQuote(latest) : null;
  },

  async getQuotes(codes) {
    // 이 API는 종목코드 여러 개를 한 번에 받지 못해 개별 호출한다.
    // 응답은 revalidate 캐시를 타므로 반복 조회 비용은 크지 않다.
    const quotes = await Promise.all(codes.map((code) => this.getQuote(code)));
    return quotes.filter((quote): quote is Quote => quote !== null);
  },

  async getDailyCandles(code, days) {
    const { beginBasDt, endBasDt } = lookbackRange(days);
    const items = await callApi({
      numOfRows: String(Math.ceil(days * 1.6) + 10),
      pageNo: "1",
      likeSrtnCd: code,
      beginBasDt,
      endBasDt,
    });

    return items
      .filter((item) => item.srtnCd === code)
      .map(toCandle)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-days);
  },
};
