import { cache } from "react";
import { loadSeedSnapshot } from "./seed";
import type { MarketSnapshot, Quote } from "./types";

/**
 * KOSPI 전 종목 시세 스냅샷 — 시세의 **단일 진실 공급원**.
 *
 * 공공데이터포털 시세는 하루 한 번(T+1 영업일 13시경) 갱신되는 일별 데이터라,
 * "기준일 하루치 전 종목" 응답 하나면 개별 시세/관심 종목/등락 랭킹이 전부 해결된다.
 * KOSPI 는 1,000종목 미만이라 numOfRows=1000 한 번(안전하게 최대 2페이지)이면 끝 —
 * **API 호출량이 종목 수와 무관해진다.**
 *
 * "오늘 데이터가 아직 없는 13시 이전" 문제는 오늘부터 거꾸로 "데이터가 있는 첫 영업일"을
 * 찾는 것으로 해결한다. 각 날짜별 fetch 는 Next.js 데이터 캐시(1시간 + datagokr 태그)를
 * 타므로, 실제 API 호출은 시간당 몇 번 수준이다. 전부 실패하면 커밋된 시드 스냅샷으로
 * 폴백해 화면이 죽지 않는다.
 */

const ENDPOINT =
  "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo";

/** 데이터 캐시 수명(초). 하루 한 번 갱신되는 데이터라 1시간이면 충분하다 */
const REVALIDATE_SECONDS = 60 * 60;

/** 연휴를 감안해 오늘부터 최대 며칠 거슬러 올라갈지 */
const LOOKBACK_DAYS = 10;

interface RawPriceItem {
  basDt: string;
  srtnCd: string;
  itmsNm: string;
  clpr: string;
  vs: string;
  fltRt: string;
  trqu: string;
  mrktTotAmt: string;
}

function toNumber(value: string | undefined): number {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** KST 기준 오늘부터 거꾸로, 주말을 뺀 날짜 후보 (YYYYMMDD, 최신부터) */
function candidateDates(): string[] {
  const dates: string[] = [];
  const cursor = new Date(Date.now() + 9 * 3600_000);
  cursor.setUTCHours(0, 0, 0, 0);
  while (dates.length < LOOKBACK_DAYS) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push(cursor.toISOString().slice(0, 10).replace(/-/g, ""));
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dates;
}

/** 기준일 하루치 KOSPI 전 종목을 받아온다. 휴장일이면 빈 배열 */
async function fetchDay(basDt: string, serviceKey: string): Promise<RawPriceItem[]> {
  const items: RawPriceItem[] = [];

  for (let pageNo = 1; pageNo <= 2; pageNo += 1) {
    const url = new URL(ENDPOINT);
    url.searchParams.set("resultType", "json");
    url.searchParams.set("basDt", basDt);
    url.searchParams.set("mrktCls", "KOSPI");
    url.searchParams.set("numOfRows", "1000");
    url.searchParams.set("pageNo", String(pageNo));
    // serviceKey 는 이미 URL 인코딩된 형태로 발급되는 경우가 많아 직접 이어붙인다.
    const response = await fetch(`${url.toString()}&serviceKey=${serviceKey}`, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ["datagokr", "snapshot"] },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const body = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      throw new Error(`JSON이 아닌 응답(인증키 오류 가능성): ${body.slice(0, 120)}`);
    }
    const responseBody = (
      payload as { response?: { body?: { items?: { item?: unknown }; totalCount?: number } } }
    ).response?.body;
    const item = responseBody?.items?.item;
    if (item) items.push(...((Array.isArray(item) ? item : [item]) as RawPriceItem[]));

    if (items.length >= Number(responseBody?.totalCount ?? 0)) break;
  }

  return items;
}

/**
 * 최근 영업일의 전 종목 시세 스냅샷.
 * React `cache()` 로 감싸 한 요청 안에서는 몇 번을 불러도 한 번만 조립된다.
 */
export const getMarketSnapshot = cache(async (): Promise<MarketSnapshot> => {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) return loadSeedSnapshot();

  for (const basDt of candidateDates()) {
    let items: RawPriceItem[];
    try {
      items = await fetchDay(basDt, serviceKey);
    } catch (error) {
      // 인증키/네트워크 문제면 다른 날짜도 똑같이 실패한다 — 바로 시드로 폴백.
      console.warn(`[market] 스냅샷 조회 실패(${basDt}), 시드 데이터로 대체:`, error);
      return loadSeedSnapshot();
    }
    if (items.length === 0) continue; // 휴장일 또는 아직 미공개인 오늘

    const date = `${basDt.slice(0, 4)}-${basDt.slice(4, 6)}-${basDt.slice(6, 8)}`;
    const quotes = new Map<string, Quote>();
    for (const item of items) {
      const code = item.srtnCd.trim().slice(-6);
      quotes.set(code, {
        code,
        name: item.itmsNm.trim(),
        market: "KOSPI",
        price: toNumber(item.clpr),
        change: toNumber(item.vs),
        changeRate: toNumber(item.fltRt),
        volume: toNumber(item.trqu),
        marketCap: toNumber(item.mrktTotAmt),
        date,
      });
    }
    return { date, source: "api", quotes };
  }

  console.warn("[market] 최근 영업일 데이터를 찾지 못해 시드 데이터로 대체합니다.");
  return loadSeedSnapshot();
});
