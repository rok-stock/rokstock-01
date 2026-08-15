/**
 * 공공데이터포털(data.go.kr) 호출 헬퍼 — 시드 생성 스크립트 전용.
 *
 * `src/lib/market/` 와 파싱 로직이 일부 겹치지만 일부러 공유하지 않는다.
 * 런타임 코드는 Next.js fetch 캐시 옵션에 결합되어 있고, 이 스크립트는
 * `node scripts/build-seed.ts` 로 단독 실행되어야 하기 때문이다.
 */

const BASE = "https://apis.data.go.kr/1160100/service";

export function requireServiceKey(): string {
  const key = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!key) {
    throw new Error(
      "DATA_GO_KR_SERVICE_KEY 환경변수가 없습니다. .env.local 에 공공데이터포털 인증키(Decoding 키)를 넣어주세요.",
    );
  }
  return key;
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ApiPage<T> {
  items: T[];
  totalCount: number;
}

/**
 * 인증키 오류 — 해당 API 에 활용신청이 안 됐거나 아직 반영 전(신청 후 최대 1시간)이라는 뜻.
 * 재시도해도 소용없으므로 별도 타입으로 구분해 호출자가 폴백을 결정하게 한다.
 */
export class DataGoKrAuthError extends Error {}

/**
 * 오퍼레이션 1회 호출. 응답 오류(XML 에러 문서, resultCode ≠ 00)를 명확한 예외로 바꾸고,
 * 네트워크 오류는 지수 백오프로 재시도한다. 인증키 오류는 재시도 없이 즉시 던진다.
 */
export async function callApi<T>(
  servicePath: string,
  params: Record<string, string>,
  retries = 3,
): Promise<ApiPage<T>> {
  const url = new URL(`${BASE}/${servicePath}`);
  url.searchParams.set("resultType", "json");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  // serviceKey 는 이미 URL 인코딩된 형태로 발급되는 경우가 많아 직접 이어붙인다.
  const requestUrl = `${url.toString()}&serviceKey=${requireServiceKey()}`;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(requestUrl);
      if (!response.ok) {
        const body = await response.text();
        // 미등록 서비스키 등 인증 계열 오류는 { OpenAPI_ServiceResponse: ... } 형태로 온다.
        if (body.includes("OpenAPI_ServiceResponse")) {
          throw new DataGoKrAuthError(
            `${servicePath}: 서비스키가 이 API 에 등록되지 않았습니다 (활용신청 필요 또는 반영 대기). ${body.slice(0, 150)}`,
          );
        }
        throw new Error(`HTTP ${response.status}`);
      }
      return parsePage<T>(await response.text());
    } catch (error) {
      if (error instanceof DataGoKrAuthError) throw error;
      lastError = error;
      if (attempt < retries) await sleep(500 * 2 ** attempt);
    }
  }
  throw new Error(`공공데이터포털 호출 실패 (${servicePath}): ${String(lastError)}`);
}

function parsePage<T>(body: string): ApiPage<T> {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    // 인증키 오류 등에서는 JSON 대신 XML 에러 문서가 돌아온다.
    throw new Error(`JSON이 아닌 응답(인증키 오류 가능성): ${body.slice(0, 200)}`);
  }

  const response = (payload as { response?: Record<string, unknown> }).response;
  if (!response) throw new Error("응답에 response 필드가 없습니다.");

  const header = response.header as { resultCode?: string; resultMsg?: string } | undefined;
  if (header?.resultCode && header.resultCode !== "00") {
    throw new Error(`오류(${header.resultCode}): ${header.resultMsg ?? "알 수 없음"}`);
  }

  const responseBody = response.body as
    | { items?: { item?: unknown }; totalCount?: number }
    | undefined;
  const items = responseBody?.items?.item;
  return {
    items: items ? ((Array.isArray(items) ? items : [items]) as T[]) : [],
    totalCount: Number(responseBody?.totalCount ?? 0),
  };
}

/**
 * totalCount 를 보고 모든 페이지를 수집한다.
 * 포털 가이드 권고: 서버 부하 방지를 위해 호출 사이에 짧은 지연을 둔다.
 */
export async function fetchAllPages<T>(
  servicePath: string,
  params: Record<string, string>,
  { numOfRows = 1000, maxPages = 10, delayMs = 300 } = {},
): Promise<T[]> {
  const all: T[] = [];
  for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
    const page = await callApi<T>(servicePath, {
      ...params,
      numOfRows: String(numOfRows),
      pageNo: String(pageNo),
    });
    all.push(...page.items);
    if (all.length >= page.totalCount || page.items.length === 0) break;
    await sleep(delayMs);
  }
  return all;
}

// ---- 날짜 유틸 (KST 기준) ----

/** KST 기준 오늘 YYYYMMDD */
export function kstTodayYmd(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10).replace(/-/g, "");
}

export function addDaysYmd(ymd: string, delta: number): string {
  const date = new Date(`${ymdToIso(ymd)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

export function isWeekendYmd(ymd: string): boolean {
  const day = new Date(`${ymdToIso(ymd)}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

/** YYYYMMDD → YYYY-MM-DD */
export function ymdToIso(ymd: string): string {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

/** 오늘부터 거꾸로, 주말을 제외한 최근 날짜 후보 목록 (최신부터) */
export function recentWeekdaysYmd(count: number): string[] {
  const days: string[] = [];
  let cursor = kstTodayYmd();
  while (days.length < count) {
    if (!isWeekendYmd(cursor)) days.push(cursor);
    cursor = addDaysYmd(cursor, -1);
  }
  return days;
}

export function toNumber(value: string | number | undefined): number {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 서비스별로 "A005930" 처럼 접두사가 붙기도 해서 뒤 6자리만 취한다 */
export function normalizeCode(srtnCd: string): string {
  return srtnCd.trim().slice(-6);
}
