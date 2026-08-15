import { seedCandles } from "./seed";
import { getMarketSnapshot } from "./snapshot";
import { searchStockMaster } from "./stock-master";
import type { DailyCandle, MarketDataProvider, Quote } from "./types";

/**
 * 공공데이터포털 — 금융위원회 「주식시세정보」 공급자.
 *
 * https://www.data.go.kr/data/15094808/openapi.do
 *
 * 알아둘 점:
 * - **실시간이 아니다.** 기준일자 기준 다음 영업일 오후에 갱신되는 일별 시세다(T+1).
 *   그래서 "현재가"라고 부르지만 실제로는 가장 최근 영업일의 **종가**다.
 * - 시세는 전부 `getMarketSnapshot()`(전 종목 하루치 1회 페치)에서 나온다.
 *   개별 종목을 API 로 따로 조회하는 건 일봉 차트(`getDailyCandles`)뿐이다.
 * - 검색은 커밋된 시드 마스터를 로컬에서 뒤진다 — API 호출 0회.
 */

const ENDPOINT =
  "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo";

/**
 * 일봉 데이터 캐시 수명(초). 과거 일봉은 사실상 불변이고 최신 하루만 추가되므로
 * 스냅샷(1시간)보다 길게 6시간을 준다. 13시 갱신 직후엔 cron 이 태그로 무효화한다.
 */
const CANDLES_REVALIDATE_SECONDS = 6 * 60 * 60;

interface RawItem {
  basDt: string;
  srtnCd: string;
  mkp: string;
  hipr: string;
  lopr: string;
  clpr: string;
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
    next: { revalidate: CANDLES_REVALIDATE_SECONDS, tags: ["datagokr", "candles"] },
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
    return searchStockMaster(query);
  },

  async getQuote(code) {
    const snapshot = await getMarketSnapshot();
    return snapshot.quotes.get(code) ?? null;
  },

  async getQuotes(codes) {
    const snapshot = await getMarketSnapshot();
    return codes
      .map((code) => snapshot.quotes.get(code))
      .filter((quote): quote is Quote => quote !== undefined);
  },

  async getAllQuotes() {
    const snapshot = await getMarketSnapshot();
    return [...snapshot.quotes.values()];
  },

  async getDailyCandles(code, days) {
    const { beginBasDt, endBasDt } = lookbackRange(days);
    let items: RawItem[];
    try {
      items = await callApi({
        numOfRows: String(Math.ceil(days * 1.6) + 10),
        pageNo: "1",
        likeSrtnCd: code,
        beginBasDt,
        endBasDt,
      });
    } catch (error) {
      // API 장애 시에도 차트가 완전히 비지 않도록 시드의 며칠치로 버틴다.
      console.warn(`[market] 일봉 조회 실패(${code}), 시드 데이터로 대체:`, error);
      return seedCandles(code).slice(-days);
    }

    return items
      .filter((item) => item.srtnCd.trim().slice(-6) === code)
      .map(toCandle)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-days);
  },
};
