import { cache } from "react";
import { loadSeedIndex } from "./seed";
import type { IndexPoint } from "./types";

/**
 * KOSPI 지수 일별 시계열 — 벤치마크 비교("지수에 묻어뒀다면")의 재료.
 *
 * 지수는 단일 시계열이라 요청 URL 이 사용자와 무관하게 하나다 —
 * 데이터 캐시(1시간 + datagokr 태그) 한 건이 모든 사용자를 감당한다.
 * API 실패/미승인 시 커밋된 시드(`src/data/index-kospi.json`)로 폴백한다.
 */

const ENDPOINT =
  "https://apis.data.go.kr/1160100/service/GetMarketIndexInfoService/getStockMarketIndex";

const REVALIDATE_SECONDS = 60 * 60;

/** 조회 구간(일). 게임 시작일이 이 안에 있으면 정확한 기준점을 잡을 수 있다 */
const WINDOW_DAYS = 400;

interface RawIndexItem {
  basDt: string;
  idxNm: string;
  clpr: string;
  vs: string;
  fltRt: string;
}

function toNumber(value: string | undefined): number {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** KOSPI 지수 시계열 (오래된 날짜부터). React cache 로 요청당 1회 */
export const getIndexSeries = cache(async (): Promise<IndexPoint[]> => {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) return loadSeedIndex();

  const begin = new Date(Date.now() - WINDOW_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  const url = new URL(ENDPOINT);
  url.searchParams.set("resultType", "json");
  url.searchParams.set("idxNm", "코스피");
  url.searchParams.set("beginBasDt", begin);
  url.searchParams.set("numOfRows", "500");
  url.searchParams.set("pageNo", "1");

  try {
    const response = await fetch(`${url.toString()}&serviceKey=${serviceKey}`, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ["datagokr", "index"] },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = JSON.parse(await response.text()) as {
      response?: { body?: { items?: { item?: unknown } } };
    };
    const item = payload.response?.body?.items?.item;
    const items = item ? ((Array.isArray(item) ? item : [item]) as RawIndexItem[]) : [];

    const points = items
      .filter((raw) => raw.idxNm === "코스피")
      .map((raw) => ({
        date: `${raw.basDt.slice(0, 4)}-${raw.basDt.slice(4, 6)}-${raw.basDt.slice(6, 8)}`,
        close: toNumber(raw.clpr),
        change: toNumber(raw.vs),
        changeRate: toNumber(raw.fltRt),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (points.length === 0) throw new Error("지수 데이터 없음");
    return points;
  } catch (error) {
    console.warn("[market] 지수 조회 실패, 시드 데이터로 대체:", error);
    return loadSeedIndex();
  }
});
